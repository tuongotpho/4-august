"""
Script tạo kho mẫu XSLT iTax Viewer cho Báo cáo tài chính và Tờ khai thuế chính
Xuất ra: apps/khaithue/app/src/core/mauItaxBctc.ts

Chạy:
  python scripts/tao-mau-itax-bctc.py
"""
import os
import sys
import re
import json
import zlib
import base64
import hashlib
import html
import xml.etree.ElementTree as ET

sys.stdout.reconfigure(encoding='utf-8')

ITAX_DIR = r"C:\Program Files (x86)\iTax Viewer"
OUT_TS = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "src", "core", "mauItaxBctc.ts"))

TARGET_MA_TKHAI = ['402', '683', '1280', '1281', '842', '864']

def norm_rel(full_path: str) -> str:
    return os.path.relpath(os.path.normpath(full_path), os.path.normpath(ITAX_DIR)).replace('\\', '/').lower()

def local_tag(tag: str) -> str:
    return tag.split('}', 1)[1] if '}' in tag else tag

def child_text(el, name: str) -> str:
    for c in el:
        if local_tag(c.tag) == name:
            return (c.text or '').strip()
    return ''

def split_top_args(arg_str: str):
    args, cur, depth, in_q = [], [], 0, None
    for ch in arg_str:
        if in_q:
            cur.append(ch)
            if ch == in_q:
                in_q = None
        else:
            if ch in ("'", '"'):
                in_q = ch
                cur.append(ch)
            elif ch == '(':
                depth += 1
                cur.append(ch)
            elif ch == ')':
                depth -= 1
                cur.append(ch)
            elif ch == ',' and depth == 0:
                args.append(''.join(cur).strip())
                cur = []
            else:
                cur.append(ch)
    if cur:
        args.append(''.join(cur).strip())
    return args

def quote_xpath_attr(expr: str) -> str:
    if '"' not in expr:
        return f'"{expr}"'
    if "'" not in expr:
        return f"'{expr}'"
    return '"' + expr.replace('"', '&quot;') + '"'

def rewrite_xslt(raw_txt: str, cur_path: str) -> str:
    txt = raw_txt.lstrip('\ufeff')
    txt = re.sub(r'<\?xml[^>]*\?>', '', txt, count=1).strip()
    # Bỏ khối <msxsl:script>
    txt = re.sub(r'<msxsl:script\b[\s\S]*?</msxsl:script>', '', txt)

    # Sửa lỗi đóng thẻ </div> đặt nhầm sau </table>
    txt = re.sub(
        r'(<div class="ghichu">\s*<div><i>[^<]*</i></div>\s*<div id="sigDiv"></div>)\s*(</td>\s*</tr>\s*</table>)\s*</div>',
        r'\1</div>\n\2',
        txt
    )
    # Sửa select="" rỗng
    txt = re.sub(r'(<xsl:(?:variable|param)\b[^>]*?\bselect\s*=\s*)""', r'\1"\'\'"', txt)

    # Thay <xsl:value-of select="ihtkk:fn(...)" /> thành <span data-ih="fn"><i data-a="0">...</i></span>
    def repl_vo(m):
        fn = m.group(2)
        args = split_top_args(m.group(3))
        inner = ''.join(f'<i data-a="{i}"><xsl:value-of select={quote_xpath_attr(a)}/></i>' for i, a in enumerate(args))
        return f'<span data-ih="{fn}">{inner}</span>'

    txt = re.sub(
        r'<xsl:value-of\b[^>]*?\bselect\s*=\s*(["\'])\s*(?:ihtkk|kdtxslt):([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\)\s*\1[^>]*(?:/>|>\s*</xsl:value-of>)',
        repl_vo,
        txt
    )

    # Thay các lệnh gọi ihtkk:stringDatetime(...) trong biểu thức XPath
    def repl_dt_xpath(m):
        expr = m.group(1).strip()
        fmt = m.group(2).strip()
        if fmt == 'yyyy':
            return f"concat(substring({expr},7,4*number(contains({expr},'/'))),substring({expr},1,4*number(contains({expr},'-'))))"
        if fmt == 'mm':
            return f"concat(substring({expr},4,2*number(contains({expr},'/'))),substring({expr},6,2*number(contains({expr},'-'))))"
        if fmt == 'dd':
            return f"concat(substring({expr},1,2*number(contains({expr},'/'))),substring({expr},9,2*number(contains({expr},'-'))))"
        if fmt == 'dd/mm/yyyy':
            return (
                f"concat(substring({expr},1,10*number(contains({expr},'/'))),"
                f"substring({expr},9,2*number(contains({expr},'-'))),substring('/',1,number(contains({expr},'-'))),"
                f"substring({expr},6,2*number(contains({expr},'-'))),substring('/',1,number(contains({expr},'-'))),"
                f"substring({expr},1,4*number(contains({expr},'-'))))"
            )
        return expr

    txt = re.sub(
        r"(?:ihtkk|kdtxslt):stringDatetime\s*\(\s*([^,]+?)\s*,\s*['\"]([^'\"]+)['\"]\s*\)",
        repl_dt_xpath,
        txt
    )

    txt = re.sub(r'\n[ \t]+', '\n', txt)
    return txt

def strip_outer(xml_str: str) -> str:
    m1 = re.search(r'<xsl:(?:stylesheet|transform)\b[^>]*>', xml_str, re.I)
    if not m1:
        return xml_str
    m2 = re.search(r'</xsl:(?:stylesheet|transform)\s*>\s*$', xml_str, re.I)
    return xml_str[m1.end():m2.start() if m2 else len(xml_str)]

def flatten_xsl(full_path: str, seen=None) -> str:
    if seen is None:
        seen = set()
    norm = norm_rel(full_path)
    if norm in seen:
        return ''
    seen.add(norm)
    if not os.path.exists(full_path):
        return ''
    raw = open(full_path, 'r', encoding='utf-8', errors='replace').read()
    rewritten = rewrite_xslt(raw, full_path)

    inc_re = re.compile(r'<xsl:(?:include|import)\s+href\s*=\s*["\']([^"\']+)["\']\s*(?:/>|>\s*</xsl:(?:include|import)>)')
    def repl(m):
        inc_href = m.group(1).strip().replace('/', '\\')
        p1 = os.path.normpath(os.path.join(os.path.dirname(full_path), inc_href))
        p2 = os.path.normpath(os.path.join(ITAX_DIR, inc_href))
        p = p1 if os.path.exists(p1) else (p2 if os.path.exists(p2) else '')
        if not p:
            return ''
        sub = flatten_xsl(p, seen)
        return strip_outer(sub)

    res = inc_re.sub(repl, rewritten)

    # Đảm bảo các template gọi không bị thiếu định nghĩa rỗng
    def_tmpls = set(re.findall(r'<xsl:template\b[^>]*\bname\s*=\s*["\']([^"\']+)["\']', res))
    extra_tmpls = []
    def repl_call(m):
        nm = m.group(1)
        if nm in def_tmpls:
            return m.group(0)
        if re.search(r'tkhaiFooter', nm, re.I) and 'tkhaiFooter' in def_tmpls:
            return '<xsl:call-template name="tkhaiFooter"'
        if re.search(r'tkhaiHeader', nm, re.I) and 'tkhaiHeader' in def_tmpls:
            return '<xsl:call-template name="tkhaiHeader"'
        def_tmpls.add(nm)
        extra_tmpls.append(f'<xsl:template name="{nm}"/>')
        return m.group(0)

    res = re.sub(r'<xsl:call-template\s+name\s*=\s*["\']([^"\']+)["\']', repl_call, res)
    if extra_tmpls:
        res = re.sub(r'</xsl:(?:stylesheet|transform)\s*>\s*$', ''.join(extra_tmpls) + '</xsl:stylesheet>', res)

    return res

def scope_css(raw_css: str, prefix='.itax-sheet') -> str:
    css = re.sub(r'/\*[\s\S]*?\*/', '', raw_css)
    css = re.sub(r'(?m)^\s*//.*$', '', css)
    css = css.replace('##', '#')
    out = []
    for m in re.finditer(r'([^{}]+)\{([^{}]*)\}', css):
        sel_raw = m.group(1).strip()
        body = m.group(2).strip()
        if not sel_raw or not body:
            continue
        sels = []
        for s in sel_raw.split(','):
            s = s.strip()
            if not s:
                continue
            if s.lower() == 'body':
                sels.append(prefix)
            else:
                sels.append(f'{prefix} {s}')
        if sels:
            out.append(','.join(sels) + '{' + re.sub(r'\s+', ' ', body) + '}')
    return '\n'.join(out)

def extract_common_js():
    xsl_root = os.path.join(ITAX_DIR, 'data', 'xslt')
    sources = [
        r'XSLT 2.3.7\TKhaiThue\common\common.xsl',
        r'XSLT 2.8.1\TKhaiThue\common\common.xsl',
        r'CTu\common\commonTT84.xsl',
    ]
    chunks = []
    seen_functions = set()
    for rel in sources:
        p = os.path.join(xsl_root, rel)
        if not os.path.exists(p):
            continue
        txt = open(p, 'r', encoding='utf-8', errors='replace').read()
        for m in re.finditer(r'<msxsl:script[^>]*>([\s\S]*?)</msxsl:script>', txt):
            js_code = html.unescape(m.group(1))
            # Để tránh duplicate function declarations, chia theo function
            chunks.append(js_code)
    return '\n'.join(chunks)

def main():
    print(f"Đọc danh mục từ {ITAX_DIR}...")
    p_tk = os.path.join(ITAX_DIR, 'data', 'DMucTKhai.xml')
    tree = ET.parse(p_tk)
    
    dmuc_tkhai = {}
    seed_paths = {} # path_rel -> full_path

    for tk in tree.getroot():
        if local_tag(tk.tag) != 'TKhai':
            continue
        ma = tk.attrib.get('maTKhai', '').strip()
        if ma not in TARGET_MA_TKHAI:
            continue
        
        raw_x = child_text(tk, 'XSLT')
        full_x = os.path.normpath(os.path.join(ITAX_DIR, raw_x.replace('/', '\\'))) if raw_x else ''
        x_rel = norm_rel(full_x) if full_x and os.path.exists(full_x) else ''
        if x_rel:
            seed_paths[x_rel] = full_x

        pls = {}
        for ds in tk:
            if local_tag(ds.tag) == 'DSachPLuc':
                for pl in ds:
                    if local_tag(pl.tag) == 'PLuc':
                        pid = pl.attrib.get('plucID', '').strip()
                        raw_px = child_text(pl, 'PLucXSLT')
                        full_px = os.path.normpath(os.path.join(ITAX_DIR, raw_px.replace('/', '\\'))) if raw_px else ''
                        px_rel = norm_rel(full_px) if full_px and os.path.exists(full_px) else ''
                        if pid and px_rel:
                            seed_paths[px_rel] = full_px
                            pls[pid] = [
                                child_text(pl, 'TenPLuc'),
                                px_rel,
                                pl.attrib.get('plucOrientation', '0').strip()
                            ]

        entry = {
            'p': tk.attrib.get('pbanTKhai', '').strip(),
            'l': tk.attrib.get('loaiTKhai', '').strip(),
            'o': tk.attrib.get('orientation', '0').strip(),
            'x': x_rel,
        }
        if pls:
            entry['pl'] = pls
        dmuc_tkhai.setdefault(ma, []).append(entry)

    print(f"Số biểu mẫu cần làm phẳng: {len(seed_paths)}")
    
    from lxml import etree
    flattened_map = {} # path_rel -> flat_content
    for rel_path, full_p in sorted(seed_paths.items()):
        flat = flatten_xsl(full_p)
        # Thử biên dịch qua lxml để bảo đảm tính hợp lệ
        try:
            doc = etree.fromstring(flat.encode('utf-8'))
            xslt = etree.XSLT(doc)
            flattened_map[rel_path] = flat
        except Exception as e:
            print(f"LỖI BIÊN DỊCH {rel_path}: {e}")
            raise

    print(f"Tất cả {len(flattened_map)} tệp XSLT biên dịch thành công qua lxml.etree.XSLT!")

    # Khử trùng chuỗi và băm hash
    hash_to_text = {}
    path_to_hash = {}
    for rel_path, content in sorted(flattened_map.items()):
        h = hashlib.sha1(content.encode('utf-8')).hexdigest()[:10]
        hash_to_text[h] = content
        path_to_hash[rel_path] = h

    # Nén kho chuỗi băm bằng zlib DEFLATE
    json_bytes = json.dumps(hash_to_text, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    compressed = zlib.compress(json_bytes, level=9)
    b64_zlib = base64.b64encode(compressed).decode('ascii')

    # Trích xuất CSS
    css1 = open(os.path.join(ITAX_DIR, 'data', 'css', 'ihtkk.css'), 'r', encoding='utf-8', errors='replace').read()
    css2 = open(os.path.join(ITAX_DIR, 'data', 'css', 'ihtkk_ntdt.css'), 'r', encoding='utf-8', errors='replace').read()
    scoped_css = scope_css(css1 + '\n' + css2, '.itax-sheet')

    # Thu thập mã JavaScript hàm common
    ih_js = extract_common_js()

    # Sinh file mauItaxBctc.ts
    dmuc_json = json.dumps(dmuc_tkhai, ensure_ascii=False, indent=2)
    path_hash_json = json.dumps(path_to_hash, ensure_ascii=False, indent=2)

    # Danh sách các hàm mà iTax Viewer có thể gọi
    known_fns = [
        'DocTienBangChu', 'breakWord', 'convertKyBaoCao', 'formatNumber', 'formatNumberUSD',
        'formatVar', 'getHuyen', 'getKHBM', 'getMaCTcapTren', 'getMonthFromString',
        'getTTThayDoi', 'getTenBVMT', 'getTenCT', 'getTenGhiChuBC26', 'getTenNganCT',
        'getTenPLP', 'getTenTN', 'getTenUpperCT', 'getTinh', 'kyTinhThue',
        'kyTinhThueTruMot', 'kyTinhThue_hddt', 'stringDatetime', 'stringDatetimeTEM',
        'timeToString', 'toEnglishCashUSD', 'toFormatDecimal', 'toFormatDecimall'
    ]
    safe_return_entries = ', '.join([f'"{fn}": typeof {fn} !== "undefined" ? {fn} : undefined' for fn in known_fns])

    ts_content = f'''/* eslint-disable */
// @ts-nocheck
// TỰ ĐỘNG SINH BỞI apps/khaithue/app/scripts/tao-mau-itax-bctc.py
// Chứa toàn bộ mẫu XSLT chuẩn HTKK / iTax Viewer cho BCTC (TT200, TT133, TT99, TT58) và tờ khai chính.
import {{ unzlibSync, strFromU8 }} from 'fflate';

export interface ItaxPlucInfo {{
  ten: string;
  xsl: string;
  orient: string;
}}

export interface ItaxTkhaiEntry {{
  p: string;
  l: string;
  o: string;
  x: string;
  pl?: Record<string, [string, string, string]>;
}}

export const ITAX_DMUC: Record<string, ItaxTkhaiEntry[]> = {dmuc_json};

export const ITAX_PATH_TO_HASH: Record<string, string> = {path_hash_json};

export const ITAX_SCOPED_CSS = {json.dumps(scoped_css, ensure_ascii=False)};

// Chuỗi nén zlib chứa các tệp XSLT đã làm phẳng hoàn toàn (self-contained)
const ITAX_ZLIB_B64 = "{b64_zlib}";

let _decompressedCache: Record<string, string> | null = null;

export function getFlatXslt(pathRel: string): string | null {{
  const hash = ITAX_PATH_TO_HASH[pathRel.toLowerCase()];
  if (!hash) return null;
  if (!_decompressedCache) {{
    try {{
      const bin = Uint8Array.from(atob(ITAX_ZLIB_B64), c => c.charCodeAt(0));
      const unzipped = unzlibSync(bin);
      const str = strFromU8(unzipped);
      _decompressedCache = JSON.parse(str);
    }} catch (e) {{
      console.error('Lỗi giải nén ITAX XSLT:', e);
      return null;
    }}
  }}
  return _decompressedCache?.[hash] || null;
}}

// Bộ hàm định dạng gốc của iTax Viewer
const ihScope: Record<string, Function | undefined> = (() => {{
  {ih_js}
  return {{
    {safe_return_entries}
  }};
}})();

const wrapNode = (s: any) => {{
  const v = s == null ? '' : String(s);
  return {{
    nextNode: () => ({{
      hasChildNodes: () => v !== '',
      childNodes: v !== '' ? [{{ nodeValue: v }}] : []
    }})
  }};
}};

export function safeFormatNumber(raw: any): string {{
  if (raw == null) return '';
  let v = String(raw).trim();
  if (!v) return '';
  if (!/^-?\\d+(?:\\.\\d+)?$/.test(v)) {{
    try {{
      return ihScope.formatNumber ? ihScope.formatNumber(wrapNode(v)) : v;
    }} catch {{
      return v;
    }}
  }}
  let neg = false;
  if (v.startsWith('-')) {{
    neg = true;
    v = v.slice(1);
  }}
  const [intP, decP] = v.split('.');
  let cleanedInt = intP.replace(/^0+(?=\\d)/, '') || '0';
  cleanedInt = cleanedInt.replace(/\\B(?=(\\d{{3}})+(?!\\d))/g, '.');
  const out = decP !== undefined ? cleanedInt + ',' + decP : cleanedInt;
  return neg ? '(' + out + ')' : out;
}}

export function callIh(fn: string, args: any[]): string {{
  if (fn === 'formatNumber') return safeFormatNumber(args[0]);
  const f = ihScope[fn];
  if (!f) return args.join('');
  try {{
    const wrapped = args.map((a, idx) => {{
      if ((fn === 'stringDatetime' || fn === 'stringDatetimeTEM' || fn === 'timeToString') && idx === 1) return String(a || '');
      if ((fn === 'toFormatDecimal' || fn === 'toFormatDecimall') && idx === 1) return Number(a) || 0;
      if (fn === 'breakWord' && idx > 0) return Number(a) || 0;
      return wrapNode(a);
    }});
    const r = f(...wrapped);
    return r == null ? '' : String(r);
  }} catch {{
    return args[0] || '';
  }}
}}
'''

    with open(OUT_TS, 'w', encoding='utf-8') as f:
        f.write(ts_content)

    print(f"ĐÃ XUẤT THÀNH CÔNG: {OUT_TS}")
    print(f"  - Dung lượng file TypeScript: {os.path.getsize(OUT_TS)/1024:.1f} KB")
    print(f"  - Kho XSLT nén zlib: {len(compressed)/1024:.1f} KB")

if __name__ == '__main__':
    main()

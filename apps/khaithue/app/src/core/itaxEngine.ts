import { ITAX_DMUC, getFlatXslt, callIh } from './mauItaxBctc';
import { docCayXml, type NutXml } from './xemHoaDon';

export interface ItaxSheetResult {
  id: string;
  label: string;
  orient: string; // '0': dọc (A4 portrait), '1': ngang (A4 landscape)
  html: string;
}

// Bỏ xmlns="..." mặc định trên các thẻ mở để tương thích XPath 1.0 (như cơ chế namespaceAware=false của iTax Viewer)
export function cleanXmlForXslt(xml: string): string {
  return xml
    .replace(/^\uFEFF/, '')
    .replace(/<[a-zA-Z_][\w:.-]*\b[^>]*>/g, tag => tag.replace(/\s+xmlns\s*=\s*(?:"[^"]*"|'[^']*')/g, ''));
}

const verNums = (s: string) => {
  const a = String(s || '').split('.').map(x => parseInt(x, 10) || 0);
  while (a.length < 3) a.push(0);
  return a;
};

const cmpVer = (a: string, b: string) => {
  const va = verNums(a), vb = verNums(b);
  for (let i = 0; i < Math.max(va.length, vb.length); i++) {
    const d = (va[i] || 0) - (vb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
};

function pickItaxEntry(arr: any[], pban: string, loai: string) {
  if (!arr || !arr.length) return null;
  let pool = arr;
  if (loai) {
    const byL = arr.filter((e: any) => (e.l || '').toUpperCase() === loai.toUpperCase());
    if (byL.length) pool = byL;
  }
  if (pban) {
    const ex = pool.find((e: any) => e.p === pban) || pool.find((e: any) => e.p && cmpVer(e.p, pban) === 0);
    if (ex) return ex;
    const le = pool.filter((e: any) => e.p && cmpVer(e.p, pban) <= 0).sort((a: any, b: any) => cmpVer(b.p, a.p));
    if (le.length) return le[0];
    const gt = pool.filter((e: any) => e.p && cmpVer(e.p, pban) > 0).sort((a: any, b: any) => cmpVer(a.p, b.p));
    if (gt.length) return gt[0];
  }
  return [...pool].sort((a: any, b: any) => cmpVer(b.p, a.p))[0];
}

function findPlucEntry(ma: string, entry: any, pid: string, pban: string) {
  const getFrom = (plMap: any) => {
    if (!plMap) return null;
    if (plMap[pid]) return plMap[pid];
    const low = pid.toLowerCase();
    const k = Object.keys(plMap).find(x => x.toLowerCase() === low);
    return k ? plMap[k] : null;
  };
  let hit = getFrom(entry?.pl);
  if (hit) return hit;
  const sameMa = [...(ITAX_DMUC[ma] || [])].sort((a, b) => Math.abs(cmpVer(a.p, pban)) - Math.abs(cmpVer(b.p, pban)));
  for (const e of sameMa) {
    hit = getFrom(e.pl);
    if (hit) return hit;
  }
  return null;
}

// Bộ nhớ đệm XSLTProcessor để tái sử dụng
const xslProcCache = new Map<string, any>();

function getXslProcessor(pathRel: string): any | null {
  if (xslProcCache.has(pathRel)) {
    return xslProcCache.get(pathRel);
  }
  if (typeof XSLTProcessor === 'undefined' || typeof DOMParser === 'undefined') {
    return null;
  }
  const flatXsl = getFlatXslt(pathRel);
  if (!flatXsl) {
    xslProcCache.set(pathRel, null);
    return null;
  }
  try {
    const xdoc = new DOMParser().parseFromString(flatXsl, 'application/xml');
    if (xdoc.getElementsByTagName('parsererror').length > 0) {
      xslProcCache.set(pathRel, null);
      return null;
    }
    const proc = new XSLTProcessor();
    proc.importStylesheet(xdoc);
    xslProcCache.set(pathRel, proc);
    return proc;
  } catch (e) {
    console.warn(`Lỗi khởi tạo XSLTProcessor cho ${pathRel}:`, e);
    xslProcCache.set(pathRel, null);
    return null;
  }
}

export interface SpecInfo {
  id: string;
  label: string;
  xsl: string;
  orient: string;
}

function labelChoMaTKhai(ma: string): string {
  if (ma === '402') return 'Báo cáo tình hình tài chính (CĐKT)';
  if (ma === '683') return 'Báo cáo tài chính (B01a - CĐKT)';
  if (ma === '1281') return 'Báo cáo tình hình tài chính (B01a - TT99)';
  if (ma === '1280') return 'Báo cáo tình hình tài chính (TT58)';
  if (ma === '842') return 'Tờ khai thuế GTGT (01/GTGT)';
  if (ma === '864') return 'Tờ khai khấu trừ thuế TNCN (05/KK-TNCN)';
  return 'Tờ khai chính';
}

/**
 * Nhận diện mẫu tờ khai và các phụ lục từ chuỗi XML hoặc cây DOM / NutXml
 */
export function matchSpecsForXml(input: string | Document | NutXml): SpecInfo[] {
  let rootTag = '';
  let ma = '';
  let pban = '';
  let loai = '';
  const plucList: string[] = [];

  if (typeof input === 'string') {
    try {
      const tree = docCayXml(cleanXmlForXslt(input));
      return matchSpecsForXml(tree);
    } catch {
      return [];
    }
  }

  // Nếu là NutXml (từ docCayXml)
  if ('ten' in input && Array.isArray((input as NutXml).con)) {
    const nut = input as NutXml;
    rootTag = nut.ten;
    if (rootTag === 'HSoThueDTu') {
      const hs = nut.con.find(c => c.ten === 'HSoKhaiThue');
      if (!hs) return [];
      const ttChung = hs.con.find(c => c.ten === 'TTinChung');
      const ttTk = ttChung?.con.find(c => c.ten === 'TTinTKhaiThue');
      const tk = ttTk?.con.find(c => c.ten === 'TKhaiThue');
      if (tk) {
        ma = tk.con.find(c => c.ten === 'maTKhai')?.chu?.trim() || '';
        pban = tk.con.find(c => c.ten === 'pbanTKhaiXML')?.chu?.trim() || '';
        loai = tk.con.find(c => c.ten === 'loaiTKhai')?.chu?.trim() || '';
      }
      const plWrap = hs.con.find(c => c.ten === 'PLuc');
      if (plWrap) {
        for (const pl of plWrap.con) {
          if (!plucList.includes(pl.ten)) plucList.push(pl.ten);
        }
      }
    } else if (rootTag === 'TKhai') {
      ma = nut.con.find(c => c.ten === 'MSo' || c.ten === 'maTKhai')?.chu?.trim() || '';
      pban = nut.con.find(c => c.ten === 'PBan' || c.ten === 'pbanTKhaiXML')?.chu?.trim() || '';
      loai = 'C';
    }
  } else if ('documentElement' in input) {
    // Nếu là Document (DOM trình duyệt)
    const doc = input as Document;
    const root = doc.documentElement;
    if (!root) return [];
    rootTag = root.localName;

    if (rootTag === 'HSoThueDTu') {
      let hs: Element | null = null;
      for (let i = 0; i < root.children.length; i++) {
        if (root.children[i].localName === 'HSoKhaiThue') {
          hs = root.children[i];
          break;
        }
      }
      if (!hs) return [];

      let tk: Element | null = null;
      const ttChung = Array.from(hs.children).find(c => c.localName === 'TTinChung');
      if (ttChung) {
        const ttTk = Array.from(ttChung.children).find(c => c.localName === 'TTinTKhaiThue');
        if (ttTk) {
          tk = Array.from(ttTk.children).find(c => c.localName === 'TKhaiThue') || null;
        }
      }

      ma = tk ? (Array.from(tk.children).find(c => c.localName === 'maTKhai')?.textContent?.trim() || '') : '';
      pban = tk ? (Array.from(tk.children).find(c => c.localName === 'pbanTKhaiXML')?.textContent?.trim() || '') : '';
      loai = tk ? (Array.from(tk.children).find(c => c.localName === 'loaiTKhai')?.textContent?.trim() || '') : '';

      const plWrap = Array.from(hs.children).find(c => c.localName === 'PLuc');
      if (plWrap) {
        for (let i = 0; i < plWrap.children.length; i++) {
          const pid = plWrap.children[i].localName;
          if (!plucList.includes(pid)) plucList.push(pid);
        }
      }
    } else if (rootTag === 'TKhai') {
      ma = root.getElementsByTagName('MSo')[0]?.textContent?.trim() ||
           root.getElementsByTagName('maTKhai')[0]?.textContent?.trim() || '';
      pban = root.getElementsByTagName('PBan')[0]?.textContent?.trim() ||
             root.getElementsByTagName('pbanTKhaiXML')[0]?.textContent?.trim() || '';
      loai = 'C';
    }
  }

  if (!ma) return [];
  const entry = pickItaxEntry(ITAX_DMUC[ma], pban, loai);
  if (!entry) return [];

  const out: SpecInfo[] = [];
  if (entry.x) {
    out.push({
      id: 'tkhai',
      label: labelChoMaTKhai(ma),
      xsl: entry.x,
      orient: entry.o || '0',
    });
  }

  for (const pid of plucList) {
    const ps = findPlucEntry(ma, entry, pid, pban);
    if (ps) {
      out.push({
        id: pid,
        label: ps[0] || pid,
        xsl: ps[1],
        orient: ps[2] || '0',
      });
    }
  }

  return out;
}

/**
 * Biến đổi file XML BCTC / Tờ khai thành danh sách các biểu mẫu HTML chuẩn iTax Viewer.
 */
export function transformXmlToItaxSheets(rawXml: string): ItaxSheetResult[] | null {
  if (!rawXml || typeof DOMParser === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  try {
    const cleaned = cleanXmlForXslt(rawXml);
    const xmlDoc = new DOMParser().parseFromString(cleaned, 'application/xml');
    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      return null;
    }

    const specs = matchSpecsForXml(xmlDoc);
    if (!specs.length) {
      return null;
    }

    const sheets: ItaxSheetResult[] = [];

    for (const sp of specs) {
      if (!sp.xsl) continue;
      const proc = getXslProcessor(sp.xsl);
      if (!proc) continue;

      try {
        const frag = proc.transformToFragment(xmlDoc, document);
        if (!frag) continue;

        const box = document.createElement('div');
        box.appendChild(frag);

        // Thay thế các thẻ placeholder <span data-ih="..."> thành kết quả hàm định dạng
        box.querySelectorAll('span[data-ih]').forEach(el => {
          const fn = el.getAttribute('data-ih') || '';
          const args = Array.from(el.children).map(c => c.textContent || '');
          const formatted = callIh(fn, args);
          el.replaceWith(document.createTextNode(formatted));
        });

        // Xoá các id trùng lặp nếu có (vd sigDiv)
        box.querySelectorAll('#sigDiv').forEach(el => el.removeAttribute('id'));

        if (box.textContent && box.textContent.replace(/\s+/g, '').length > 10) {
          sheets.push({
            id: sp.id,
            label: sp.label,
            orient: sp.orient,
            html: box.innerHTML,
          });
        }
      } catch (err) {
        console.warn(`Lỗi transform biểu mẫu ${sp.id} (${sp.label}):`, err);
      }
    }

    return sheets.length ? sheets : null;
  } catch (e) {
    console.error('Lỗi khi dựng iTax sheets từ XML:', e);
    return null;
  }
}

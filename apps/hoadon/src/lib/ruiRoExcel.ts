import PizZip from 'pizzip'
import { chuanMst, type DnRuiRo, type DsRuiRo, type NhomRuiRo } from './ruiRo'

/**
 * Đọc file Excel danh sách DN rủi ro về hóa đơn của cơ quan thuế (.xlsx = zip chứa XML, đọc bằng PizZip + DOMParser).
 * Mỗi sheet có 1 dòng tiêu đề chứa ô "MST" — tự dò cột theo tên, không phụ thuộc thứ tự cột; sheet không có cột MST thì bỏ qua.
 */

const nfc = (s: string) => s.normalize('NFC').replace(/\s+/g, ' ').trim()
const thuong = (s: string) => nfc(s).toLowerCase()

function con(el: Element, ten: string): Element[] {
  return Array.from(el.getElementsByTagName('*')).filter((x) => x.localName === ten)
}

function xml(zip: PizZip, path: string): Document | null {
  const f = zip.file(path)
  return f ? new DOMParser().parseFromString(f.asText(), 'application/xml') : null
}

/** "B12" -> 1 (cột thứ mấy, đếm từ 0) */
function cotSo(ref: string): number {
  const chu = ref.replace(/\d+$/, '').toUpperCase()
  let n = 0
  for (const c of chu) n = n * 26 + (c.charCodeAt(0) - 64)
  return n - 1
}

interface O {
  v: string
  so: boolean // ô kiểu số (ngày tháng trong Excel cũng là số)
}

function docSheet(doc: Document, chuoi: string[]): O[][] {
  const rows: O[][] = []
  for (const r of con(doc.documentElement, 'row')) {
    const dong: O[] = []
    for (const c of con(r, 'c')) {
      const t = c.getAttribute('t') ?? ''
      const v = con(c, 'v')[0]?.textContent ?? ''
      let o: O
      if (t === 's') o = { v: chuoi[Number(v)] ?? '', so: false }
      else if (t === 'inlineStr') o = { v: con(c, 't').map((x) => x.textContent ?? '').join(''), so: false }
      else if (t === 'str' || t === 'b' || t === 'e') o = { v, so: false }
      else o = { v, so: v !== '' }
      dong[cotSo(c.getAttribute('r') ?? 'A1')] = o
    }
    rows.push(dong)
  }
  return rows
}

/** Ngày trong Excel: số seri (45000…) hoặc chữ "06.08.2026", "06/08/2026" -> yyyy-mm-dd */
function ngay(o: O | undefined): string {
  if (!o || !o.v.trim()) return ''
  if (o.so) {
    const n = Number(o.v)
    if (n > 1000 && n < 100000) return new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000).toISOString().slice(0, 10)
  }
  const m = o.v.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  const iso = o.v.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  return iso ? iso[0] : o.v.trim()
}

function mstTuO(o: O | undefined): string {
  if (!o) return ''
  let s = chuanMst(o.v)
  // ô kiểu số làm mất số 0 đầu: 9 chữ số -> 10, 11 chữ số -> 12 (CCCD)
  if (o.so && /^\d+$/.test(s) && (s.length === 9 || s.length === 11)) s = '0' + s
  return /^\d{9,13}(-\d{3})?$/.test(s) ? s : ''
}

/** Đọc file Excel danh sách DN rủi ro. Lỗi nếu không sheet nào có cột "MST". */
export function docDsRuiRo(buf: ArrayBuffer | Uint8Array, tenFile = ''): DsRuiRo {
  let zip: PizZip
  try {
    zip = new PizZip(buf)
  } catch {
    throw new Error('Không phải file Excel .xlsx (file .xls cũ: mở bằng Excel rồi "Lưu thành" .xlsx)')
  }
  const wb = xml(zip, 'xl/workbook.xml')
  if (!wb) throw new Error('Không phải file Excel .xlsx')
  const chuoi = (() => {
    const d = xml(zip, 'xl/sharedStrings.xml')
    return d ? con(d.documentElement, 'si').map((si) => con(si, 't').map((t) => t.textContent ?? '').join('')) : []
  })()
  const rels = new Map<string, string>()
  const relDoc = xml(zip, 'xl/_rels/workbook.xml.rels')
  if (relDoc) for (const r of con(relDoc.documentElement, 'Relationship')) rels.set(r.getAttribute('Id') ?? '', r.getAttribute('Target') ?? '')

  const nhom: NhomRuiRo[] = []
  const dong: DnRuiRo[] = []
  const sheets = con(wb.documentElement, 'sheet')
  sheets.forEach((sh, i) => {
    const rid = sh.getAttribute('r:id') ?? Array.from(sh.attributes).find((a) => a.localName === 'id')?.value ?? ''
    let target = rels.get(rid) ?? `worksheets/sheet${i + 1}.xml`
    target = target.startsWith('/') ? target.slice(1) : `xl/${target}`
    const doc = xml(zip, target)
    if (!doc) return
    const rows = docSheet(doc, chuoi)

    const hdr = rows.findIndex((r, k) => k < 30 && r.some((o) => o && thuong(o.v) === 'mst'))
    if (hdr < 0) return
    const ten = rows[hdr].map((o) => (o ? thuong(o.v) : ''))
    const tim = (f: (t: string) => boolean) => ten.findIndex((t) => !!t && f(t))
    const c = {
      mst: tim((t) => t === 'mst'),
      ten: (() => {
        const k = tim((t) => /^tên (doanh nghiệp|người nộp thuế|nnt|đơn vị|công ty)/.test(t))
        return k >= 0 ? k : tim((t) => t.startsWith('tên'))
      })(),
      soCv: tim((t) => /^số (cv|công văn|thông báo|tb)\b/.test(t)),
      ngayCv: tim((t) => /^ngày (cv|công văn|thông báo|tb)\b/.test(t)),
      bienPhap: tim((t) => t.startsWith('biện pháp')),
      trangThai: tim((t) => t.startsWith('trạng thái')),
      ngayChuyen: tim((t) => t.startsWith('ngày chuyển trạng thái')),
    }
    const moTa = rows.slice(0, hdr).flat().map((o) => (o ? nfc(o.v) : '')).find((v) => /^danh sách/i.test(v)) ?? ''
    const ni = nhom.push({ sheet: nfc(sh.getAttribute('name') ?? `Sheet ${i + 1}`), moTa }) - 1
    const lay = (r: O[], k: number) => (k >= 0 && r[k] ? nfc(r[k].v) : '')
    for (const r of rows.slice(hdr + 1)) {
      const mst = mstTuO(r[c.mst])
      if (!mst) continue
      dong.push({
        mst,
        ten: lay(r, c.ten),
        nhom: ni,
        soCv: lay(r, c.soCv),
        ngayCv: c.ngayCv >= 0 ? ngay(r[c.ngayCv]) : '',
        bienPhap: lay(r, c.bienPhap),
        trangThai: lay(r, c.trangThai),
        ngayChuyen: c.ngayChuyen >= 0 ? ngay(r[c.ngayChuyen]) : '',
      })
    }
  })
  if (!nhom.length) throw new Error('Không thấy sheet nào có cột "MST" — có đúng file danh sách DN rủi ro không?')
  return { cacFile: [{ ten: tenFile, napLuc: Date.now(), soDong: dong.length }], nhom, dong }
}

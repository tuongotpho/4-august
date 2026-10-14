import PizZip from 'pizzip'

/**
 * Đọc file .xlsx (zip chứa XML) bằng PizZip + DOMParser — không cần thư viện Excel nặng.
 * Trả về mỗi sheet một bảng ô: số giữ nguyên là số (ngày/giờ Excel là số), chữ là chuỗi, ô công thức lấy giá trị đã tính.
 */
export type O = string | number | null
export interface Sheet {
  ten: string
  dong: O[][]
}

const con = (el: Element | Document, ten: string) => Array.from(el.getElementsByTagName('*')).filter((x) => x.localName === ten)

function xml(zip: PizZip, path: string): Document | null {
  const f = zip.file(path)
  return f ? new DOMParser().parseFromString(f.asText(), 'application/xml') : null
}

/** "B12" -> 1 (đếm từ 0) */
function cotSo(ref: string): number {
  let n = 0
  for (const c of ref.replace(/\d+$/, '').toUpperCase()) n = n * 26 + (c.charCodeAt(0) - 64)
  return n - 1
}

const chu = (el: Element) => con(el, 't').map((t) => t.textContent ?? '').join('')

export function docXlsx(buf: ArrayBuffer | Uint8Array): Sheet[] {
  const zip = new PizZip(buf)
  const wb = xml(zip, 'xl/workbook.xml')
  if (!wb) throw new Error('Không phải file Excel .xlsx')
  const rels = xml(zip, 'xl/_rels/workbook.xml.rels')
  const dich = new Map(rels ? con(rels, 'Relationship').map((r) => [r.getAttribute('Id') ?? '', r.getAttribute('Target') ?? '']) : [])
  const ss = xml(zip, 'xl/sharedStrings.xml')
  const chuoi = ss ? con(ss, 'si').map(chu) : []

  return con(wb, 'sheet').map((s) => {
    const rid = s.getAttribute('r:id') ?? Array.from(s.attributes).find((a) => a.localName === 'id')?.value ?? ''
    let dich1 = dich.get(rid) ?? ''
    dich1 = dich1.startsWith('/') ? dich1.slice(1) : 'xl/' + dich1.replace(/^\.\//, '')
    const doc = xml(zip, dich1)
    const dong: O[][] = []
    if (doc) {
      for (const r of con(doc, 'row')) {
        const i = Number(r.getAttribute('r')) - 1
        const hang: O[] = []
        for (const c of con(r, 'c')) {
          const j = cotSo(c.getAttribute('r') ?? 'A1')
          const t = c.getAttribute('t')
          const v = con(c, 'v')[0]?.textContent ?? null
          let gt: O = null
          if (t === 's') gt = v === null ? null : chuoi[Number(v)] ?? null
          else if (t === 'inlineStr') gt = chu(c)
          else if (t === 'str' || t === 'e') gt = v
          else if (t === 'b') gt = v === null ? null : Number(v)
          else gt = v === null || v === '' ? null : Number(v)
          if (typeof gt === 'string') gt = gt.normalize('NFC').trim() || null
          hang[j] = gt
        }
        dong[i] = Array.from(hang, (x) => x ?? null)
      }
    }
    return { ten: s.getAttribute('name') ?? '', dong: Array.from(dong, (x) => x ?? []) }
  })
}

/** Số ngày Excel -> 'YYYY-MM-DD' (gốc 1899-12-30) */
export function ngayExcel(n: number): string {
  return new Date(Math.round((n - 25569) * 86400_000)).toISOString().slice(0, 10)
}

/** Phần lẻ của số Excel -> 'HH:mm' */
export function gioExcel(n: number): string {
  const p = Math.round((n % 1) * 24 * 60)
  return `${String(Math.floor(p / 60) % 24).padStart(2, '0')}:${String(p % 60).padStart(2, '0')}`
}

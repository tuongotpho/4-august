import PizZip from 'pizzip'
import { fmtDate, fromIso, toIso } from './dates.js'
import { firstInvoiceDate } from './status.js'
import type { Dossier, Settings } from './types.js'

/** Một dòng của bảng đăng ký lịch tuần (sửa được ở hộp xem trước, KHÔNG lưu vào hồ sơ). */
export interface DongLich {
  id: string // id hồ sơ
  ngay: string // yyyy-mm-dd
  noiDung: string
  thanhPhan: string
  diaDiem: string
}

export interface ThongTinLich {
  donVi: string // dòng trên cùng bên trái, ví dụ "CÔNG TY DỊCH VỤ ĐIỆN LỰC MIỀN BẮC"
  boPhan: string // ví dụ "PHÒNG KỸ THUẬT AN TOÀN"
  tieuDe: string
  tieuDePhu: string // "(Từ ngày … đến ngày …)"
  nguoiKy: string
}

const THU = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']

/** 2026-06-24 -> "Thứ Tư" */
export function thuCua(iso: string): string {
  const d = fromIso(iso)
  return d ? THU[d.getDay()] : ''
}

/** Ngày làm việc của hồ sơ = ngày hóa đơn đầu tiên (chưa có HĐ thì ngày tờ trình). */
export const ngayLamViec = (d: Dossier) => firstInvoiceDate(d) || d.ngayToTrinh || ''

// Viết tắt tên đơn vị trong cột Thành phần (so không dấu, không phân biệt hoa thường; "công ty" / "cty" như nhau)
const CTY = '(?:cong ty|cty)'
export const VIET_TAT: [RegExp, string][] = [
  [/tap doan dien luc viet nam/, 'EVN'],
  [new RegExp(`tong ${CTY} dien luc mien bac`), 'NPC'],
  [new RegExp(`${CTY} cong nghe thong tin dien luc mien bac`), 'NPC IT'],
  // mọi PC tỉnh: "Công ty Điện lực Tuyên Quang" -> "PC Tuyên Quang" (giữ nguyên tên tỉnh như đã gõ).
  // Không dính NPC (đã thay ở dòng trên), NPC IT, NPSC ("Công ty Dịch vụ Điện lực…") vì giữa có chữ khác.
  [new RegExp(`${CTY} dien luc(?= \\S)`), 'PC'],
  [/ky thuat an toan/, 'KTAT'],
  [/ke hoach vat tu/, 'KHVT'],
]

// mỗi ký tự -> đúng 1 ký tự không dấu, chữ thường (để vị trí khớp trên chuỗi không dấu dùng lại được cho chuỗi gốc)
const khongDau = (s: string) =>
  [...s.normalize('NFC')].map((c) => (c === 'đ' || c === 'Đ' ? 'd' : c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().slice(0, 1) || c)).join('')

/** "Tổng công ty Điện lực miền Bắc (NPC), Phòng Kỹ thuật An toàn" -> "NPC, Phòng KTAT" */
export function vietTat(ten: string): string {
  let s = ten.normalize('NFC').replace(/\s+/g, ' ')
  for (const [mau, tat] of VIET_TAT) {
    const re = new RegExp(`(?<![a-z0-9])${mau.source.replace(/ /g, '\\s+')}(?![a-z0-9])`, 'g')
    const khop = [...khongDau(s).matchAll(re)].reverse() // thay từ cuối lên để vị trí phía trước không lệch
    for (const m of khop) s = s.slice(0, m.index) + tat + s.slice(m.index! + m[0].length)
  }
  // "Tổng công ty … (NPC)" -> "NPC (NPC)" -> "NPC"; "PC Tuyên Quang (PC Tuyên Quang)" -> "PC Tuyên Quang"
  return s
    .replace(/([^,()]+?)\s*\(([^()]+)\)/g, (x, a: string, b: string) => (khongDau(a.trim()).endsWith(khongDau(b.trim())) ? a : x))
    .trim()
}

/** Các hồ sơ đã chọn -> dòng lịch, xếp theo ngày tăng dần. diaDiemDaNho: địa điểm đã gõ lần trước (theo id hồ sơ). */
export function dongLichTuan(ds: Dossier[], diaDiemDaNho: Record<string, string> = {}): DongLich[] {
  return ds
    .map((d) => ({
      id: d.id,
      ngay: ngayLamViec(d),
      noiDung: d.noiDung.trim() || (d.hoSoCu ? d.invoices[0]?.tenNguoiBan ?? '' : ''),
      thanhPhan: d.thanhPhan.map((t) => vietTat(t.donVi)).filter(Boolean).join(', '),
      diaDiem: diaDiemDaNho[d.id] ?? d.doiTac.trim(),
    }))
    .sort((a, b) => (a.ngay || '9999').localeCompare(b.ngay || '9999'))
}

/** "(Từ ngày 22/06/2026 đến ngày 28/06/2026)": cả tuần (thứ Hai – Chủ nhật) chứa các ngày đã chọn. */
export function khoangTuan(ngays: string[]): string {
  const ds = ngays.filter((n) => fromIso(n)).sort()
  if (!ds.length) return '(Từ ngày ……/……/…… đến ngày ……/……/……)'
  const dau = fromIso(ds[0])!
  dau.setDate(dau.getDate() - ((dau.getDay() + 6) % 7)) // lùi về thứ Hai
  const cuoi = fromIso(ds[ds.length - 1])!
  cuoi.setDate(cuoi.getDate() + ((7 - cuoi.getDay()) % 7)) // tới Chủ nhật
  return `(Từ ngày ${fmtDate(toIso(dau))} đến ngày ${fmtDate(toIso(cuoi))})`
}

export function thongTinMacDinh(s: Settings, dong: DongLich[]): ThongTinLich {
  return {
    donVi: s.donVi.toUpperCase(),
    boPhan: s.boPhan.toUpperCase(),
    tieuDe: 'ĐĂNG KÝ LỊCH CÔNG TÁC TUẦN',
    tieuDePhu: khoangTuan(dong.map((d) => d.ngay)),
    nguoiKy: s.hoTen,
  }
}

// ---------- Dựng file Word (tự viết XML, không cần mẫu) ----------

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

interface Chu {
  dam?: boolean
  nghieng?: boolean
  co?: number // cỡ chữ (pt)
}

function run(text: string, c: Chu = {}): string {
  const rpr = `${c.dam ? '<w:b/>' : ''}${c.nghieng ? '<w:i/>' : ''}${c.co ? `<w:sz w:val="${c.co * 2}"/><w:szCs w:val="${c.co * 2}"/>` : ''}`
  // xuống dòng trong ô -> <w:br/>
  return text
    .split('\n')
    .map((dong, i) => `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${esc(dong)}</w:t></w:r>`)
    .join('')
}

function para(runs: string, canh: 'left' | 'center' | 'right' = 'left', sau = 0, thutTrai = 0): string {
  const ind = thutTrai ? `<w:ind w:left="${thutTrai}"/>` : ''
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="${sau}"/>${ind}<w:jc w:val="${canh}"/></w:pPr>${runs}</w:p>`
}

const VIEN = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((k) => `<w:${k} w:val="single" w:sz="6" w:space="0" w:color="000000"/>`).join('')

function o(rong: number, noiDung: string, opt: { nen?: string; giua?: boolean } = {}): string {
  return (
    `<w:tc><w:tcPr><w:tcW w:w="${rong}" w:type="dxa"/>${opt.nen ? `<w:shd w:val="clear" w:color="auto" w:fill="${opt.nen}"/>` : ''}<w:vAlign w:val="center"/></w:tcPr>` +
    noiDung +
    '</w:tc>'
  )
}

// A4 ngang, lề 1,5 cm hai bên -> vùng chữ 16838 - 2*850 = 15138 dxa
const COT = [2000, 6300, 4400, 2438]
const TIEU_DE_COT = ['Ngày', 'Nội dung làm việc', 'Thành phần làm việc', 'Địa điểm']

function bangLich(dong: DongLich[]): string {
  const luoi = COT.map((w) => `<w:gridCol w:w="${w}"/>`).join('')
  const dau =
    '<w:tr><w:trPr><w:tblHeader/></w:trPr>' + TIEU_DE_COT.map((t, i) => o(COT[i], para(run(t, { dam: true }), 'center'), { nen: 'D9E2F3' })).join('') + '</w:tr>'
  const than = dong
    .map((d) => {
      const ngay = d.ngay ? `${thuCua(d.ngay)}\n${fmtDate(d.ngay)}` : '……'
      return (
        '<w:tr><w:trPr><w:cantSplit/></w:trPr>' +
        o(COT[0], para(run(ngay, { dam: true }), 'center')) +
        o(COT[1], para(run(d.noiDung || '……'))) +
        o(COT[2], para(run(d.thanhPhan || '……'))) +
        o(COT[3], para(run(d.diaDiem || '……'), 'center')) +
        '</w:tr>'
      )
    })
    .join('')
  return (
    `<w:tbl><w:tblPr><w:tblW w:w="${COT.reduce((a, b) => a + b, 0)}" w:type="dxa"/><w:jc w:val="center"/><w:tblBorders>${VIEN}</w:tblBorders>` +
    '<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>' +
    `<w:tblGrid>${luoi}</w:tblGrid>${dau}${than}</w:tbl>`
  )
}

function documentXml(dong: DongLich[], tt: ThongTinLich): string {
  const dauTrang = [
    tt.donVi && para(run(tt.donVi, { co: 12 })),
    tt.boPhan && para(run(tt.boPhan, { dam: true, co: 12 }), 'left', 240),
  ].filter(Boolean)
  const body = [
    ...dauTrang,
    para(run(tt.tieuDe, { dam: true, co: 15 }), 'center'),
    para(run(tt.tieuDePhu, { nghieng: true }), 'center', 240),
    bangLich(dong),
    para('', 'left', 240),
    // khối ký: căn giữa trong cột bên phải (khoảng 1/3 bề ngang)
    tt.nguoiKy && para(run('NGƯỜI ĐĂNG KÝ', { dam: true }), 'center', 0, 10000),
    tt.nguoiKy && para(run('\n\n\n'), 'center', 0, 10000),
    tt.nguoiKy && para(run(tt.nguoiKy, { dam: true }), 'center', 0, 10000),
  ].filter(Boolean)
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>' +
    body.join('') +
    '<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="1000" w:right="850" w:bottom="1000" w:left="850" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr>' +
    '</w:body></w:document>'
  )
}

const STYLES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="26"/><w:szCs w:val="26"/><w:lang w:val="vi-VN"/></w:rPr></w:rPrDefault>' +
  '<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
  '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:left w:w="108" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>' +
  '</w:styles>'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/** File Word đăng ký lịch tuần: A4 ngang, bảng 4 cột Ngày | Nội dung | Thành phần | Địa điểm. */
export function taoDocxLichTuan(dong: DongLich[], tt: ThongTinLich): Blob {
  const zip = new PizZip()
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
  )
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  )
  zip.file(
    'word/_rels/document.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
  )
  zip.file('word/styles.xml', STYLES)
  zip.file('word/document.xml', documentXml(dong, tt))
  return zip.generate({ type: 'blob', mimeType: DOCX_MIME, compression: 'DEFLATE' }) as Blob
}

// HOÁ ĐƠN GỐC: file XML hoặc PDF của từng hoá đơn (khác danh sách Excel tải ở cổng thuế, vốn chỉ có phần đầu).
// Đọc ra: phần đầu + DÒNG HÀNG (tên hàng, ĐVT, số lượng, đơn giá, thuế suất) + dấu hiệu kiểm tra (mã CQT, chữ ký, ngày ký).
// Phần đọc PDF chuyển từ app hoá đơn đỏ (repo tuongotpho/hoadon, src/lib/invoicePdf.ts) và bổ sung MST NGƯỜI MUA
// (app này cần biết hoá đơn là bán ra hay mua vào), mã CQT, chữ ký.
// File này không phụ thuộc thư viện: web app, máy chủ MCP và test dùng chung. Lấy chữ từ PDF: may/pdfChu.ts (web), mcp/pdfChu.ts (Node).
//
// KHÔNG đụng phần tính tờ khai: tờ khai vẫn lấy số từ danh sách Excel. Hoá đơn gốc chỉ để soát, phân loại, ghép lô.

import type { CanhBao, HoaDon, LoaiHD } from './types.js'
import type { Kho } from './kho.js'
import { conHieuLuc } from './excel.js'
import { tien } from './nhan.js'

export interface DongHang {
  ten: string
  dvt: string
  sl: number
  dg: number
  tt: number // thành tiền chưa thuế
  ts: string // thuế suất: "8%", "10%", "0%", "KCT", "KKKNT"...
}

export interface LienQuan {
  loai: 'thayThe' | 'dieuChinh'
  kyHieu: string
  so: string
  ngay: string // dd/MM/yyyy
}

export interface HoaDonGoc {
  nguon: 'xml' | 'pdf'
  tenFile: string
  kyHieuMau: string
  kyHieu: string // không gồm số mẫu: "C25TNA"
  so: string
  ngay: string // dd/MM/yyyy
  mstBan: string
  tenBan: string
  mstMua: string
  tenMua: string
  chuaThue: number
  thue: number
  tong: number
  dong: DongHang[]
  /** Mã của cơ quan thuế ('' = không thấy; hoá đơn máy tính tiền / không mã thì có thể không có) */
  mccqt: string
  /** Có chữ ký số người bán: XML đọc được chắc; PDF chỉ đoán theo chữ "Ký bởi" -> null = không biết */
  kyBan: boolean | null
  ngayKy: string // dd/MM/yyyy
  lienQuan: LienQuan | null
}

const dmY = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}
const soThuong = (s: string) => {
  const n = Number(String(s ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

// ───────────── XML (chuẩn TT78/NĐ123) ─────────────

const the = (xml: string, tag: string) => new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${tag}>`).exec(xml)?.[1]?.trim() ?? ''
const giaiMa = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

/** Đọc XML hoá đơn. Không phải hoá đơn (không có thẻ HDon/TTChung) thì null. */
export function docXmlGoc(xml: string, tenFile = ''): HoaDonGoc | null {
  const ttc = the(xml, 'TTChung')
  if (!ttc || !/<(?:\w+:)?HDon[\s>]/.test(xml)) return null
  const ban = the(xml, 'NBan')
  const mua = the(xml, 'NMua')
  const tt = the(xml, 'TToan')
  const dong: DongHang[] = []
  for (const m of xml.matchAll(/<(?:\w+:)?HHDVu(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?HHDVu>/g)) {
    const h = m[1]
    if (the(h, 'TChat') === '4') continue // dòng ghi chú
    dong.push({ ten: giaiMa(the(h, 'THHDVu')), dvt: giaiMa(the(h, 'DVTinh')), sl: soThuong(the(h, 'SLuong')), dg: soThuong(the(h, 'DGia')), tt: soThuong(the(h, 'ThTien')), ts: the(h, 'TSuat') })
  }
  const chuaThue = soThuong(the(tt, 'TgTCThue'))
  const thue = soThuong(the(tt, 'TgTThue'))
  const lq = the(xml, 'TTHDLQuan')
  const tc = the(lq, 'TCHDon')
  const kyBanXml = /<(?:\w+:)?NBan>\s*<(?:\w+:)?Signature[\s>]/.test(xml) || /<(?:\w+:)?Signature[^>]*Id="seller"/i.test(xml)
  // Giờ ký của người bán: thẻ SigningTime đầu tiên (nằm trong chữ ký người bán)
  const dsCks = the(xml, 'DSCKS')
  const ngayKy = dmY(the(the(dsCks, 'NBan') || dsCks, 'SigningTime'))
  return {
    nguon: 'xml', tenFile,
    kyHieuMau: the(ttc, 'KHMSHDon'), kyHieu: the(ttc, 'KHHDon'), so: String(Number(the(ttc, 'SHDon')) || the(ttc, 'SHDon')),
    ngay: dmY(the(ttc, 'NLap')),
    mstBan: the(ban, 'MST'), tenBan: giaiMa(the(ban, 'Ten')),
    mstMua: the(mua, 'MST'), tenMua: giaiMa(the(mua, 'Ten')),
    chuaThue, thue, tong: soThuong(the(tt, 'TgTTTBSo')) || chuaThue + thue,
    dong,
    mccqt: the(xml, 'MCCQT'),
    kyBan: kyBanXml,
    ngayKy,
    lienQuan: (tc === '1' || tc === '2') && the(lq, 'SHDCLQuan')
      ? { loai: tc === '1' ? 'thayThe' : 'dieuChinh', kyHieu: the(lq, 'KHHDCLQuan'), so: String(Number(the(lq, 'SHDCLQuan')) || the(lq, 'SHDCLQuan')), ngay: dmY(the(lq, 'NLHDCLQuan')) }
      : null,
  }
}

// ───────────── PDF (bản thể hiện) — đoán có căn cứ từ chữ trong file ─────────────

function tienPdf(s: string | undefined): number {
  if (!s) return 0
  const n = Number(s.replace(/[.,](?=\d{3}(?!\d))/g, '').replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n) : 0
}
const dau = (text: string, re: RegExp) => re.exec(text)?.[1]?.trim() ?? ''
function catNhanSau(s: string): string {
  return s.split(/\s+(?:Điện thoại|Email|E-mail|Fax|Ngân hàng|Số tài khoản|Mã số thuế|MST|Website|Địa chỉ)\s*[:(]/i)[0].trim()
}
const DVT = new Set(('tấn kg tạ m3 khối chuyến xe lần cái chiếc bộ lít bao túi thùng tháng ngày km m tờ quyển hộp gói chai lon con ' +
  'đĩa bình mẹt bát suất phần két người đêm phòng nồi cốc ly ấm đôi vé xuất cặp tô bàn mâm kiện cuộn').split(' '))
const NHAN_MST = /(?:Mã số thuế|MST|Căn cước công dân|CCCD|Mã số định danh)[ \t]*(?:\([^)]*\))?[ \t]*:[ \t]*([\d \t-]{9,32})/i

/** Bản thể hiện chưa cấp số ("Số : <Chưa cấp số>") — bản nháp */
export function laBanNhap(lines: string[]): boolean {
  return lines.some((l) => /Số[^:\n]*:\s*<?\s*Chưa\s+cấp\s+số/i.test(l))
}

function soHoaDonPdf(lines: string[]): string {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].replace(/Mẫu\s*số[^:\n]*:[ \t]*\S+/gi, '')
    const cung = /(?:^|\s)Số(?:\s*hóa đơn)?[ \t]*(?:\([^)]*\))?[ \t]*:[ \t]*((?:\d[ \t]?){1,12})(?!\S*\d)/i.exec(l)
    if (cung) return String(Number(cung[1].replace(/\s/g, '')))
    if (/(?:^|\s)Số(?:\s*hóa đơn)?[ \t]*(?:\([^)]*\))?[ \t]*:[ \t]*$/i.test(l)) {
      for (const sau of lines.slice(i + 1, i + 4)) {
        if (/Mã|MST|Ngày/i.test(sau)) continue
        const m = /(?:^|\s)0*(\d{1,8})[ \t]*$/.exec(sau)
        if (m) return m[1]
      }
    }
  }
  return ''
}

function kyHieuPdf(lines: string[], all: string): { mau: string; kh: string } {
  const kh = dau(all, /Ký hiệu[^:\n]*:[ \t]*([0-9]?[A-Z][A-Z0-9]{4,7})\b/i).toUpperCase()
  const mau = dau(all, /Mẫu số[^:\n]*:[ \t]*(\d)/i)
  if (/^\d/.test(kh)) return { mau: kh[0], kh: kh.slice(1) }
  if (kh) return { mau, kh }
  const t = /\b([12])(C\d{2}[A-Z]{2,3})\b/.exec(lines.slice(0, 8).join(' '))
  return t ? { mau: t[1], kh: t[2] } : { mau, kh: '' }
}

function lienQuanPdf(all: string): LienQuan | null {
  const m = /(thay\s*thế|điều\s*chỉnh)\s+cho\s+(?:hóa|hoá)\s+đơn([^\n]{0,200}(?:\n[^\n]{0,120})?)/i.exec(all)
  if (!m) return null
  const t = m[2].replace(/\n/g, ' ')
  const kh = /ký\s*hiệu\s*:?\s*[0-9]?([A-Z][A-Z0-9]{4,7})/i.exec(t)?.[1]?.toUpperCase() ?? ''
  const so = /(?:^|[\s,(])số\s*:?\s*0*(\d{1,8})(?!\d)/i.exec(t.replace(/Mẫu\s*số\s*:?\s*\d+/gi, ''))?.[1] ?? ''
  if (!so) return null
  const d = /ngày\s*(\d{1,2})\s*tháng\s*(\d{1,2})\s*năm\s*(\d{4})/i.exec(t) ?? /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t)
  return { loai: /thay/i.test(m[1]) ? 'thayThe' : 'dieuChinh', kyHieu: kh, so, ngay: d ? `${d[1].padStart(2, '0')}/${d[2].padStart(2, '0')}/${d[3]}` : '' }
}

/** Dò hoá đơn từ các dòng chữ của PDF. Dò được dưới 4 thông tin chính thì null (PDF scan/ảnh, hoặc mẫu lạ). */
export function docPdfGoc(lines: string[], tenFile = ''): HoaDonGoc | null {
  if (laBanNhap(lines)) return null
  const all = lines.join('\n')
  const viTriMua = all.search(/Tên khách hàng|Họ (?:và )?tên người mua|Người mua hàng\s*\(|Người mua hàng\s*:|Tên người mua|Đơn vị mua|\(Buyer\)|\(Customer/i)
  const phanBan = viTriMua > 0 ? all.slice(0, viTriMua) : all
  const phanMua = viTriMua > 0 ? all.slice(viTriMua) : ''
  const ngay = /Ngày\s*(?:\([^)]*\))?\s*(\d{1,2})\s*tháng\s*(?:\([^)]*\))?\s*(\d{1,2})\s*năm\s*(?:\([^)]*\))?\s*(\d{4})/i.exec(all)
  const { mau, kh } = kyHieuPdf(lines, all)

  let tenBan = catNhanSau(dau(phanBan, /(?:Đơn vị bán(?: hàng)?|Tên người bán|Người bán(?: hàng)?|Tên hộ kinh doanh|Chủ hộ kinh doanh)[ \t]*(?:\([^)]*\))?[ \t]*:[ \t]*(.+)/i))
  if (!tenBan) {
    const sl = phanBan.split('\n')
    const i = sl.findIndex((l) => NHAN_MST.test(l))
    const truoc = i > 0 ? sl[i - 1].trim() : ''
    if (truoc && !truoc.includes(':') && truoc.length > 5) tenBan = truoc
  }
  const tenMua = catNhanSau(dau(phanMua, /(?:Tên đơn vị|Đơn vị mua(?: hàng)?|Tên khách hàng|Tên người mua|Tên công ty)[ \t]*(?:\([^)]*\))?[ \t]*:[ \t]*(.+)/i))
    || catNhanSau(dau(phanMua, /(?:Họ (?:và )?tên người mua(?: hàng)?|Người mua hàng)[ \t]*(?:\([^)]*\))?[ \t]*:[ \t]*(.+)/i))

  // Tiền: chỉ dò trong CÙNG MỘT DÒNG để không lấy nhầm số ở dòng dưới
  let chuaThue = 0, thue = 0, tong = 0
  const thueRieng = tienPdf(dau(all, /Tiền thuế (?:GTGT|giá trị gia tăng)[^:\n]*:[ \t]*'?([\d.,]+)/i))
  const ch = /Cộng tiền (?:bán )?hàng(?: hóa, dịch vụ| hóa| hoá, dịch vụ)?[^:\n]*:[ \t]*'?([\d.,]+)(?:[ \t]+([\d.,]+))?/i.exec(all)
  const tt = /Tổng (?:cộng )?(?:số )?tiền thanh toán[^:\n]*:[ \t]*'?([\d.,]+)(?:[ \t]+([\d.,]+)[ \t]+([\d.,]+))?/i.exec(all)
  const tc = /Tổng cộng[ \t]*(?:\([^)]*\))?[ \t]*:[ \t]*([\d.,]+)[ \t]+([\d.,]+)[ \t]+([\d.,]+)/i.exec(all)
  const ba = tt?.[3] ? tt : tc
  if (ba) {
    chuaThue = tienPdf(ba[1]); thue = tienPdf(ba[2]); tong = tienPdf(ba[3])
  } else {
    const cuoiDong = (nhan: string) => tienPdf(new RegExp(`${nhan}[^:\\n]*?[ \\t](\\d[\\d.,]*\\d)[ \\t]*$`, 'im').exec(all)?.[1])
    chuaThue = tienPdf(ch?.[1]) || cuoiDong('(?:Tổng )?Cộng tiền (?:bán )?hàng') || cuoiDong('^Tổng tiền chưa (?:có )?thuế')
    thue = tienPdf(ch?.[2]) || thueRieng || cuoiDong('Tiền thuế (?:GTGT|giá trị gia tăng)') || cuoiDong('^Tổng tiền thuế')
    tong = tienPdf(tt?.[1]) || cuoiDong('Tổng (?:cộng )?(?:số )?tiền thanh toán') || chuaThue + thue
    // Mẫu in nhãn "Tổng tiền chưa thuế" lẫn trong dòng tiêu đề bảng: suy ra từ tổng thanh toán − thuế
    if (!chuaThue && tong && thue) chuaThue = tong - thue
  }

  const dong: DongHang[] = []
  // dòng chữ thuần (không phải tiêu đề, không phải dòng tiền) có thể là phần tên hàng bị tràn dòng
  const laChuTen = (l?: string) => !!l && /\p{L}{2,}/u.test(l) && !/^\d{1,3} /.test(l) && !/^(STT|A B C|\(1\)|Tổng|Cộng|Tiền|Thuế|Số tiền|Đơn vị|tính)/i.test(l) && !/:/.test(l)
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    const m = /^(\d{1,3}) (.+?) ([\d.,]+) ([\d.,]+) ([\d.,]+)(?: (\d+%|KCT|KKKNT)(?: [\d.,]+)?)?$/.exec(l)
    if (!m) continue
    const thanhTien = tienPdf(m[5])
    // số lượng có thể lẻ (63,81 tấn): đổi dấu phẩy thập phân
    const sl = Number(m[3].replace(/\.(?=\d{3}(?!\d))/g, '').replace(',', '.'))
    if (!thanhTien || !sl) continue
    const tu = m[2].split(' ')
    const cuoi = tu.at(-1)!
    const chiDvt = tu.length === 1 && DVT.has(cuoi.toLowerCase())
    const coDvt = chiDvt || (tu.length > 1 && DVT.has(cuoi.toLowerCase()))
    let ten = chiDvt ? '' : coDvt ? tu.slice(0, -1).join(' ') : m[2]
    // Mẫu in tên hàng ở dòng trên (và phần còn lại ở dòng dưới) dòng số liệu
    if (!ten) ten = [laChuTen(lines[i - 1]) ? lines[i - 1] : '', laChuTen(lines[i + 1]) ? lines[i + 1] : ''].filter(Boolean).join(' ')
    dong.push({ ten, dvt: coDvt ? cuoi : '', sl, dg: tienPdf(m[4]), tt: thanhTien, ts: m[6] ?? '' })
  }

  const kyBoi = /(?:Ký bởi|Được ký bởi|Signed by|Signature Valid)/i.test(all)
  // "Ký ngày : 01/01/2025", "Ngày ký: 21 / 03 / 2025" — không cắt nhầm "18/01" thành "8/01"
  const ngayKyM = /(?:Ký ngày|Ngày ký)\s*(?:\([^)]*\))?\s*:?\s*(?<!\d)(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})/i.exec(all)
    ?? /(?:Ký bởi|Signed by)[\s\S]{0,160}?(?<!\d)(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})/i.exec(all)
  const h: HoaDonGoc = {
    nguon: 'pdf', tenFile,
    kyHieuMau: mau, kyHieu: kh, so: soHoaDonPdf(lines),
    ngay: ngay ? `${ngay[1].padStart(2, '0')}/${ngay[2].padStart(2, '0')}/${ngay[3]}` : '',
    mstBan: dau(phanBan, NHAN_MST).replace(/\s/g, ''), tenBan,
    mstMua: dau(phanMua, NHAN_MST).replace(/\s/g, ''), tenMua,
    chuaThue, thue, tong,
    dong,
    mccqt: dau(all, /Mã (?:của )?(?:cơ quan thuế|CQT)[^:\n]*:[ \t]*([0-9A-F]{20,40})/i),
    kyBan: kyBoi ? true : null,
    ngayKy: ngayKyM ? `${ngayKyM[1].padStart(2, '0')}/${ngayKyM[2].padStart(2, '0')}/${ngayKyM[3]}` : '',
    lienQuan: lienQuanPdf(all),
  }
  const thay = [h.so, h.ngay, h.mstBan, h.chuaThue || h.tong].filter(Boolean).length
  return thay >= 4 ? h : null
}

export interface PdfTextItem {
  str: string
  transform: number[]
}

/** Ghép các mảnh chữ của PDF thành từng dòng (cùng độ cao trên trang), trái sang phải */
export function ghepDong(items: PdfTextItem[]): string[] {
  const rows: { y: number; parts: { x: number; s: string }[] }[] = []
  for (const it of items) {
    if (!it.str.trim()) continue
    const x = it.transform[4]
    const y = it.transform[5]
    let row = rows.find((r) => Math.abs(r.y - y) < 3)
    if (!row) rows.push((row = { y, parts: [] }))
    row.parts.push({ x, s: it.str })
  }
  return rows.sort((a, b) => b.y - a.y).map((r) => r.parts.sort((a, b) => a.x - b.x).map((p) => p.s).join(' ').replace(/\s+/g, ' ').trim())
}

// ───────────── Phân loại theo tên hàng ─────────────

export type NhomHang = 'vienNen' | 'vanChuyen' | 'khac'
export const TEN_NHOM: Record<NhomHang | 'banRa', string> = { vienNen: 'Viên nén / nguyên liệu gỗ', vanChuyen: 'Vận chuyển', khac: 'Chi phí khác', banRa: 'Bán ra' }

/** Quy tắc mặc định (từ khoá trong tên hàng). Thứ tự: vận chuyển trước (vd "Cước vận chuyển viên nén") */
export const QUY_TAC_MAC_DINH: { nhom: NhomHang; tuKhoa: string[] }[] = [
  { nhom: 'vanChuyen', tuKhoa: ['cước', 'vận chuyển', 'vận tải', 'thuê xe', 'chở hàng', 'phí xe'] },
  { nhom: 'vienNen', tuKhoa: ['viên nén', 'pellet', 'mùn cưa', 'dăm gỗ', 'dăm', 'vỏ băm', 'ván vỏ', 'củi', 'gỗ', 'trấu', 'sinh khối'] },
]

const boDau = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

export function phanLoaiDong(ten: string, quyTac = QUY_TAC_MAC_DINH): NhomHang {
  const t = boDau(ten)
  for (const q of quyTac) if (q.tuKhoa.some((k) => t.includes(boDau(k)))) return q.nhom
  return 'khac'
}

/** Nhóm của cả hoá đơn = nhóm chiếm nhiều tiền nhất trong các dòng hàng. Hoá đơn bán ra -> 'banRa' */
export function nhomHoaDon(h: HoaDonGoc, mstCty: string, quyTac = QUY_TAC_MAC_DINH): NhomHang | 'banRa' {
  if (h.mstBan === mstCty) return 'banRa'
  const cong: Record<NhomHang, number> = { vienNen: 0, vanChuyen: 0, khac: 0 }
  for (const d of h.dong) cong[phanLoaiDong(d.ten, quyTac)] += Math.abs(d.tt) || 1
  if (!h.dong.length) return 'khac'
  return (Object.entries(cong) as [NhomHang, number][]).sort((a, b) => b[1] - a[1])[0][0]
}

/** Tổng số lượng theo đơn vị cho một nhóm hàng (vd. tấn viên nén) */
export function tongSoLuong(h: HoaDonGoc, nhom: NhomHang, quyTac = QUY_TAC_MAC_DINH): Record<string, number> {
  const kq: Record<string, number> = {}
  for (const d of h.dong) if (phanLoaiDong(d.ten, quyTac) === nhom) kq[(d.dvt || '?').toLowerCase()] = (kq[(d.dvt || '?').toLowerCase()] ?? 0) + d.sl
  return kq
}

// ───────────── Rơ-le kiểm tra từng hoá đơn ─────────────

const THUE_SUAT_HOP_LE = /^(0|5|8|10)%$|^(KCT|KKKNT|KHAC:.*)$/i
/** Từ 01/07/2025 (Luật thuế GTGT 2024): hoá đơn mua từ 5 triệu phải thanh toán không dùng tiền mặt mới được khấu trừ */
export const NGUONG_KHONG_TIEN_MAT = 5_000_000

export function kiemHoaDon(h: HoaDonGoc, mstCty: string): CanhBao[] {
  const kq: CanhBao[] = []
  const ten = `HĐ ${h.kyHieu}-${h.so} (${h.tenFile})`
  const mua = h.mstMua === mstCty && h.mstBan !== mstCty
  // Ký hiệu bắt đầu bằng C = hoá đơn CÓ mã của CQT. PDF nhiều mẫu (bản chuyển đổi) không in mã -> chỉ kiểm với XML
  if (h.nguon === 'xml' && !h.mccqt && /^C/i.test(h.kyHieu)) kq.push({ muc: 'loi', noiDung: `${ten}: ký hiệu ${h.kyHieu} là hoá đơn có mã của CQT nhưng XML không có mã — kiểm trên cổng thuế` })
  if (h.nguon === 'xml' && h.kyBan === false) kq.push({ muc: 'loi', noiDung: `${ten}: XML không có chữ ký số của người bán` })
  if (h.ngayKy && h.ngay && h.ngayKy !== h.ngay) kq.push({ muc: 'chu_y', noiDung: `${ten}: ngày ký ${h.ngayKy} khác ngày lập ${h.ngay}` })
  if (h.lienQuan) kq.push({ muc: 'chu_y', noiDung: `${ten}: là hoá đơn ${h.lienQuan.loai === 'thayThe' ? 'THAY THẾ' : 'ĐIỀU CHỈNH'} cho HĐ ${h.lienQuan.kyHieu}-${h.lienQuan.so}${h.lienQuan.ngay ? ` ngày ${h.lienQuan.ngay}` : ''} — kiểm hoá đơn cũ đã loại khỏi kê khai chưa` })
  const lech = h.dong.filter((d) => d.ts && !THUE_SUAT_HOP_LE.test(d.ts.replace(/\s/g, '')))
  if (lech.length) kq.push({ muc: 'chu_y', noiDung: `${ten}: thuế suất lạ ${[...new Set(lech.map((d) => d.ts))].join(', ')}` })
  const cacTs = [...new Set(h.dong.map((d) => d.ts).filter(Boolean))]
  if (cacTs.length > 1) kq.push({ muc: 'chu_y', noiDung: `${ten}: một hoá đơn nhiều thuế suất (${cacTs.join(', ')}) — khi kê phụ lục giảm thuế chỉ lấy phần 8%` })
  const congDong = h.dong.reduce((s, d) => s + d.tt, 0)
  if (h.dong.length && h.chuaThue && Math.abs(congDong - h.chuaThue) > Math.max(1000, h.dong.length * 2)) {
    kq.push({ muc: 'chu_y', noiDung: `${ten}: cộng các dòng hàng ${tien(congDong)} đ khác tổng chưa thuế ${tien(h.chuaThue)} đ${h.nguon === 'pdf' ? ' (có thể PDF đọc thiếu dòng)' : ''}` })
  }
  if (mua && h.tong >= NGUONG_KHONG_TIEN_MAT && nam(h.ngay) * 100 + thang(h.ngay) >= 202507) {
    kq.push({ muc: 'chu_y', noiDung: `${ten}: hoá đơn mua ${tien(h.tong)} đ (từ 5 triệu) — phải có chứng từ thanh toán không dùng tiền mặt mới được khấu trừ` })
  }
  return kq
}
const nam = (dmy: string) => Number(dmy.slice(6, 10)) || 0
const thang = (dmy: string) => Number(dmy.slice(3, 5)) || 0

// ───────────── So hoá đơn gốc với danh sách Excel (cổng thuế) ─────────────

/** Khoá hoá đơn: cùng cách sổ hoá đơn trong kho (bán ra không cần MST người bán) */
export const khoaGoc = (h: { mstBan: string; kyHieu: string; so: string }, mstCty: string) => {
  const loai: LoaiHD = h.mstBan === mstCty ? 'ban' : 'mua'
  return `${loai}|${loai === 'ban' ? '' : h.mstBan}|${h.kyHieu}|${Number(h.so) || h.so}`
}

export interface KetQuaSoKhop {
  /** Hoá đơn có trong Excel cổng thuế (còn hiệu lực) mà CHƯA có file gốc XML/PDF */
  thieuGoc: { l: LoaiHD; kh: string; so: string; ng: string; ten: string; v: number; t: number }[]
  /** Có file gốc nhưng tiền khác Excel */
  lechTien: { l: LoaiHD; kh: string; so: string; excelV: number; gocV: number; excelT: number; gocT: number; tenFile: string }[]
  /** File gốc không thấy trong Excel (có thể Excel tải thiếu tháng, hoặc hoá đơn của đơn vị khác) */
  khongCoTrongExcel: { kh: string; so: string; ng: string; tenFile: string }[]
  soExcel: number
  soCoGoc: number
}

export function soKhopGoc(kho: Kho, mst: string, goc: HoaDonGoc[]): KetQuaSoKhop {
  const theoKhoa = new Map(goc.map((h) => [khoaGoc(h, mst), h]))
  const kq: KetQuaSoKhop = { thieuGoc: [], lechTien: [], khongCoTrongExcel: [], soExcel: 0, soCoGoc: 0 }
  const daGap = new Set<string>()
  for (const [k, g] of Object.entries(kho.hoaDon?.[mst] ?? {})) {
    if (g.x) continue // chỉ biết từ file lẻ, không phải danh sách cổng thuế
    if (!conHieuLuc({ trangThai: g.tt ?? '' } as HoaDon)) continue
    kq.soExcel++
    const h = theoKhoa.get(k)
    if (!h) {
      kq.thieuGoc.push({ l: g.l, kh: g.kh, so: g.so, ng: g.ng, ten: g.ten, v: g.v, t: g.t })
      continue
    }
    daGap.add(k)
    kq.soCoGoc++
    if (Math.abs(h.chuaThue - g.v) > 1 || Math.abs(h.thue - g.t) > 1) kq.lechTien.push({ l: g.l, kh: g.kh, so: g.so, excelV: g.v, gocV: h.chuaThue, excelT: g.t, gocT: h.thue, tenFile: h.tenFile })
  }
  for (const [k, h] of theoKhoa) {
    const g = kho.hoaDon?.[mst]?.[k]
    // chỉ biết từ chính file gốc (dấu x) = chưa thấy trong danh sách cổng thuế
    if (!daGap.has(k) && (!g || g.x)) kq.khongCoTrongExcel.push({ kh: h.kyHieu, so: h.so, ng: h.ngay, tenFile: h.tenFile })
  }
  const sx = (a: { ng: string }, b: { ng: string }) => a.ng.split('/').reverse().join('').localeCompare(b.ng.split('/').reverse().join(''))
  kq.thieuGoc.sort(sx)
  return kq
}

/** Hoá đơn gốc -> dạng hoá đơn của sổ (để nạp như file XML lẻ khi chưa có Excel) */
export function gocThanhHoaDon(h: HoaDonGoc, mstCty: string): HoaDon {
  return {
    loai: h.mstBan === mstCty ? 'ban' : 'mua', kyHieuMau: h.kyHieuMau, kyHieu: h.kyHieu, so: h.so, ngay: h.ngay,
    mstBan: h.mstBan, tenBan: h.tenBan, mstMua: h.mstMua, tenMua: h.tenMua, chuaThue: h.chuaThue, thue: h.thue,
    trangThai: h.lienQuan ? (h.lienQuan.loai === 'thayThe' ? 'Hóa đơn thay thế' : 'Hóa đơn điều chỉnh') : 'Hóa đơn mới', file: h.tenFile,
  }
}

// ───────────── Tổng hợp cho màn hình / AI ─────────────

export interface QuyHang {
  khoa: string // 2025-Q2
  /** Số lượng viên nén / nguyên liệu gỗ theo đơn vị (vd { tấn: 120.5 }) */
  muaVienNen: Record<string, number>
  banRa: Record<string, number>
  tienMuaVienNen: number
  tienVanChuyen: number
  tienKhac: number
  tienBan: number
  soHoaDon: number
}

export interface TongHopGoc {
  soGoc: number
  soXml: number
  soPdf: number
  soKhop: KetQuaSoKhop
  kiemTra: CanhBao[]
  theoQuy: QuyHang[]
}

const congDon = (a: Record<string, number>, b: Record<string, number>) => {
  for (const [k0, v0] of Object.entries(b)) {
    // quy kg về tấn để cộng chung (hoá đơn ghi lẫn "Tấn" / "tấn" / "kg")
    const laTan = /^(tấn|tan|t)$/i.test(k0)
    const k = laTan || k0 === 'kg' ? 'tấn' : k0
    const v = k0 === 'kg' ? v0 / 1000 : v0
    a[k] = Math.round(((a[k] ?? 0) + v) * 1000) / 1000
  }
}

export function tongHopGoc(kho: Kho, mst: string, quyTac = QUY_TAC_MAC_DINH): TongHopGoc {
  // Hoá đơn đã bị thay thế / huỷ (theo danh sách cổng thuế) thì không tính vào số lượng, tiền
  const goc = Object.values(kho.goc?.[mst] ?? {}).filter((h) => {
    const g = kho.hoaDon?.[mst]?.[khoaGoc(h, mst)]
    return !g || conHieuLuc({ trangThai: g.tt ?? '' } as HoaDon)
  })
  const quy = new Map<string, QuyHang>()
  for (const h of goc) {
    const m = /^\d{2}\/(\d{2})\/(\d{4})$/.exec(h.ngay)
    if (!m) continue
    const khoa = `${m[2]}-Q${Math.ceil(Number(m[1]) / 3)}`
    const q = quy.get(khoa) ?? { khoa, muaVienNen: {}, banRa: {}, tienMuaVienNen: 0, tienVanChuyen: 0, tienKhac: 0, tienBan: 0, soHoaDon: 0 }
    q.soHoaDon++
    if (h.mstBan === mst) {
      q.tienBan += h.chuaThue
      for (const d of h.dong) congDon(q.banRa, { [(d.dvt || '?').toLowerCase()]: d.sl })
    } else {
      for (const d of h.dong) {
        const n = phanLoaiDong(d.ten, quyTac)
        if (n === 'vienNen') {
          q.tienMuaVienNen += d.tt
          congDon(q.muaVienNen, { [(d.dvt || '?').toLowerCase()]: d.sl })
        } else if (n === 'vanChuyen') q.tienVanChuyen += d.tt
        else q.tienKhac += d.tt
      }
      if (!h.dong.length) q.tienKhac += h.chuaThue
    }
    quy.set(khoa, q)
  }
  return {
    soGoc: goc.length,
    soXml: goc.filter((h) => h.nguon === 'xml').length,
    soPdf: goc.filter((h) => h.nguon === 'pdf').length,
    soKhop: soKhopGoc(kho, mst, goc),
    kiemTra: goc.flatMap((h) => kiemHoaDon(h, mst)).sort((a, b) => (a.muc === b.muc ? 0 : a.muc === 'loi' ? -1 : 1)),
    theoQuy: [...quy.values()].sort((a, b) => b.khoa.localeCompare(a.khoa)),
  }
}

/** Cảnh báo đưa lên mục "Cần xử lý": lệch tiền giữa file gốc và Excel, lỗi nặng khi kiểm hoá đơn, còn thiếu file gốc */
export function canhBaoGoc(t: TongHopGoc): CanhBao[] {
  const kq: CanhBao[] = []
  for (const x of t.soKhop.lechTien) {
    kq.push({ muc: 'loi', noiDung: `HĐ ${x.kh}-${x.so} (${x.tenFile}): file gốc ghi ${tien(x.gocV)} đ chưa thuế / thuế ${tien(x.gocT)} đ, danh sách cổng thuế ghi ${tien(x.excelV)} / ${tien(x.excelT)} đ — kiểm lại` })
  }
  kq.push(...t.kiemTra.filter((c) => c.muc === 'loi'))
  if (t.soGoc && t.soKhop.thieuGoc.length) {
    const mua = t.soKhop.thieuGoc.filter((x) => x.l === 'mua').length
    kq.push({ muc: 'chu_y', noiDung: `${t.soKhop.thieuGoc.length}/${t.soKhop.soExcel} hoá đơn trên cổng thuế chưa có file gốc XML/PDF (${mua} mua vào) — xem mục "Hoá đơn gốc"` })
  }
  return kq
}

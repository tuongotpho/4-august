import type { Dossier, Invoice } from './types.js'

/**
 * Tỉnh / thành phố của hóa đơn — suy ra từ địa chỉ người bán (không lưu thêm trường nào).
 * Theo 34 tỉnh, thành sau sắp xếp 01/7/2025: địa chỉ ghi tên tỉnh cũ được quy về tỉnh mới
 * (vd "tỉnh Thái Bình" -> Hưng Yên) để gom nhóm thống nhất giữa hóa đơn cũ và mới.
 */
export const CHUA_RO_TINH = '(chưa rõ tỉnh)'

// tỉnh mới: [tên hiển thị, ...tên tỉnh cũ gộp vào / tên gọi khác]
const DS: [string, ...string[]][] = [
  ['Hà Nội'], ['Huế', 'Thừa Thiên Huế'], ['Lai Châu'], ['Điện Biên'], ['Sơn La'], ['Lạng Sơn'], ['Quảng Ninh'],
  ['Thanh Hóa'], ['Nghệ An'], ['Hà Tĩnh'], ['Cao Bằng'],
  ['Tuyên Quang', 'Hà Giang'], ['Lào Cai', 'Yên Bái'], ['Thái Nguyên', 'Bắc Kạn', 'Bắc Cạn'], ['Phú Thọ', 'Vĩnh Phúc', 'Hòa Bình'],
  ['Bắc Ninh', 'Bắc Giang'], ['Hưng Yên', 'Thái Bình'], ['Hải Phòng', 'Hải Dương'], ['Ninh Bình', 'Hà Nam', 'Nam Định'],
  ['Quảng Trị', 'Quảng Bình'], ['Đà Nẵng', 'Quảng Nam'], ['Quảng Ngãi', 'Kon Tum'], ['Gia Lai', 'Bình Định'],
  ['Khánh Hòa', 'Ninh Thuận'], ['Lâm Đồng', 'Đắk Nông', 'Đăk Nông', 'Bình Thuận'], ['Đắk Lắk', 'Đăk Lăk', 'Đắc Lắc', 'Phú Yên'],
  ['TP Hồ Chí Minh', 'Hồ Chí Minh', 'HCM', 'Sài Gòn', 'Bình Dương', 'Bà Rịa Vũng Tàu', 'Vũng Tàu'],
  ['Đồng Nai', 'Bình Phước'], ['Tây Ninh', 'Long An'], ['Cần Thơ', 'Sóc Trăng', 'Hậu Giang'], ['Vĩnh Long', 'Bến Tre', 'Trà Vinh'],
  ['Đồng Tháp', 'Tiền Giang'], ['Cà Mau', 'Bạc Liêu'], ['An Giang', 'Kiên Giang'],
]

const khongDau = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[-–.]/g, ' ').replace(/\s+/g, ' ').trim()

// tên không dấu -> tỉnh mới; tên dài trước để "ba ria vung tau" khớp trước "vung tau"
const BANG = new Map<string, string>()
for (const [moi, ...khac] of DS) for (const t of [moi, ...khac]) BANG.set(khongDau(t), moi)
const TEN = [...BANG.keys()].sort((a, b) => b.length - a.length)

// bỏ tiền tố hành chính ở đầu một đoạn địa chỉ
const TIEN_TO = /^(tinh|thanh pho|tp|t p|t)\s+/

export function tinhTuDiaChi(diaChi: string): string {
  const doan = khongDau(diaChi).split(/[,;]/).map((s) => s.trim()).filter((s) => s && s !== 'viet nam' && s !== 'vietnam' && s !== 'vn')
  // tỉnh thường ở cuối địa chỉ: xét từ đoạn cuối lên
  for (let i = doan.length - 1; i >= 0; i--) {
    const s = doan[i].replace(TIEN_TO, '').replace(/\s*viet ?nam$/, '').trim()
    const t = BANG.get(s)
    if (t) return t
  }
  // không tách được bằng dấu phẩy: tìm "tỉnh X" / "thành phố X" / "TP X" ở bất kỳ đâu
  const chu = ` ${doan.join(' ')} `
  for (const ten of TEN) if (new RegExp(`(tinh|thanh pho|tp) ${ten} `).test(chu)) return BANG.get(ten)!
  return CHUA_RO_TINH
}

export const tinhCua = (inv: Pick<Invoice, 'diaChiNguoiBan'>) => tinhTuDiaChi(inv.diaChiNguoiBan || '')

/** Các tỉnh của một hồ sơ (theo thứ tự hóa đơn, không lặp). */
export const tinhHoSo = (d: Dossier) => [...new Set(d.invoices.map(tinhCua))]

/** Danh sách tỉnh có trong các hóa đơn, nhiều hóa đơn nhất trước; "(chưa rõ)" cuối. */
export function demTinh(invs: Pick<Invoice, 'diaChiNguoiBan'>[]): { tinh: string; soHd: number }[] {
  const m = new Map<string, number>()
  for (const i of invs) m.set(tinhCua(i), (m.get(tinhCua(i)) ?? 0) + 1)
  return [...m]
    .map(([tinh, soHd]) => ({ tinh, soHd }))
    .sort((a, b) => (a.tinh === CHUA_RO_TINH ? 1 : b.tinh === CHUA_RO_TINH ? -1 : b.soHd - a.soHd || a.tinh.localeCompare(b.tinh, 'vi')))
}

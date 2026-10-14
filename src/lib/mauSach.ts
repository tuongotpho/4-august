// Mẫu file Excel "sạch" của app: một sheet LichGiang, mỗi cột đúng một ô dữ liệu — nhập vào không phải đoán gì.
// File ATLD_sach.xlsx (làm sạch từ file AppSheet cũ) và file anh tự sửa trong Excel đều theo mẫu này.
import { gioExcel, ngayExcel, type O, type Sheet } from './excel.js'
import { boDau, chuanDiaDiem, doanBuoi, lopMoi, TEN_BUOI, type Buoi, type LopGiang } from './model.js'

export const COT_SACH = [
  'Mã', 'Ngày giảng', 'Số ngày', 'Từ giờ', 'Đến giờ', 'Buổi', 'Hình thức', 'Đối tác', 'Người liên hệ', 'Khách hàng',
  'Địa điểm', 'Nội dung', 'Thù lao', 'Thanh toán', 'Ngày nhận tiền', 'Hủy', 'Ghi chú',
] as const

export const GIA_TRI = {
  buoi: Object.values(TEN_BUOI),
  hinhThuc: ['Trực tiếp', 'Online'],
  thanhToan: ['Đã nhận', 'Chưa nhận'],
}

/** Sheet theo mẫu sạch: dòng đầu có đủ các cột Mã, Ngày giảng, Khách hàng, Thanh toán */
export function laSheetSach(s: Sheet): boolean {
  const td = (s.dong[0] ?? []).map((o) => boDau(String(o ?? '')))
  return ['ma', 'ngay giang', 'khach hang', 'thanh toan'].every((k) => td.includes(k))
}

const p2 = (n: number) => String(n).padStart(2, '0')

function ngay(v: O): string {
  if (typeof v === 'number') return ngayExcel(v)
  const s = String(v ?? '').trim()
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
  if (m) return `${m[3]}-${p2(Number(m[2]))}-${p2(Number(m[1]))}`
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : ''
}

function gio(v: O): string {
  if (typeof v === 'number') return gioExcel(v)
  const m = /^(\d{1,2})[:h](\d{2})?/.exec(String(v ?? '').trim())
  return m ? `${p2(Number(m[1]))}:${m[2] ?? '00'}` : ''
}

function tien(v: O): number | null | undefined {
  if (v === null || v === '') return null
  if (typeof v === 'number') return Math.round(v)
  const s = v.replace(/[.,\s]|đ/g, '')
  return /^\d+$/.test(s) ? Number(s) : undefined // undefined = có chữ nhưng không đọc được
}

export function docSheetSach(s: Sheet, homNay: string): { lop: LopGiang[]; loi: { dong: number; lyDo: string; moTa: string }[] } {
  const td = (s.dong[0] ?? []).map((o) => boDau(String(o ?? '')))
  const cot = (ten: string) => td.indexOf(boDau(ten))
  const lop: LopGiang[] = []
  const loi: { dong: number; lyDo: string; moTa: string }[] = []
  const ids = new Set<string>()
  for (let i = 1; i < s.dong.length; i++) {
    const d = s.dong[i] ?? []
    const o = (ten: string): O => (cot(ten) < 0 ? null : d[cot(ten)] ?? null)
    const chu = (ten: string) => String(o(ten) ?? '').trim()
    if (!chu('Khách hàng') && o('Ngày giảng') === null) continue
    const moTa = `${chu('Khách hàng')} · ${chu('Ngày giảng')}`
    const n = ngay(o('Ngày giảng'))
    if (!n) {
      loi.push({ dong: i + 1, lyDo: 'Ngày giảng không đọc được (cần ngày Excel hoặc dd/mm/yyyy)', moTa })
      continue
    }
    const t = tien(o('Thù lao'))
    if (t === undefined) {
      loi.push({ dong: i + 1, lyDo: `Thù lao "${chu('Thù lao')}" không phải số`, moTa })
      continue
    }
    let id = chu('Mã')
    if (!id || ids.has(id)) id = `${s.ten}-${i + 1}`.replace(/\s+/g, '_')
    ids.add(id)
    const soNgay = Math.max(1, Math.round(Number(o('Số ngày')) || 1))
    const gioBD = gio(o('Từ giờ'))
    const gioKT = gio(o('Đến giờ'))
    const tenBuoi = boDau(chu('Buổi'))
    const buoi = ((Object.entries(TEN_BUOI).find(([, v]) => boDau(v) === tenBuoi)?.[0] as Buoi | undefined) ?? doanBuoi(gioBD, gioKT, soNgay))
    const daNhan = /^da/.test(boDau(chu('Thanh toán')))
    lop.push(lopMoi({
      id,
      ngay: n,
      soNgay,
      gioBD,
      gioKT,
      buoi: soNgay > 1 ? 'nhieu_ngay' : buoi,
      hinhThuc: /online/i.test(chu('Hình thức')) ? 'online' : 'truc_tiep',
      doiTac: chu('Đối tác'),
      lienHe: chu('Người liên hệ'),
      khachHang: chu('Khách hàng'),
      diaDiem: chuanDiaDiem(chu('Địa điểm')),
      noiDung: chu('Nội dung'),
      chiPhi: t,
      thanhToan: daNhan ? 'da' : 'chua',
      ngayTT: daNhan ? ngay(o('Ngày nhận tiền')) : '',
      huy: !!chu('Hủy'),
      ghiChu: chu('Ghi chú'),
      nguon: 'excel',
      canDongBo: n >= homNay,
    }))
  }
  return { lop, loi }
}

// Biến kết quả AI đọc tin nhắn (Zalo dán sang Telegram / ô "Dán tin nhắn" trên web) thành lớp giảng.
// AI chỉ trích; mọi chuẩn hóa (tên đối tác, buổi, giờ mặc định, đối tác theo người liên hệ) làm ở đây để test được.
import {
  boDau, chuanDiaDiem, chuanDoiTac, doanBuoi, docTien, GIO_MAC_DINH, lopMoi, type Buoi, type CaiDat, type HinhThuc, type LopGiang,
} from './model.js'
import type { GoiY } from './tinh.js'

export interface LopAI {
  ngay: string
  soNgay: number
  gioBD: string
  gioKT: string
  buoi: Buoi | ''
  hinhThuc: HinhThuc | ''
  doiTac: string
  lienHe: string
  khachHang: string
  diaDiem: string
  noiDung: string
  chiPhi: number | null
  ghiChu: string
  /** Chỗ AI không chắc (ngày tương đối, thù lao không rõ…) — bot báo lại để anh soát */
  luuY: string
}

export interface KetQuaAI {
  hanhDong: 'tao_lop' | 'thanh_toan' | 'khac'
  lop: LopAI[]
  thanhToan: { tim: string; soTien: number | null; ngay: string } | null
  traLoi: string
}

const GIO = /^([01]\d|2[0-3]):[0-5]\d$/

export function lopTuAI(a: LopAI, cd: CaiDat, gy: GoiY, tinGoc: string, nguon: LopGiang['nguon']): LopGiang {
  const soNgay = Math.max(1, Math.round(a.soNgay || 1))
  let gioBD = GIO.test(a.gioBD) ? a.gioBD : ''
  let gioKT = GIO.test(a.gioKT) ? a.gioKT : ''
  const buoi: Buoi = soNgay > 1 ? 'nhieu_ngay' : a.buoi || doanBuoi(gioBD, gioKT)
  if (!gioBD && a.buoi) [gioBD, gioKT] = GIO_MAC_DINH[buoi]
  if (gioBD && !gioKT) gioKT = buoi === 'ca_ngay' ? '16:30' : ''

  // Tên liên hệ / đối tác: khớp với cách viết đã có trong dữ liệu (bỏ dấu, không phân biệt hoa thường)
  const khop = (ten: string, ds: string[]) => ds.find((x) => boDau(x) === boDau(ten)) ?? ten.trim()
  const lienHe = a.lienHe ? khop(a.lienHe, gy.lienHe.map((x) => x.ten)) : ''
  let doiTac = a.doiTac ? chuanDoiTac(khop(a.doiTac, gy.doiTac), cd) : ''
  if (!doiTac && lienHe) doiTac = gy.lienHe.find((x) => x.ten === lienHe)?.doiTac ?? ''

  const online = a.hinhThuc === 'online' || /online|zoom|meet|teams/i.test(`${a.diaDiem} ${a.noiDung}`)
  return lopMoi({
    ngay: /^\d{4}-\d{2}-\d{2}$/.test(a.ngay) ? a.ngay : lopMoi().ngay,
    soNgay,
    gioBD,
    gioKT,
    buoi,
    hinhThuc: online ? 'online' : 'truc_tiep',
    doiTac,
    lienHe,
    khachHang: a.khachHang.trim(),
    diaDiem: online && !a.diaDiem ? 'Online' : chuanDiaDiem(a.diaDiem),
    noiDung: a.noiDung.trim(),
    chiPhi: a.chiPhi === null ? null : docTien(a.chiPhi),
    ghiChu: a.ghiChu.trim(),
    nguon,
    tinGoc: tinGoc.slice(0, 4000),
  })
}

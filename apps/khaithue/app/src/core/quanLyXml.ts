// QUẢN LÝ HOÁ ĐƠN XML trong kho: phân loại, lọc, nhóm, cộng tiền — phần tính toán thuần (không React) để test được.
// Dữ liệu đầu vào là HoaDonGoc đã lưu (kho.goc[mst]); file này chỉ đọc, không đổi cấu trúc dữ liệu.
import type { HoaDonGoc } from './hoaDonGoc'
import { khoaCuaGoc } from './xemHoaDon'

export type Chieu = 'mua' | 'ban'
/** Theo ký hiệu: chữ đầu C = có mã CQT, K = không mã; chữ thứ 4 M = máy tính tiền */
export type LoaiHd = 'coMa' | 'khongMa' | 'mayTinhTien'
export type TinhTrang = 'goc' | 'thayThe' | 'dieuChinh'
export type CanXem = 'thieuMa' | 'khongKy' | 'chuaCoFile'

export const TEN_LOAI: Record<LoaiHd, string> = { coMa: 'Có mã CQT', khongMa: 'Không mã', mayTinhTien: 'Máy tính tiền' }
export const TEN_TINH_TRANG: Record<TinhTrang, string> = { goc: 'Hoá đơn gốc', thayThe: 'Thay thế HĐ khác', dieuChinh: 'Điều chỉnh HĐ khác' }
export const TEN_CAN_XEM: Record<CanXem, string> = { thieuMa: 'Thiếu mã CQT', khongKy: 'Không có chữ ký số', chuaCoFile: 'Chưa có file gốc trên mây' }

export interface DongXml {
  g: HoaDonGoc
  khoa: string
  chieu: Chieu
  loai: LoaiHd
  tinhTrang: TinhTrang
  /** "MM/yyyy" */
  thang: string
  /** yyyymmdd để xếp */
  ngayXep: string
  doiTac: { mst: string; ten: string }
  thueSuat: string[]
  canXem: CanXem[]
}

export const loaiTheoKyHieu = (kyHieu: string): LoaiHd =>
  kyHieu.charAt(3).toUpperCase() === 'M' ? 'mayTinhTien' : /^K/i.test(kyHieu) ? 'khongMa' : 'coMa'

const ngayXep = (dmy: string) => dmy.split('/').reverse().join('')

/** Dựng danh sách hoá đơn XML của một doanh nghiệp, mới nhất lên đầu */
export function lapDanhSach(goc: Record<string, HoaDonGoc> | undefined, mstCty: string, coFileGoc?: (khoa: string) => boolean): DongXml[] {
  return Object.values(goc ?? {})
    .filter((g) => g.nguon === 'xml')
    .map((g): DongXml => {
      const khoa = khoaCuaGoc(g)
      const chieu: Chieu = g.mstBan === mstCty ? 'ban' : 'mua'
      const loai = loaiTheoKyHieu(g.kyHieu)
      const canXem: CanXem[] = []
      if (loai === 'coMa' && !g.mccqt) canXem.push('thieuMa')
      if (g.kyBan === false && loai !== 'mayTinhTien') canXem.push('khongKy')
      if (coFileGoc && !coFileGoc(khoa)) canXem.push('chuaCoFile')
      return {
        g, khoa, chieu, loai, canXem,
        tinhTrang: g.lienQuan?.loai ?? 'goc',
        thang: g.ngay.slice(3),
        ngayXep: ngayXep(g.ngay),
        doiTac: chieu === 'ban' ? { mst: g.mstMua, ten: g.tenMua } : { mst: g.mstBan, ten: g.tenBan },
        thueSuat: [...new Set((g.dong ?? []).map((d) => d.ts).filter(Boolean))],
      }
    })
    .sort((a, b) => b.ngayXep.localeCompare(a.ngayXep) || (Number(b.g.so) || 0) - (Number(a.g.so) || 0))
}

export interface BoLoc {
  tim: string
  chieu: '' | Chieu
  thang: string
  loai: '' | LoaiHd
  tinhTrang: '' | TinhTrang
  thueSuat: string
  /** chỉ hoá đơn cần xem lại */
  canXem: boolean
  /** MST đối tác */
  doiTac: string
}

export const LOC_TRONG: BoLoc = { tim: '', chieu: '', thang: '', loai: '', tinhTrang: '', thueSuat: '', canXem: false, doiTac: '' }

export const boDau = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

export function locDanhSach(ds: DongXml[], l: BoLoc): DongXml[] {
  const tu = boDau(l.tim).split(/\s+/).filter(Boolean)
  return ds.filter((x) => {
    if (l.chieu && x.chieu !== l.chieu) return false
    if (l.thang && x.thang !== l.thang) return false
    if (l.loai && x.loai !== l.loai) return false
    if (l.tinhTrang && x.tinhTrang !== l.tinhTrang) return false
    if (l.thueSuat && !x.thueSuat.includes(l.thueSuat)) return false
    if (l.canXem && !x.canXem.length) return false
    if (l.doiTac && x.doiTac.mst !== l.doiTac) return false
    if (!tu.length) return true
    const chu = boDau([x.g.kyHieu, x.g.so, x.g.tenBan, x.g.mstBan, x.g.tenMua, x.g.mstMua, x.g.tenFile, ...(x.g.dong ?? []).map((d) => d.ten)].join(' '))
    return tu.every((t) => chu.includes(t))
  })
}

export interface Cong {
  so: number
  chuaThue: number
  thue: number
  tong: number
}

const CONG_TRONG: Cong = { so: 0, chuaThue: 0, thue: 0, tong: 0 }
export const congLai = (ds: DongXml[]): Cong =>
  ds.reduce((a, x) => ({ so: a.so + 1, chuaThue: a.chuaThue + x.g.chuaThue, thue: a.thue + x.g.thue, tong: a.tong + x.g.tong }), CONG_TRONG)

/** Cộng riêng mua vào / bán ra (cộng chung hai chiều không có nghĩa) */
export const congTheoChieu = (ds: DongXml[]) => ({ mua: congLai(ds.filter((x) => x.chieu === 'mua')), ban: congLai(ds.filter((x) => x.chieu === 'ban')) })

export type KieuNhom = '' | 'thang' | 'doiTac' | 'loai' | 'thueSuat'

export interface Nhom {
  khoa: string
  ten: string
  phu: string
  ds: DongXml[]
  cong: Cong
}

/** Nhóm danh sách (đã lọc) để xem gọn; thứ tự trong nhóm giữ như danh sách vào */
export function nhomDanhSach(ds: DongXml[], kieu: KieuNhom): Nhom[] {
  if (!kieu) return [{ khoa: '', ten: '', phu: '', ds, cong: congLai(ds) }]
  const m = new Map<string, { ten: string; phu: string; ds: DongXml[] }>()
  const them = (k: string, ten: string, phu: string, x: DongXml) => {
    const n = m.get(k) ?? { ten, phu, ds: [] }
    n.ds.push(x)
    m.set(k, n)
  }
  for (const x of ds) {
    if (kieu === 'thang') them(x.thang, `Tháng ${x.thang}`, '', x)
    else if (kieu === 'doiTac') them(`${x.chieu}|${x.doiTac.mst}`, x.doiTac.ten || '(không tên)', `${x.chieu === 'ban' ? 'Khách hàng' : 'Nhà cung cấp'} · MST ${x.doiTac.mst || '?'}`, x)
    else if (kieu === 'loai') them(x.loai, TEN_LOAI[x.loai], '', x)
    else for (const ts of x.thueSuat.length ? x.thueSuat : ['(không ghi)']) them(ts, `Thuế suất ${ts}`, '', x)
  }
  const kq = [...m].map(([khoa, n]) => ({ khoa, ...n, cong: congLai(n.ds) }))
  if (kieu === 'thang') kq.sort((a, b) => ngayXep(b.khoa).localeCompare(ngayXep(a.khoa)))
  else if (kieu === 'doiTac') kq.sort((a, b) => b.cong.tong - a.cong.tong)
  else kq.sort((a, b) => b.ds.length - a.ds.length)
  return kq
}

export type CotXep = 'ngay' | 'doiTac' | 'tong' | 'thue'

export function xepDanhSach(ds: DongXml[], cot: CotXep, giam: boolean): DongXml[] {
  const so = (a: DongXml, b: DongXml) => {
    if (cot === 'ngay') return a.ngayXep.localeCompare(b.ngayXep) || (Number(a.g.so) || 0) - (Number(b.g.so) || 0)
    if (cot === 'doiTac') return boDau(a.doiTac.ten).localeCompare(boDau(b.doiTac.ten))
    if (cot === 'tong') return a.g.tong - b.g.tong
    return a.g.thue - b.g.thue
  }
  return [...ds].sort((a, b) => (giam ? -so(a, b) : so(a, b)))
}

/** Đếm số hoá đơn theo từng giá trị (để hiện cạnh nút lọc) */
export function demTheo<K extends string>(ds: DongXml[], lay: (x: DongXml) => K | K[]): Map<K, number> {
  const m = new Map<K, number>()
  for (const x of ds) {
    const v = lay(x)
    for (const k of Array.isArray(v) ? v : [v]) m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

/** Các dòng cho file Excel danh sách đang xem */
export function dongExcel(ds: DongXml[]) {
  return ds.map((x) => ({
    'Ngày': x.g.ngay,
    'Chiều': x.chieu === 'ban' ? 'Bán ra' : 'Mua vào',
    'Mẫu số': x.g.kyHieuMau,
    'Ký hiệu': x.g.kyHieu,
    'Số': x.g.so,
    'Loại': TEN_LOAI[x.loai],
    'Tình trạng': TEN_TINH_TRANG[x.tinhTrang],
    'MST đối tác': x.doiTac.mst,
    'Tên đối tác': x.doiTac.ten,
    'Thuế suất': x.thueSuat.join(', '),
    'Tiền trước thuế': x.g.chuaThue,
    'Tiền thuế': x.g.thue,
    'Tổng thanh toán': x.g.tong,
    'Mã CQT': x.g.mccqt,
    'Cần xem lại': x.canXem.map((c) => TEN_CAN_XEM[c]).join('; '),
    'Tên file': x.g.tenFile,
  }))
}

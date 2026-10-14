// Các phép tính trên danh sách lớp: công nợ, tổng hợp, gợi ý danh mục. Dùng chung web + bot.
import { boDau, daGiang, GIO_MAC_DINH, soNgayGiua, homNay, trangThai, type LopGiang } from './model.js'

export const sapXepTheoNgay = (a: LopGiang, b: LopGiang) =>
  a.ngay.localeCompare(b.ngay) || a.gioBD.localeCompare(b.gioBD) || a.khachHang.localeCompare(b.khachHang)

export interface NhomCongNo {
  doiTac: string
  lop: LopGiang[]
  tong: number
  cuNhat: string // ngày giảng cũ nhất chưa trả
  soNgayCho: number
}

/** Lớp đã giảng mà chưa nhận tiền, gom theo đối tác, nợ lâu nhất lên đầu */
export function congNo(ds: LopGiang[], bayGio = new Date()): NhomCongNo[] {
  const nhom = new Map<string, LopGiang[]>()
  for (const l of ds) {
    const tt = trangThai(l, bayGio)
    if (tt !== 'cho_tien' && tt !== 'thieu_thu_lao') continue
    const k = l.doiTac || '(chưa rõ đối tác)'
    nhom.set(k, [...(nhom.get(k) ?? []), l])
  }
  const hn = homNay(bayGio)
  return [...nhom.entries()]
    .map(([doiTac, lop]) => {
      lop.sort(sapXepTheoNgay)
      return { doiTac, lop, tong: lop.reduce((s, l) => s + (l.chiPhi ?? 0), 0), cuNhat: lop[0].ngay, soNgayCho: soNgayGiua(lop[0].ngay, hn) }
    })
    .sort((a, b) => a.cuNhat.localeCompare(b.cuNhat))
}

export interface DongTongHop {
  khoa: string
  soLop: number
  tien: number
  daTT: number
}

function gom(ds: LopGiang[], khoa: (l: LopGiang) => string): DongTongHop[] {
  const m = new Map<string, DongTongHop>()
  for (const l of ds) {
    if (l.huy) continue
    const k = khoa(l)
    const d = m.get(k) ?? { khoa: k, soLop: 0, tien: 0, daTT: 0 }
    d.soLop++
    d.tien += l.chiPhi ?? 0
    if (l.thanhToan === 'da') d.daTT += l.chiPhi ?? 0
    m.set(k, d)
  }
  return [...m.values()]
}

export const theoNam = (ds: LopGiang[]) => gom(ds, (l) => l.ngay.slice(0, 4)).sort((a, b) => a.khoa.localeCompare(b.khoa))

/** 12 tháng của một năm (tháng trống vẫn có dòng) */
export function theoThang(ds: LopGiang[], nam: string): DongTongHop[] {
  const co = new Map(gom(ds.filter((l) => l.ngay.startsWith(nam)), (l) => l.ngay.slice(5, 7)).map((d) => [d.khoa, d]))
  return Array.from({ length: 12 }, (_, i) => {
    const k = String(i + 1).padStart(2, '0')
    return co.get(k) ?? { khoa: k, soLop: 0, tien: 0, daTT: 0 }
  })
}

export const theoDoiTac = (ds: LopGiang[], nam?: string) =>
  gom(nam ? ds.filter((l) => l.ngay.startsWith(nam)) : ds, (l) => l.doiTac || '(chưa rõ)').sort((a, b) => b.tien - a.tien)

export interface GoiY {
  doiTac: string[]
  lienHe: { ten: string; doiTac: string }[]
  khachHang: string[]
  diaDiem: string[]
}

/** Danh mục gợi ý rút ra từ chính dữ liệu: dùng nhiều xếp trước. Người liên hệ gắn với đối tác hay đi cùng nhất. */
export function goiY(ds: LopGiang[]): GoiY {
  const dem = (f: (l: LopGiang) => string) => {
    const m = new Map<string, number>()
    for (const l of ds) {
      const v = f(l).trim()
      if (v) m.set(v, (m.get(v) ?? 0) + 1)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k)
  }
  const lh = new Map<string, Map<string, number>>()
  for (const l of ds) {
    if (!l.lienHe.trim()) continue
    const m = lh.get(l.lienHe.trim()) ?? new Map<string, number>()
    m.set(l.doiTac, (m.get(l.doiTac) ?? 0) + 1)
    lh.set(l.lienHe.trim(), m)
  }
  return {
    doiTac: dem((l) => l.doiTac),
    lienHe: dem((l) => l.lienHe).map((ten) => ({ ten, doiTac: [...lh.get(ten)!.entries()].sort((a, b) => b[1] - a[1])[0][0] })),
    khachHang: dem((l) => l.khachHang),
    diaDiem: dem((l) => l.diaDiem),
  }
}

/** Lớp có thể trùng: cùng ngày và tên khách hàng gần giống (bỏ dấu, chứa nhau) */
export function timTrung(ds: LopGiang[], l: Pick<LopGiang, 'id' | 'ngay' | 'khachHang'>): LopGiang | undefined {
  const k = boDau(l.khachHang)
  if (!k) return undefined
  return ds.find((x) => x.id !== l.id && !x.huy && x.ngay === l.ngay && (boDau(x.khachHang).includes(k) || k.includes(boDau(x.khachHang))))
}

/** Lớp trùng giờ (cùng ngày, khoảng giờ giao nhau) */
export function trungGio(ds: LopGiang[], l: LopGiang): LopGiang[] {
  if (l.huy) return []
  // lớp chưa ghi giờ: lấy giờ chuẩn của buổi
  const gio = (x: LopGiang) => [x.gioBD || GIO_MAC_DINH[x.buoi][0], x.gioKT || GIO_MAC_DINH[x.buoi][1]]
  const [bd, kt] = gio(l)
  return ds.filter((x) => x.id !== l.id && !x.huy && x.ngay === l.ngay && gio(x)[0] < kt && bd < gio(x)[1])
}

/** Tìm lớp chưa thanh toán khớp tên khách hàng / đối tác (cho lệnh "đã nhận tiền …") */
export function timLopChoTien(ds: LopGiang[], tu: string, bayGio = new Date()): LopGiang[] {
  const k = boDau(tu)
  if (k.length < 3) return []
  return ds
    .filter((l) => !l.huy && l.thanhToan === 'chua' && daGiang(l, bayGio))
    .filter((l) => [l.khachHang, l.doiTac, l.lienHe].some((v) => v && boDau(v).length >= 3 && (boDau(v).includes(k) || k.includes(boDau(v)))))
    .sort(sapXepTheoNgay)
}

/** Người liên hệ dùng gần đây nhất trước (nhập nhanh trên điện thoại) */
export function lienHeGanDay(ds: LopGiang[], n = 8): { ten: string; doiTac: string }[] {
  const gap = new Map<string, LopGiang>()
  for (const l of ds) {
    if (!l.lienHe) continue
    const cu = gap.get(l.lienHe)
    if (!cu || l.ngay > cu.ngay) gap.set(l.lienHe, l)
  }
  return [...gap.values()].sort((a, b) => b.ngay.localeCompare(a.ngay)).slice(0, n).map((l) => ({ ten: l.lienHe, doiTac: l.doiTac }))
}

/** Lớp gần nhất với người liên hệ này — để điền sẵn đối tác, hình thức, thù lao như lần trước */
export function lanTruoc(ds: LopGiang[], lienHe: string): LopGiang | undefined {
  return ds.filter((l) => l.lienHe === lienHe && !l.huy).sort((a, b) => b.ngay.localeCompare(a.ngay))[0]
}

/** Các mức thù lao hay gặp trong 12 tháng gần đây */
export function mucTienHayGap(ds: LopGiang[], n = 5, bayGio = new Date()): number[] {
  const tu = homNay(new Date(bayGio.getTime() - 365 * 86400_000))
  const dem = new Map<number, number>()
  for (const l of ds) if (l.chiPhi && l.ngay >= tu) dem.set(l.chiPhi, (dem.get(l.chiPhi) ?? 0) + 1)
  return [...dem.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k).sort((a, b) => a - b)
}

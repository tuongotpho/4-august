// LÔ HÀNG: một lần mua – chở – bán được ghép lại (DN thương mại giao thẳng, không kho).
// Mỗi lô gom hoá đơn MUA (viên nén / nguyên liệu), hoá đơn CƯỚC xe và hoá đơn BÁN; app tính tấn mua / tấn bán / chênh,
// giá vốn – cước – doanh thu – lãi gộp, và soát giấy tờ chứng minh hàng thật (hợp đồng, phiếu cân, biên bản giao nhận...).
// Số tấn lấy từ dòng hàng của hoá đơn GỐC (XML/PDF); hoá đơn chưa có file gốc thì người dùng gõ tay số tấn của lô.
// KHÔNG đụng tờ khai: lô chỉ để quản trị và chứng minh giao dịch thật.

import type { CanhBao, HoaDon, LoaiHD } from './types.js'
import type { Kho } from './kho.js'
import { conHieuLuc } from './excel.js'
import { phanLoaiDong, QUY_TAC_MAC_DINH, type NhomHang } from './hoaDonGoc.js'
import { tien } from './nhan.js'

export type LoaiGiayTo = 'hopDongMua' | 'hopDongBan' | 'phieuCan' | 'bienBanGiaoNhan' | 'hopDongXe' | 'khac'

export const TEN_GIAY_TO: Record<LoaiGiayTo, string> = {
  hopDongMua: 'Hợp đồng mua',
  hopDongBan: 'Hợp đồng bán',
  phieuCan: 'Phiếu cân',
  bienBanGiaoNhan: 'Biên bản giao nhận',
  hopDongXe: 'Hợp đồng / chứng từ thuê xe',
  khac: 'Giấy tờ khác',
}

/** Giấy tờ BẮT BUỘC để chứng minh một lô giao thẳng là hàng thật (thiếu -> cờ vàng) */
export const GIAY_TO_CAN: LoaiGiayTo[] = ['hopDongMua', 'hopDongBan', 'phieuCan', 'bienBanGiaoNhan']

export interface GiayTo {
  loai: LoaiGiayTo
  ten: string
  duongDan: string // đường dẫn file trên mây ('' = chỉ ghi nhận tên, chưa tải file lên)
  kichThuoc: number
}

export interface LoHang {
  id: string
  ten: string
  ngayTao: string // yyyy-mm-dd
  ghiChu: string
  /** Khoá hoá đơn trong sổ (kho.hoaDon[mst]) — hoá đơn mua, cước, bán đều để chung, app tự xếp */
  hoaDon: string[]
  /** Số tấn gõ tay (dùng khi hoá đơn chưa có file gốc nên không có dòng hàng) */
  tanTay?: { mua?: number; ban?: number }
  giayTo: GiayTo[]
}

export interface HoaDonTrongLo {
  khoa: string
  l: LoaiHD
  nhom: NhomHang | 'banRa'
  kh: string
  so: string
  ng: string
  ten: string
  v: number
  t: number
  /** Số tấn theo dòng hàng hoá đơn gốc (null = chưa có file gốc) */
  tan: number | null
  conHieuLuc: boolean
}

export interface KetQuaLo {
  lo: LoHang
  hoaDon: HoaDonTrongLo[]
  tanMua: number | null
  tanBan: number | null
  chenhTan: number | null // bán − mua
  giaVon: number // tiền hàng mua (chưa thuế)
  cuoc: number // tiền vận chuyển (chưa thuế)
  chiPhiKhac: number
  doanhThu: number
  laiGop: number
  thueDauVao: number
  thueDauRa: number
  giayToThieu: LoaiGiayTo[]
  canhBao: CanhBao[]
  /** Ngày sớm nhất – muộn nhất của các hoá đơn trong lô */
  tuNgay: string
  denNgay: string
  nhaCungCap: string[]
  benMua: string[]
}

const TAN = /^(tấn|tan|t|tấn\.)$/i
/** Chênh cân cho phép: bán nhiều hơn mua tới 1% coi là sai số cân (chú ý), quá 1% mới là dấu hiệu bán khống (lỗi) */
export const CHENH_CAN = 0.01
const isoNgay = (dmy: string) => dmy.split('/').reverse().join('-')

/** Số tấn của một hoá đơn theo dòng hàng (đổi kg -> tấn). nhom: chỉ cộng dòng thuộc nhóm đó (mua viên nén); bán ra thì cộng hết */
function tanCuaHoaDon(kho: Kho, mst: string, khoa: string, nhom: NhomHang | 'banRa', quyTac = QUY_TAC_MAC_DINH): number | null {
  const g = kho.goc?.[mst]?.[khoa]
  if (!g) return null
  let tan = 0
  for (const d of g.dong) {
    if (nhom !== 'banRa' && phanLoaiDong(d.ten, quyTac) !== nhom) continue
    const dvt = d.dvt.trim().toLowerCase()
    if (TAN.test(dvt)) tan += d.sl
    else if (dvt === 'kg') tan += d.sl / 1000
  }
  return Math.round(tan * 1000) / 1000
}

function nhomCua(kho: Kho, mst: string, khoa: string, l: LoaiHD, quyTac = QUY_TAC_MAC_DINH): NhomHang | 'banRa' {
  if (l === 'ban') return 'banRa'
  const g = kho.goc?.[mst]?.[khoa]
  if (g?.dong.length) {
    const cong: Record<NhomHang, number> = { vienNen: 0, vanChuyen: 0, khac: 0 }
    for (const d of g.dong) cong[phanLoaiDong(d.ten, quyTac)] += Math.abs(d.tt) || 1
    return (Object.entries(cong) as [NhomHang, number][]).sort((a, b) => b[1] - a[1])[0][0]
  }
  // Chưa có file gốc: đoán theo tên nhà cung cấp (nhà xe / vận tải)
  const ten = kho.hoaDon?.[mst]?.[khoa]?.ten ?? ''
  return phanLoaiDong(ten, quyTac) === 'vanChuyen' ? 'vanChuyen' : 'vienNen'
}

export function tinhLo(kho: Kho, mst: string, lo: LoHang): KetQuaLo {
  const hd: HoaDonTrongLo[] = []
  const canhBao: CanhBao[] = []
  for (const khoa of lo.hoaDon) {
    const g = kho.hoaDon?.[mst]?.[khoa]
    if (!g) {
      canhBao.push({ muc: 'chu_y', noiDung: `Lô "${lo.ten}": hoá đơn ${khoa.split('|').slice(2).join('-')} không còn trong sổ (đã xoá file?)` })
      continue
    }
    const nhom = nhomCua(kho, mst, khoa, g.l)
    const hl = conHieuLuc({ trangThai: g.tt ?? '' } as HoaDon)
    hd.push({ khoa, l: g.l, nhom, kh: g.kh, so: g.so, ng: g.ng, ten: g.ten, v: g.v, t: g.t, tan: nhom === 'vienNen' || nhom === 'banRa' ? tanCuaHoaDon(kho, mst, khoa, nhom) : null, conHieuLuc: hl })
    if (!hl) canhBao.push({ muc: 'loi', noiDung: `Lô "${lo.ten}": HĐ ${g.kh}-${g.so} đã bị thay thế/huỷ — bỏ khỏi lô, thay bằng hoá đơn mới` })
  }
  const dung = hd.filter((h) => h.conHieuLuc)
  const mua = dung.filter((h) => h.nhom === 'vienNen')
  const ban = dung.filter((h) => h.nhom === 'banRa')
  const tong = (ds: HoaDonTrongLo[], k: 'v' | 't') => ds.reduce((s, h) => s + h[k], 0)
  const tongTan = (ds: HoaDonTrongLo[], tay?: number) => {
    if (tay !== undefined && tay !== null) return tay
    if (!ds.length) return null
    if (ds.some((h) => h.tan === null)) return null // thiếu file gốc -> không biết đủ
    return Math.round(ds.reduce((s, h) => s + (h.tan ?? 0), 0) * 1000) / 1000
  }
  const tanMua = tongTan(mua, lo.tanTay?.mua)
  const tanBan = tongTan(ban, lo.tanTay?.ban)
  const giaVon = tong(mua, 'v')
  const cuoc = tong(dung.filter((h) => h.nhom === 'vanChuyen'), 'v')
  const chiPhiKhac = tong(dung.filter((h) => h.nhom === 'khac'), 'v')
  const doanhThu = tong(ban, 'v')
  const chenh = tanMua !== null && tanBan !== null ? Math.round((tanBan - tanMua) * 1000) / 1000 : null

  if (!mua.length) canhBao.push({ muc: 'chu_y', noiDung: `Lô "${lo.ten}": chưa có hoá đơn mua hàng` })
  if (!ban.length) canhBao.push({ muc: 'chu_y', noiDung: `Lô "${lo.ten}": chưa có hoá đơn bán` })
  if (chenh !== null && chenh > 0.001) {
    const lon = chenh > (tanMua ?? 0) * CHENH_CAN
    canhBao.push(lon
      ? { muc: 'loi', noiDung: `Lô "${lo.ten}": bán ${tanBan} tấn NHIỀU HƠN mua ${tanMua} tấn (thừa ${chenh} tấn, quá 1%) — dấu hiệu bán khống, cần hoá đơn mua bù hoặc kiểm lại số lượng` }
      : { muc: 'chu_y', noiDung: `Lô "${lo.ten}": bán ${tanBan} tấn, mua ${tanMua} tấn (thừa ${chenh} tấn, dưới 1%) — có thể do chênh cân; giữ phiếu cân hai đầu để giải trình` })
  }
  if (mua.length && ban.length && (tanMua === null || tanBan === null)) canhBao.push({ muc: 'chu_y', noiDung: `Lô "${lo.ten}": chưa đủ số tấn (hoá đơn chưa có file gốc) — nạp file XML/PDF hoặc gõ tay số tấn của lô` })
  if (doanhThu && giaVon + cuoc + chiPhiKhac > doanhThu) canhBao.push({ muc: 'chu_y', noiDung: `Lô "${lo.ten}": lỗ ${tien(giaVon + cuoc + chiPhiKhac - doanhThu)} đ (giá vốn + cước + chi phí > doanh thu)` })
  const coGiay = new Set(lo.giayTo.map((g) => g.loai))
  const giayToThieu = GIAY_TO_CAN.filter((l) => !coGiay.has(l))
  if (cuoc && !coGiay.has('hopDongXe')) giayToThieu.push('hopDongXe')
  const ngay = dung.map((h) => isoNgay(h.ng)).sort()
  return {
    lo, hoaDon: hd, tanMua, tanBan, chenhTan: chenh, giaVon, cuoc, chiPhiKhac, doanhThu,
    laiGop: doanhThu - giaVon - cuoc - chiPhiKhac,
    thueDauVao: tong(dung.filter((h) => h.l === 'mua'), 't'), thueDauRa: tong(ban, 't'),
    giayToThieu, canhBao,
    tuNgay: ngay[0]?.split('-').reverse().join('/') ?? '', denNgay: ngay.at(-1)?.split('-').reverse().join('/') ?? '',
    nhaCungCap: [...new Set(mua.map((h) => h.ten))], benMua: [...new Set(ban.map((h) => h.ten))],
  }
}

export interface TongHopLo {
  lo: KetQuaLo[]
  /** Hoá đơn còn hiệu lực CHƯA thuộc lô nào (để ghép tiếp) */
  chuaVaoLo: { khoa: string; l: LoaiHD; nhom: NhomHang | 'banRa'; kh: string; so: string; ng: string; ten: string; v: number; tan: number | null }[]
  /** Hoá đơn nằm trong NHIỀU lô (lỗi ghép) */
  trungLo: { khoa: string; lo: string[] }[]
  /** Luỹ kế theo năm: tấn mua viên nén / tấn bán (theo hoá đơn gốc) — bán > mua là cờ đỏ */
  theoNam: { nam: number; tanMua: number; tanBan: number; hoaDonThieuGoc: number }[]
  canhBao: CanhBao[]
}

export function tongHopLo(kho: Kho, mst: string, dsLo: LoHang[]): TongHopLo {
  const lo = dsLo.map((x) => tinhLo(kho, mst, x)).sort((a, b) => isoNgay(b.denNgay || '01/01/1900').localeCompare(isoNgay(a.denNgay || '01/01/1900')))
  const thuocLo = new Map<string, string[]>()
  for (const x of dsLo) for (const k of x.hoaDon) thuocLo.set(k, [...(thuocLo.get(k) ?? []), x.ten])
  const chuaVaoLo: TongHopLo['chuaVaoLo'] = []
  const nam = new Map<number, { nam: number; tanMua: number; tanBan: number; hoaDonThieuGoc: number }>()
  for (const [khoa, g] of Object.entries(kho.hoaDon?.[mst] ?? {})) {
    if (!conHieuLuc({ trangThai: g.tt ?? '' } as HoaDon)) continue
    const nhom = nhomCua(kho, mst, khoa, g.l)
    const tan = nhom === 'vienNen' || nhom === 'banRa' ? tanCuaHoaDon(kho, mst, khoa, nhom) : null
    if (!thuocLo.has(khoa)) chuaVaoLo.push({ khoa, l: g.l, nhom, kh: g.kh, so: g.so, ng: g.ng, ten: g.ten, v: g.v, tan })
    const n = Number(g.ng.slice(6, 10))
    if (!n || (nhom !== 'vienNen' && nhom !== 'banRa')) continue
    const y = nam.get(n) ?? { nam: n, tanMua: 0, tanBan: 0, hoaDonThieuGoc: 0 }
    if (tan === null) y.hoaDonThieuGoc++
    else if (nhom === 'banRa') y.tanBan += tan
    else y.tanMua += tan
    nam.set(n, y)
  }
  chuaVaoLo.sort((a, b) => isoNgay(b.ng).localeCompare(isoNgay(a.ng)))
  const theoNam = [...nam.values()].map((y) => ({ ...y, tanMua: Math.round(y.tanMua * 1000) / 1000, tanBan: Math.round(y.tanBan * 1000) / 1000 })).sort((a, b) => b.nam - a.nam)
  const canhBao: CanhBao[] = lo.flatMap((x) => x.canhBao)
  for (const x of lo) if (x.giayToThieu.length) canhBao.push({ muc: 'chu_y', noiDung: `Lô "${x.lo.ten}": thiếu ${x.giayToThieu.map((l) => TEN_GIAY_TO[l]).join(', ')}` })
  const trungLo = [...thuocLo].filter(([, ds]) => ds.length > 1).map(([khoa, ds]) => ({ khoa, lo: ds }))
  for (const t of trungLo) canhBao.push({ muc: 'loi', noiDung: `Hoá đơn ${t.khoa.split('|').slice(2).join('-')} nằm trong ${t.lo.length} lô (${t.lo.join(', ')}) — mỗi hoá đơn chỉ thuộc một lô` })
  for (const y of theoNam) {
    const thua = Math.round((y.tanBan - y.tanMua) * 1000) / 1000
    if (!y.hoaDonThieuGoc && thua > 0.001) {
      canhBao.push(thua > y.tanMua * CHENH_CAN
        ? { muc: 'loi', noiDung: `Năm ${y.nam}: tổng tấn BÁN ${y.tanBan} > tấn MUA ${y.tanMua} theo hoá đơn (thừa ${thua} tấn, quá 1%) — không có kho nên bán phải ≤ mua (dấu hiệu bán khống)` }
        : { muc: 'chu_y', noiDung: `Năm ${y.nam}: tấn bán ${y.tanBan} nhỉnh hơn tấn mua ${y.tanMua} (thừa ${thua} tấn, dưới 1%) — có thể do chênh cân giữa lúc mua và lúc bán; giữ phiếu cân để giải trình` })
    }
  }
  return { lo, chuaVaoLo, trungLo, theoNam, canhBao }
}

/**
 * Gợi ý ghép lô: với mỗi hoá đơn BÁN chưa vào lô, lấy các hoá đơn MUA viên nén + CƯỚC chưa vào lô trong khoảng
 * `soNgay` ngày trước đó (giao thẳng: mua – chở – bán gần nhau). Chỉ là gợi ý, người dùng xác nhận.
 */
export function goiYLo(t: TongHopLo, soNgay = 7): { ban: TongHopLo['chuaVaoLo'][number]; mua: TongHopLo['chuaVaoLo']; cuoc: TongHopLo['chuaVaoLo'] }[] {
  const ms = (dmy: string) => Date.parse(isoNgay(dmy))
  const daDung = new Set<string>()
  const kq: { ban: TongHopLo['chuaVaoLo'][number]; mua: TongHopLo['chuaVaoLo']; cuoc: TongHopLo['chuaVaoLo'] }[] = []
  const ban = t.chuaVaoLo.filter((h) => h.nhom === 'banRa').sort((a, b) => ms(a.ng) - ms(b.ng))
  for (const b of ban) {
    const trongKhoang = (h: TongHopLo['chuaVaoLo'][number]) => !daDung.has(h.khoa) && ms(h.ng) <= ms(b.ng) && ms(b.ng) - ms(h.ng) <= soNgay * 86400000
    const theoNgay = (x: TongHopLo['chuaVaoLo'][number], y: TongHopLo['chuaVaoLo'][number]) => ms(x.ng) - ms(y.ng)
    const mua = t.chuaVaoLo.filter((h) => h.nhom === 'vienNen' && trongKhoang(h)).sort(theoNgay)
    const cuoc = t.chuaVaoLo.filter((h) => h.nhom === 'vanChuyen' && trongKhoang(h)).sort(theoNgay)
    if (!mua.length) continue
    for (const h of [...mua, ...cuoc]) daDung.add(h.khoa)
    kq.push({ ban: b, mua, cuoc })
  }
  return kq
}

// SỔ QUỸ TIỀN MẶT: phiếu thu / phiếu chi, tồn quỹ luỹ kế, gắn phiếu với hoá đơn (trả / thu tiền mặt).
// Dùng để: khép kín dòng tiền với công nợ (sao kê ngân hàng + tiền mặt), và cảnh báo hoá đơn mua trả TIỀN MẶT
// vượt ngưỡng không được khấu trừ thuế GTGT (từ 01/07/2025: từ 5 triệu; trước đó: từ 20 triệu).
// Không phải sổ kế toán đầy đủ (chưa hạch toán tài khoản) — là sổ theo dõi quỹ để đối chiếu.

import type { CanhBao } from './types.js'
import type { Kho } from './kho.js'
import { tien } from './nhan.js'

export type NhomPhieu = 'banHang' | 'muaHang' | 'vanChuyen' | 'luong' | 'rutNganHang' | 'nopNganHang' | 'khac'

export const TEN_NHOM_PHIEU: Record<NhomPhieu, string> = {
  banHang: 'Thu tiền bán hàng',
  muaHang: 'Chi mua hàng',
  vanChuyen: 'Chi cước vận chuyển',
  luong: 'Chi lương',
  rutNganHang: 'Rút tiền gửi ngân hàng về quỹ',
  nopNganHang: 'Nộp tiền mặt vào ngân hàng',
  khac: 'Khác',
}

export interface PhieuQuy {
  id: string
  loai: 'thu' | 'chi'
  so: string // số phiếu, vd PT001 / PC001
  ngay: string // dd/MM/yyyy
  soTien: number
  nhom: NhomPhieu
  noiDung: string
  doiTac: string // người nộp / người nhận
  /** Khoá hoá đơn (kho.hoaDon[mst]) mà phiếu này thanh toán */
  hoaDon: string[]
  /** Phiếu lập từ sao kê: "idSaoKe#idGD" — để nạp lại không lập trùng */
  nguon?: string
  tkNo?: string
  tkCo?: string
  diaChi?: string // địa chỉ người nộp / nhận
  kemTheo?: string // "Kèm theo … chứng từ gốc"
}

export interface CaiDatQuy {
  tonDau: number
  ngayTonDau: string // dd/MM/yyyy — tồn quỹ đầu kỳ tính tới ngày này
  /** Người ký chứng từ quỹ + nhận diện thủ quỹ trên sao kê (chungTuQuy.ts) */
  nguoiKy?: import('./chungTuQuy.js').NguoiKyQuy
}

export interface SoQuy {
  caiDat: CaiDatQuy
  phieu: Record<string, PhieuQuy>
}

export const QUY_TRONG = (): SoQuy => ({ caiDat: { tonDau: 0, ngayTonDau: '' }, phieu: {} })

const iso = (dmy: string) => dmy.split('/').reverse().join('-')

/** Ngưỡng hoá đơn mua phải thanh toán không dùng tiền mặt mới được khấu trừ GTGT */
export const nguongTienMat = (ngayHD: string) => (iso(ngayHD) >= '2025-07-01' ? 5_000_000 : 20_000_000)

export interface DongSoQuy extends PhieuQuy {
  thu: number
  chi: number
  ton: number // tồn sau phiếu này
}

export interface KetQuaQuy {
  dong: DongSoQuy[]
  tonDau: number
  tongThu: number
  tongChi: number
  tonCuoi: number
  /** Số tiền mặt đã trả / thu theo từng hoá đơn (để cộng vào công nợ) */
  daTraTheoHoaDon: Record<string, number>
  canhBao: CanhBao[]
  theoThang: { thang: string; thu: number; chi: number; ton: number }[]
}

/** Lập sổ quỹ trong khoảng [tu, den] (dd/MM/yyyy, bỏ trống = tất cả) */
export function lapSoQuy(kho: Kho, mst: string, quy: SoQuy, tu = '', den = ''): KetQuaQuy {
  const tat = Object.values(quy.phieu).sort((a, b) => iso(a.ngay).localeCompare(iso(b.ngay)) || (a.loai === b.loai ? a.so.localeCompare(b.so) : a.loai === 'thu' ? -1 : 1))
  const canhBao: CanhBao[] = []
  const daTra: Record<string, number> = {}
  // tồn đầu kỳ của khoảng xem = tồn đầu sổ + phát sinh trước "tu"
  let ton = quy.caiDat.tonDau
  for (const p of tat) if (tu && iso(p.ngay) < iso(tu)) ton += p.loai === 'thu' ? p.soTien : -p.soTien
  const tonDau = ton
  const dong: DongSoQuy[] = []
  let tongThu = 0
  let tongChi = 0
  let daBaoAm = false
  for (const p of tat) {
    for (const k of p.hoaDon) daTra[k] = (daTra[k] ?? 0) + p.soTien / p.hoaDon.length
    if ((tu && iso(p.ngay) < iso(tu)) || (den && iso(p.ngay) > iso(den))) continue
    const thu = p.loai === 'thu' ? p.soTien : 0
    const chi = p.loai === 'chi' ? p.soTien : 0
    ton += thu - chi
    tongThu += thu
    tongChi += chi
    dong.push({ ...p, thu, chi, ton })
    if (ton < 0 && !daBaoAm) {
      daBaoAm = true
      canhBao.push({ muc: 'loi', noiDung: `Quỹ tiền mặt ÂM ${tien(-ton)} đ sau phiếu ${p.so} ngày ${p.ngay} — chi nhiều hơn tiền đang có: thiếu phiếu thu (rút ngân hàng, thu bán hàng) hoặc nhập sai` })
    }
    if (quy.caiDat.ngayTonDau && iso(p.ngay) < iso(quy.caiDat.ngayTonDau)) {
      canhBao.push({ muc: 'chu_y', noiDung: `Phiếu ${p.so} ngày ${p.ngay} lập TRƯỚC ngày tồn đầu kỳ ${quy.caiDat.ngayTonDau} — có thể đã tính trong tồn đầu` })
    }
  }
  // Hoá đơn mua trả bằng tiền mặt vượt ngưỡng -> không được khấu trừ thuế GTGT
  const hd = kho.hoaDon?.[mst] ?? {}
  for (const p of tat.filter((x) => x.loai === 'chi')) {
    for (const k of p.hoaDon) {
      const g = hd[k]
      if (!g) {
        canhBao.push({ muc: 'chu_y', noiDung: `Phiếu ${p.so}: hoá đơn ${k.split('|').slice(2).join('-')} không còn trong sổ` })
        continue
      }
      if (g.l !== 'mua') continue
      const tong = g.v + g.t
      const nguong = nguongTienMat(g.ng)
      if (tong >= nguong) {
        canhBao.push({ muc: 'loi', noiDung: `HĐ mua ${g.kh}-${g.so} ngày ${g.ng} (${g.ten}) ${tien(tong)} đ trả TIỀN MẶT (phiếu ${p.so}) — từ ${tien(nguong)} đ phải chuyển khoản mới được khấu trừ thuế ${tien(g.t)} đ` })
      }
    }
  }
  const thang = new Map<string, { thang: string; thu: number; chi: number; ton: number }>()
  for (const d of dong) {
    const t = d.ngay.slice(3)
    const x = thang.get(t) ?? { thang: t, thu: 0, chi: 0, ton: 0 }
    x.thu += d.thu
    x.chi += d.chi
    x.ton = d.ton
    thang.set(t, x)
  }
  return { dong, tonDau, tongThu, tongChi, tonCuoi: ton, daTraTheoHoaDon: daTra, canhBao, theoThang: [...thang.values()] }
}

/** Số phiếu tiếp theo: PT001, PT002… / PC001… theo năm của ngày phiếu */
export function soPhieuMoi(quy: SoQuy, loai: 'thu' | 'chi', ngay: string): string {
  const tienTo = loai === 'thu' ? 'PT' : 'PC'
  const nam = ngay.slice(6, 10)
  const max = Object.values(quy.phieu)
    .filter((p) => p.loai === loai && p.ngay.slice(6, 10) === nam)
    .map((p) => Number(/(\d+)$/.exec(p.so)?.[1] ?? 0))
    .reduce((a, b) => Math.max(a, b), 0)
  return `${tienTo}${String(max + 1).padStart(3, '0')}`
}

/** Gợi ý phiếu chi / thu từ hoá đơn (điền sẵn số tiền, đối tác, nhóm) */
export function phieuTuHoaDon(kho: Kho, mst: string, khoa: string, quy: SoQuy, ngay: string): Omit<PhieuQuy, 'id'> | null {
  const g = kho.hoaDon?.[mst]?.[khoa]
  if (!g) return null
  const loai = g.l === 'ban' ? 'thu' : 'chi'
  return {
    loai, so: soPhieuMoi(quy, loai, ngay), ngay, soTien: g.v + g.t,
    nhom: g.l === 'ban' ? 'banHang' : /cước|vận chuyển|vận tải/i.test(g.ten) ? 'vanChuyen' : 'muaHang',
    noiDung: `${loai === 'thu' ? 'Thu tiền' : 'Thanh toán'} HĐ ${g.kh}-${g.so} ngày ${g.ng}`, doiTac: g.ten, hoaDon: [khoa],
  }
}


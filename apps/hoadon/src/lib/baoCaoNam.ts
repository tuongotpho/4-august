import { KHONG_TAG, TAG_MAC_DINH } from './hashtag.js'
import { formatMoney } from './numberToWords.js'
import { statusOf, waitingDays, type StatusKey } from './status.js'
import {
  avgDurations, byMonth, bySeller, byTag, flattenInvoices, nhomTt, topVaKhac, type InvoiceRow, type MonthStat, type NhomTt, type SellerStat, type TagStat,
} from './summary.js'
import type { Dossier } from './types.js'

/**
 * Số liệu cho "Báo cáo tình hình thanh toán năm" (in ra PDF gửi lãnh đạo).
 * Tính trên hóa đơn có ngày HĐ thuộc năm; hồ sơ = hồ sơ có ít nhất 1 hóa đơn trong năm,
 * tiền của hồ sơ chỉ cộng các hóa đơn trong năm.
 */

export type { NhomTt }
export const TEN_NHOM_TT: Record<NhomTt, string> = {
  daTt: 'Đã được thanh toán',
  choKt: 'Đã nộp, chờ kế toán thanh toán',
  chuaNop: 'Chưa nộp kế toán',
}

interface Dem {
  soHoSo: number
  soHd: number
  tongTien: number
}

export interface DongNguoiTT extends Dem {
  ten: string
  daTt: number
}

export interface HoSoTon {
  d: Dossier
  tongTien: number
  trangThai: StatusKey
  cho: number | null // số ngày đã chờ ở bước hiện tại
}

export interface BaoCaoNam {
  nam: number
  tong: Dem
  theoNhom: Record<NhomTt, Dem>
  thang: MonthStat[]
  theoViec: TagStat[]
  nhieuTag: boolean // có hồ sơ gắn >1 tag -> cộng các dòng "theo việc" có thể lớn hơn tổng
  theoNguoiTT: DongNguoiTT[]
  nguoiBan: { top: SellerStat[]; khac: { soNguoi: number; soHd: number; tongTien: number } | null }
  thoiGian: { hdDenNop: number | null; nopDenTt: number | null }
  namTruoc: { soHd: number; tongTien: number } | null
  tonDong: HoSoTon[]
  rows: InvoiceRow[] // bảng kê chi tiết (phụ lục), mới nhất trước
  nhanXet: string[]
}

const dem = (rows: InvoiceRow[]): Dem => ({
  soHoSo: new Set(rows.map((r) => r.d.id)).size,
  soHd: rows.length,
  tongTien: rows.reduce((a, r) => a + (r.inv.tongTien || 0), 0),
})

/** "652,5 triệu đồng" — dễ đọc trong lời nhận xét; dưới 1 triệu thì ghi đủ số. */
export function tienChu(n: number): string {
  if (Math.abs(n) < 1e6) return `${formatMoney(n)} đồng`
  return `${(Math.round(n / 1e5) / 10).toLocaleString('vi-VN')} triệu đồng`
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
export const tenViec = (ma: string) => (ma === KHONG_TAG ? 'Chưa gắn việc' : `#${ma}${TAG_MAC_DINH.find((t) => t.ma === ma) ? ` (${TAG_MAC_DINH.find((t) => t.ma === ma)!.ten})` : ''}`)

export function lapBaoCaoNam(list: Dossier[], nam: number, canhBaoSauNgay = 15): BaoCaoNam {
  const tatCa = flattenInvoices(list)
  const trongNam = (r: InvoiceRow, n: number) => Number(r.inv.ngayHd.slice(0, 4)) === n
  const rows = tatCa.filter((r) => trongNam(r, nam))
  const tong = dem(rows)

  const theoNhom = { daTt: dem([]), choKt: dem([]), chuaNop: dem([]) } as Record<NhomTt, Dem>
  for (const k of Object.keys(theoNhom) as NhomTt[]) theoNhom[k] = dem(rows.filter((r) => nhomTt(r.status) === k))

  // theo người đề nghị thanh toán
  const mapTT = new Map<string, InvoiceRow[]>()
  for (const r of rows) {
    const ten = r.d.nguoiDeNghi.trim() || '(chưa ghi)'
    mapTT.set(ten, [...(mapTT.get(ten) ?? []), r])
  }
  const theoNguoiTT = [...mapTT]
    .map(([ten, rs]) => ({ ten, ...dem(rs), daTt: rs.filter((r) => r.status === 'daTt').reduce((a, r) => a + (r.inv.tongTien || 0), 0) }))
    .sort((a, b) => b.tongTien - a.tongTien)

  const hoSo = [...new Map(rows.map((r) => [r.d.id, r.d])).values()]
  const tienTrongNam = (d: Dossier) => rows.filter((r) => r.d.id === d.id).reduce((a, r) => a + (r.inv.tongTien || 0), 0)
  const tonDong = hoSo
    .filter((d) => statusOf(d) !== 'daTt')
    .map((d) => ({ d, tongTien: tienTrongNam(d), trangThai: statusOf(d), cho: waitingDays(d) }))
    .sort((a, b) => (b.cho ?? -1) - (a.cho ?? -1))

  const truoc = tatCa.filter((r) => trongNam(r, nam - 1))
  const namTruoc = truoc.length ? { soHd: truoc.length, tongTien: dem(truoc).tongTien } : null
  const thang = byMonth(rows, nam)
  const theoViec = byTag(rows)
  const thoiGian = avgDurations(hoSo)

  // ── lời nhận xét tự động (số liệu, không đánh giá) ──
  const nhanXet: string[] = []
  if (tong.soHd) {
    let c = `Năm ${nam} phát sinh ${tong.soHd} hóa đơn thuộc ${tong.soHoSo} hồ sơ, tổng ${tienChu(tong.tongTien)}.`
    if (namTruoc?.tongTien) {
      const lech = tong.tongTien - namTruoc.tongTien
      const p = Math.round((Math.abs(lech) / namTruoc.tongTien) * 100) // làm tròn theo độ lớn: giảm 37,5% -> 38%
      c += ` So với năm ${nam - 1} (${tienChu(namTruoc.tongTien)}), ${p === 0 ? 'tương đương' : `${lech > 0 ? 'tăng' : 'giảm'} ${p}%`}.`
    }
    nhanXet.push(c)
    const conLai = tong.tongTien - theoNhom.daTt.tongTien
    nhanXet.push(
      `Đã được kế toán thanh toán ${tienChu(theoNhom.daTt.tongTien)} (${pct(theoNhom.daTt.tongTien, tong.tongTien)}% số tiền)` +
        (conLai > 0
          ? `; còn ${tienChu(conLai)} chưa thanh toán, gồm ${tienChu(theoNhom.choKt.tongTien)} đã nộp chờ kế toán và ${tienChu(theoNhom.chuaNop.tongTien)} chưa nộp kế toán.`
          : '; không còn hóa đơn chưa thanh toán.'),
    )
    const max = thang.reduce((a, m) => (m.tongTien > a.tongTien ? m : a), thang[0])
    if (max.tongTien) nhanXet.push(`Tháng phát sinh nhiều nhất: tháng ${max.thang} (${tienChu(max.tongTien)}, ${max.soHd} hóa đơn).`)
    const viec = theoViec.filter((t) => t.ma !== KHONG_TAG).slice(0, 3)
    if (viec.length) nhanXet.push(`Chi nhiều nhất cho: ${viec.map((t) => `${tenViec(t.ma)} ${tienChu(t.tongTien)}`).join('; ')}.`)
    if (thoiGian.hdDenNop != null || thoiGian.nopDenTt != null) {
      const p: string[] = []
      const ngay = (n: number) => `${n.toLocaleString('vi-VN')} ngày` // 51,8 ngày
      if (thoiGian.hdDenNop != null) p.push(`từ ngày hóa đơn đến khi nộp kế toán ${ngay(thoiGian.hdDenNop)}`)
      if (thoiGian.nopDenTt != null) p.push(`từ khi nộp đến khi được thanh toán ${ngay(thoiGian.nopDenTt)}`)
      nhanXet.push(`Thời gian trung bình: ${p.join('; ')}.`)
    }
    const lau = tonDong.filter((x) => x.trangThai === 'choKt' && (x.cho ?? 0) > canhBaoSauNgay)
    if (lau.length) nhanXet.push(`${lau.length} hồ sơ đã nộp kế toán quá ${canhBaoSauNgay} ngày chưa được thanh toán (${tienChu(lau.reduce((a, x) => a + x.tongTien, 0))}).`)
  } else {
    nhanXet.push(`Năm ${nam} chưa có hóa đơn nào.`)
  }

  return {
    nam,
    tong,
    theoNhom,
    thang,
    theoViec,
    nhieuTag: rows.some((r) => (r.d.tags?.length ?? 0) > 1),
    theoNguoiTT,
    nguoiBan: topVaKhac(bySeller(rows), 10),
    thoiGian,
    namTruoc,
    tonDong,
    rows,
    nhanXet,
  }
}

import { chuanTag, KHONG_TAG } from './hashtag.js'
import { firstInvoiceDate, statusOf, totalOf, type StatusKey } from './status.js'
import { tinhHoSo } from './tinh.js'
import type { Dossier } from './types.js'

/** Bộ lọc danh sách hồ sơ (màn Hồ sơ thanh toán). */
export type LocTrangThai = StatusKey | 'all' | 'chuaXong' | 'cu'
export interface BoLoc {
  trangThai: LocTrangThai
  tag: string | null // mã tag, hoặc KHONG_TAG = hồ sơ chưa gắn tag
  nam: number | 'all' // theo ngày hóa đơn sớm nhất
  thang: number | 'all'
  q: string
  tinh?: string | null // tỉnh của người bán (suy từ địa chỉ, xem tinh.ts)
}
export const LOC_MAC_DINH: BoLoc = { trangThai: 'chuaXong', tag: null, nam: 'all', thang: 'all', q: '', tinh: null }

/** "Điện lực" -> "dien luc": tìm không cần gõ dấu. */
export function boDau(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

function chuTimKiem(d: Dossier): string {
  return boDau(
    [
      d.noiDung, d.doiTac, d.ghiChu, d.nguoiDeNghi, d.soToTrinh, d.soDntt,
      ...(d.tags ?? []).map((t) => `#${t}`),
      ...tinhHoSo(d),
      ...d.invoices.flatMap((i) => [i.soHd, i.tenNguoiBan, i.mstNguoiBan]),
    ].join(' '),
  )
}

export function hopTrangThai(d: Dossier, t: LocTrangThai): boolean {
  const s = statusOf(d)
  if (t === 'all') return true
  if (t === 'chuaXong') return s !== 'daTt'
  if (t === 'cu') return d.hoSoCu
  return s === t
}

export function hopTag(d: Dossier, tag: string | null): boolean {
  if (!tag) return true
  if (tag === KHONG_TAG) return !d.tags?.length
  return (d.tags ?? []).includes(tag)
}

export function hopKy(d: Dossier, nam: number | 'all', thang: number | 'all'): boolean {
  if (nam === 'all') return true
  const hd = firstInvoiceDate(d)
  if (Number(hd.slice(0, 4)) !== nam) return false
  return thang === 'all' || Number(hd.slice(5, 7)) === thang
}

/** Mọi từ gõ vào ô tìm đều phải có (không phân biệt dấu, hoa/thường). */
export function hopTuKhoa(d: Dossier, q: string): boolean {
  const tu = boDau(q).split(/\s+/).filter(Boolean)
  if (!tu.length) return true
  const chu = chuTimKiem(d)
  return tu.every((t) => chu.includes(t))
}

export const hopTinh = (d: Dossier, tinh: string | null | undefined) => !tinh || tinhHoSo(d).includes(tinh)

export function locHoSo(list: Dossier[], b: BoLoc): Dossier[] {
  return list.filter((d) => hopTrangThai(d, b.trangThai) && hopTag(d, b.tag) && hopKy(d, b.nam, b.thang) && hopTinh(d, b.tinh) && hopTuKhoa(d, b.q))
}

/** Đang lọc khác mặc định (để hiện nút "Bỏ lọc"). */
export function dangLoc(b: BoLoc): boolean {
  return b.trangThai !== LOC_MAC_DINH.trangThai || !!b.tag || b.nam !== 'all' || !!b.tinh || !!b.q.trim()
}

/** Đếm hồ sơ theo tag (hồ sơ nhiều tag được đếm ở mỗi tag) — nhiều nhất trước, "(chưa gắn)" cuối. */
export function demTag(list: Dossier[]): { ma: string; soHoSo: number; tongTien: number }[] {
  const m = new Map<string, { soHoSo: number; tongTien: number }>()
  for (const d of list) {
    const tags = d.tags?.length ? d.tags : [KHONG_TAG]
    for (const t of tags) {
      const x = m.get(t) ?? { soHoSo: 0, tongTien: 0 }
      x.soHoSo++
      x.tongTien += totalOf(d)
      m.set(t, x)
    }
  }
  return [...m.entries()]
    .map(([ma, x]) => ({ ma, ...x }))
    .sort((a, b) => (a.ma === KHONG_TAG ? 1 : b.ma === KHONG_TAG ? -1 : b.soHoSo - a.soHoSo || a.ma.localeCompare(b.ma)))
}

/** Các năm có hóa đơn, mới nhất trước. */
export function namCoHoSo(list: Dossier[]): number[] {
  const ys = new Set(list.map((d) => Number(firstInvoiceDate(d).slice(0, 4))).filter(Boolean))
  return [...ys].sort((a, b) => b - a)
}

export interface NhomThang {
  khoa: string // "2026-10"; "" = chưa có ngày hóa đơn
  nhan: string
  ds: Dossier[]
  tongTien: number
}

/** Gom danh sách ĐÃ XẾP theo ngày HĐ thành từng tháng (giữ nguyên thứ tự), kèm tổng tiền mỗi tháng. */
export function nhomTheoThang(list: Dossier[]): NhomThang[] {
  const out: NhomThang[] = []
  for (const d of list) {
    const khoa = firstInvoiceDate(d).slice(0, 7)
    let g = out.at(-1)
    if (!g || g.khoa !== khoa) {
      g = { khoa, nhan: khoa ? `Tháng ${Number(khoa.slice(5, 7))}/${khoa.slice(0, 4)}` : 'Chưa có ngày hóa đơn', ds: [], tongTien: 0 }
      out.push(g)
    }
    g.ds.push(d)
    g.tongTien += totalOf(d)
  }
  return out
}

/** Gắn thêm / bỏ tag cho 1 hồ sơ (dùng khi sửa hàng loạt). Trả về chính hồ sơ cũ nếu không đổi gì. */
export function doiTag(d: Dossier, them: string[], bo: string[]): Dossier {
  const cu = d.tags ?? []
  const boSet = new Set(bo.map(chuanTag))
  const moi = [...cu.filter((t) => !boSet.has(t))]
  for (const t of them.map(chuanTag)) if (t && !moi.includes(t)) moi.push(t)
  if (moi.length === cu.length && moi.every((t, i) => t === cu[i])) return d
  return { ...d, tags: moi }
}

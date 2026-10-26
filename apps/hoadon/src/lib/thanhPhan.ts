import { boDau } from './locHoSo'
import { firstInvoiceDate } from './status'
import type { Dossier, ThanhPhan } from './types'

/** Một bộ thành phần tham gia đã dùng ở hồ sơ cũ (các hồ sơ có bộ y hệt được gộp làm một). */
export interface BoThanhPhan {
  khoa: string
  thanhPhan: ThanhPhan[]
  tongNguoi: number
  hoSo: { id: string; noiDung: string; ngay: string } // hồ sơ gần nhất dùng bộ này
  soLan: number // số hồ sơ dùng bộ này
}

const tenChuan = (s: string) => boDau(s).replace(/\s+/g, ' ').trim()
const khoaBo = (tp: ThanhPhan[]) => tp.map((t) => `${tenChuan(t.donVi)}|${t.soNguoi || 0}`).join(';')
const ngayHs = (d: Dossier) => firstInvoiceDate(d) || d.ngayToTrinh || new Date(d.updatedAt || 0).toISOString().slice(0, 10)

/** Các bộ thành phần đã dùng (bỏ hồ sơ đang mở, bỏ dòng trống), bộ dùng gần nhất trước. */
export function boThanhPhanCu(list: Dossier[], boQuaId?: string): BoThanhPhan[] {
  const map = new Map<string, BoThanhPhan>()
  for (const d of list) {
    if (d.id === boQuaId) continue
    const tp = d.thanhPhan.filter((t) => t.donVi.trim())
    if (!tp.length) continue
    const khoa = khoaBo(tp)
    const hs = { id: d.id, noiDung: d.noiDung, ngay: ngayHs(d) }
    const co = map.get(khoa)
    if (!co) map.set(khoa, { khoa, thanhPhan: tp.map((t) => ({ ...t })), tongNguoi: tp.reduce((a, t) => a + (t.soNguoi || 0), 0), hoSo: hs, soLan: 1 })
    else {
      co.soLan++
      if (hs.ngay > co.hoSo.ngay) co.hoSo = hs
    }
  }
  return [...map.values()].sort((a, b) => b.hoSo.ngay.localeCompare(a.hoSo.ngay))
}

/** Tìm theo tên đơn vị hoặc nội dung hồ sơ — không dấu, mọi từ đều phải có. */
export function timBo(ds: BoThanhPhan[], q: string): BoThanhPhan[] {
  const tu = boDau(q).split(/\s+/).filter(Boolean)
  if (!tu.length) return ds
  return ds.filter((b) => {
    const chu = boDau([b.hoSo.noiDung, ...b.thanhPhan.map((t) => t.donVi)].join(' '))
    return tu.every((t) => chu.includes(t))
  })
}

/** Thêm bộ cũ vào danh sách đang có: đơn vị đã có thì giữ nguyên số người, chỉ thêm đơn vị mới (theo thứ tự bộ cũ). */
export function themVao(dangCo: ThanhPhan[], bo: ThanhPhan[]): ThanhPhan[] {
  const da = new Set(dangCo.map((t) => tenChuan(t.donVi)).filter(Boolean))
  return [...dangCo, ...bo.filter((t) => !da.has(tenChuan(t.donVi))).map((t) => ({ ...t }))]
}

/** "Phòng KTAT 3, Điện lực Hưng Yên 4" */
export const tomTat = (tp: ThanhPhan[]) => tp.map((t) => `${t.donVi.trim()} ${t.soNguoi || 0}`).join(', ')

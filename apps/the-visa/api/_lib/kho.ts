// Kho dữ liệu RIÊNG TƯ của máy chủ: Vercel Blob hoặc Cloud Storage của Firebase (xem luuTru.ts, biến VISA_KHO).
//   ky/<id>.json  — một kỳ sao kê đã đọc + đã đối chiếu
//   pdf/<id>.pdf  — file sao kê gốc
import { luuTru } from './luuTru.js'
import type { Ky } from '../../shared/kieu.js'

const ID = /^\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}$/
export const idHopLe = (id: string) => ID.test(id)

async function docJson<T>(pathname: string): Promise<T | null> {
  const chu = await luuTru().docChu(pathname)
  return chu == null ? null : (JSON.parse(chu) as T)
}

export async function dsKy(): Promise<Ky[]> {
  const ds = await luuTru().ds('ky/')
  const ky = await Promise.all(ds.map((p) => docJson<Ky>(p)))
  return ky.filter((k): k is Ky => !!k).sort((a, b) => a.tu.localeCompare(b.tu))
}

export async function luuKy(ky: Ky) {
  await luuTru().ghi(`ky/${ky.id}.json`, JSON.stringify(ky), 'application/json')
}

export async function luuPdf(id: string, pdf: ArrayBuffer) {
  await luuTru().ghi(`pdf/${id}.pdf`, Buffer.from(pdf), 'application/pdf')
}

export async function docPdf(id: string) {
  return luuTru().docLuong(`pdf/${id}.pdf`)
}

export async function xoaKy(id: string) {
  await luuTru().xoa([`ky/${id}.json`, `pdf/${id}.pdf`]).catch(() => luuTru().xoa([`ky/${id}.json`]))
}

export async function docKy(id: string) {
  return idHopLe(id) ? docJson<Ky>(`ky/${id}.json`) : null
}

// ---------- Kết nối AI (MCP): phiên của từng máy + nhật ký ghi ----------
//   mcp/phien/<id>.json     một máy AI đã được cho phép (xoá = thu hồi)
//   mcp/nhat-ky/<giờ>-<id>  mỗi lần AI GHI dữ liệu (chỉ thêm, không sửa)

export interface PhienMcp {
  id: string
  email: string
  tenMay: string
  ungDung: string
  noiNhan: string
  taoLuc: string
}
export interface DongNhatKy {
  luc: string
  phien: string
  tenMay: string
  congCu: string
  moTa: string
}

const ID_PHIEN = /^[a-f0-9]{24}$/

async function dsJson<T>(prefix: string, toiDa = 500): Promise<T[]> {
  const ds = await luuTru().ds(prefix, toiDa)
  return (await Promise.all(ds.slice(-toiDa).map((p) => docJson<T>(p)))).filter((x): x is Awaited<T> & T => !!x)
}

export async function taoPhien(p: PhienMcp) {
  await luuTru().ghi(`mcp/phien/${p.id}.json`, JSON.stringify(p), 'application/json', { khongGhiDe: true })
}
export const docPhien = (id: string) => (ID_PHIEN.test(id) ? docJson<PhienMcp>(`mcp/phien/${id}.json`) : Promise.resolve(null))
export const dsPhien = () => dsJson<PhienMcp>('mcp/phien/')
export async function xoaPhien(id: string) {
  if (ID_PHIEN.test(id)) await luuTru().xoa([`mcp/phien/${id}.json`])
}

export async function ghiNhatKy(d: DongNhatKy) {
  await luuTru().ghi(`mcp/nhat-ky/${d.luc.replace(/[:.]/g, '-')}-${d.phien}.json`, JSON.stringify(d), 'application/json', { duoiNgauNhien: true })
}
export const dsNhatKy = async () => (await dsJson<DongNhatKy>('mcp/nhat-ky/', 200)).sort((a, b) => b.luc.localeCompare(a.luc))

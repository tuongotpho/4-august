// Đọc / ghi dữ liệu cho máy chủ (bot) — CÙNG đường dẫn, CÙNG tên ô với web app (src/lib/store/FirebaseStore.ts),
// nên bot ghi gì web app thấy ngay (onSnapshot) và ngược lại.
import { randomUUID } from 'node:crypto'
import { CAI_DAT_MAC_DINH, chuanLop, type CaiDat, type LopGiang } from '../src/lib/model.js'
import type { FirebaseNguoiDung } from './firebaseRest.js'

const goc = (fb: FirebaseNguoiDung) => `users/${fb.uid}`

export async function taiLop(fb: FirebaseNguoiDung): Promise<LopGiang[]> {
  const ds = await fb.docBoSuuTap<LopGiang>(`${goc(fb)}/lop`)
  return ds.map(({ _id, ...l }) => chuanLop({ ...(l as LopGiang), id: _id }))
}

export async function docLop(fb: FirebaseNguoiDung, id: string): Promise<LopGiang | null> {
  const l = await fb.docTaiLieu<LopGiang>(`${goc(fb)}/lop/${id}`)
  return l ? chuanLop({ ...l, id }) : null
}

export async function luuLop(fb: FirebaseNguoiDung, l: LopGiang) {
  await fb.ghi(`${goc(fb)}/lop/${l.id}`, JSON.parse(JSON.stringify(l)) as Record<string, unknown>)
}

export async function xoaLop(fb: FirebaseNguoiDung, id: string) {
  await fb.xoa(`${goc(fb)}/lop/${id}`)
}

export async function taiCaiDat(fb: FirebaseNguoiDung): Promise<CaiDat> {
  const c = (await fb.docTaiLieu<Partial<CaiDat>>(`${goc(fb)}/meta/caiDat`)) ?? {}
  return { ...CAI_DAT_MAC_DINH, ...c, biDanhDoiTac: { ...(c.biDanhDoiTac ?? {}) }, lich: { ...CAI_DAT_MAC_DINH.lich, ...(c.lich ?? {}) } }
}

// ---------------- Phiên máy (bot Telegram) ----------------

export async function taoPhien(fb: FirebaseNguoiDung, p: { tenMay: string; noiNhan: string }): Promise<string> {
  const ma = randomUUID()
  await fb.ghi(`${goc(fb)}/phien/${ma}`, { ...p, taoLuc: new Date() })
  return ma
}

export async function conPhien(fb: FirebaseNguoiDung, ma: string) {
  return fb.docTaiLieu(`${goc(fb)}/phien/${ma}`)
}

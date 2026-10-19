// Phiên AI và nhật ký, lưu ngay trong Firestore của app (database tuongot-sale, không cần cơ sở dữ liệu riêng):
//
//   mcp_sessions/{maPhien}  mỗi máy / ứng dụng AI đã được cho phép. Chỉ chủ tài khoản đọc / xoá được.
//                           Xoá phiên trên web app = thu hồi quyền máy đó (máy chủ kiểm mỗi lần gọi).
//   mcp_logs/{ma}           mỗi lần AI GHI / XOÁ dữ liệu. Chủ shop xem được, không ai sửa / xoá được.
//
// Luật tương ứng nằm trong firestore.rules.

import type { FirebaseNguoiDung } from './firebaseRest.ts'

export const BO_PHIEN = 'mcp_sessions'
export const BO_NHAT_KY = 'mcp_logs'

export interface Phien {
  uid: string
  email: string
  tenMay: string
  ungDung: string
  noiNhan: string
  taoLuc: number
  /** Lần cuối AI xin vé mới (khoảng mỗi giờ một lần khi đang dùng) */
  dungLuc?: number
}

export async function taoPhien(fb: FirebaseNguoiDung, p: Pick<Phien, 'tenMay' | 'ungDung' | 'noiNhan'>): Promise<string> {
  return fb.them(BO_PHIEN, { uid: fb.uid, email: fb.email, ...p, taoLuc: Date.now() } satisfies Phien)
}

/** Phiên còn hiệu lực không (chưa bị thu hồi, đúng chủ) */
export async function conPhien(fb: FirebaseNguoiDung, maPhien: string): Promise<Phien | null> {
  const p = await fb.docTaiLieu<Phien>(`${BO_PHIEN}/${maPhien}`)
  return p && p.uid === fb.uid ? p : null
}

export async function ghiDungLuc(fb: FirebaseNguoiDung, maPhien: string) {
  await fb.ghi(`${BO_PHIEN}/${maPhien}`, { dungLuc: Date.now() }, 'capNhat').catch(() => undefined)
}

export interface DongNhatKy {
  uid: string
  email: string
  phien: string
  tenMay: string
  congCu: string
  /** "orders/abc" ... */
  doiTuong: string
  tenDoiTuong: string
  tomTat: string
  luc: number
}

export async function ghiNhatKy(fb: FirebaseNguoiDung, d: Omit<DongNhatKy, 'uid' | 'email' | 'luc'>) {
  await fb.them(BO_NHAT_KY, { uid: fb.uid, email: fb.email, ...d, luc: Date.now() } satisfies DongNhatKy)
}

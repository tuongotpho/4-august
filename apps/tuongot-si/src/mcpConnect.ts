// Kết nối AI (MCP): đăng nhập riêng để cấp quyền, quản lý phiên và nhật ký.
// Máy chủ nằm ở thư mục mcp/, chạy CHUNG project Vercel với web (cùng tên miền).
// Phiên và nhật ký lưu ở Firestore (mcp_sessions, mcp_logs — xem firestore.rules).

import { deleteApp, getApp, getApps, initializeApp } from 'firebase/app'
import { GoogleAuthProvider, getAuth, inMemoryPersistence, setPersistence, signInWithPopup, signOut } from 'firebase/auth'
import { collection, deleteDoc, doc, getFirestore, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { isDemo } from './store'

const env = import.meta.env

/** Máy chủ MCP = chính tên miền web đang chạy (Vercel). Chạy ở máy thì cho phép máy chủ chạy thử localhost. */
export function mayChuChoPhep(thamSo: string | null, dev = env.DEV): string {
  if (dev && thamSo && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(thamSo)) return thamSo
  return location.origin
}

/** Mở qua cổng app-by-lethanh thì máy chủ MCP vẫn ở địa chỉ gốc tuongot-si.vercel.app */
export const mcpUrl = () => `${location.hostname === 'app-by-lethanh.vercel.app' ? 'https://tuongot-si.vercel.app' : location.origin}/mcp`

const cfg = {
  apiKey: env.VITE_FIREBASE_API_KEY as string,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string,
  appId: env.VITE_FIREBASE_APP_ID as string,
}
const dbId = (env.VITE_FIREBASE_DATABASE_ID as string | undefined) || '(default)'

/**
 * Đăng nhập Google bằng một phiên Firebase RIÊNG (không đụng phiên đang mở trên web), lấy mã làm mới
 * trao cho máy chủ MCP. Mỗi lần cho phép là một mã mới — thu hồi phiên AI không làm văng web.
 */
export async function dangNhapGoogleChoAi(): Promise<{ maLamMoi: string; dangXuat: () => Promise<void> }> {
  const app = getApps().find((a) => a.name === 'ai-phu') ?? initializeApp(cfg, 'ai-phu')
  const auth = getAuth(app)
  await setPersistence(auth, inMemoryPersistence)
  const { user } = await signInWithPopup(auth, new GoogleAuthProvider())
  return { maLamMoi: user.refreshToken, dangXuat: () => signOut(auth).then(() => deleteApp(app)) }
}

export interface PhienAi {
  id: string
  tenMay: string
  ungDung: string
  noiNhan: string
  taoLuc: number
  dungLuc?: number
}

export interface DongNhatKyAi {
  id: string
  email: string
  tenMay: string
  congCu: string
  tenDoiTuong: string
  tomTat: string
  luc: number
}

const db = () => getFirestore(getApp(), dbId)

export function theoDoiPhien(uidCuaToi: string, cb: (ds: PhienAi[]) => void, loi: (e: Error) => void) {
  if (isDemo) return () => {}
  return onSnapshot(
    query(collection(db(), 'mcp_sessions'), where('uid', '==', uidCuaToi)),
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }) as PhienAi).sort((a, b) => b.taoLuc - a.taoLuc)),
    loi,
  )
}

export const thuHoiPhien = (id: string) => deleteDoc(doc(db(), 'mcp_sessions', id))

export function theoDoiNhatKy(cb: (ds: DongNhatKyAi[]) => void, loi: (e: Error) => void, soDong = 30) {
  if (isDemo) return () => {}
  return onSnapshot(
    query(collection(db(), 'mcp_logs'), orderBy('luc', 'desc'), limit(soDong)),
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }) as DongNhatKyAi)),
    loi,
  )
}

export const uidHienTai = () => (isDemo ? null : (getAuth(getApp()).currentUser?.uid ?? null))

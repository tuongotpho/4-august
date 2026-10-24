// Chỉ dùng phần ĐĂNG NHẬP của Firebase (project app-from-ai, cùng khoá với 5 app).
// Cùng tên miền + cùng khoá + app tên mặc định → phiên đăng nhập ở trang chủ được cả 5 app dưới /quy-phong/, /lich-giang/… dùng chung.

import { initializeApp } from 'firebase/app'
import { getAuth, getRedirectResult, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, type User } from 'firebase/auth'

const app = initializeApp({
  apiKey: 'AIzaSyCfCX-xKHVnvv2tEb_AVdxL_xvqnnSjgcQ',
  authDomain: 'app-from-ai.firebaseapp.com',
  projectId: 'app-from-ai',
  appId: '1:895767442095:web:7f5f49b9a8b1e2bd259a5a',
})
const auth = getAuth(app)

export const theoDoiNguoiDung = (cb: (u: User | null) => void) => onAuthStateChanged(auth, cb)

/** Quay về sau khi đăng nhập kiểu chuyển trang (điện thoại chặn cửa sổ bật lên) */
export const ketQuaChuyenTrang = () => getRedirectResult(auth)

// Trình duyệt chặn cửa sổ bật lên (điện thoại, trình duyệt trong Zalo…) thì chuyển sang kiểu chuyển trang
const LOI_CUA_SO = ['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/web-storage-unsupported']

export async function dangNhap() {
  const nhaCC = new GoogleAuthProvider()
  try {
    await signInWithPopup(auth, nhaCC)
  } catch (e) {
    const ma = (e as { code?: string }).code ?? ''
    if (LOI_CUA_SO.includes(ma)) return signInWithRedirect(auth, nhaCC)
    throw e
  }
}

/** Đăng xuất ở trang chủ = đăng xuất cả 5 app (dùng chung phiên) */
export const dangXuat = () => signOut(auth)

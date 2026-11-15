// Đăng nhập Google qua Firebase Auth của project app-from-ai (dùng chung với các app cá nhân khác).
import { initializeApp } from 'firebase/app'
import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'

const env = import.meta.env
const app = initializeApp({
  // cấu hình web Firebase là thông tin công khai (có sẵn trong mã chạy của mọi app dùng chung project)
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyCfCX-xKHVnvv2tEb_AVdxL_xvqnnSjgcQ',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'app-from-ai.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'app-from-ai',
  appId: env.VITE_FIREBASE_APP_ID || '1:895767442095:web:6cd820bd280b8add259a5a',
})
export const auth = getAuth(app)
export const dangNhap = () => signInWithPopup(auth, new GoogleAuthProvider())
export const dangXuat = () => signOut(auth)
export const theoDoi = (cb: (u: User | null) => void) => onAuthStateChanged(auth, cb)

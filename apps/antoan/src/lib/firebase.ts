import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signInWithPopup, signOut, type User } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { FirebaseStore } from './store/FirebaseStore'

// Mã cấu hình web của Firebase — loại được phép công khai (chỉ để nhận diện dự án).
// Bảo mật nằm ở firestore.rules: mỗi tài khoản chỉ đọc/ghi được users/{uid}/ của mình.
const firebaseConfig = {
  apiKey: 'AIzaSyCfCX-xKHVnvv2tEb_AVdxL_xvqnnSjgcQ',
  authDomain: 'app-from-ai.firebaseapp.com',
  projectId: 'app-from-ai',
  storageBucket: 'app-from-ai.firebasestorage.app',
  messagingSenderId: '895767442095',
  appId: '1:895767442095:web:7f5f49b9a8b1e2bd259a5a',
}

const giaLap = import.meta.env.VITE_GIA_LAP === '1'
const app = initializeApp(giaLap ? { ...firebaseConfig, projectId: 'demo-atld' } : firebaseConfig)
export const auth = getAuth(app)

// Database riêng "antoan" (dự án dùng chung với app hoadon và app khác)
const db = getFirestore(app, 'antoan')
if (giaLap) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9198', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8188)
}

export function onUser(cb: (u: User | null) => void) {
  return onAuthStateChanged(auth, cb)
}

export async function dangNhapGoogle() {
  // Máy giả lập: đăng nhập bằng tài khoản Google giả (emulator nhận mã JSON không ký), khỏi bật cửa sổ
  if (giaLap) return void (await signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: 'thu-1', email: 'thu@gia.lap', email_verified: true }))))
  await signInWithPopup(auth, new GoogleAuthProvider())
}

export async function dangXuat() {
  await signOut(auth)
}

export function storeFor(u: User) {
  return new FirebaseStore(db, u.uid)
}

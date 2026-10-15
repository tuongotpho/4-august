/**
 * Chạy với emulator:  npm run test:emu
 * (firebase emulators:exec … đặt FIRESTORE_EMULATOR_HOST; thiếu biến này thì bỏ qua)
 */
import { describe, expect, it } from 'vitest';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';
import { FirestoreStore } from './firestore_store.js';
import { MAU_MAC_DINH, type MauNhap } from './mau_nhap.js';
import type { GiaoDich } from './types.js';

const coEmu = !!process.env.FIRESTORE_EMULATOR_HOST;
const DB = 'quyphong';

async function dangNhap(ten: string) {
  const app = initializeApp({ apiKey: 'fake', projectId: 'app-from-ai', authDomain: 'x' }, ten);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app, DB);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const cred = GoogleAuthProvider.credential(JSON.stringify({ sub: ten, email: `${ten}@test.local` }));
  const { user } = await signInWithCredential(auth, cred);
  return { app, db, uid: user.uid };
}

const cho = <T>(dangKy: (cb: (x: T) => void) => () => void, dk: (x: T) => boolean) =>
  new Promise<T>((ok) => {
    const huy = dangKy((x) => {
      if (dk(x)) {
        setTimeout(() => huy());
        ok(x);
      }
    });
  });

const gd = (id: string, soTien: number): GiaoDich => ({
  id, loai: 'chi', ngay: '2026-10-15', soTien, noiDung: 'Thử ' + id, doiTuong: '', ghiChu: '', daHoan: false, hinhThuc: 'CK', nhom: 'Khác',
});

describe.skipIf(!coEmu)('FirestoreStore trên emulator (database quyphong)', () => {
  it('lưu / sửa / xóa / nhập / mẫu, và người khác không đọc ghi được', async () => {
    const a = await dangNhap('nguoi-a');
    const b = await dangNhap('nguoi-b');
    const s = new FirestoreStore(a.db, a.uid);

    await s.nhap([gd('x1', 100), gd('x2', 200), { ...gd('x3', 300), nguon: undefined }], true);
    let ds = await cho<GiaoDich[]>((cb) => s.theoDoi(cb), (x) => x.length === 3);
    await s.luu({ ...gd('x1', 999) });
    await s.xoa('x2');
    ds = await cho<GiaoDich[]>((cb) => s.theoDoi(cb), (x) => x.length === 2 && x.some((g) => g.soTien === 999));
    expect(ds.map((g) => g.id).sort()).toEqual(['x1', 'x3']);

    await s.nhap([gd('y', 1)], true);
    ds = await cho<GiaoDich[]>((cb) => s.theoDoi(cb), (x) => x.length === 1);
    expect(ds[0].id).toBe('y');

    // Mẫu: null → danh sách → null
    expect(await cho<MauNhap[] | null>((cb) => s.theoDoiMau(cb), () => true)).toBeNull();
    await s.luuMau(MAU_MAC_DINH.slice(0, 3));
    expect(await cho<MauNhap[] | null>((cb) => s.theoDoiMau(cb), (x) => x?.length === 3)).toHaveLength(3);
    await s.luuMau(null);
    expect(await cho<MauNhap[] | null>((cb) => s.theoDoiMau(cb), (x) => x === null)).toBeNull();

    // Quy tắc: B không đọc / ghi được dữ liệu của A
    await expect(getDoc(doc(b.db, 'users', a.uid, 'giao_dich', 'y'))).rejects.toThrow(/permission|false for/i);
    await expect(setDoc(doc(b.db, 'users', a.uid, 'giao_dich', 'z'), { soTien: 1 })).rejects.toThrow(/permission|false for/i);

    await deleteApp(a.app);
    await deleteApp(b.app);
  }, 30_000);
});

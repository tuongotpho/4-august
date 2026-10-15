import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import type { MauNhap } from './mau_nhap.js';
import type { DataStore } from './store.js';
import type { GiaoDich } from './types.js';

/** Dữ liệu ở users/{uid}/giao_dich/{id} — chỉ chủ tài khoản đọc/ghi (xem firestore.rules). */
export class FirestoreStore implements DataStore {
  constructor(
    private db: Firestore,
    private uid: string,
  ) {}

  private col() {
    return collection(this.db, 'users', this.uid, 'giao_dich');
  }

  theoDoi(cb: (ds: GiaoDich[]) => void, loi?: (e: Error) => void) {
    return onSnapshot(
      this.col(),
      (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as GiaoDich), id: d.id }))),
      (e) => loi?.(e),
    );
  }

  async luu(g: GiaoDich) {
    const { id, ...con } = g;
    // Firestore không nhận undefined
    const sach = Object.fromEntries(Object.entries({ ...con, capNhat: Date.now() }).filter(([, v]) => v !== undefined));
    await setDoc(doc(this.col(), id), sach);
  }

  async xoa(id: string) {
    await deleteDoc(doc(this.col(), id));
  }

  async nhap(ds: GiaoDich[], thayThe: boolean) {
    const viec: ((b: ReturnType<typeof writeBatch>) => void)[] = [];
    if (thayThe) {
      const cu = await getDocs(this.col());
      cu.forEach((d) => viec.push((b) => b.delete(d.ref)));
    }
    for (const g of ds) {
      const { id, ...con } = g;
      const sach = Object.fromEntries(Object.entries({ ...con, capNhat: Date.now() }).filter(([, v]) => v !== undefined));
      viec.push((b) => b.set(doc(this.col(), id), sach));
    }
    // Mỗi batch tối đa 500 thao tác
    for (let i = 0; i < viec.length; i += 450) {
      const b = writeBatch(this.db);
      viec.slice(i, i + 450).forEach((f) => f(b));
      await b.commit();
    }
  }

  /** Mẫu nhập để chung một tài liệu: users/{uid}/cai_dat/mau_nhap { ds: [...] } */
  private docMau() {
    return doc(this.db, 'users', this.uid, 'cai_dat', 'mau_nhap');
  }

  theoDoiMau(cb: (ds: MauNhap[] | null) => void) {
    return onSnapshot(this.docMau(), (snap) => {
      const ds = snap.data()?.ds;
      cb(Array.isArray(ds) ? ds : null);
    });
  }

  async luuMau(ds: MauNhap[] | null) {
    await setDoc(this.docMau(), { ds: ds ?? deleteField() }, { merge: true });
  }
}

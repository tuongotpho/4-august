import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import type { MauNhap } from './mau_nhap.js';
import type { DataStore, NhatKyAI, PhienAI } from './store.js';
import type { GiaoDich } from './types.js';

/** Dữ liệu ở users/{uid}/giao_dich/{id} — chỉ chủ tài khoản đọc/ghi (xem firestore.rules). */
export class FirestoreStore implements DataStore {
  constructor(
    private db: Firestore,
    private uid: string,
  ) {}

  private nhanh(ten: string) {
    return collection(this.db, 'users', this.uid, ten);
  }

  /** Phiên AI do máy chủ MCP tạo (users/{uid}/phienAI) — xoá = thu hồi; nhật ký ở users/{uid}/nhatKyAI */
  ai = {
    theoDoiPhien: (cb: (ds: PhienAI[]) => void) =>
      onSnapshot(this.nhanh('phienAI'), (snap) =>
        cb(
          snap.docs
            .map((d) => {
              const x = d.data();
              return { id: d.id, tenMay: x.tenMay ?? '', ungDung: x.ungDung ?? '', noiNhan: x.noiNhan ?? '', taoLuc: x.taoLuc?.toDate?.() ?? null };
            })
            .sort((a, b) => (b.taoLuc?.getTime() ?? 0) - (a.taoLuc?.getTime() ?? 0)),
        ),
      ),
    thuHoi: (id: string) => deleteDoc(doc(this.nhanh('phienAI'), id)),
    theoDoiNhatKy: (cb: (ds: NhatKyAI[]) => void) =>
      onSnapshot(query(this.nhanh('nhatKyAI'), orderBy('luc', 'desc'), limit(30)), (snap) =>
        cb(
          snap.docs.map((d) => {
            const x = d.data();
            return { id: d.id, luc: x.luc?.toDate?.() ?? null, tenMay: x.tenMay ?? '', congCu: x.congCu ?? '', moTa: x.moTa ?? '' };
          }),
        ),
      ),
  };

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

import type { MauNhap } from './mau_nhap.js';
import type { DataStore } from './store.js';
import type { GiaoDich } from './types.js';

const KHOA = 'quy-ktat:giao-dich';
const KHOA_MAU = 'quy-ktat:mau-nhap';

/** Lưu trong trình duyệt (dùng khi chưa cấu hình Firebase). */
export class LocalStore implements DataStore {
  private nghe = new Set<(ds: GiaoDich[]) => void>();
  private ngheMau = new Set<(ds: MauNhap[] | null) => void>();

  constructor(private kho: Pick<Storage, 'getItem' | 'setItem'> = localStorage) {}

  private doc(): GiaoDich[] {
    try {
      return JSON.parse(this.kho.getItem(KHOA) ?? '[]');
    } catch {
      return [];
    }
  }

  private ghi(ds: GiaoDich[]) {
    this.kho.setItem(KHOA, JSON.stringify(ds));
    for (const cb of this.nghe) cb(ds);
  }

  theoDoi(cb: (ds: GiaoDich[]) => void) {
    this.nghe.add(cb);
    cb(this.doc());
    return () => void this.nghe.delete(cb);
  }

  async luu(g: GiaoDich) {
    const ds = this.doc().filter((x) => x.id !== g.id);
    ds.push({ ...g, capNhat: Date.now() });
    this.ghi(ds);
  }

  async xoa(id: string) {
    this.ghi(this.doc().filter((x) => x.id !== id));
  }

  async nhap(moi: GiaoDich[], thayThe: boolean) {
    const ids = new Set(moi.map((g) => g.id));
    const cu = thayThe ? [] : this.doc().filter((g) => !ids.has(g.id));
    this.ghi([...cu, ...moi]);
  }

  private docMau(): MauNhap[] | null {
    try {
      return JSON.parse(this.kho.getItem(KHOA_MAU) ?? 'null');
    } catch {
      return null;
    }
  }

  theoDoiMau(cb: (ds: MauNhap[] | null) => void) {
    this.ngheMau.add(cb);
    cb(this.docMau());
    return () => void this.ngheMau.delete(cb);
  }

  async luuMau(ds: MauNhap[] | null) {
    this.kho.setItem(KHOA_MAU, JSON.stringify(ds));
    for (const cb of this.ngheMau) cb(ds);
  }
}

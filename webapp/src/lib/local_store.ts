import type { DataStore } from './store.js';
import type { GiaoDich } from './types.js';

const KHOA = 'quy-ktat:giao-dich';

/** Lưu trong trình duyệt (dùng khi chưa cấu hình Firebase). */
export class LocalStore implements DataStore {
  private nghe = new Set<(ds: GiaoDich[]) => void>();

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
}

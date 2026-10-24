import { describe, expect, it } from 'vitest';
import { LocalStore } from './local_store.js';
import { apMau, MAU_MAC_DINH, mauTuGiaoDich, nhanTien, type MauNhap } from './mau_nhap.js';
import { NHOM_CHI, NHOM_THU } from './types.js';

describe('mẫu nhập', () => {
  it('mẫu mặc định: id không trùng, nhóm hợp lệ theo loại', () => {
    expect(new Set(MAU_MAC_DINH.map((m) => m.id)).size).toBe(MAU_MAC_DINH.length);
    for (const m of MAU_MAC_DINH) expect(m.loai === 'thu' ? NHOM_THU : NHOM_CHI).toContain(m.nhom);
  });

  it('áp mẫu ra giao dịch mới, mỗi lần một id', () => {
    const m = MAU_MAC_DINH.find((x) => x.id === 'm-hoa-sn')!;
    const a = apMau(m, '2026-10-15');
    expect(a).toMatchObject({ loai: 'chi', nhom: 'Sinh nhật', soTien: 600_000, hinhThuc: 'CK', ngay: '2026-10-15', daHoan: false });
    expect(apMau(m, '2026-10-15').id).not.toBe(a.id);
  });

  it('tạo mẫu từ giao dịch đang nhập', () => {
    const g = apMau(MAU_MAC_DINH[0], '2026-10-15');
    const m = mauTuGiaoDich({ ...g, noiDung: '  Sinh nhật sếp Nam ', soTien: 3_000_000 }, '');
    expect(m).toMatchObject({ ten: 'Sinh nhật sếp Nam', noiDung: 'Sinh nhật sếp Nam ', soTien: 3_000_000, loai: 'chi' });
  });

  it('nhãn tiền nhanh', () => {
    expect([200_000, 1_000_000, 10_000_000].map(nhanTien)).toEqual(['200k', '1tr', '10tr']);
  });

  it('LocalStore lưu / khôi phục mẫu', async () => {
    const m = new Map<string, string>();
    const s = new LocalStore({ getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) });
    let ds: MauNhap[] | null | undefined;
    s.theoDoiMau((x) => (ds = x));
    expect(ds).toBeNull();
    await s.luuMau(MAU_MAC_DINH.slice(0, 2));
    expect(ds).toHaveLength(2);
    await s.luuMau([]);
    expect(ds).toEqual([]); // xóa hết mẫu khác với "chưa tùy chỉnh"
    await s.luuMau(null);
    expect(ds).toBeNull();
  });
});

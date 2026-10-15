import { describe, expect, it } from 'vitest';
import { LocalStore } from './local_store.js';
import { docJson, docTien, loc, soQuy, theoThang, tong, vanDe, xuatCsv } from './tinh_toan.js';
import type { GiaoDich } from './types.js';

const gd = (p: Partial<GiaoDich>): GiaoDich => ({
  id: p.id ?? Math.random().toString(),
  loai: 'chi',
  ngay: '2025-01-01',
  soTien: 0,
  noiDung: '',
  doiTuong: '',
  ghiChu: '',
  daHoan: false,
  hinhThuc: 'CK',
  nhom: 'Khác',
  ...p,
});

const mau = [
  gd({ id: 'a', loai: 'thu', ngay: '2025-01-05', soTien: 10_000_000, noiDung: 'Thưởng phòng' }),
  gd({ id: 'b', ngay: '2025-01-10', soTien: 3_000_000, noiDung: 'Sinh nhật sếp Nam', nhom: 'Sinh nhật' }),
  gd({ id: 'c', ngay: '2025-02-01', soTien: null, noiDung: 'Làm việc Hòa Bình', hinhThuc: '' }),
  gd({ id: 'd', ngay: '2025-02-03', soTien: 9_000_000, noiDung: 'Liên hoan' }),
];

describe('tính toán sổ quỹ', () => {
  it('tồn quỹ lũy kế theo ngày, bỏ qua dòng thiếu tiền', () => {
    expect(soQuy([...mau].reverse()).map((g) => g.ton)).toEqual([10e6, 7e6, 7e6, -2e6]);
    expect(tong(mau)).toEqual({ thu: 10e6, chi: 12e6, ton: -2e6 });
  });

  it('gộp theo tháng', () => {
    expect(theoThang(mau)).toEqual([
      { thang: '2025-01', thu: 10e6, chi: 3e6, ton: 7e6 },
      { thang: '2025-02', thu: 0, chi: 9e6, ton: -2e6 },
    ]);
  });

  it('lọc: tìm không dấu, theo tháng, cần kiểm tra', () => {
    expect(loc(mau, { tuKhoa: 'sinh nhat' }).map((g) => g.id)).toEqual(['b']);
    expect(loc(mau, { thang: '02' }).map((g) => g.id)).toEqual(['c', 'd']);
    expect(loc(mau, { chiCanKiemTra: true }).map((g) => g.id)).toEqual(['c']);
    expect(vanDe(mau[2])).toEqual(['Không có số tiền', 'Chưa ghi TM/CK']);
  });

  it('đọc số tiền gõ tay', () => {
    expect(docTien('1.500.000')).toBe(1_500_000);
    expect(docTien('1,5tr')).toBe(1_500_000);
    expect(docTien('500k')).toBe(500_000);
    expect(docTien('abc')).toBeNull();
    expect(docTien('')).toBeNull();
  });

  it('nhập JSON: chặn dữ liệu sai, làm sạch trường', () => {
    expect(() => docJson({})).toThrow();
    expect(() => docJson([{ loai: 'x' }])).toThrow();
    const [g] = docJson([{ id: 'x', loai: 'thu', ngay: '05/01/2025', soTien: 1.6, hinhThuc: 'abc' }]);
    expect(g).toMatchObject({ id: 'x', ngay: null, soTien: 2, hinhThuc: '', nhom: 'Khác', daHoan: false });
  });

  it('CSV có BOM và thoát dấu ngoặc kép', () => {
    const csv = xuatCsv(soQuy([gd({ noiDung: 'Mua "chè"', soTien: 5 })]));
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('"Mua ""chè"""');
  });
});

describe('LocalStore', () => {
  const kho = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };

  it('lưu, sửa, xóa, nhập gộp/thay thế', async () => {
    const s = new LocalStore(kho());
    let ds: GiaoDich[] = [];
    s.theoDoi((x) => (ds = x));
    await s.nhap(mau, false);
    expect(ds).toHaveLength(4);
    await s.luu({ ...mau[0], soTien: 1 });
    expect(ds.find((g) => g.id === 'a')?.soTien).toBe(1);
    await s.xoa('b');
    expect(ds.map((g) => g.id).sort()).toEqual(['a', 'c', 'd']);
    await s.nhap([gd({ id: 'z' })], false);
    expect(ds).toHaveLength(4);
    await s.nhap([gd({ id: 'z' })], true);
    expect(ds.map((g) => g.id)).toEqual(['z']);
  });
});

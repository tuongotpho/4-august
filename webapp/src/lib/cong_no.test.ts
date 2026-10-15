import { describe, expect, it } from 'vitest';
import { canhBaoCongNo, congNo, tongCongNo } from './cong_no.js';
import { loc, soQuy } from './tinh_toan.js';
import type { GiaoDich } from './types.js';

const gd = (p: Partial<GiaoDich>): GiaoDich => ({
  id: p.id ?? Math.random().toString(),
  loai: 'chi',
  ngay: '2026-01-01',
  soTien: 0,
  noiDung: '',
  doiTuong: '',
  ghiChu: '',
  daHoan: false,
  hinhThuc: 'CK',
  nhom: 'Khác',
  ...p,
});

const so = [
  // A Tuấn ứng cho phòng 9,8tr; phòng đã trả 2 lần 3tr + 2tr
  gd({ id: 'u1', loai: 'thu', nhom: 'Ứng, vay', soTien: 9_800_000, noiDung: 'A Tuấn ứng tiền cho phòng', ngay: '2026-02-11' }),
  gd({ id: 't1', loai: 'chi', nhom: 'Ứng, vay, trả', soTien: 3_000_000, noiDung: 'Trả a Tuấn', hoanCho: 'u1', ngay: '2026-03-01' }),
  gd({ id: 't2', loai: 'chi', nhom: 'Ứng, vay, trả', soTien: 2_000_000, noiDung: 'Trả a Tuấn', hoanCho: 'u1', ngay: '2026-04-01' }),
  // Phòng ứng cho a Hòa 10tr, chưa hoàn
  gd({ id: 'u2', loai: 'chi', nhom: 'Ứng, vay, trả', soTien: 10_000_000, noiDung: 'Gửi a Hòa đi NPC', ngay: '2026-01-10' }),
  // Khoản cũ đã đánh dấu hoàn
  gd({ id: 'u3', loai: 'chi', nhom: 'Ứng, vay, trả', soTien: 5_000_000, daHoan: true, ngay: '2024-06-10' }),
  // Ứng mới, chưa quá hạn
  gd({ id: 'u4', loai: 'chi', nhom: 'Ứng, vay, trả', soTien: 1_000_000, ngay: '2026-04-20' }),
];

describe('công nợ ứng', () => {
  it('cộng dồn các lần trả, bỏ khoản đã hoàn', () => {
    const ds = congNo(so, '2026-05-01');
    expect(ds.map((k) => [k.g.id, k.chieu, k.daTra, k.conLai])).toEqual([
      ['u3', 'no_phong', 0, 0],
      ['u2', 'no_phong', 0, 10_000_000],
      ['u1', 'phong_no', 5_000_000, 4_800_000],
      ['u4', 'no_phong', 0, 1_000_000],
    ]);
    expect(tongCongNo(ds)).toEqual({ phongNo: 4_800_000, noPhong: 11_000_000 });
  });

  it('dòng trả ứng không bị tính là khoản ứng mới', () => {
    expect(congNo(so, '2026-05-01').some((k) => k.g.id === 't1')).toBe(false);
  });

  it('cảnh báo quá hạn và liên kết sai', () => {
    const cb = canhBaoCongNo(
      [...so, gd({ id: 'x', loai: 'chi', hoanCho: 'u2' }), gd({ id: 'y', loai: 'thu', hoanCho: 'khong-co' })],
      '2026-05-01',
    );
    expect(cb.get('u1')).toEqual(['Phòng nợ ứng quá 30 ngày chưa trả']);
    expect(cb.get('u2')).toEqual(['Ứng quá 30 ngày chưa hoàn']);
    expect(cb.has('u4')).toBe(false);
    expect(cb.get('x')?.[0]).toMatch(/sai chiều/);
    expect(cb.get('y')?.[0]).toMatch(/không còn/);
  });

  it('sổ quỹ: cùng ngày thu trước chi, cảnh báo công nợ nằm trong canhBao và bộ lọc', () => {
    const s = soQuy(
      [
        gd({ id: 'c', loai: 'chi', ngay: '2026-02-11', soTien: 10_000_000 }),
        gd({ id: 'a', loai: 'thu', ngay: '2026-02-11', soTien: 20_000_000 }),
      ],
      '2026-05-01',
    );
    expect(s.map((g) => [g.id, g.ton])).toEqual([
      ['a', 20_000_000],
      ['c', 10_000_000],
    ]);
    const s2 = soQuy(so, '2026-05-01');
    expect(loc(s2, { chiCanKiemTra: true }).map((g) => g.id)).toEqual(['u2', 'u1']);
  });

  it('cảnh báo nhóm Khác lớn và thu đánh dấu đã hoàn', () => {
    const s = soQuy(
      [
        gd({ id: 'k', loai: 'thu', soTien: 69_600_000, nhom: 'Khác' }),
        gd({ id: 'h', loai: 'thu', soTien: 50_000_000, nhom: 'Thưởng', daHoan: true }),
      ],
      '2026-01-01',
    );
    expect(s.find((g) => g.id === 'k')?.canhBao).toEqual(['Nhóm "Khác" từ 5 triệu — nên xếp nhóm cụ thể']);
    expect(s.find((g) => g.id === 'h')?.canhBao).toEqual(['Khoản thu đánh dấu "Đã hoàn" nhưng không phải tiền ứng']);
  });
});

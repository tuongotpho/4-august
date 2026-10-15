import type { GiaoDich, Loai } from './types.js';

export interface BoLoc {
  loai?: Loai | '';
  nhom?: string;
  nam?: string;
  thang?: string; // "01".."12"
  tuKhoa?: string;
  chiCanKiemTra?: boolean;
}

export interface DongSo extends GiaoDich {
  ton: number;
}

const boDau = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

export function sapXep(ds: GiaoDich[]): GiaoDich[] {
  return [...ds].sort(
    (a, b) =>
      (a.ngay ?? '').localeCompare(b.ngay ?? '') ||
      a.loai.localeCompare(b.loai) ||
      a.id.localeCompare(b.id),
  );
}

/** Sổ quỹ theo thời gian, kèm tồn quỹ lũy kế sau mỗi dòng (tính trên toàn bộ, trước khi lọc). */
export function soQuy(ds: GiaoDich[]): DongSo[] {
  let ton = 0;
  return sapXep(ds).map((g) => {
    ton += (g.loai === 'thu' ? 1 : -1) * (g.soTien ?? 0);
    return { ...g, ton };
  });
}

export function vanDe(g: GiaoDich): string[] {
  const v: string[] = [];
  if (g.soTien == null) v.push('Không có số tiền');
  if (!g.ngay) v.push('Không có ngày');
  if (g.loai === 'chi' && !g.hinhThuc) v.push('Chưa ghi TM/CK');
  return v;
}

export function loc<T extends GiaoDich>(ds: T[], b: BoLoc): T[] {
  const tk = b.tuKhoa ? boDau(b.tuKhoa.trim()) : '';
  return ds.filter((g) => {
    if (b.loai && g.loai !== b.loai) return false;
    if (b.nhom && g.nhom !== b.nhom) return false;
    if (b.nam && g.ngay?.slice(0, 4) !== b.nam) return false;
    if (b.thang && g.ngay?.slice(5, 7) !== b.thang) return false;
    if (b.chiCanKiemTra && vanDe(g).length === 0) return false;
    if (tk && !boDau(`${g.noiDung} ${g.doiTuong} ${g.ghiChu}`).includes(tk)) return false;
    return true;
  });
}

export function tong(ds: GiaoDich[]) {
  let thu = 0;
  let chi = 0;
  for (const g of ds) {
    if (g.loai === 'thu') thu += g.soTien ?? 0;
    else chi += g.soTien ?? 0;
  }
  return { thu, chi, ton: thu - chi };
}

export function theoThang(ds: GiaoDich[]) {
  const m = new Map<string, { thu: number; chi: number }>();
  for (const g of ds) {
    if (!g.ngay) continue;
    const k = g.ngay.slice(0, 7);
    const a = m.get(k) ?? { thu: 0, chi: 0 };
    a[g.loai] += g.soTien ?? 0;
    m.set(k, a);
  }
  let ton = 0;
  return [...m.keys()].sort().map((thang) => {
    const a = m.get(thang)!;
    ton += a.thu - a.chi;
    return { thang, ...a, ton };
  });
}

export function theoNhom(ds: GiaoDich[], loai: Loai) {
  const m = new Map<string, { tien: number; so: number }>();
  for (const g of ds) {
    if (g.loai !== loai) continue;
    const a = m.get(g.nhom) ?? { tien: 0, so: 0 };
    a.tien += g.soTien ?? 0;
    a.so += 1;
    m.set(g.nhom, a);
  }
  return [...m.entries()].map(([nhom, a]) => ({ nhom, ...a })).sort((a, b) => b.tien - a.tien);
}

export function cacNam(ds: GiaoDich[]): string[] {
  return [...new Set(ds.map((g) => g.ngay?.slice(0, 4)).filter((x): x is string => !!x))].sort();
}

export const dinhDangTien = (n: number | null | undefined) =>
  n == null ? '' : n.toLocaleString('vi-VN');

export const dinhDangNgay = (s: string | null) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');

/** Đọc "1.500.000", "1,5tr", "500k" → số đồng. */
export function docTien(s: string): number | null {
  const t = s.trim().toLowerCase().replace(/\s/g, '');
  if (!t) return null;
  const m = t.match(/^([\d.,]+)(tr|triệu|k|nghìn)?$/);
  if (!m) return null;
  if (m[2]) {
    const x = parseFloat(m[1].replace(',', '.'));
    return Number.isFinite(x) ? Math.round(x * (m[2].startsWith('t') ? 1e6 : 1e3)) : null;
  }
  const x = parseInt(m[1].replace(/[.,]/g, ''), 10);
  return Number.isFinite(x) ? x : null;
}

/** Xuất CSV (có BOM để Excel đọc đúng tiếng Việt). */
export function xuatCsv(ds: DongSo[]): string {
  const dau = ['Ngày', 'Loại', 'Nhóm', 'Nội dung', 'Đơn vị/Người', 'Thu', 'Chi', 'Tồn quỹ', 'Hình thức', 'Đã hoàn', 'Ghi chú'];
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const dong = ds.map((g) =>
    [
      dinhDangNgay(g.ngay),
      g.loai === 'thu' ? 'Thu' : 'Chi',
      g.nhom,
      g.noiDung,
      g.doiTuong,
      g.loai === 'thu' ? g.soTien ?? '' : '',
      g.loai === 'chi' ? g.soTien ?? '' : '',
      g.ton,
      { TM: 'Tiền mặt', CK: 'Chuyển khoản', '': '' }[g.hinhThuc],
      g.daHoan ? 'x' : '',
      g.ghiChu,
    ]
      .map(q)
      .join(','),
  );
  return '﻿' + [dau.map(q).join(','), ...dong].join('\r\n');
}

/** Kiểm tra & làm sạch dữ liệu nhập từ file JSON. */
export function docJson(raw: unknown): GiaoDich[] {
  if (!Array.isArray(raw)) throw new Error('File phải là một mảng giao dịch');
  return raw.map((r, i) => {
    if (!r || typeof r !== 'object') throw new Error(`Dòng ${i + 1} không hợp lệ`);
    const o = r as Record<string, unknown>;
    if (o.loai !== 'thu' && o.loai !== 'chi') throw new Error(`Dòng ${i + 1}: loai phải là thu/chi`);
    const s = (v: unknown) => (typeof v === 'string' ? v : '');
    return {
      id: s(o.id) || `nhap-${Date.now()}-${i}`,
      loai: o.loai,
      ngay: /^\d{4}-\d{2}-\d{2}$/.test(s(o.ngay)) ? s(o.ngay) : null,
      soTien: typeof o.soTien === 'number' ? Math.round(o.soTien) : null,
      noiDung: s(o.noiDung),
      doiTuong: s(o.doiTuong),
      ghiChu: s(o.ghiChu),
      daHoan: o.daHoan === true,
      hinhThuc: o.hinhThuc === 'TM' || o.hinhThuc === 'CK' ? o.hinhThuc : '',
      nhom: s(o.nhom) || 'Khác',
      nguon: s(o.nguon) || undefined,
    };
  });
}

// Phần xử lý của từng công cụ MCP — hàm thuần trên dữ liệu đã tải, dùng ĐÚNG phần tính toán của web app
// (src/lib/tinh_toan.ts, mau_nhap.ts) để số liệu AI trả lời khớp với màn hình.

import { apMau, ngayTruoc, type MauNhap } from '../src/lib/mau_nhap.js';
import { taoId } from '../src/lib/store.js';
import { docTien, loc, soQuy, theoNhom, theoThang, tong, vanDe, type DongSo } from '../src/lib/tinh_toan.js';
import { NHOM_CHI, NHOM_THU, type GiaoDich, type HinhThuc, type Loai } from '../src/lib/types.js';

export interface DuLieu {
  giaoDich: GiaoDich[];
  mau: MauNhap[];
}

export interface NoiGhi {
  luu(g: GiaoDich): Promise<void>;
  xoa(id: string): Promise<void>;
  nhatKy(congCu: string, moTa: string): Promise<void>;
}

const boDau = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();

const vnd = (n: number | null | undefined) => (n == null ? 'chưa có số tiền' : `${n.toLocaleString('vi-VN')} đ`);

/** Dạng gọn gửi cho AI */
function dong(g: GiaoDich & { ton?: number }) {
  return {
    id: g.id,
    ngay: g.ngay,
    loai: g.loai,
    so_tien: g.soTien,
    noi_dung: g.noiDung,
    nhom: g.nhom,
    doi_tuong: g.doiTuong || undefined,
    hinh_thuc: g.hinhThuc || undefined,
    da_hoan: g.daHoan || undefined,
    ghi_chu: g.ghiChu || undefined,
    ton_quy_sau: g.ton,
    can_kiem_tra: vanDe(g).length ? vanDe(g) : undefined,
  };
}

function timGiaoDich(d: DuLieu, id: string): GiaoDich {
  const g = d.giaoDich.find((x) => x.id === id);
  if (!g) throw new Error(`Không có giao dịch id "${id}" — dùng danh_sach_giao_dich để tìm id`);
  return g;
}

function kiemNhom(loai: Loai, nhom: string) {
  const ds = loai === 'thu' ? NHOM_THU : NHOM_CHI;
  if (!ds.includes(nhom)) throw new Error(`Nhóm "${nhom}" không có trong nhóm ${loai}. Chọn một trong: ${ds.join(' | ')}`);
}

function kiemNgay(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) throw new Error(`Ngày "${s}" không đúng dạng yyyy-mm-dd`);
}

function docSoTien(v: number | string | null | undefined): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const n = typeof v === 'number' ? Math.round(v) : docTien(v);
  if (n == null || n < 0) throw new Error(`Số tiền "${v}" không hợp lệ (vd 1500000, "1,5tr", "500k")`);
  return n;
}

// ---------------- Đọc ----------------

export function tongQuan(d: DuLieu) {
  const so = soQuy(d.giaoDich);
  const homNay = ngayTruoc(0);
  const nam = homNay.slice(0, 4);
  const thang = homNay.slice(5, 7);
  const t = tong(so);
  const tNam = tong(loc(so, { nam }));
  const tThang = tong(loc(so, { nam, thang }));
  return {
    hom_nay: homNay,
    so_giao_dich: so.length,
    tu_ngay: so.find((g) => g.ngay)?.ngay ?? null,
    den_ngay: [...so].reverse().find((g) => g.ngay)?.ngay ?? null,
    ton_quy: t.ton,
    tong_thu: t.thu,
    tong_chi: t.chi,
    nam_nay: { nam, thu: tNam.thu, chi: tNam.chi, chenh_lech: tNam.ton },
    thang_nay: { thang: `${thang}/${nam}`, thu: tThang.thu, chi: tThang.chi, chenh_lech: tThang.ton },
    can_kiem_tra: so.filter((g) => vanDe(g).length).length,
    gan_day: [...so].reverse().slice(0, 8).map(dong),
    nhom_thu: NHOM_THU,
    nhom_chi: NHOM_CHI,
  };
}

export interface ThamSoDanhSach {
  loai?: Loai;
  nhom?: string;
  nam?: number;
  thang?: number;
  tu_ngay?: string;
  den_ngay?: string;
  tim?: string;
  can_kiem_tra?: boolean;
  da_hoan?: boolean;
  gioi_han?: number;
  cu_truoc?: boolean;
}

export function danhSachGiaoDich(d: DuLieu, a: ThamSoDanhSach) {
  let ds: DongSo[] = loc(soQuy(d.giaoDich), {
    loai: a.loai,
    nhom: a.nhom,
    nam: a.nam ? String(a.nam) : undefined,
    thang: a.thang ? String(a.thang).padStart(2, '0') : undefined,
    tuKhoa: a.tim,
    chiCanKiemTra: a.can_kiem_tra,
  });
  if (a.tu_ngay) ds = ds.filter((g) => (g.ngay ?? '') >= a.tu_ngay!);
  if (a.den_ngay) ds = ds.filter((g) => (g.ngay ?? '') <= a.den_ngay!);
  if (a.da_hoan !== undefined) ds = ds.filter((g) => g.daHoan === a.da_hoan);
  const t = tong(ds);
  const gioiHan = a.gioi_han ?? 50;
  const sapXep = a.cu_truoc ? ds : [...ds].reverse();
  return {
    so_dong: ds.length,
    tong_thu: t.thu,
    tong_chi: t.chi,
    chenh_lech: t.ton,
    hien: Math.min(gioiHan, ds.length),
    ghi_chu: ds.length > gioiHan ? `Chỉ hiện ${gioiHan}/${ds.length} dòng (${a.cu_truoc ? 'cũ' : 'mới'} nhất trước); tổng tiền tính trên TẤT CẢ ${ds.length} dòng` : undefined,
    dong: sapXep.slice(0, gioiHan).map(dong),
  };
}

export function tongHop(d: DuLieu, a: { nam?: number }) {
  const so = soQuy(d.giaoDich);
  const pham = a.nam ? loc(so, { nam: String(a.nam) }) : so;
  // Tồn cuối tháng luôn tính lũy kế từ đầu sổ
  const tonThang = new Map(theoThang(so).map((t) => [t.thang, t.ton]));
  const t = tong(pham);
  return {
    pham_vi: a.nam ? `năm ${a.nam}` : 'toàn bộ sổ',
    tong_thu: t.thu,
    tong_chi: t.chi,
    chenh_lech: t.ton,
    theo_thang: theoThang(pham).map((x) => ({ thang: x.thang, thu: x.thu, chi: x.chi, chenh_lech: x.thu - x.chi, ton_cuoi_thang: tonThang.get(x.thang) })),
    chi_theo_nhom: theoNhom(pham, 'chi').map((n) => ({ nhom: n.nhom, so_lan: n.so, tien: n.tien })),
    thu_theo_nhom: theoNhom(pham, 'thu').map((n) => ({ nhom: n.nhom, so_lan: n.so, tien: n.tien })),
  };
}

export function danhSachMau(d: DuLieu) {
  return d.mau.map((m) => ({
    id: m.id,
    ten: m.ten,
    loai: m.loai,
    nhom: m.nhom,
    noi_dung_mau: m.noiDung.trim() || undefined,
    hinh_thuc: m.hinhThuc || undefined,
    doi_tuong: m.doiTuong || undefined,
    so_tien: m.soTien ?? undefined,
  }));
}

// ---------------- Ghi ----------------

export interface ThamSoThem {
  mau?: string;
  loai?: Loai;
  ngay?: string;
  so_tien?: number | string;
  noi_dung?: string;
  nhom?: string;
  hinh_thuc?: HinhThuc;
  doi_tuong?: string;
  ghi_chu?: string;
  da_hoan?: boolean;
  bo_qua_trung?: boolean;
}

function timMau(d: DuLieu, ten: string): MauNhap {
  const k = boDau(ten);
  const m = d.mau.find((x) => x.id === ten) ?? d.mau.find((x) => boDau(x.ten) === k) ?? d.mau.find((x) => boDau(x.ten).includes(k));
  if (!m) throw new Error(`Không có mẫu "${ten}". Mẫu hiện có: ${d.mau.map((x) => x.ten).join(' | ')}`);
  return m;
}

export async function themGiaoDich(d: DuLieu, ghi: NoiGhi, a: ThamSoThem) {
  const ngay = a.ngay ?? ngayTruoc(0);
  kiemNgay(ngay);
  const mau = a.mau ? timMau(d, a.mau) : null;
  const goc: GiaoDich = mau
    ? apMau(mau, ngay)
    : { id: taoId(), loai: a.loai ?? 'chi', ngay, soTien: null, noiDung: '', doiTuong: '', ghiChu: '', daHoan: false, hinhThuc: '', nhom: 'Khác' };
  const loai = a.loai ?? goc.loai;
  const g: GiaoDich = {
    ...goc,
    loai,
    soTien: docSoTien(a.so_tien) ?? goc.soTien,
    noiDung: (a.noi_dung ?? goc.noiDung).trim(),
    nhom: a.nhom ?? (loai === goc.loai ? goc.nhom : 'Khác'),
    hinhThuc: a.hinh_thuc ?? goc.hinhThuc,
    doiTuong: a.doi_tuong ?? goc.doiTuong,
    ghiChu: a.ghi_chu ?? '',
    daHoan: a.da_hoan ?? false,
  };
  if (!g.noiDung) throw new Error('Thiếu nội dung giao dịch');
  if (g.soTien == null) throw new Error('Thiếu số tiền');
  kiemNhom(g.loai, g.nhom);

  // Chặn nhập trùng: cùng ngày, cùng loại, cùng số tiền, nội dung gần giống
  const nd = boDau(g.noiDung);
  const trung = d.giaoDich.filter(
    (x) => x.ngay === g.ngay && x.loai === g.loai && x.soTien === g.soTien && (boDau(x.noiDung).includes(nd) || nd.includes(boDau(x.noiDung))),
  );
  if (trung.length && !a.bo_qua_trung) {
    return {
      da_ghi: false,
      nghi_trung: trung.map(dong),
      huong_dan: 'Có giao dịch giống hệt (cùng ngày, loại, số tiền, nội dung gần giống). Hỏi người dùng; nếu vẫn muốn ghi thì gọi lại với bo_qua_trung=true.',
    };
  }

  await ghi.luu(g);
  await ghi.nhatKy('them_giao_dich', `${g.loai === 'thu' ? 'Thu' : 'Chi'} ${vnd(g.soTien)} — ${g.noiDung} (${g.ngay})`);
  const sau = tong([...d.giaoDich, g]);
  return { da_ghi: true, giao_dich: dong(g), mau_da_dung: mau?.ten, ton_quy_moi: sau.ton };
}

export interface ThamSoSua {
  id: string;
  loai?: Loai;
  ngay?: string;
  so_tien?: number | string | null;
  noi_dung?: string;
  nhom?: string;
  hinh_thuc?: HinhThuc;
  doi_tuong?: string;
  ghi_chu?: string;
  da_hoan?: boolean;
}

export async function suaGiaoDich(d: DuLieu, ghi: NoiGhi, a: ThamSoSua) {
  const cu = timGiaoDich(d, a.id);
  const moi: GiaoDich = { ...cu };
  if (a.loai !== undefined) moi.loai = a.loai;
  if (a.ngay !== undefined) {
    kiemNgay(a.ngay);
    moi.ngay = a.ngay;
  }
  if (a.so_tien !== undefined) moi.soTien = docSoTien(a.so_tien) ?? null;
  if (a.noi_dung !== undefined) {
    if (!a.noi_dung.trim()) throw new Error('Nội dung không được để trống');
    moi.noiDung = a.noi_dung.trim();
  }
  if (a.nhom !== undefined) moi.nhom = a.nhom;
  if (a.hinh_thuc !== undefined) moi.hinhThuc = a.hinh_thuc;
  if (a.doi_tuong !== undefined) moi.doiTuong = a.doi_tuong;
  if (a.ghi_chu !== undefined) moi.ghiChu = a.ghi_chu;
  if (a.da_hoan !== undefined) moi.daHoan = a.da_hoan;
  // Đổi thu <-> chi mà nhóm cũ không hợp thì báo, không tự đoán
  kiemNhom(moi.loai, moi.nhom);

  const doi = (Object.keys(moi) as (keyof GiaoDich)[])
    .filter((k) => k !== 'capNhat' && moi[k] !== cu[k])
    .map((k) => ({ o: k, cu: cu[k], moi: moi[k] }));
  if (!doi.length) return { da_ghi: false, thong_bao: 'Không có gì thay đổi', giao_dich: dong(cu) };

  await ghi.luu(moi);
  await ghi.nhatKy('sua_giao_dich', `Sửa "${cu.noiDung}" (${cu.ngay}): ${doi.map((x) => `${x.o}: ${String(x.cu)} → ${String(x.moi)}`).join('; ')}`);
  return { da_ghi: true, thay_doi: doi, giao_dich: dong(moi), ton_quy_moi: tong(d.giaoDich.map((x) => (x.id === moi.id ? moi : x))).ton };
}

export async function xoaGiaoDich(d: DuLieu, ghi: NoiGhi, a: { id: string; xac_nhan: string }) {
  const g = timGiaoDich(d, a.id);
  if (a.xac_nhan.trim() !== g.noiDung.trim()) {
    return {
      da_xoa: false,
      can_xac_nhan: g.noiDung,
      giao_dich: dong(g),
      huong_dan: 'Hỏi người dùng có chắc xoá giao dịch này không; đồng ý thì gửi lại với xac_nhan đúng bằng can_xac_nhan.',
    };
  }
  await ghi.xoa(g.id);
  await ghi.nhatKy('xoa_giao_dich', `Xoá ${g.loai === 'thu' ? 'thu' : 'chi'} ${vnd(g.soTien)} — ${g.noiDung} (${g.ngay})`);
  return { da_xoa: true, giao_dich: dong(g), ton_quy_moi: tong(d.giaoDich.filter((x) => x.id !== g.id)).ton };
}

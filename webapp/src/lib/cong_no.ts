// Công nợ tiền ứng của phòng.
//   - Phòng nợ: khoản THU nhóm "Ứng, vay" — ai đó ứng tiền cho phòng, phòng phải trả lại.
//   - Đang ở ngoài: khoản CHI nhóm "Ứng, vay, trả" — phòng ứng tiền cho người, người phải hoàn.
// Dòng trả / hoàn (chiều ngược lại) ghi hoanCho = id khoản ứng; trả nhiều lần thì cộng dồn.
// Khoản cũ đánh dấu "Đã hoàn" (daHoan) coi như đã xong dù không có dòng trả.

import { NHOM_CHI_UNG, NHOM_HOAN, NHOM_THU_UNG, type GiaoDich } from './types.js';

export type ChieuNo = 'phong_no' | 'no_phong';

export interface KhoanUng {
  g: GiaoDich;
  chieu: ChieuNo;
  daTra: number;
  conLai: number;
  /** Các dòng đã trả / hoàn cho khoản này */
  cacLanTra: GiaoDich[];
  /** Số ngày từ lúc ứng đến homNay */
  soNgay: number | null;
}

export const SO_NGAY_QUA_HAN = 30;

export function chieuUng(g: GiaoDich): ChieuNo | null {
  if (g.hoanCho) return null;
  if (g.loai === 'thu' && g.nhom === NHOM_THU_UNG) return 'phong_no';
  if (g.loai === 'chi' && g.nhom === NHOM_CHI_UNG) return 'no_phong';
  return null;
}

/** Dòng trả cho khoản ứng `goc` phải ngược chiều tiền với nó. */
export const traHopLe = (tra: GiaoDich, goc: GiaoDich) => !!chieuUng(goc) && tra.loai !== goc.loai;

const soNgayGiua = (tu: string | null, den: string) =>
  tu ? Math.round((Date.parse(den) - Date.parse(tu)) / 86_400_000) : null;

export function congNo(ds: GiaoDich[], homNay: string): KhoanUng[] {
  const theoId = new Map(ds.map((g) => [g.id, g]));
  const tra = new Map<string, GiaoDich[]>();
  for (const g of ds) {
    if (!g.hoanCho) continue;
    const goc = theoId.get(g.hoanCho);
    if (!goc || !traHopLe(g, goc)) continue;
    tra.set(goc.id, [...(tra.get(goc.id) ?? []), g]);
  }
  const kq: KhoanUng[] = [];
  for (const g of ds) {
    const chieu = chieuUng(g);
    if (!chieu) continue;
    const cacLanTra = (tra.get(g.id) ?? []).sort((a, b) => (a.ngay ?? '').localeCompare(b.ngay ?? ''));
    const daTra = cacLanTra.reduce((s, x) => s + (x.soTien ?? 0), 0);
    const conLai = g.daHoan ? 0 : Math.max(0, (g.soTien ?? 0) - daTra);
    kq.push({ g, chieu, daTra, conLai, cacLanTra, soNgay: soNgayGiua(g.ngay, homNay) });
  }
  return kq.sort((a, b) => (a.g.ngay ?? '').localeCompare(b.g.ngay ?? ''));
}

/** Giao dịch trả / hoàn điền sẵn cho khoản ứng k (mặc định trả hết phần còn lại). */
export function giaoDichTra(k: KhoanUng, id: string, ngay: string): GiaoDich {
  const phongTra = k.chieu === 'phong_no';
  return {
    id,
    loai: phongTra ? 'chi' : 'thu',
    ngay,
    soTien: k.conLai,
    noiDung: `${phongTra ? 'Trả ứng' : 'Hoàn ứng'}: ${k.g.noiDung}`,
    doiTuong: k.g.doiTuong,
    ghiChu: '',
    daHoan: false,
    hinhThuc: 'CK',
    nhom: phongTra ? NHOM_CHI_UNG : NHOM_HOAN,
    hoanCho: k.g.id,
  };
}

export function tongCongNo(ds: KhoanUng[]) {
  let phongNo = 0;
  let noPhong = 0;
  for (const k of ds) {
    if (k.chieu === 'phong_no') phongNo += k.conLai;
    else noPhong += k.conLai;
  }
  return { phongNo, noPhong };
}

/** Cảnh báo cần dữ liệu cả sổ (công nợ, liên kết trả). Trả map id → danh sách cảnh báo. */
export function canhBaoCongNo(ds: GiaoDich[], homNay: string): Map<string, string[]> {
  const m = new Map<string, string[]>();
  const them = (id: string, s: string) => m.set(id, [...(m.get(id) ?? []), s]);
  for (const k of congNo(ds, homNay)) {
    if (k.conLai > 0 && (k.soNgay ?? 0) > SO_NGAY_QUA_HAN)
      them(k.g.id, k.chieu === 'phong_no' ? `Phòng nợ ứng quá ${SO_NGAY_QUA_HAN} ngày chưa trả` : `Ứng quá ${SO_NGAY_QUA_HAN} ngày chưa hoàn`);
  }
  const theoId = new Map(ds.map((g) => [g.id, g]));
  for (const g of ds) {
    if (!g.hoanCho) continue;
    const goc = theoId.get(g.hoanCho);
    if (!goc) them(g.id, 'Trả cho khoản ứng không còn trong sổ');
    else if (!traHopLe(g, goc)) them(g.id, 'Liên kết trả ứng sai chiều (phải ngược thu/chi với khoản ứng)');
  }
  return m;
}

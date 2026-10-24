import { taoId } from './store.js';
import type { GiaoDich, HinhThuc, Loai } from './types.js';

/** Mẫu nhập nhanh: điền sẵn loại, nhóm, nội dung, hình thức (và số tiền nếu cố định). */
export interface MauNhap {
  id: string;
  ten: string;
  bieuTuong: string;
  loai: Loai;
  nhom: string;
  noiDung: string;
  hinhThuc: HinhThuc;
  doiTuong: string;
  soTien: number | null;
}

const m = (
  id: string,
  bieuTuong: string,
  ten: string,
  loai: Loai,
  nhom: string,
  noiDung: string,
  hinhThuc: HinhThuc,
  extra: Partial<MauNhap> = {},
): MauNhap => ({ id, ten, bieuTuong, loai, nhom, noiDung, hinhThuc, doiTuong: '', soTien: null, ...extra });

/** Rút ra từ các khoản hay gặp trong sổ quỹ cũ. */
export const MAU_MAC_DINH: MauNhap[] = [
  m('m-sn', '🎂', 'Sinh nhật', 'chi', 'Sinh nhật', 'Sinh nhật ', 'TM'),
  m('m-hoa-sn', '💐', 'Hoa sinh nhật', 'chi', 'Sinh nhật', 'Hoa sinh nhật ', 'CK', { soTien: 600_000 }),
  m('m-lh', '🍲', 'Liên hoan', 'chi', 'Liên hoan, giao lưu', 'Liên hoan ', 'CK'),
  m('m-tet', '🧧', 'Chúc tết', 'chi', 'Lễ, Tết', 'Chúc tết ', 'TM'),
  m('m-ct', '🚗', 'Công tác', 'chi', 'Công tác, làm việc', 'Công tác ', 'CK'),
  m('m-hd', '🧾', 'Hóa đơn (HĐ)', 'chi', 'Công tác, làm việc', 'HĐ ', 'CK'),
  m('m-khcn', '🔬', 'Đề tài, sáng kiến', 'chi', 'KHCN, sáng kiến', '', 'TM'),
  m('m-hq', '🍊', 'Hoa quả, chè', 'chi', 'Mua sắm, quà tặng', 'Mua hoa quả ', 'CK'),
  m('m-qua', '🎁', 'Quà tặng', 'chi', 'Mua sắm, quà tặng', 'Quà tặng ', 'CK'),
  m('m-ung', '💸', 'Chi ứng', 'chi', 'Ứng, vay, trả', 'Ứng ', 'TM'),
  m('m-hieu', '🕯️', 'Hiếu hỉ', 'chi', 'Hiếu hỉ, thăm hỏi', '', 'TM'),
  m('m-thuong', '🏆', 'Thưởng', 'thu', 'Thưởng', 'Thưởng ', '', { doiTuong: 'NPSC' }),
  m('m-hoan', '↩️', 'Hoàn ứng', 'thu', 'Hoàn ứng, hoàn tiền', 'Hoàn ứng ', ''),
  m('m-tet-thu', '🧧', 'Được chúc tết', 'thu', 'Chúc tết, biếu', 'Chúc tết - ', ''),
  m('m-tt-hd', '🧾', 'Thanh toán HĐ', 'thu', 'Thanh toán hóa đơn', 'Thanh toán HĐ ', ''),
  m('m-ung-thu', '💰', 'Ứng tiền cho phòng', 'thu', 'Ứng, vay', 'Ứng tiền cho phòng - ', ''),
];

/** Mức tiền bấm nhanh (đồng). */
export const TIEN_NHANH = [200_000, 500_000, 1_000_000, 2_000_000, 3_000_000, 5_000_000, 10_000_000];

export const nhanTien = (n: number) => (n >= 1e6 ? `${n / 1e6}tr` : `${n / 1e3}k`);

export function apMau(mau: MauNhap, ngay: string): GiaoDich {
  return {
    id: taoId(),
    loai: mau.loai,
    ngay,
    soTien: mau.soTien,
    noiDung: mau.noiDung,
    doiTuong: mau.doiTuong,
    ghiChu: '',
    daHoan: false,
    hinhThuc: mau.hinhThuc,
    nhom: mau.nhom,
  };
}

/** Tạo mẫu từ một giao dịch đang nhập. */
export function mauTuGiaoDich(g: GiaoDich, ten: string): MauNhap {
  return {
    id: `m-${Date.now().toString(36)}`,
    ten: ten.trim() || g.noiDung.trim() || 'Mẫu mới',
    bieuTuong: g.loai === 'thu' ? '➕' : '⭐',
    loai: g.loai,
    nhom: g.nhom,
    noiDung: g.noiDung.trim() ? g.noiDung.trim() + ' ' : '',
    hinhThuc: g.hinhThuc,
    doiTuong: g.doiTuong,
    soTien: g.soTien,
  };
}

/** Ngày yyyy-mm-dd theo giờ máy, lùi `truNgay` ngày. */
export function ngayTruoc(truNgay = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - truNgay);
  return d.toLocaleDateString('sv-SE');
}

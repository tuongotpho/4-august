export type Loai = 'thu' | 'chi';
export type HinhThuc = 'TM' | 'CK' | '';

/** Một dòng trong sổ quỹ. Tiền: đồng (số nguyên). Ngày: yyyy-mm-dd. */
export interface GiaoDich {
  id: string;
  loai: Loai;
  ngay: string | null;
  soTien: number | null;
  noiDung: string;
  /** Thu: đơn vị / người nộp. Chi: để trống hoặc người nhận. */
  doiTuong: string;
  ghiChu: string;
  daHoan: boolean;
  hinhThuc: HinhThuc;
  nhom: string;
  /** Dòng trong file Excel gốc, ví dụ "Chi!17". Bản ghi tạo mới để trống. */
  nguon?: string;
  capNhat?: number;
}

export const NHOM_THU = [
  'Thưởng',
  'Chúc tết, biếu',
  'Hoàn ứng, hoàn tiền',
  'Ứng, vay',
  'Thanh toán hóa đơn',
  'Góp quỹ, bàn giao',
  'Khác',
];

export const NHOM_CHI = [
  'Công tác, làm việc',
  'KHCN, sáng kiến',
  'Lễ, Tết',
  'Sinh nhật',
  'Liên hoan, giao lưu',
  'Mua sắm, quà tặng',
  'Hiếu hỉ, thăm hỏi',
  'Du lịch',
  'Ứng, vay, trả',
  'Khác',
];

// 5 app của 4.August. duongDan = đường dẫn con dưới cổng (vercel.json chuyển tiếp sang diaChiGoc).
// mau = màu nhận diện (giữ đúng màu chủ đạo app đang dùng — chốt 24/10/2026, báo cáo F:\AI\08-…).

export interface AppCon {
  ma: string
  ten: string
  moTa: string
  kyHieu: string
  mau: string
  duongDan: string
  diaChiGoc: string
  /** Trong "cài đặt riêng" của app có gì (mở bằng duongDan + ?cai-dat) */
  caiDat: string
}

export const DS_APP: AppCon[] = [
  {
    ma: 'quyphong',
    ten: 'Quỹ phòng KTAT',
    moTa: 'Sổ thu – chi, công nợ ứng',
    kyHieu: 'QP',
    mau: '#1f4e78',
    duongDan: '/quy-phong/',
    diaChiGoc: 'https://quyphong.vercel.app',
    caiDat: 'Kết nối AI: máy đã cho phép, nhật ký AI ghi / xoá',
  },
  {
    ma: 'antoan',
    ten: 'Lịch giảng ATLĐ',
    moTa: 'Lịch lớp, thù lao, công nợ đối tác',
    kyHieu: 'LG',
    mau: '#0f766e',
    duongDan: '/lich-giang/',
    diaChiGoc: 'https://quanly-at.vercel.app',
    caiDat: 'Nhập Excel, Google Calendar, bot Telegram, Kết nối AI, gộp đối tác, sao lưu',
  },
  {
    ma: 'tuongot-si',
    ten: 'Bán buôn tương ớt',
    moTa: 'Đơn hàng, khách, tồn kho',
    kyHieu: 'TƠ',
    mau: '#b91c1c',
    duongDan: '/tuong-ot/',
    diaChiGoc: 'https://tuongot-si.vercel.app',
    caiDat: 'Thông tin in hoá đơn, tài khoản nhận tiền (mã QR), sao lưu, Kết nối AI',
  },
  {
    ma: 'hoadon',
    ten: 'Hoá đơn NPSC',
    moTa: 'Hồ sơ hoá đơn, tờ trình, ĐNTT',
    kyHieu: 'HĐ',
    mau: '#2563eb',
    duongDan: '/hoa-don/',
    diaChiGoc: 'https://hoadon-npsc.vercel.app',
    caiDat: 'Danh sách lựa chọn, hàng cấm, quy tắc tiền, thông tin mẫu Word, sao lưu, bot Telegram, quyền của AI',
  },
  {
    ma: 'khaithue',
    ten: 'Khai thuế',
    moTa: 'Tờ khai quý, hoá đơn, sổ quỹ',
    kyHieu: 'KT',
    mau: '#047857',
    duongDan: '/khai-thue/',
    diaChiGoc: 'https://khaithue.vercel.app',
    caiDat: 'Kết nối AI, nhắc hạn nộp qua Telegram, người xem chung',
  },
]

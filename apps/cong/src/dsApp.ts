// Các app qua cổng (5 app của 4.August + app riêng the-visa). duongDan = đường dẫn con dưới cổng (vercel.json chuyển tiếp sang diaChiGoc).
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
  /** File khai báo app (manifest) của app; qua cổng được thay bằng manifest chung để cài từ trang nào cũng ra một app phạm vi "/" */
  manifest?: string
}

/** ?ve=<đường dẫn>: app gửi về trang chủ khi chưa đăng nhập; đăng nhập xong mở lại đúng chỗ.
 *  Chỉ nhận đường dẫn thuộc các app trong danh sách (không cho chuyển sang trang lạ). */
export function duongVeHopLe(ve: string | null): string | null {
  if (!ve || !ve.startsWith('/') || ve.startsWith('//')) return null
  return DS_APP.some((a) => ve.startsWith(a.duongDan)) ? ve : null
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
    manifest: 'manifest.webmanifest',
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
    manifest: 'manifest.webmanifest',
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
    manifest: 'manifest.webmanifest',
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
    manifest: 'site.webmanifest',
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
  {
    // App riêng, mã ở repo tuongotpho/visa (KHÔNG nằm trong apps/ của 4.August) — chỉ nối qua cổng.
    ma: 'the-visa',
    ten: 'Chi tiêu thẻ',
    moTa: 'Sao kê thẻ tín dụng, biểu đồ, nhận xét',
    kyHieu: 'TV',
    mau: '#0b8a5f',
    duongDan: '/the-visa/',
    diaChiGoc: 'https://the-visa-lethanh.vercel.app',
    caiDat: 'Tải sao kê PDF, các kỳ đã lưu, đổi nhóm giao dịch, Kết nối AI (MCP)',
  },
]

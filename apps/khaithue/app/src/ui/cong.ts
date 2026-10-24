// Mở qua cổng chung app-by-lethanh.vercel.app/khai-thue/: đăng nhập, đăng xuất, cài đặt nằm ở trang chủ của cổng.
// Nhận theo đường dẫn (không theo tên miền) để chạy thử trên máy với cùng đường dẫn cũng đúng; ở khaithue.vercel.app luôn là false.

export const QUA_CONG = typeof location !== 'undefined' && location.pathname.startsWith('/khai-thue/')
/** Trang chủ mở thẳng hộp tài khoản (Kết nối AI, Telegram, người xem) bằng ?cai-dat */
export const MO_CAI_DAT = QUA_CONG && new URLSearchParams(location.search).has('cai-dat')
export const TRANG_CHU = '../'

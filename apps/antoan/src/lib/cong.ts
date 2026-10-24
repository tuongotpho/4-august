// Mở qua cổng chung app-by-lethanh.vercel.app/lich-giang/: đăng nhập, đăng xuất, cài đặt nằm ở trang chủ của cổng.
// Nhận theo đường dẫn (không theo tên miền) để chạy thử trên máy với cùng đường dẫn cũng đúng; ở quanly-at.vercel.app luôn là false.

export const QUA_CONG = typeof location !== 'undefined' && location.pathname.startsWith('/lich-giang/')
/** Trang chủ mở thẳng tab Cài đặt của app bằng ?cai-dat */
export const MO_CAI_DAT = QUA_CONG && new URLSearchParams(location.search).has('cai-dat')
export const TRANG_CHU = '../'

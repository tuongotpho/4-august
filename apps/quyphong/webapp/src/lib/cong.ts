// Mở qua cổng chung app-by-lethanh.vercel.app/quy-phong/: đăng nhập, đăng xuất, cài đặt nằm ở trang chủ của cổng.
// Nhận theo đường dẫn (không theo tên miền) để chạy thử trên máy với cùng đường dẫn cũng đúng; ở quyphong.vercel.app luôn là false.

export const QUA_CONG = typeof location !== 'undefined' && location.pathname.startsWith('/quy-phong/');
/** Trang chủ mở thẳng phần cài đặt riêng của app bằng ?cai-dat */
export const MO_CAI_DAT = QUA_CONG && new URLSearchParams(location.search).has('cai-dat');
export const TRANG_CHU = '../';
/** Chưa đăng nhập: về trang chủ đăng nhập, kèm ?ve= để đăng nhập xong quay lại đúng trang đang mở (vd link bot ?hs=…) */
export const veTrangChuDangNhap = () =>
  location.replace(TRANG_CHU + '?ve=' + encodeURIComponent(location.pathname + location.search));

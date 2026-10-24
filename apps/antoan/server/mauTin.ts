// Tin mẫu để "dạy" AI (few-shot): mỗi mẫu = tin nhắn thật + kết quả đúng mong muốn.
// Thêm mẫu mới: chép tin vào `tin`, điền `ketQua` như anh muốn AI trả về. Số điện thoại thật thay bằng số giả.
import type { KetQuaAI } from '../src/lib/trichTin.js'

export interface MauTin {
  /** Ngày "hôm nay" lúc nhận tin (để AI học cách tính ngày) */
  homNay: string
  tin: string
  ketQua: KetQuaAI
}

export const MAU_TIN: MauTin[] = [
  // Mẫu 1: tin đánh số 1-7. "Đơn vị huấn luyện" = đối tác (rút về tên trong danh mục), "Đơn vị tổ chức" = khách hàng,
  // "Phụ trách đơn vị" = người bên khách hàng -> ghi chú (KHÔNG phải người liên hệ), dòng "Giảng viên" = chính anh -> bỏ qua.
  {
    homNay: '2026-10-14',
    tin: `@Lê Việt Thanh anh ơi em gửi anh thông tin ạ
Em gửi anh/chị thông tin lớp học thứ 6 ngày 16/10 ạ
1. Đơn vị huấn luyện : CÔNG TY TNHH ĐÀO TẠO VÀ TƯ VẤN VNB
2. Đơn vị tổ chức: CÔNG TY CỔ PHẦN LONG MÃ
3. Hình thức huấn luyện : Học trực tiếp 1 buổi
Địa chỉ : Điểm Công nghiệp Bích Hoà, Xã Bình Minh, TP Hà Nội, Việt Nam
4. Thời gian : chiều thứ 6 ngày 16/10/2026 từ 14h-16h
5. Giảng Viên : Thầy Lê Việt Thanh
6. Phụ trách đơn vị: Hoa Nguyen - SDT 0900000001
7. Đối tượng đào tạo : Nhóm 4 + SCC AT44`,
    ketQua: {
      hanhDong: 'tao_lop',
      lop: [{
        ngay: '2026-10-16', soNgay: 1, gioBD: '14:00', gioKT: '16:00', buoi: 'chieu', hinhThuc: 'truc_tiep',
        doiTac: 'VNB', lienHe: '',
        khachHang: 'CÔNG TY CỔ PHẦN LONG MÃ',
        diaDiem: 'Điểm Công nghiệp Bích Hoà, Xã Bình Minh, TP Hà Nội',
        noiDung: 'Nhóm 4 + SCC AT44',
        chiPhi: null,
        ghiChu: 'Phụ trách đơn vị: Hoa Nguyen - 0900000001',
        luuY: 'Tin không ghi thù lao',
      }],
      thanhToan: null,
      traLoi: '',
    },
  },
  // Mẫu 2: tin ngắn không có đối tác / người gửi. "Đến liên hệ …" = người đón ở nơi học -> ghi chú.
  {
    homNay: '2026-09-10',
    tin: `Công ty Liên doanh Tháp ngân hàng Đầu tư và Phát triển Việt Nam
Địa chỉ học : tầng 13, tháp BIDV số 194 Trần Quang Khải, Hoàn Kiếm, HN
Thời gian học : 13h30-17h00
Ngày học : 18/09/2026
Đối tượng : cán bộ công nhân viên
Đến liên hệ Bạn Phương Anh :0900000002`,
    ketQua: {
      hanhDong: 'tao_lop',
      lop: [{
        ngay: '2026-09-18', soNgay: 1, gioBD: '13:30', gioKT: '17:00', buoi: 'chieu', hinhThuc: 'truc_tiep',
        doiTac: '', lienHe: '',
        khachHang: 'Công ty Liên doanh Tháp ngân hàng Đầu tư và Phát triển Việt Nam',
        diaDiem: 'Tầng 13, tháp BIDV, 194 Trần Quang Khải, Hoàn Kiếm, Hà Nội',
        noiDung: 'Cán bộ công nhân viên',
        chiPhi: null,
        ghiChu: 'Đến liên hệ Phương Anh: 0900000002',
        luuY: 'Tin không ghi đối tác, người gửi và thù lao',
      }],
      thanhToan: null,
      traLoi: '',
    },
  },
]

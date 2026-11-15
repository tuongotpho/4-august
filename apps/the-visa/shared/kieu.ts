// Kiểu dữ liệu dùng chung giữa giao diện (src) và máy chủ (api).

/** Một dòng giao dịch, giữ đúng dấu như sao kê: âm = chi tiêu, dương = ghi có (trả nợ thẻ, hoàn tiền) */
export interface GiaoDich {
  id: string
  ngay: string // ngày giao dịch YYYY-MM-DD
  ngayHT: string // ngày hạch toán YYYY-MM-DD
  moTa: string
  soTien: number
  nhomTay?: string // nhóm do người dùng tự chọn, đè lên nhóm tự phân loại
  nghiSai?: string // OCR thấy chỗ đáng ngờ (vd. 2 cột số tiền không giống nhau)
}

/** Một kỳ sao kê. Các số dư ghi DƯƠNG = số tiền đang nợ ngân hàng */
export interface Ky {
  id: string // YYYY-MM-DD_YYYY-MM-DD
  tu: string
  den: string
  hanMuc?: number
  hanTra?: string // YYYY-MM-DD
  toiThieu?: number
  dauKy: number
  phatSinh: number
  daTra: number
  cuoiKy: number
  giaoDich: GiaoDich[]
  tenFile?: string
  luuLuc?: string
}

/** Một chữ do OCR đọc ra, kèm khung toạ độ (pixel) */
export interface Chu {
  text: string
  x0: number
  y0: number
  x1: number
  y1: number
}

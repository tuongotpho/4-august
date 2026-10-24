import { describe, expect, it } from 'vitest'
import { docTep, phanLoai } from './excel.js'

const CTY = '0100000000'
const TD = ['STT', 'Ký hiệu mẫu số', 'Ký hiệu hóa đơn', 'Số hóa đơn', 'Ngày lập', 'MST người bán/MST người xuất hàng', 'Tên người bán/Tên người xuất hàng', 'Địa chỉ người bán', 'Tổng tiền chưa thuế', 'Tổng tiền thuế', 'Tổng tiền chiết khấu thương mại', 'Tổng tiền phí', 'Tổng tiền thanh toán', 'Đơn vị tiền tệ', 'Tỷ giá', 'Trạng thái hóa đơn']

describe('File Excel ghép tay bị lệch cột', () => {
  it('dòng có thêm cột "MST người mua" chèn trước cột tiền: tự đọc lại đúng, không ra số tỷ', () => {
    const rows = [
      ['DANH SÁCH HÓA ĐƠN'], ['Từ ngày 01/01/2025 đến ngày 31/03/2025'], TD,
      // dòng đúng khuôn tiêu đề
      [1, '1', 'C25TMV', '1', '01/01/2025', '0200000001', 'NCC A', 'PT', 4208750, 336700, null, null, 4545450, 'VND', '1.0', 'Hóa đơn mới'],
      // dòng dán từ bản tải khác: có thêm MST người mua (là MST công ty) chèn trước cột tiền
      [2, '1', 'C25TLX', '329', '26/12/2025', '0200000002', 'NCC B', 'HN', CTY, 94482000, 7558560, 0, 102040560, 'VND', '1.0', 'Hóa đơn đã bị thay thế'],
    ]
    const t = docTep(rows, 'gop.xlsx')!
    expect(t.suaLechCot).toBe(1)
    expect(t.hoaDon.map((h) => [h.chuaThue, h.thue, h.mstMua, h.trangThai])).toEqual([
      [4208750, 336700, '', 'Hóa đơn mới'],
      [94482000, 7558560, CTY, 'Hóa đơn đã bị thay thế'],
    ])
    const kq = phanLoai([t], CTY)
    expect(kq.canhBao.some((c) => c.noiDung.includes('1 dòng bị lệch cột'))).toBe(true)
  })

  it('dòng số tiền vô lý không sửa được: bỏ ra và báo, không lọt vào số liệu', () => {
    const rows = [TD, [1, '1', 'C25TAA', '7', '01/02/2025', '0200000001', 'NCC A', 'PT', 1000, 900, null, null, 1900, 'VND', '1.0', 'Hóa đơn mới']]
    const t = docTep(rows, 'hong.xlsx')!
    expect(t.hoaDon).toEqual([])
    expect(t.boDong).toBe(1)
  })

  it('file ghép tay kiểu Ban-all-25 (báo cáo 06): MST kéo chuột tăng dần + dòng dán sai thứ tự cột -> báo LỖI, không xếp nhầm bán thành mua', () => {
    const TD_BAN = ['STT', 'Ký hiệu mẫu số', 'Ký hiệu hóa đơn', 'Số hóa đơn', 'Ngày lập', 'MST người mua/MST người nhận hàng', 'MST người bán/MST người xuất hàng', 'Tên người bán/Tên người xuất hàng', 'Tên người mua/Tên người nhận hàng', 'Địa chỉ người mua', 'Tổng tiền chưa thuế', 'Tổng tiền thuế', 'Trạng thái hóa đơn']
    const rows = [
      TD_BAN,
      // Q1: MST người bán bị kéo chuột tăng dần từ dòng 2
      [1, '1', 'C25TNA', '1', '02/01/2025', '0300000001', CTY, 'CTY MÌNH', 'KHÁCH A', 'HN', 77700000, 6216000, 'Hóa đơn mới'],
      [2, '1', 'C25TNA', '2', '06/01/2025', '0300000001', '0100000001', 'CTY MÌNH', 'KHÁCH A', 'HN', 10000000, 800000, 'Hóa đơn mới'],
      [3, '1', 'C25TNA', '3', '07/01/2025', '0300000001', '0100000002', 'CTY MÌNH', 'KHÁCH A', 'HN', 10000000, 800000, 'Hóa đơn mới'],
      // Q2: dán từ bản tải khác thứ tự cột: MST công ty rơi vào cột "MST người mua", tên công ty vào cột "MST người bán"
      [4, '1', 'C25TNA', '43', '03/04/2025', CTY, 'CÔNG TY TNHH MÌNH', '0300000001', 'KHÁCH A', 'HN', 80274000, 6421920, 'Hóa đơn mới'],
      [5, '1', 'C25TNA', '44', '08/04/2025', CTY, 'CÔNG TY TNHH MÌNH', '0300000001', 'KHÁCH A', 'HN', 244545000, 19563600, 'Hóa đơn mới'],
    ]
    const t = docTep(rows, 'Ban-all-25.xlsx')!
    expect(t.lechCotMst).toBe(2)
    expect(t.mstTangDan).toEqual([{ cot: 'người bán', soDong: 3, tu: CTY, den: '0100000002' }])
    const kq = phanLoai([t], CTY)
    // Không còn dòng nào bị xếp thành MUA VÀO
    expect(kq.hoaDon.filter((h) => h.loai === 'mua')).toEqual([])
    expect(kq.canhBao.filter((c) => c.muc === 'loi').map((c) => c.noiDung)).toEqual(expect.arrayContaining([
      expect.stringContaining('bỏ 2 dòng có ô MST chứa CHỮ'),
      expect.stringContaining('3 dòng liền nhau có MST người bán tăng đều 1 đơn vị (0100000000 → 0100000002)'),
    ]))
  })

  it('khách lẻ ghi chữ ở cột MST người mua: vẫn đọc bình thường, không báo lệch cột', () => {
    const TD2 = ['STT', 'Ký hiệu mẫu số', 'Ký hiệu hóa đơn', 'Số hóa đơn', 'Ngày lập', 'MST người bán', 'Tên người bán', 'MST người mua', 'Tên người mua', 'Tổng tiền chưa thuế', 'Tổng tiền thuế', 'Trạng thái hóa đơn']
    const t = docTep([TD2, [1, '1', 'C25TNA', '9', '02/01/2025', CTY, 'CTY MÌNH', 'Khách lẻ không lấy hoá đơn', 'Nguyễn Văn B', 1000000, 80000, 'Hóa đơn mới']], 'le.xlsx')!
    expect(t.hoaDon).toHaveLength(1)
    expect(t.lechCotMst).toBeUndefined()
    expect(t.mstTangDan).toBeUndefined()
  })
})


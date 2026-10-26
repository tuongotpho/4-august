import { describe, expect, it } from 'vitest'
import { TU_KHOA_CAM_MAC_DINH, timHangCam } from '../src/lib/hangCam'
import { laBanNhap, parseInvoiceText } from '../src/lib/invoicePdf'
import { emptyInvoice } from '../src/lib/model'

// Dữ liệu GIẢ, chép đúng kiểu câu chữ của các mẫu hóa đơn gặp trong thư mục chi phí thật
describe('các mẫu hóa đơn khác', () => {
  it('hộ kinh doanh: "Căn cước công dân" + "Cộng tiền bán hàng hóa, dịch vụ"', () => {
    const r = parseInvoiceText([
      'HỘ KINH DOANH THỬ NGHIỆM', 'Căn cước công dân : 001200000001', 'Địa chỉ : Số 1 Phố Thử, Hà Nội', 'HÓA ĐƠN BÁN HÀNG Ký hiệu : 2C26MKD',
      'Ngày 05 tháng 05 năm 2026 Số : 00001228', 'Tên người mua : CÔNG TY THỬ', 'Cộng tiền bán hàng hóa, dịch vụ : 15.963.640',
      'Số tiền viết bằng chữ : Mười lăm triệu chín trăm sáu mươi ba nghìn sáu trăm bốn mươi đồng chẵn.',
    ])
    expect(r).toMatchObject({ tenNguoiBan: 'HỘ KINH DOANH THỬ NGHIỆM', mstNguoiBan: '001200000001', soHd: '1228', tongTien: 15963640 })
  })
  it('song ngữ: "Cộng tiền bán hàng hóa, dịch vụ (Total amount) :"', () => {
    const r = parseInvoiceText(['Ký hiệu (Serial) : 2C24TYY', 'HÓA ĐƠN BÁN HÀNG', 'Số (No.) : 308', 'Cộng tiền bán hàng hóa, dịch vụ (Total amount) : 9.840.480'])
    expect(r).toMatchObject({ kyHieu: '2C24TYY', soHd: '308', tongTien: 9840480 })
  })
  it('song ngữ GTGT: "Tổng cộng (Total) : trước thuế  thuế  tổng"', () => {
    const r = parseInvoiceText(['HÓA ĐƠN GIÁ TRỊ GIA TĂNG Ký hiệu (Serial) : 1C26MSH', '(VAT INVOICE) Số (No.) : 00001163',
      'Thuế suất 8% (VAT rate 8%) : 4.284.000 342.720 4.626.720', 'Tổng cộng (Total) : 4.284.000 342.720 4.626.720'])
    expect(r).toMatchObject({ soHd: '1163', tienTruocThue: 4284000, tienThue: 342720, tongTien: 4626720 })
  })
  it('MISA bán hàng có chiết khấu: "Tổng tiền: 0 4.800.000" -> số CUỐI là tổng', () => {
    const r = parseInvoiceText([
      'HỘ KINH DOANH THỬ', 'Mã số thuế : 001000000002', 'HÓA ĐƠN BÁN HÀNG Ký hiệu : 2C26MTT', 'Ngày 01 tháng 10 năm 2026 Số : 00000901',
      'Họ và tên người mua hàng :', '1 Món thử Đĩa 3,00 220.000 660.000', 'Tổng tiền: 0 4.800.000',
      'Đã giảm 0 đồng, tương ứng 20% mức tỷ lệ % để tính thuế giá trị gia tăng theo Nghị quyết số 204/2025/QH15.',
    ])
    expect(r).toMatchObject({ soHd: '901', tienTruocThue: 4800000, tienThue: 0, tongTien: 4800000 })
  })
})

describe('địa chỉ người bán bị PDF ngắt dòng', () => {
  const doc = (...dong: string[]) => parseInvoiceText(['Đơn vị bán hàng: CÔNG TY THỬ', 'Mã số thuế: 0100000001', ...dong, 'Tên người mua: BÊN MUA']).diaChiNguoiBan
  it('nối dòng dưới khi dòng đầu chưa có tỉnh', () => {
    // dữ liệu giả, giữ đúng chỗ bị ngắt như các hóa đơn thật
    expect(doc('Địa chỉ: A1 – NV1 ô số 1, Khu đô thị thử nghiệm đường Thử,Phường Tây', 'Mỗ, Thành phố Hà Nội, Việt Nam', 'Điện thoại: 0240000000'))
      .toBe('A1 – NV1 ô số 1, Khu đô thị thử nghiệm đường Thử,Phường Tây Mỗ, Thành phố Hà Nội, Việt Nam')
    expect(doc('Địa chỉ (Address): Số 1 đường Thử, Phường Thử, Thị xã Thử, Tỉnh Hưng', 'Yên'))
      .toBe('Số 1 đường Thử, Phường Thử, Thị xã Thử, Tỉnh Hưng Yên')
    // cắt 2 lần
    expect(doc('Địa chỉ: Số 1 ngõ 1 phố Thử, Phường Thử, Quận Nam Từ', 'Liêm, Thành phố', 'Hà Nội'))
      .toBe('Số 1 ngõ 1 phố Thử, Phường Thử, Quận Nam Từ Liêm, Thành phố Hà Nội')
  })
  it('không nối khi dòng đầu đã đủ tỉnh, hoặc dòng dưới là nhãn khác / nối vẫn không ra tỉnh', () => {
    expect(doc('Địa chỉ: Số 1 Tràng Tiền, Hà Nội', 'Số 5 phố khác')).toBe('Số 1 Tràng Tiền, Hà Nội')
    expect(doc('Địa chỉ: Số 5 đường Trần Phú, phường Nguyễn Trãi', 'Điện thoại: 0240000000')).toBe('Số 5 đường Trần Phú, phường Nguyễn Trãi')
    expect(doc('Địa chỉ: Số 5 đường Trần Phú, phường Nguyễn Trãi', 'HÓA ĐƠN GIÁ TRỊ GIA TĂNG')).toBe('Số 5 đường Trần Phú, phường Nguyễn Trãi')
  })
})

describe('rượu/bia: món ăn nấu với rượu/bia không tính', () => {
  const cam = (...ten: string[]) =>
    timHangCam([{ ...emptyInvoice(), items: ten.map((t) => ({ ten: t, dvt: '', soLuong: 1, donGia: 0, thanhTien: 1, thueSuat: '' })) }], TU_KHOA_CAM_MAC_DINH).map((c) => c.ten)
  it('bỏ qua món ăn, vẫn bắt đồ uống', () => {
    expect(cam('tôm hấp bia', 'Gà hấp rượu', 'Bò ngâm rượu vang', 'Rượu Sung men', 'Bia Hà Nội')).toEqual(['Rượu Sung men', 'Bia Hà Nội'])
  })
})

describe('các mẫu gặp khi gom thư mục chi phí (dữ liệu giả, đúng câu chữ)', () => {
  it('3 số trên dòng "Tổng tiền thanh toán" -> lấy số CUỐI làm tổng; nhãn "Bằng chữ (In words)"', () => {
    const r = parseInvoiceText([
      'HÓA ĐƠN GIÁ TRỊ GIA TĂNG', 'Ký hiệu (Serial): 1C24THP', '(VAT INVOICE) Số (No): 755', 'Ngày 17 tháng 07 năm 2024',
      'Đơn vị bán hàng (Seller): CÔNG TY THỬ', 'Mã số thuế (Tax Code): 0100000001', 'Tên đơn vị (Company\'s name): BÊN MUA',
      'Hàng hóa chịu thuế suất: 8% 8.233.000 658.640 8.891.640', 'Tổng tiền thanh toán (Total of payment): 8.233.000 658.640 8.891.640',
      'Bằng chữ (In words): Tám triệu tám trăm chín mươi mốt nghìn sáu trăm bốn mươi đồng',
    ])
    expect(r).toMatchObject({ kyHieu: '1C24THP', soHd: '755', tienTruocThue: 8233000, tienThue: 658640, tongTien: 8891640 })
    expect(r.tienBangChu).toMatch(/^Tám triệu tám trăm chín mươi mốt nghìn/)
  })
  it('"Cộng tiền hàng hóa, dịch vụ: A B" = tiền hàng + tiền thuế (không lấy thuế ở dòng thuế suất lẻ)', () => {
    const r = parseInvoiceText([
      'Ký hiệu: 1C26MVN', 'HÓA ĐƠN GIÁ TRỊ GIA TĂNG', 'Số: 5264', 'Cộng tiền hàng hóa, dịch vụ: 4.055.051 324.949', 'Tổng cộng tiền thanh toán:',
      'Tổng tiền chịu thuế 8%: 4.027.777,79 Tổng tiền thuế GTGT 8%: 322.222,21',
    ])
    expect(r).toMatchObject({ tienTruocThue: 4055051, tienThue: 324949, tongTien: 4380000 })
  })
  it('số hóa đơn ở dòng dưới nhãn; ký hiệu sau chữ HÓA ĐƠN', () => {
    expect(parseInvoiceText(['Ký hiệu (Serial) : 1C24MBT', 'HÓA ĐƠN GIÁ TRỊ GIA TĂNG', 'Số (No.) :', '(KHỞI TẠO TỪ MÁY TÍNH TIỀN) 1456'])).toMatchObject({ soHd: '1456', kyHieu: '1C24MBT' })
    expect(parseInvoiceText(['Ký hiệu (Serial):', 'HÓA ĐƠN GIÁ TRỊ GIA TĂNG 1C24TBA', '(VAT INVOICE) Số (No.): 1434'])).toMatchObject({ soHd: '1434', kyHieu: '1C24TBA' })
    expect(
      parseInvoiceText(['HÓA ĐƠN GIÁ TRỊ GIA TĂNG Mẫu số (Form No.) : 1/002', '(VAT INVOICE) Ký hiệu (Serial No.) : C25TDG', 'Ngày (day) 13 tháng (month) 06 năm (year) 2025 Số (Invoice No.) :', 'Mã CQT: 00EFE2', '00004317']),
    ).toMatchObject({ soHd: '4317', kyHieu: '1C25TDG', ngayHd: '2025-06-13' })
  })
  it('"MST (Tax Code)" (Bkav/VNPT) và "Tên hộ kinh doanh"', () => {
    expect(parseInvoiceText(['Đơn vị bán (Seller): CÔNG TY THỬ', 'MST (Tax Code): 5500000001', 'Người mua (Buyer):', 'MST (Tax Code): 0100100417-046'])).toMatchObject({ mstNguoiBan: '5500000001' })
    expect(parseInvoiceText(['Tên hộ kinh doanh (Household business) : NGUYỄN THỊ THỬ', 'Chủ hộ kinh doanh (Seller) : NGUYỄN THỊ THỬ', 'Mã số thuế (Tax code) : 8700000001-001'])).toMatchObject({ tenNguoiBan: 'NGUYỄN THỊ THỬ', mstNguoiBan: '8700000001-001' })
  })
  it('nhận ra bản nháp "Số : <Chưa cấp số>"', () => {
    expect(laBanNhap(['HÓA ĐƠN GIÁ TRỊ GIA TĂNG Ký hiệu : 1C26MPD', 'Ngày 27 tháng 05 năm 2026 Số : <Chưa cấp số>'])).toBe(true)
    expect(laBanNhap(['Ngày 27 tháng 05 năm 2026 Số : 00000322'])).toBe(false)
  })
})

describe('ACMAN: nhãn tiền KHÔNG có dấu hai chấm', () => {
  it('đọc đúng tiền hàng, thuế, tổng (số ở cuối dòng, bỏ qua "8%")', () => {
    const r = parseInvoiceText([
      'Mẫu số: 1', 'HÓA ĐƠN GIÁ TRỊ GIA TĂNG', 'Ký hiệu: C26TTT', 'Ngày 07 tháng 10 năm 2026', 'Số hóa đơn: 00000012',
      'Đơn vị bán hàng: CÔNG TY THỬ', 'Mã số thuế: 0100000009 Điện thoại: 0900000000', 'Đơn vị mua hàng: BÊN MUA',
      '1 Cước vận chuyển thử 19C-00000 Tấn 10,5 100.000 1.050.000',
      'Tổng cộng tiền hàng hóa, dịch vụ 1.050.000', 'Tiền thuế GTGT 8% 84.000', 'Tổng tiền thanh toán 1.134.000',
      'Số tiền viết bằng chữ: Một triệu một trăm ba mươi tư nghìn đồng./.',
    ])
    expect(r).toMatchObject({ soHd: '12', tienTruocThue: 1050000, tienThue: 84000, tongTien: 1134000 })
  })
})

describe('VNPT: số tách từng chữ số, chữ ở dòng dưới', () => {
  it('đọc đúng', () => {
    const r = parseInvoiceText([
      'HÓA ĐƠN BÁN HÀNG', 'Ký hiệu (Series) : 2C25THP', '(ELECTRONIC INVOICE DISPLAY) Số (Invoice No.) : 0 0 0 0 0 2 6 1',
      'Đơn vị bán hàng (Seller) : NGUYỄN VĂN THỬ', 'Mã số thuế (Tax code) : 0 0 1 0 0 0 0 0 0 0 0 1', 'Tên đơn vị (Company\'s name) : BÊN MUA',
      'Tổng tiền thanh toán (Total Amount) : 4.890.480', 'Số tiền viết bằng chữ (In words) :', 'Bốn triệu tám trăm chín mươi nghìn bốn trăm tám mươi đồng',
    ])
    expect(r).toMatchObject({ soHd: '261', mstNguoiBan: '001000000001', tongTien: 4890480, tienBangChu: 'Bốn triệu tám trăm chín mươi nghìn bốn trăm tám mươi đồng' })
  })
})

import { describe, expect, it } from 'vitest'
import { khoTrong, napHoaDon, type Kho } from './kho.js'
import { boGiaoDichTrung, docSaoKe, tinhCongNo, type SaoKe } from './saoKe.js'
import type { HoaDon } from './types.js'

const CTY = '2601102955'
const hd = (h: Partial<HoaDon>): HoaDon => ({
  loai: 'mua', kyHieuMau: '1', kyHieu: 'C25TKL', so: '1', ngay: '01/08/2025', mstBan: '2601066601', tenBan: 'CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ BẢO KHÁNH LINH', mstMua: CTY, tenMua: '',
  chuaThue: 0, thue: 0, trangThai: 'Hóa đơn mới', file: 'x.xlsx', ...h,
})

function kho(): Kho {
  return napHoaDon(khoTrong(), CTY, [
    hd({ so: '10', ngay: '01/08/2025', chuaThue: 50_000_000, thue: 4_000_000 }), // 54tr
    hd({ so: '11', ngay: '05/08/2025', chuaThue: 20_000_000, thue: 1_600_000 }), // 21,6tr
    hd({ so: '12', ngay: '06/08/2025', chuaThue: 10_000_000, thue: 800_000 }), // 10,8tr — chưa trả
    hd({ kyHieu: 'C25TMV', so: '3', ngay: '02/08/2025', mstBan: '2600937045', tenBan: 'CÔNG TY TNHH XÂY DỰNG THƯƠNG MẠI MẠNH VINH', chuaThue: 4_000_000, thue: 320_000 }), // dưới 5tr
    hd({ loai: 'ban', kyHieu: 'C25TNA', so: '40', ngay: '03/08/2025', mstBan: CTY, mstMua: '2600835029', tenMua: 'CÔNG TY TNHH MỘT THÀNH VIÊN RENTECH', chuaThue: 100_000_000, thue: 8_000_000 }),
    hd({ loai: 'ban', kyHieu: 'C25TNA', so: '41', ngay: '21/08/2025', mstBan: CTY, mstMua: '2600835029', tenMua: 'CÔNG TY TNHH MỘT THÀNH VIÊN RENTECH', chuaThue: 50_000_000, thue: 4_000_000 }),
  ])
}

// Kiểu 1: cột Ghi nợ / Ghi có riêng (Vietcombank, MB...)
const VCB = [
  ['NGÂN HÀNG TMCP NGOẠI THƯƠNG VIỆT NAM - VIETCOMBANK'],
  ['Số tài khoản: 1234567890'],
  ['STT', 'Ngày giao dịch', 'Số tham chiếu', 'Số tiền ghi nợ', 'Số tiền ghi có', 'Số dư', 'Nội dung chi tiết'],
  [1, '02/08/2025', 'FT1', '54,000,000', '', '946,000,000', 'NGA ANH CK THANH TOAN HD 10 CONG TY BAO KHANH LINH'], // đúng tiền HĐ 10
  [2, '06/08/2025', 'FT2', '', '108.000.000', '1.054.000.000', 'RENTECH TT TIEN HANG'], // đúng tiền HĐ bán 40
  [3, '07/08/2025', 'FT3', '4,320,000', '', '', 'TT CUOC XE MANH VINH'], // cước 4,32tr
  [4, '10/08/2025', 'FT4', '15,000,000', '', '', 'CK BAO KHANH LINH tra mot phan'], // trả một phần HĐ 11
  [5, '11/08/2025', 'FT5', '2,000,000', '', '', 'PHI DICH VU NGAN HANG'], // không liên quan
  ['', 'Tổng cộng', '', '75,320,000', '108,000,000', '', ''],
]
// Kiểu 2: một cột "Số tiền" có dấu, ngày kiểu số Excel
const MOT_COT = [
  ['Lịch sử giao dịch'],
  ['Ngày hiệu lực', 'Diễn giải', 'Số tiền', 'Số dư'],
  [45885, 'Thanh toan Rentech HD41', 54000000, 1],
  [45886, 'Chuyen tien noi bo', -1000000, 1],
]

describe('Sao kê ngân hàng', () => {
  it('đọc kiểu cột Nợ/Có riêng: tiền có dấu phẩy/chấm, bỏ dòng tổng; nhận ngân hàng, số tài khoản, khoảng ngày', () => {
    const sk = docSaoKe(VCB, 'saoke-vcb.xlsx')!
    expect(sk).toMatchObject({ nganHang: 'VIETCOMBANK', soTaiKhoan: '1234567890', tuNgay: '02/08/2025', denNgay: '11/08/2025' })
    expect(sk.giaoDich.map((g) => [g.ngay, g.vao, g.ra])).toEqual([
      ['02/08/2025', 0, 54_000_000], ['06/08/2025', 108_000_000, 0], ['07/08/2025', 0, 4_320_000], ['10/08/2025', 0, 15_000_000], ['11/08/2025', 0, 2_000_000],
    ])
  })
  it('đọc kiểu một cột tiền có dấu (âm = ra), ngày dạng số Excel', () => {
    const sk = docSaoKe(MOT_COT, 'lsgd.xlsx')!
    expect(sk.giaoDich.map((g) => [g.ngay, g.vao, g.ra, g.noiDung])).toEqual([['16/08/2025', 54_000_000, 0, 'Thanh toan Rentech HD41'], ['17/08/2025', 0, 1_000_000, 'Chuyen tien noi bo']])
    expect(docSaoKe([['DANH SÁCH HÓA ĐƠN'], ['STT', 'Số hóa đơn']], 'x.xlsx')).toBeNull()
  })
  it('ghép tiền với hoá đơn: đúng số tiền, trả một phần, trả qua nhiều sao kê; công nợ theo đối tác; HĐ mua ≥ 5tr chưa chuyển khoản', () => {
    const a: SaoKe = { ...docSaoKe(VCB, 'vcb.xlsx')!, id: 'a' }
    const b: SaoKe = { ...docSaoKe(MOT_COT, 'lsgd.xlsx')!, id: 'b' }
    const k = tinhCongNo(kho(), CTY, [a, b])
    expect(k).toMatchObject({ soGiaoDich: 7, daGhep: 5 })
    const tra = Object.fromEntries(k.hoaDon.map((h) => [h.so, h.daTra]))
    expect(tra).toEqual({ '10': 54_000_000, '11': 15_000_000, '12': 0, '3': 4_320_000, '40': 108_000_000, '41': 54_000_000 })
    expect(k.chuaGhep.map((x) => x.gd.noiDung)).toEqual(['PHI DICH VU NGAN HANG', 'Chuyen tien noi bo'])
    expect(k.phaiThu).toBe(0)
    expect(k.phaiTra).toBe(6_600_000 + 10_800_000) // HĐ 11 còn 6,6tr + HĐ 12 chưa trả
    expect(k.doiTac.find((d) => d.mst === '2601066601')).toMatchObject({ l: 'mua', soHoaDon: 3, conNo: 17_400_000 })
    // HĐ 11 (21,6tr, mới trả 15tr) và HĐ 12 (10,8tr, chưa trả) lập sau 01/07/2025, từ 5 triệu -> nhắc; HĐ cước 4,32tr dưới ngưỡng
    expect(k.muaChuaChuyenKhoan.map((h) => h.so)).toEqual(['11', '12'])
    expect(k.canhBao[0].noiDung).toContain('mới thấy chuyển khoản 15.000.000 đ')
  })
  it('gán tay thắng ghép tự động; gán rỗng = không liên quan hoá đơn', () => {
    const a: SaoKe = { ...docSaoKe(VCB, 'vcb.xlsx')!, id: 'a', ghepTay: { '8': ['mua|2601066601|C25TKL|12'], '4': [] } } // dòng 8 = FT5 2tr -> gán HĐ 12; dòng 4 = FT1 -> bỏ
    const k = tinhCongNo(kho(), CTY, [a])
    const tra = Object.fromEntries(k.hoaDon.map((h) => [h.so, h.daTra]))
    expect(tra['12']).toBe(2_000_000)
    expect(tra['10']).toBe(15_000_000) // FT1 bị bỏ -> FT4 (15tr, nhắc Bảo Khánh Linh) trừ vào HĐ cũ nhất
    expect(k.chuaGhep).toEqual([])
  })

  it('hai hoá đơn cùng số tiền: chọn hoá đơn có SỐ HĐ ghi trong nội dung chuyển khoản', () => {
    const k0 = napHoaDon(khoTrong(), CTY, [
      hd({ so: '20', ngay: '01/09/2025', chuaThue: 10_000_000, thue: 800_000 }),
      hd({ so: '21', ngay: '02/09/2025', chuaThue: 10_000_000, thue: 800_000 }),
    ])
    const sk: SaoKe = { ...docSaoKe([['Ngày giao dịch', 'Ghi nợ', 'Ghi có', 'Nội dung'], ['03/09/2025', '10,800,000', '', 'TT HD 0020']], 'x.xlsx')!, id: 's' }
    const tra = Object.fromEntries(tinhCongNo(k0, CTY, [sk]).hoaDon.map((h) => [h.so, h.daTra]))
    expect(tra).toEqual({ '20': 10_800_000, '21': 0 })
  })
})

describe('Chống trùng giao dịch giữa các file sao kê (theo số bút toán)', () => {
  // File kỳ sau bắt đầu lại từ ngày cuối kỳ trước -> lặp FT4, FT5 của file VCB
  const KY_SAU = [
    ['NGÂN HÀNG TMCP NGOẠI THƯƠNG VIỆT NAM - VIETCOMBANK'],
    ['Số tài khoản: 1234567890'],
    ['STT', 'Ngày giao dịch', 'Số tham chiếu', 'Số tiền ghi nợ', 'Số tiền ghi có', 'Số dư', 'Nội dung chi tiết'],
    [1, '10/08/2025', 'FT4', '15,000,000', '', '', 'CK BAO KHANH LINH tra mot phan'],
    [2, '11/08/2025', 'FT5', '2,000,000', '', '', 'PHI DICH VU NGAN HANG'],
    [3, '12/08/2025', 'FT6', '6,600,000', '', '', 'CK BAO KHANH LINH tra not HD 11'],
  ]
  const a = (): SaoKe => ({ ...docSaoKe(VCB, 'vcb-t8a.xlsx')!, id: 'a' })
  const b = (): SaoKe => ({ ...docSaoKe(KY_SAU, 'vcb-t8b.xlsx')!, id: 'b' })

  it('cùng số bút toán + cùng tiền ở 2 file chỉ tính một lần, giữ bản ở file bắt đầu sớm hơn', () => {
    const { ds, soTrung } = boGiaoDichTrung([b(), a()])
    expect(soTrung).toBe(2)
    expect(ds.find((s) => s.id === 'a')!.giaoDich).toHaveLength(5)
    expect(ds.find((s) => s.id === 'b')!.giaoDich.map((g) => g.soCT)).toEqual(['FT6'])
  })

  it('công nợ không bị cộng tiền trả 2 lần', () => {
    const k = tinhCongNo(kho(), CTY, [a(), b()])
    expect(k.soTrung).toBe(2)
    expect(k.soGiaoDich).toBe(6)
    const tra = Object.fromEntries(k.hoaDon.map((h) => [h.so, h.daTra]))
    expect(tra['11']).toBe(21_600_000) // 15tr (một lần) + 6,6tr — không phải 15 + 15 + 6,6
    expect(k.phaiTra).toBe(10_800_000)
  })

  it('không có số bút toán thì không gộp (2 lần chuyển cùng tiền cùng ngày là chuyện bình thường)', () => {
    const khongCT = [['Ngày giao dịch', 'Ghi nợ', 'Ghi có', 'Nội dung'], ['10/08/2025', '15,000,000', '', 'CK BAO KHANH LINH']]
    const x: SaoKe = { ...docSaoKe(khongCT, 'x.xlsx')!, id: 'x' }
    const y: SaoKe = { ...docSaoKe(khongCT, 'y.xlsx')!, id: 'y' }
    expect(boGiaoDichTrung([x, y]).soTrung).toBe(0)
  })

  it('cùng số bút toán nhưng khác số tiền: không phải trùng', () => {
    const lech = KY_SAU.map((r, i) => (i === 3 ? [1, '10/08/2025', 'FT4', '15,000,001', '', '', 'x'] : r))
    expect(boGiaoDichTrung([a(), { ...docSaoKe(lech, 'z.xlsx')!, id: 'z' }]).soTrung).toBe(1)
  })

  it('giữ bản có gán tay, dù ở file sau; sao kê gốc không bị sửa', () => {
    const goc = b()
    const coTay: SaoKe = { ...goc, ghepTay: { '4': ['mua|2601066601|C25TKL|11'] } } // dòng 4 = FT4
    const { ds } = boGiaoDichTrung([a(), coTay])
    expect(ds.find((s) => s.id === 'b')!.giaoDich.map((g) => g.soCT)).toEqual(['FT4', 'FT6'])
    expect(ds.find((s) => s.id === 'a')!.giaoDich.map((g) => g.soCT)).not.toContain('FT4')
    expect(coTay.giaoDich).toHaveLength(3)
  })
})

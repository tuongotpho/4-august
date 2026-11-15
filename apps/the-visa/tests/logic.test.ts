// Test bằng dữ liệu GIẢ (repo công khai — không đưa sao kê thật vào đây).
import { describe, expect, it } from 'vitest'
import { docTien, dungKy, gomDong } from '../shared/docSaoKe'
import { doiChieu } from '../shared/doiChieu'
import { dsKhoanChi, khuVuc, laTraNo, nhomTuDong, tenNoiChi } from '../shared/phanLoai'
import { nhanXet, thongKeNam, traDungHan } from '../shared/thongKe'
import { kiemKy } from '../shared/kiemKy'
import { emailDuocPhep } from '../api/_lib/xacThuc'
import type { Chu, GiaoDich, Ky } from '../shared/kieu'

describe('docTien', () => {
  it('đọc số tiền chuẩn', () => {
    expect(docTien('-1,200,206.00')).toBe(-1200206)
    expect(docTien('4,194,387.00')).toBe(4194387)
    expect(docTien('-71,100.00')).toBe(-71100)
  })
  it('chấp nhận OCR đặt sai dấu phân cách', () => {
    expect(docTien('-29.22000')).toBe(-29220)
  })
  it('không nhận chữ, ngày, lãi suất', () => {
    expect(docTien('VND')).toBeNull()
    expect(docTien('11/06/26')).toBeNull()
    expect(docTien('3.29')).toBeNull()
  })
})

// Dựng "chữ OCR" giả cho một trang sao kê: mỗi dòng là danh sách [x, chữ]
let y = 0
const dong = (...o: [number, string][]): Chu[] => { y += 40; return o.map(([x, text]) => ({ text, x0: x, x1: x + 8 * text.length, y0: y, y1: y + 18 })) }
function trangGia(dsDong: Chu[][]) { return { chu: dsDong.flat(), rong: 1700 } }

describe('dungKy', () => {
  it('dựng kỳ từ trang giả, có dòng mô tả xuống hàng và ngày in lệch', () => {
    y = 0
    const t1 = trangGia([
      dong([500, 'Statement'], [640, 'cycle'], [720, ':'], [740, '21/04/2026'], [900, '-'], [920, '20/05/2026']),
      dong([120, 'limit'], [1500, '125,000,000.00']),
      dong([200, '04/06/2026'], [600, '-641,332.00'], [950, '-1,000,000.00'], [1400, '-1,000,000.00']),
      dong([150, '-500,000.00'], [450, '+'], [550, '-1,000,000.00'], [950, '+'], [1050, '500,000.00'], [1250, '='], [1400, '-1,000,000.00']),
      dong([170, '18/04/26'], [350, '21/04/26'], [500, 'Retail'], [560, 'VNM'], [620, 'HA'], [660, 'NOI'], [700, 'PHE'], [750, 'LA'], [790, '-'], [955, '-300,000.00'], [1095, 'VND'], [1485, '-300,000.00']),
      dong([500, 'NT']),
      dong([170, '11/0626']),
      dong([350, '12/06/26'], [500, 'Retail'], [560, 'VNM'], [620, 'HA'], [660, 'NOI'], [700, 'Shopee'], [955, '-2717,000.00'], [1095, 'VND'], [1485, '-700,000.00']),
      dong([170, '03/05/26'], [350, '04/05/26'], [500, 'Credit'], [580, 'Account'], [680, 'I2B'], [750, 'Virtual'], [830, 'Card'], [955, '500,000.00'], [1095, 'VND'], [1485, '500,000.00']),
      dong([500, 'payment;']),
      dong([900, 'Total'], [960, 'debit'], [1030, 'amount'], [1485, '-1,000,000.00']),
      dong([900, 'Paid'], [960, 'during'], [1030, 'term'], [1485, '500,000.00']),
    ])
    const { ky, loi } = dungKy([t1])
    expect(loi).toEqual([])
    expect(ky).toMatchObject({ id: '2026-04-21_2026-05-20', hanTra: '2026-06-04', toiThieu: 641332, hanMuc: 125000000, dauKy: 500000, phatSinh: 1000000, daTra: 500000, cuoiKy: 1000000 })
    expect(ky!.giaoDich.map((g) => [g.ngay, g.soTien])).toEqual([['2026-04-18', -300000], ['2026-06-11', -700000], ['2026-05-03', 500000]])
    expect(ky!.giaoDich[0].moTa).toBe('Retail VNM HA NOI PHE LA - NT')
    expect(ky!.giaoDich[2].moTa).toBe('Credit Account I2B Virtual Card payment;')
    expect(doiChieu(ky!).khop).toBe(true)
  })
  it('không dừng ở bảng tóm tắt trang 1 dù OCR gộp chữ "Total debit / Paid during" vào hàng số (lỗi 30/10/2026)', () => {
    y = 0
    const t1 = trangGia([
      dong([500, 'Statement'], [640, 'cycle'], [720, ':'], [740, '21/04/2026'], [900, '-'], [920, '20/05/2026']),
      dong([150, '-500,000.00'], [300, 'Total'], [360, 'debit'], [420, 'amount'], [550, '-300,000.00'], [700, 'Paid'], [760, 'during'], [820, 'term'], [1050, '500,000.00'], [1400, '-300,000.00']),
      dong([170, '18/04/26'], [350, '21/04/26'], [500, 'Retail'], [560, 'VNM'], [620, 'HA'], [660, 'NOI'], [700, 'Shopee'], [955, '-100,000.00'], [1095, 'VND'], [1485, '-100,000.00']),
    ])
    const t2 = trangGia([
      dong([170, '19/04/26'], [350, '21/04/26'], [500, 'Retail'], [560, 'VNM'], [620, 'HA'], [660, 'NOI'], [700, 'Shopee'], [955, '-200,000.00'], [1095, 'VND'], [1485, '-200,000.00']),
      dong([170, '03/05/26'], [350, '04/05/26'], [500, 'Credit'], [580, 'Account'], [680, 'I2B'], [750, 'Virtual'], [830, 'Card'], [955, '500,000.00'], [1095, 'VND'], [1485, '500,000.00']),
      dong([900, 'Total'], [960, 'debit'], [1030, 'amount'], [1485, '-300,000.00']),
      dong([900, 'Paid'], [960, 'during'], [1030, 'term'], [1485, '500,000.00']),
    ])
    expect(dungKy([t1]).hetBang).toBe(false)
    const { ky, hetBang } = dungKy([t1, t2])
    expect(hetBang).toBe(true)
    expect(ky!.giaoDich).toHaveLength(3)
    expect(doiChieu(ky!).khop).toBe(true)
  })
  it('báo lỗi khi không có kỳ / tóm tắt', () => {
    expect(dungKy([{ chu: [], rong: 1000 }]).ky).toBeNull()
  })
  it('gom chữ cùng hàng dù OCR tách cột', () => {
    const d = gomDong([{ text: 'b', x0: 50, x1: 60, y0: 101, y1: 119 }, { text: 'a', x0: 10, x1: 20, y0: 100, y1: 118 }, { text: 'c', x0: 10, x1: 20, y0: 140, y1: 158 }])
    expect(d.map((x) => x.text)).toEqual(['a b', 'c'])
  })
})

const gd = (ngay: string, moTa: string, soTien: number, id = ngay + moTa): GiaoDich => ({ id, ngay, ngayHT: ngay, moTa, soTien })
const ky = (tu: string, den: string, giaoDich: GiaoDich[], p: Partial<Ky> = {}): Ky => {
  const chi = -giaoDich.filter((g) => g.soTien < 0).reduce((s, g) => s + g.soTien, 0)
  const co = giaoDich.filter((g) => g.soTien > 0).reduce((s, g) => s + g.soTien, 0)
  return { id: `${tu}_${den}`, tu, den, dauKy: 0, phatSinh: chi, daTra: co, cuoiKy: chi - co, giaoDich, ...p }
}

describe('phân loại', () => {
  it('nhóm, tên, khu vực', () => {
    expect(nhomTuDong('Retail VNM PHU THO PLX_VINH PHUC_CH 216')).toBe('Xăng xe')
    expect(nhomTuDong('Retail VNM HA NOI MEGAPAY*MANULIFE VN')).toBe('Bảo hiểm')
    expect(nhomTuDong('Retail VNM HANOI 5644')).toBe('Siêu thị & tạp hoá')
    expect(nhomTuDong('Retail VNM HA NOI CONG TY DTV')).toBe('Sửa điện thoại')
    expect(nhomTuDong('Retail VNM HA NOI VNPAY YDLD01')).toBe('Khác (chưa rõ)')
    expect(tenNoiChi('Retail VNM HNO PAYOO-FPTLONGCHAU80172')).toBe('Nhà thuốc Long Châu')
    expect(khuVuc('Retail VNM SON LA PLX_SONLA_CH 28')).toBe('Sơn La')
    expect(khuVuc('Retail VNM Ho Chi Minh SPEEPAY*Shopee')).toBe('Online')
  })
  it('trả nợ thẻ không tính là chi; hoàn tiền trừ vào chi', () => {
    expect(laTraNo(gd('2026-05-01', 'Credit Account I2B Virtual Card payment;', 1000))).toBe(true)
    expect(laTraNo(gd('2026-05-01', 'Credit VNM HA NOI Shopee', 1000))).toBe(false)
    const k = dsKhoanChi([ky('2026-05-01', '2026-05-31', [gd('2026-05-02', 'Retail VNM HA NOI Shopee', -300), gd('2026-05-03', 'Credit VNM HA NOI Shopee', 100), gd('2026-05-04', 'Credit Account I2B Virtual Card payment;', 5000)])])
    expect(k.map((x) => [x.nhom, x.tien])).toEqual([['Mua sắm online', 300], ['Mua sắm online', -100]])
  })
  it('nhóm tự chọn đè nhóm tự động', () => {
    const g = { ...gd('2026-05-02', 'Retail VNM HA NOI VNPAY YDLD01', -229000), nhomTay: 'Ăn uống & cà phê' }
    expect(dsKhoanChi([ky('2026-05-01', '2026-05-31', [g])])[0].nhom).toBe('Ăn uống & cà phê')
  })
})

describe('thống kê', () => {
  const k1 = ky('2026-04-21', '2026-05-20', [gd('2026-04-25', 'Retail VNM HA NOI Shopee', -1_000_000), gd('2026-05-10', 'Retail VNM HNO PAYOO-FPTLONGCHAU1', -990_000)], { hanTra: '2026-06-04' })
  const k2 = ky('2026-05-21', '2026-06-20', [gd('2026-05-28', 'Credit Account I2B Virtual Card payment;', 1_990_000), gd('2026-06-01', 'Retail VNM HA NOI Shopee', -2_000_000), gd('2026-06-12', 'Retail VNM HNO PAYOO-FPTLONGCHAU1', -990_000)], { hanTra: '2026-07-06', dauKy: 1_990_000 })
  const k3 = ky('2026-06-21', '2026-07-20', [gd('2026-07-20', 'Credit Account I2B Virtual Card payment;', 1_000_000), gd('2026-07-02', 'Retail VNM HA NOI Shopee', -3_000_000), gd('2026-07-18', 'Retail VNM HNO PAYOO-FPTLONGCHAU1', -990_000)], { hanTra: '2026-08-04', dauKy: 2_990_000 })

  it('trả nợ đúng hạn', () => {
    const t = traDungHan([k3, k1, k2])
    expect(t.map((x) => x.du)).toEqual([true, false])
  })
  it('nhận xét: tăng 3 kỳ liền, khoản lặp, trả chưa đủ', () => {
    const nx = nhanXet([k1, k2, k3], '2026-07-25')
    const ten = nx.map((n) => n.tieuDe)
    expect(ten).toContain('Mua sắm online tăng 3 kỳ liền')
    expect(nx.find((n) => n.tieuDe === 'Khoản lặp lại đều đặn')?.noiDung).toContain('Nhà thuốc Long Châu ~990.000đ × 3 lần (3 kỳ)')
    expect(ten).toContain('Trả nợ: có kỳ chưa trả đủ')
    expect(ten.some((t) => t.startsWith('Hạn trả: 17h ngày 04/08/2026'))).toBe(true)
  })
  it('thống kê năm theo ngày giao dịch', () => {
    const t = thongKeNam([k1, k2, k3], 2026)
    expect(t.tong).toBe(8_970_000)
    expect(t.thang[3]).toBe(1_000_000)
    expect(t.thang[6]).toBe(3_990_000)
    expect([t.tuThang, t.denThang, t.soThangCoDuLieu]).toEqual([4, 7, 4])
    expect(t.tongNamTruoc).toBe(0)
  })
})

describe('máy chủ', () => {
  it('chỉ email trong danh sách được vào', () => {
    expect(emailDuocPhep('A@x.com', 'a@x.com, b@y.com')).toBe(true)
    expect(emailDuocPhep('c@x.com', 'a@x.com')).toBe(false)
    expect(emailDuocPhep('a@x.com', '')).toBe(false)
    expect(emailDuocPhep(undefined, 'a@x.com')).toBe(false)
  })
  it('kiểm kỳ gửi lên', () => {
    const k = ky('2026-04-21', '2026-05-20', [gd('2026-04-25', 'x', -1)])
    expect(kiemKy(k).id).toBe(k.id)
    expect(() => kiemKy({ ...k, id: '../../etc' })).toThrow()
    expect(() => kiemKy({ ...k, phatSinh: 1.5 })).toThrow()
  })
})

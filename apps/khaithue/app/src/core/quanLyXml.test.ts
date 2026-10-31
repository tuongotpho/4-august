import { describe, expect, it } from 'vitest'
import type { HoaDonGoc } from './hoaDonGoc'
import { congTheoChieu, demTheo, dongExcel, lapDanhSach, locDanhSach, LOC_TRONG, loaiTheoKyHieu, nhomDanhSach, xepDanhSach } from './quanLyXml'
import { khoaCuaGoc } from './xemHoaDon'

const CTY = '0100000001'
// Số liệu bịa để thử, không phải hoá đơn thật
const hd = (x: Partial<HoaDonGoc>): HoaDonGoc => ({
  nguon: 'xml', tenFile: 'a.xml', kyHieuMau: '1', kyHieu: 'C26TAA', so: '1', ngay: '05/10/2026',
  mstBan: '0200000002', tenBan: 'Công ty Cung Cấp A', mstMua: CTY, tenMua: 'Công ty Mình',
  chuaThue: 1000, thue: 80, tong: 1080, dong: [{ ten: 'Ớt tươi', dvt: 'kg', sl: 1, dg: 1000, tt: 1000, ts: '8%' }],
  mccqt: 'M1', kyBan: true, ngayKy: '05/10/2026', lienQuan: null, ...x,
})

const KHO: Record<string, HoaDonGoc> = Object.fromEntries([
  hd({ so: '1' }),
  hd({ so: '2', ngay: '20/10/2026', chuaThue: 5000, thue: 500, tong: 5500, dong: [{ ten: 'Chai thuỷ tinh', dvt: 'cái', sl: 10, dg: 500, tt: 5000, ts: '10%' }] }),
  hd({ so: '3', ngay: '02/09/2026', kyHieu: 'C26MSG', mccqt: '', kyBan: false, mstBan: '0300000003', tenBan: 'Siêu thị B' }),
  hd({ so: '4', ngay: '15/10/2026', kyHieu: 'C26TBB', mstBan: CTY, tenBan: 'Công ty Mình', mstMua: '0400000004', tenMua: 'Quán Ăn C', chuaThue: 20000, thue: 1600, tong: 21600 }),
  hd({ so: '5', ngay: '16/10/2026', kyHieu: 'C26TAA', mccqt: '', lienQuan: { loai: 'thayThe', kyHieu: 'C26TAA', so: '1', ngay: '05/10/2026' } }),
  hd({ so: '6', ngay: '01/10/2026', kyHieu: 'K26TCC', mccqt: '' }),
  hd({ nguon: 'pdf', so: '7' }),
].map((g) => [khoaCuaGoc(g), g]))

describe('quản lý hoá đơn XML', () => {
  const ds = lapDanhSach(KHO, CTY)

  it('chỉ lấy hoá đơn XML, mới nhất lên đầu', () => {
    expect(ds.map((x) => x.g.so)).toEqual(['2', '5', '4', '1', '6', '3'])
  })

  it('phân loại theo ký hiệu, chiều, tình trạng, cần xem lại', () => {
    expect(loaiTheoKyHieu('C26TAA')).toBe('coMa')
    expect(loaiTheoKyHieu('K26TCC')).toBe('khongMa')
    expect(loaiTheoKyHieu('C26MSG')).toBe('mayTinhTien')
    const theo = (so: string) => ds.find((x) => x.g.so === so)!
    expect(theo('4').chieu).toBe('ban')
    expect(theo('4').doiTac).toEqual({ mst: '0400000004', ten: 'Quán Ăn C' })
    expect(theo('1').doiTac.mst).toBe('0200000002')
    expect(theo('5').tinhTrang).toBe('thayThe')
    expect(theo('5').canXem).toEqual(['thieuMa'])
    // máy tính tiền / không mã: không có mã, không ký là bình thường
    expect(theo('3').canXem).toEqual([])
    expect(theo('6').canXem).toEqual([])
    expect(theo('2').thueSuat).toEqual(['10%'])
  })

  it('đánh dấu chưa có file gốc trên mây khi có hàm kiểm', () => {
    const co = new Set([ds[0].khoa])
    const d = lapDanhSach(KHO, CTY, (k) => co.has(k))
    expect(d.filter((x) => x.canXem.includes('chuaCoFile')).length).toBe(5)
  })

  it('lọc kết hợp: tháng, chiều, thuế suất, đối tác, tìm cả tên hàng không dấu', () => {
    expect(locDanhSach(ds, { ...LOC_TRONG, thang: '10/2026' }).length).toBe(5)
    expect(locDanhSach(ds, { ...LOC_TRONG, chieu: 'ban' }).map((x) => x.g.so)).toEqual(['4'])
    expect(locDanhSach(ds, { ...LOC_TRONG, thueSuat: '10%' }).map((x) => x.g.so)).toEqual(['2'])
    expect(locDanhSach(ds, { ...LOC_TRONG, doiTac: '0300000003' }).map((x) => x.g.so)).toEqual(['3'])
    expect(locDanhSach(ds, { ...LOC_TRONG, tim: 'chai thuy' }).map((x) => x.g.so)).toEqual(['2'])
    expect(locDanhSach(ds, { ...LOC_TRONG, canXem: true }).map((x) => x.g.so)).toEqual(['5'])
    expect(locDanhSach(ds, { ...LOC_TRONG, loai: 'mayTinhTien', thang: '10/2026' })).toEqual([])
  })

  it('cộng riêng mua vào / bán ra', () => {
    const c = congTheoChieu(ds)
    expect(c.ban).toEqual({ so: 1, chuaThue: 20000, thue: 1600, tong: 21600 })
    expect(c.mua).toEqual({ so: 5, chuaThue: 9000, thue: 820, tong: 9820 })
  })

  it('nhóm theo tháng / đối tác, có cộng từng nhóm', () => {
    const t = nhomDanhSach(ds, 'thang')
    expect(t.map((n) => [n.khoa, n.cong.so])).toEqual([['10/2026', 5], ['09/2026', 1]])
    const d = nhomDanhSach(ds, 'doiTac')
    expect(d[0].ten).toBe('Quán Ăn C')
    expect(d.find((n) => n.khoa === 'mua|0200000002')!.cong).toEqual({ so: 4, chuaThue: 8000, thue: 740, tong: 8740 })
    expect(nhomDanhSach(ds, '')[0].ds.length).toBe(6)
  })

  it('xếp theo tổng tiền, đếm theo thuế suất, dòng Excel', () => {
    expect(xepDanhSach(ds, 'tong', true)[0].g.so).toBe('4')
    expect(xepDanhSach(ds, 'ngay', false)[0].g.so).toBe('3')
    expect(demTheo(ds, (x) => x.thueSuat).get('8%')).toBe(5)
    const e = dongExcel(ds.slice(0, 1))[0]
    expect(e['Tổng thanh toán']).toBe(5500)
    expect(e['Chiều']).toBe('Mua vào')
  })
})

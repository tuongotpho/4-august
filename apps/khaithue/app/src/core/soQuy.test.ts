import { describe, expect, it } from 'vitest'
import { khoTrong, napHoaDon } from './kho.js'
import { lapSoQuy, nguongTienMat, phieuTuHoaDon, soPhieuMoi, type PhieuQuy, type SoQuy } from './soQuy.js'
import { docSaoKe, tinhCongNo, type SaoKe } from './saoKe.js'
import type { HoaDon } from './types.js'

const CTY = '2601102955'
const hd = (h: Partial<HoaDon>): HoaDon => ({
  loai: 'mua', kyHieuMau: '1', kyHieu: 'C25TKG', so: '1', ngay: '01/08/2025', mstBan: '2601103317', tenBan: 'KG HOME', mstMua: CTY, tenMua: '',
  chuaThue: 0, thue: 0, trangThai: 'Hóa đơn mới', file: '', ...h,
})
const kho = () => napHoaDon(khoTrong(), CTY, [
  hd({ so: '1', ngay: '01/08/2025', chuaThue: 3_000_000, thue: 240_000 }), // 3,24tr: dưới ngưỡng 5tr
  hd({ so: '2', ngay: '02/08/2025', chuaThue: 6_000_000, thue: 480_000 }), // 6,48tr: từ 01/07/2025 trả tiền mặt -> không được khấu trừ
  hd({ so: '3', ngay: '02/03/2025', chuaThue: 15_000_000, thue: 1_200_000 }), // 16,2tr trước 01/07/2025: ngưỡng cũ 20tr -> vẫn được
  hd({ loai: 'ban', kyHieu: 'C25TNA', so: '50', ngay: '03/08/2025', mstBan: CTY, mstMua: '2600835029', tenMua: 'RENTECH', chuaThue: 10_000_000, thue: 800_000 }),
])
const p = (o: Partial<PhieuQuy>): PhieuQuy => ({ id: o.so ?? 'x', loai: 'chi', so: 'PC001', ngay: '05/08/2025', soTien: 0, nhom: 'khac', noiDung: '', doiTac: '', hoaDon: [], ...o })

describe('Sổ quỹ tiền mặt', () => {
  it('tồn luỹ kế theo ngày (thu trước chi cùng ngày); tổng thu/chi; tồn cuối; xem theo khoảng ngày', () => {
    const quy: SoQuy = { caiDat: { tonDau: 10_000_000, ngayTonDau: '01/08/2025' }, phieu: {
      a: p({ id: 'a', loai: 'chi', so: 'PC001', ngay: '05/08/2025', soTien: 3_240_000, hoaDon: ['mua|2601103317|C25TKG|1'] }),
      b: p({ id: 'b', loai: 'thu', so: 'PT001', ngay: '05/08/2025', soTien: 10_800_000, nhom: 'banHang', hoaDon: ['ban||C25TNA|50'] }),
      c: p({ id: 'c', loai: 'chi', so: 'PC002', ngay: '20/09/2025', soTien: 2_000_000, nhom: 'luong' }),
    } }
    const k = lapSoQuy(kho(), CTY, quy)
    expect(k.dong.map((d) => [d.so, d.ton])).toEqual([['PT001', 20_800_000], ['PC001', 17_560_000], ['PC002', 15_560_000]])
    expect(k).toMatchObject({ tonDau: 10_000_000, tongThu: 10_800_000, tongChi: 5_240_000, tonCuoi: 15_560_000 })
    expect(k.theoThang).toEqual([{ thang: '08/2025', thu: 10_800_000, chi: 3_240_000, ton: 17_560_000 }, { thang: '09/2025', thu: 0, chi: 2_000_000, ton: 15_560_000 }])
    expect(k.canhBao).toEqual([])
    const t9 = lapSoQuy(kho(), CTY, quy, '01/09/2025', '30/09/2025')
    expect([t9.tonDau, t9.dong.length, t9.tonCuoi]).toEqual([17_560_000, 1, 15_560_000])
  })
  it('quỹ âm -> LỖI; HĐ mua trả tiền mặt vượt ngưỡng (5tr từ 01/07/2025, 20tr trước đó) -> LỖI không được khấu trừ', () => {
    const quy: SoQuy = { caiDat: { tonDau: 1_000_000, ngayTonDau: '' }, phieu: {
      a: p({ id: 'a', so: 'PC001', ngay: '03/08/2025', soTien: 6_480_000, hoaDon: ['mua|2601103317|C25TKG|2'] }),
      b: p({ id: 'b', so: 'PC002', ngay: '04/08/2025', soTien: 16_200_000, hoaDon: ['mua|2601103317|C25TKG|3'] }),
    } }
    const ds = lapSoQuy(kho(), CTY, quy).canhBao.map((c) => [c.muc, c.noiDung.slice(0, 60)])
    expect(ds).toEqual([
      ['loi', expect.stringContaining('Quỹ tiền mặt ÂM 5.480.000 đ sau phiếu PC001')],
      ['loi', expect.stringContaining('HĐ mua C25TKG-2 ngày 02/08/2025')],
    ])
    expect(nguongTienMat('30/06/2025')).toBe(20_000_000)
    expect(nguongTienMat('01/07/2025')).toBe(5_000_000)
  })
  it('số phiếu tự tăng theo năm; phiếu điền sẵn từ hoá đơn', () => {
    const quy: SoQuy = { caiDat: { tonDau: 0, ngayTonDau: '' }, phieu: { a: p({ id: 'a', so: 'PC007', ngay: '01/02/2025' }), b: p({ id: 'b', so: 'PC002', ngay: '01/02/2024' }) } }
    expect(soPhieuMoi(quy, 'chi', '10/10/2025')).toBe('PC008')
    expect(soPhieuMoi(quy, 'chi', '10/10/2026')).toBe('PC001')
    expect(soPhieuMoi(quy, 'thu', '10/10/2025')).toBe('PT001')
    expect(phieuTuHoaDon(kho(), CTY, 'ban||C25TNA|50', quy, '05/08/2025')).toMatchObject({ loai: 'thu', so: 'PT001', soTien: 10_800_000, nhom: 'banHang', doiTac: 'RENTECH', hoaDon: ['ban||C25TNA|50'] })
  })
  it('công nợ cộng cả tiền mặt; HĐ ≥ 5tr trả tiền mặt KHÔNG được tính là chuyển khoản', () => {
    const quy: SoQuy = { caiDat: { tonDau: 50_000_000, ngayTonDau: '' }, phieu: { a: p({ id: 'a', so: 'PC001', ngay: '03/08/2025', soTien: 6_480_000, hoaDon: ['mua|2601103317|C25TKG|2'] }) } }
    const sk: SaoKe = { ...docSaoKe([['Ngày giao dịch', 'Ghi nợ', 'Ghi có', 'Nội dung'], ['05/08/2025', '', '10,800,000', 'RENTECH TT HD 50']], 'x.xlsx')!, id: 's' }
    const k = tinhCongNo(kho(), CTY, [sk], 120, lapSoQuy(kho(), CTY, quy).daTraTheoHoaDon)
    const h2 = k.hoaDon.find((h) => h.so === '2')!
    expect([h2.daTra, h2.tienMat]).toEqual([6_480_000, 6_480_000])
    expect(k.muaChuaChuyenKhoan.map((h) => h.so)).toEqual(['2'])
    expect(k.canhBao[0].noiDung).toContain('chưa thấy chuyển khoản (trả tiền mặt 6.480.000 đ)')
    expect(k.hoaDon.find((h) => h.so === '50')!.daTra).toBe(10_800_000)
  })
})

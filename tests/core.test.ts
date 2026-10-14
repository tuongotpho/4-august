import { describe, expect, it } from 'vitest'
import { suKienTu } from '../src/lib/lichGoogle'
import { CAI_DAT_MAC_DINH, daGiang, docTien, lopMoi, trangThai } from '../src/lib/model'
import { congNo, goiY, theoThang, timLopChoTien, timTrung, trungGio } from '../src/lib/tinh'
import { lopTuAI, type LopAI } from '../src/lib/trichTin'

// 14/10/2026 10:00 giờ Việt Nam
const BAY_GIO = new Date('2026-10-14T03:00:00Z')

describe('tiền', () => {
  it('đọc nhiều cách viết', () => {
    expect(docTien('1tr5')).toBe(1_500_000)
    expect(docTien('1tr')).toBe(1_000_000)
    expect(docTien('2 triệu')).toBe(2_000_000)
    expect(docTien('1.5tr')).toBe(1_500_000)
    expect(docTien('800k')).toBe(800_000)
    expect(docTien('1,500,000')).toBe(1_500_000)
    expect(docTien('1.500.000đ')).toBe(1_500_000)
    expect(docTien('abc')).toBeNull()
  })
})

describe('trạng thái', () => {
  it('đã giảng theo ngày + giờ kết thúc', () => {
    expect(daGiang(lopMoi({ ngay: '2026-10-13' }), BAY_GIO)).toBe(true)
    expect(daGiang(lopMoi({ ngay: '2026-10-14', gioBD: '08:00', gioKT: '09:30' }), BAY_GIO)).toBe(true)
    expect(daGiang(lopMoi({ ngay: '2026-10-14', gioBD: '13:30', gioKT: '17:00' }), BAY_GIO)).toBe(false)
    expect(daGiang(lopMoi({ ngay: '2026-10-13', soNgay: 2 }), BAY_GIO)).toBe(false) // lớp 2 ngày còn hôm nay
    expect(trangThai(lopMoi({ ngay: '2026-10-01', chiPhi: null }), BAY_GIO)).toBe('thieu_thu_lao')
    expect(trangThai(lopMoi({ ngay: '2026-10-01', chiPhi: 1 }), BAY_GIO)).toBe('cho_tien')
    expect(trangThai(lopMoi({ ngay: '2026-10-20' }), BAY_GIO)).toBe('sap_toi')
  })

  it('công nợ gom theo đối tác, nợ lâu lên đầu', () => {
    const ds = [
      lopMoi({ ngay: '2026-10-01', doiTac: 'TIEC', chiPhi: 1_500_000 }),
      lopMoi({ ngay: '2026-09-01', doiTac: 'ESC', chiPhi: 1_000_000 }),
      lopMoi({ ngay: '2026-10-05', doiTac: 'TIEC', chiPhi: 1_000_000 }),
      lopMoi({ ngay: '2026-10-05', doiTac: 'TIEC', chiPhi: 9, thanhToan: 'da' }),
      lopMoi({ ngay: '2026-10-20', doiTac: 'TIEC', chiPhi: 9 }),
    ]
    const n = congNo(ds, BAY_GIO)
    expect(n.map((x) => [x.doiTac, x.lop.length, x.tong])).toEqual([['ESC', 1, 1_000_000], ['TIEC', 2, 2_500_000]])
    expect(n[0].soNgayCho).toBe(43)
  })

  it('tổng hợp theo tháng đủ 12 tháng, bỏ lớp hủy', () => {
    const t = theoThang([lopMoi({ ngay: '2026-03-02', chiPhi: 5 }), lopMoi({ ngay: '2026-03-09', chiPhi: 7, huy: true })], '2026')
    expect(t).toHaveLength(12)
    expect(t[2]).toMatchObject({ soLop: 1, tien: 5 })
  })

  it('tìm trùng / trùng giờ / lớp chờ tiền', () => {
    const a = lopMoi({ ngay: '2026-11-12', khachHang: 'Công ty Cty Thử Hải Dương', gioBD: '08:00', gioKT: '11:00' })
    const ds = [a, lopMoi({ ngay: '2026-10-01', khachHang: 'Cty Thử', doiTac: 'TIEC', chiPhi: 1 }), lopMoi({ ngay: '2026-10-02', khachHang: 'Hà Mai', chiPhi: 1 })]
    expect(timTrung(ds, { id: 'x', ngay: '2026-11-12', khachHang: 'cty thu hai duong' })?.id).toBe(a.id)
    expect(trungGio(ds, lopMoi({ ngay: '2026-11-12', gioBD: '10:00', gioKT: '12:00' }))).toHaveLength(1)
    expect(trungGio(ds, lopMoi({ ngay: '2026-11-12', gioBD: '13:30', gioKT: '17:00' }))).toHaveLength(0)
    expect(timLopChoTien(ds, 'cty thu', BAY_GIO).map((l) => l.khachHang)).toEqual(['Cty Thử'])
    expect(timLopChoTien(ds, 'Hà', BAY_GIO)).toHaveLength(0) // tên quá ngắn không khớp bừa
  })
})

describe('AI -> lớp', () => {
  const ds = [lopMoi({ ngay: '2026-01-01', lienHe: 'Ngọc Anh', doiTac: 'TIEC', khachHang: 'X' })]
  const a: LopAI = {
    ngay: '2026-11-12', soNgay: 1, gioBD: '', gioKT: '', buoi: 'sang', hinhThuc: '', doiTac: '', lienHe: 'ngoc anh', khachHang: ' Cty Thử ',
    diaDiem: 'hải dương', noiDung: '', chiPhi: 1_500_000, ghiChu: '', luuY: '',
  }
  it('điền giờ theo buổi, khớp liên hệ -> đối tác, chuẩn địa điểm', () => {
    const l = lopTuAI(a, CAI_DAT_MAC_DINH, goiY(ds), 'tin gốc', 'telegram')
    expect(l).toMatchObject({ gioBD: '08:00', gioKT: '11:30', lienHe: 'Ngọc Anh', doiTac: 'TIEC', khachHang: 'Cty Thử', diaDiem: 'Hải Dương', chiPhi: 1_500_000, nguon: 'telegram', tinGoc: 'tin gốc', canDongBo: true })
  })
  it('online nhận ra từ "zoom", bí danh đối tác', () => {
    const l = lopTuAI({ ...a, doiTac: 'at green', noiDung: 'qua zoom', diaDiem: '' }, { ...CAI_DAT_MAC_DINH, biDanhDoiTac: { 'at green': 'Green' } }, goiY([]), '', 'web')
    expect(l).toMatchObject({ hinhThuc: 'online', diaDiem: 'Online', doiTac: 'Green' })
  })
})

describe('sự kiện Google Calendar', () => {
  it('có giờ -> theo giờ VN; nhiều ngày -> cả ngày', () => {
    const s = suKienTu(lopMoi({ id: 'abc', ngay: '2026-11-12', gioBD: '08:00', gioKT: '11:00', khachHang: 'Cty Thử', doiTac: 'TIEC', chiPhi: 1_500_000 }), 'https://x.app')
    expect(s).toMatchObject({ caNgay: false, batDau: '2026-11-12T08:00:00+07:00', ketThuc: '2026-11-12T11:00:00+07:00', tieuDe: 'Giảng ATLĐ – Cty Thử (TIEC)' })
    expect(s.moTa).toContain('Thù lao: 1.500.000 đ')
    expect(s.moTa).toContain('[atld:abc]')
    const n = suKienTu(lopMoi({ ngay: '2026-02-22', soNgay: 2, gioBD: '08:00', gioKT: '16:30' }))
    expect(n).toMatchObject({ caNgay: true, batDau: '2026-02-22', ketThuc: '2026-02-24' })
  })
})

// Lịch công việc chính (congViec): hiện trên lịch để biết ngày bận, KHÔNG tính thù lao / doanh thu / công nợ.
import { describe, expect, it } from 'vitest'
import { suKienTu } from '../src/lib/lichGoogle'
import { chuanLop, lopMoi, tenLop, thuLao, trangThai } from '../src/lib/model'
import { congNo, goiY, theoDoiTac, theoNam, theoThang, timLopChoTien, timTrung, tongDenNay, trungGio } from '../src/lib/tinh'

const bayGio = new Date('2026-11-20T05:00:00Z') // 12h trưa 20/11 giờ VN
const lop = lopMoi({ id: 'lop1', ngay: '2026-11-10', gioBD: '08:00', gioKT: '11:00', khachHang: 'Cty ABC', doiTac: 'TIEC', chiPhi: 1_500_000 })
// lịch công việc lỡ có số tiền (dữ liệu nhập tay / AI) vẫn không được tính
const viec = lopMoi({ id: 'viec1', ngay: '2026-11-12', gioBD: '08:00', gioKT: '16:30', congViec: true, noiDung: 'Kiểm tra trạm 110kV', chiPhi: 9_000_000, doiTac: 'TIEC' })
const ds = [lop, viec]

describe('lịch công việc', () => {
  it('bản ghi cũ không có trường congViec -> lớp giảng bình thường', () => {
    const { congViec: _bo, ...cu } = lop
    expect(chuanLop(cu as typeof lop).congViec).toBe(false)
    expect(chuanLop({ ...viec }).congViec).toBe(true)
  })

  it('trạng thái riêng, tên = tên việc', () => {
    expect(trangThai(viec, bayGio)).toBe('cong_viec')
    expect(trangThai({ ...viec, huy: true }, bayGio)).toBe('huy')
    expect(tenLop(viec)).toBe('Kiểm tra trạm 110kV')
    expect(tenLop(lop)).toBe('Cty ABC')
    expect(thuLao(viec)).toBe(0)
    expect(thuLao(lop)).toBe(1_500_000)
  })

  it('không vào công nợ, không vào "đã nhận tiền …"', () => {
    const no = congNo(ds, bayGio)
    expect(no.flatMap((n) => n.lop).map((l) => l.id)).toEqual(['lop1'])
    expect(timLopChoTien(ds, 'TIEC', bayGio).map((l) => l.id)).toEqual(['lop1'])
  })

  it('không cộng vào doanh thu / tổng hợp', () => {
    expect(theoNam(ds)).toEqual([{ khoa: '2026', soLop: 1, tien: 1_500_000, daTT: 0 }])
    expect(theoThang(ds, '2026')[10]).toMatchObject({ soLop: 1, tien: 1_500_000 })
    expect(theoDoiTac(ds, '2026')).toEqual([{ khoa: 'TIEC', soLop: 1, tien: 1_500_000, daTT: 0 }])
    expect(tongDenNay(ds, 'nam', bayGio)).toMatchObject([{ khoa: '2026', soLop: 1, tien: 1_500_000 }])
  })

  it('không làm bẩn gợi ý đối tác / khách hàng', () => {
    const v2 = lopMoi({ congViec: true, noiDung: 'Họp', doiTac: 'Chỉ trong việc', khachHang: 'X' })
    const gy = goiY([...ds, v2])
    expect(gy.doiTac).not.toContain('Chỉ trong việc')
    expect(gy.khachHang).not.toContain('X')
  })

  it('lớp mới trùng ngày bận công việc -> báo trùng giờ; không coi là "trùng lớp"', () => {
    const moi = lopMoi({ ngay: '2026-11-12', gioBD: '13:30', gioKT: '17:00', khachHang: 'Cty XYZ' })
    expect(trungGio(ds, moi).map((l) => l.id)).toEqual(['viec1'])
    expect(timTrung(ds, moi)).toBeUndefined()
  })

  it('Google Calendar: tiêu đề trung tính, không ghi thù lao', () => {
    const s = suKienTu(viec)
    expect(s.tieuDe).toBe('💼 Kiểm tra trạm 110kV')
    expect(s.moTa).not.toContain('Thù lao')
    expect(s.moTa).toContain('[atld:viec1]')
  })
})

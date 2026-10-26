import { describe, expect, it } from 'vitest'
import { lapBaoCaoNam, tienChu } from '../src/lib/baoCaoNam'
import { KHONG_TAG } from '../src/lib/hashtag'
import { emptyDossier, emptyInvoice } from '../src/lib/model'
import { nhanTrangThai } from '../src/lib/status'

const hd = (ngayHd: string, tongTien: number, ten = 'Nhà hàng A') => ({ ...emptyInvoice(), soHd: '1', ngayHd, tongTien, tenNguoiBan: ten })
const hs = (p: Partial<ReturnType<typeof emptyDossier>>) => ({ ...emptyDossier(), nguoiDeNghi: 'Anh A', ...p })

const daTt = hs({ invoices: [hd('2026-03-05', 4_000_000)], tags: ['CBM'], ngayToTrinh: '2026-03-01', ngayDntt: '2026-03-06', ngayNopKeToan: '2026-03-10', ngayKeToanTt: '2026-03-20' })
// hồ sơ 2 HĐ: 1 HĐ năm 2025, 1 HĐ năm 2026 -> chỉ tính HĐ 2026
const choKt = hs({ invoices: [hd('2025-12-28', 9_000_000), hd('2026-03-02', 1_000_000, 'Khách sạn B')], ngayToTrinh: '2025-12-20', ngayDntt: '2026-01-05', ngayNopKeToan: '2026-01-06', nguoiDeNghi: 'Chị B' })
const chuaNop = hs({ invoices: [hd('2026-07-15', 2_500_000)], tags: ['KHCN', 'CBM'] })
const cu = hs({ invoices: [hd('2025-05-01', 3_000_000)], ngayKeToanTt: '2025-06-01' })

describe('báo cáo năm', () => {
  const bc = lapBaoCaoNam([daTt, choKt, chuaNop, cu], 2026, 15)

  it('chỉ tính hóa đơn có ngày trong năm', () => {
    expect(bc.tong).toEqual({ soHoSo: 3, soHd: 3, tongTien: 7_500_000 })
    expect(bc.theoNhom.daTt.tongTien).toBe(4_000_000)
    expect(bc.theoNhom.choKt.tongTien).toBe(1_000_000)
    expect(bc.theoNhom.chuaNop.tongTien).toBe(2_500_000)
    expect(bc.thang[2].tongTien).toBe(5_000_000) // tháng 3
    expect(bc.namTruoc).toEqual({ soHd: 2, tongTien: 12_000_000 })
  })

  it('tồn đọng: hồ sơ chưa thanh toán, tiền chỉ phần trong năm, chờ lâu lên đầu', () => {
    expect(bc.tonDong.map((x) => x.d.id)).toEqual([choKt.id, chuaNop.id])
    expect(bc.tonDong[0].tongTien).toBe(1_000_000)
  })

  it('theo người đề nghị và theo việc', () => {
    expect(bc.theoNguoiTT.map((n) => [n.ten, n.tongTien, n.daTt])).toEqual([
      ['Anh A', 6_500_000, 4_000_000],
      ['Chị B', 1_000_000, 0],
    ])
    expect(bc.theoViec.find((v) => v.ma === 'CBM')?.tongTien).toBe(6_500_000)
    expect(bc.theoViec.at(-1)?.ma).toBe(KHONG_TAG)
    expect(bc.nhieuTag).toBe(true)
  })

  it('lời nhận xét có số tổng, so năm trước, tỷ lệ đã thanh toán', () => {
    expect(bc.nhanXet[0]).toBe('Năm 2026 phát sinh 3 hóa đơn thuộc 3 hồ sơ, tổng 7,5 triệu đồng. So với năm 2025 (12 triệu đồng), giảm 38%.')
    expect(bc.nhanXet[1]).toContain('4 triệu đồng (53% số tiền)')
    expect(bc.nhanXet.some((x) => x.startsWith('Tháng phát sinh nhiều nhất: tháng 3'))).toBe(true)
    expect(bc.nhanXet.some((x) => x.includes('quá 15 ngày chưa được thanh toán'))).toBe(true)
  })

  it('năm trống', () => {
    expect(lapBaoCaoNam([cu], 2026).nhanXet).toEqual(['Năm 2026 chưa có hóa đơn nào.'])
  })

  it('định dạng tiền chữ và nhãn trạng thái HĐ cũ', () => {
    expect(tienChu(652_521_060)).toBe('652,5 triệu đồng')
    expect(tienChu(800_000)).toBe('800.000 đồng')
    expect(nhanTrangThai(hs({ hoSoCu: true, invoices: [hd('2026-01-01', 1)] }))).toBe('Chưa thanh toán')
  })
})

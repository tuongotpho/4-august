import { describe, expect, it } from 'vitest'
import { emptyDossier, emptyInvoice } from '../src/lib/model'
import { flattenInvoices, hopHoaDon, LOC_TONG_HOP } from '../src/lib/summary'

const hs = (ngayHd: string, p: Partial<ReturnType<typeof emptyDossier>> = {}) => ({
  ...emptyDossier(),
  invoices: [{ ...emptyInvoice(), soHd: '57', ngayHd, tongTien: 1_000_000, tenNguoiBan: 'Nhà hàng Điện Biên', mstNguoiBan: '0100000001' }],
  ...p,
})
const rows = flattenInvoices([
  hs('2026-10-05', { noiDung: 'Làm việc với Điện lực Hưng Yên', tags: ['CBM'], nguoiDeNghi: 'Lê Việt Thanh', ngayKeToanTt: '2026-10-20' }),
  hs('2026-09-10', { noiDung: 'Họp đề tài', nguoiDeNghi: 'Nguyễn Đình Cường', ngayNopKeToan: '2026-09-15' }),
  hs('2025-12-30', { noiDung: 'Tiếp khách' }),
])
const loc = (p: Partial<typeof LOC_TONG_HOP>) => rows.filter((r) => hopHoaDon(r, { ...LOC_TONG_HOP, ...p })).map((r) => r.d.noiDung)

describe('bộ lọc trang Tổng hợp', () => {
  it('kỳ: năm, tháng (tháng chỉ có tác dụng khi chọn năm)', () => {
    expect(loc({ nam: 2026 })).toHaveLength(2)
    expect(loc({ nam: 2026, thang: 9 })).toEqual(['Họp đề tài'])
    expect(loc({ thang: 9 })).toHaveLength(3)
  })
  it('tình trạng thanh toán theo 3 nhóm', () => {
    expect(loc({ nhom: 'daTt' })).toEqual(['Làm việc với Điện lực Hưng Yên'])
    expect(loc({ nhom: 'choKt' })).toEqual(['Họp đề tài'])
    expect(loc({ nhom: 'chuaNop' })).toEqual(['Tiếp khách'])
  })
  it('người TT, kể cả hồ sơ chưa ghi', () => {
    expect(loc({ nguoiTT: 'Nguyễn Đình Cường' })).toEqual(['Họp đề tài'])
    expect(loc({ nguoiTT: '' })).toEqual(['Tiếp khách'])
  })
  it('tìm không dấu, mọi từ, cả số HĐ / MST / hashtag', () => {
    expect(loc({ q: 'dien luc hung' })).toEqual(['Làm việc với Điện lực Hưng Yên'])
    expect(loc({ q: '#cbm' })).toHaveLength(1)
    expect(loc({ q: '0100000001 57' })).toHaveLength(3)
    expect(loc({ q: 'dien xyz' })).toEqual([])
  })
})

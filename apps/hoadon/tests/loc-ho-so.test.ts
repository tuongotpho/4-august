import { describe, expect, it } from 'vitest'
import { KHONG_TAG } from '../src/lib/hashtag'
import { dangLoc, demTag, doiTag, LOC_MAC_DINH, locHoSo, namCoHoSo, nhomTheoThang } from '../src/lib/locHoSo'
import { emptyDossier, emptyInvoice } from '../src/lib/model'

const hs = (ngayHd: string, tien: number, p: Partial<ReturnType<typeof emptyDossier>> = {}) => ({
  ...emptyDossier(), invoices: [{ ...emptyInvoice(), soHd: '1', ngayHd, tongTien: tien, tenNguoiBan: 'Nhà hàng Điện Biên' }], ...p,
})

const a = hs('2026-10-05', 1_000_000, { noiDung: 'Làm việc với Công ty Điện lực Hưng Yên', tags: ['CBM'] })
const b = hs('2026-10-01', 2_000_000, { noiDung: 'Họp đề tài', tags: ['KHCN', 'CBM'], ngayKeToanTt: '2026-10-20' })
const c = hs('2025-12-30', 500_000, { noiDung: 'Tiếp khách' })
const tat = { ...LOC_MAC_DINH, trangThai: 'all' as const }

describe('lọc hồ sơ', () => {
  it('tìm không cần dấu, nhiều từ đều phải có', () => {
    expect(locHoSo([a, b, c], { ...tat, q: 'dien luc hung' })).toEqual([a])
    expect(locHoSo([a, b, c], { ...tat, q: 'điện biên' })).toHaveLength(3) // tên người bán
    expect(locHoSo([a, b, c], { ...tat, q: 'dien xyz' })).toEqual([])
  })
  it('theo tag, kể cả hồ sơ chưa gắn tag', () => {
    expect(locHoSo([a, b, c], { ...tat, tag: 'CBM' })).toEqual([a, b])
    expect(locHoSo([a, b, c], { ...tat, tag: KHONG_TAG })).toEqual([c])
  })
  it('theo năm / tháng ngày HĐ và trạng thái mặc định (chưa xong)', () => {
    expect(locHoSo([a, b, c], { ...tat, nam: 2025 })).toEqual([c])
    expect(locHoSo([a, b, c], { ...tat, nam: 2026, thang: 10 })).toEqual([a, b])
    expect(locHoSo([a, b, c], LOC_MAC_DINH)).toEqual([a, c])
    expect(dangLoc(LOC_MAC_DINH)).toBe(false)
    expect(dangLoc({ ...LOC_MAC_DINH, tag: 'CBM' })).toBe(true)
  })
  it('đếm tag: nhiều nhất trước, chưa gắn cuối', () => {
    expect(demTag([a, b, c]).map((t) => [t.ma, t.soHoSo, t.tongTien])).toEqual([
      ['CBM', 2, 3_000_000], ['KHCN', 1, 2_000_000], [KHONG_TAG, 1, 500_000],
    ])
    expect(namCoHoSo([c, a])).toEqual([2026, 2025])
  })
  it('nhóm theo tháng giữ thứ tự và cộng tiền', () => {
    const g = nhomTheoThang([a, b, c])
    expect(g.map((x) => [x.nhan, x.ds.length, x.tongTien])).toEqual([['Tháng 10/2026', 2, 3_000_000], ['Tháng 12/2025', 1, 500_000]])
  })
})

describe('gắn / bỏ tag hàng loạt', () => {
  it('thêm giữ tag cũ, bỏ đúng tag, chuẩn hoá tag gõ tay', () => {
    expect(doiTag(b, ['sáng kiến'], ['CBM']).tags).toEqual(['KHCN', 'SANGKIEN'])
    expect(doiTag(a, ['cbm'], [])).toBe(a) // không đổi gì -> trả nguyên hồ sơ
  })
})

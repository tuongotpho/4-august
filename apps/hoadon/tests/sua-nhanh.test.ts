import { describe, expect, it } from 'vitest'
import { today } from '../src/lib/dates'
import { emptyDossier, emptyInvoice } from '../src/lib/model'
import { statusOf } from '../src/lib/status'
import { datTrangThai, trangThaiChonDuoc } from '../src/lib/suaNhanh'
import { DEFAULT_SETTINGS as S } from '../src/lib/types'

const hs = (p: Partial<ReturnType<typeof emptyDossier>> = {}) => ({
  ...emptyDossier(), invoices: [{ ...emptyInvoice(), soHd: '1', ngayHd: '2026-09-28', tongTien: 1 }], ...p,
})

describe('đổi trạng thái nhanh', () => {
  it('tiến bước: điền ngày còn trống, giữ ngày đã có', () => {
    const { moi, xoa } = datTrangThai(hs(), 'choNop', S)
    expect(moi).toMatchObject({ ngayToTrinh: '2026-09-24' })
    expect(moi.ngayDntt).toBeTruthy()
    expect(statusOf(moi)).toBe('choNop')
    expect(xoa).toEqual([])
    const r = datTrangThai(hs({ ngayToTrinh: '2026-09-20', ngayDntt: '2026-10-01' }), 'daTt', S).moi
    expect(r).toMatchObject({ ngayToTrinh: '2026-09-20', ngayDntt: '2026-10-01', ngayKeToanTt: today() })
  })
  it('lùi bước: xoá ngày bước sau và báo tên ngày bị xoá', () => {
    const d = hs({ ngayToTrinh: '2026-09-24', ngayDntt: '2026-10-01', ngayNopKeToan: '2026-10-02', ngayKeToanTt: '2026-10-10' })
    const { moi, xoa } = datTrangThai(d, 'choLamHs', S)
    expect(statusOf(moi)).toBe('choLamHs')
    expect(moi.ngayToTrinh).toBe('2026-09-24')
    expect(xoa).toEqual(['ngày kế toán thanh toán', 'ngày nộp kế toán', 'ngày ĐNTT'])
  })
  it('chọn đúng trạng thái đang có thì không đổi gì', () => {
    const d = hs({ ngayToTrinh: '2026-09-24', ngayDntt: '2026-10-01' })
    expect(datTrangThai(d, 'choNop', S).moi).toBe(d)
  })
  it('hóa đơn cũ: chỉ chưa / đã thanh toán, không tự điền ngày nộp', () => {
    const d = hs({ hoSoCu: true, ngayKeToanTt: '2026-10-10' })
    expect(trangThaiChonDuoc(d)).toEqual(['choKt', 'daTt'])
    const { moi } = datTrangThai(d, 'choKt', S)
    expect(moi).toMatchObject({ ngayKeToanTt: '', ngayNopKeToan: '' })
  })
})

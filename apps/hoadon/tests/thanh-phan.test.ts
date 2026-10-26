import { describe, expect, it } from 'vitest'
import { emptyDossier, emptyInvoice } from '../src/lib/model'
import { boThanhPhanCu, themVao, timBo, tomTat } from '../src/lib/thanhPhan'

const hs = (ngayHd: string, noiDung: string, thanhPhan: { donVi: string; soNguoi: number }[]) => ({
  ...emptyDossier(), noiDung, thanhPhan, invoices: [{ ...emptyInvoice(), ngayHd }],
})
const a = hs('2026-07-10', 'Làm việc với Điện lực Hưng Yên', [{ donVi: 'Phòng KTAT', soNguoi: 3 }, { donVi: 'Điện lực Hưng Yên', soNguoi: 4 }])
const b = hs('2026-09-01', 'Họp đề tài', [{ donVi: 'Phòng KTAT', soNguoi: 2 }])
// y hệt bộ của a (khác dấu cách / hoa thường) -> gộp; hồ sơ này mới hơn
const c = hs('2026-10-05', 'Lần 2 đi Hưng Yên', [{ donVi: 'phòng  KTAT ', soNguoi: 3 }, { donVi: 'Điện lực hưng yên', soNguoi: 4 }])
const trong = hs('2026-10-20', 'Chưa có thành phần', [{ donVi: ' ', soNguoi: 1 }])

describe('bộ thành phần cũ', () => {
  const ds = boThanhPhanCu([a, b, c, trong])
  it('gộp bộ trùng, bỏ bộ trống, gần nhất trước', () => {
    expect(ds.map((x) => [x.hoSo.noiDung, x.soLan, x.tongNguoi])).toEqual([
      ['Lần 2 đi Hưng Yên', 2, 7],
      ['Họp đề tài', 1, 2],
    ])
  })
  it('bỏ hồ sơ đang mở', () => {
    expect(boThanhPhanCu([a, b], a.id).map((x) => x.hoSo.id)).toEqual([b.id])
  })
  it('tìm không dấu theo đơn vị hoặc nội dung', () => {
    expect(timBo(ds, 'hung yen').map((x) => x.soLan)).toEqual([2])
    expect(timBo(ds, 'de tai')).toHaveLength(1)
    expect(timBo(ds, 'ktat')).toHaveLength(2)
    expect(timBo(ds, 'xyz')).toEqual([])
  })
  it('thêm vào: giữ đơn vị đang có, chỉ thêm đơn vị mới', () => {
    expect(themVao([{ donVi: 'Phòng KTAT', soNguoi: 5 }], a.thanhPhan)).toEqual([
      { donVi: 'Phòng KTAT', soNguoi: 5 },
      { donVi: 'Điện lực Hưng Yên', soNguoi: 4 },
    ])
    expect(tomTat(a.thanhPhan)).toBe('Phòng KTAT 3, Điện lực Hưng Yên 4')
  })
})

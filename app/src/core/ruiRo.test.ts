import { describe, expect, it } from 'vitest'
import { khoTrong, napHoaDon } from './kho.js'
import { bangRuiRo, docDsRuiRo, giaiNenDs, gopDsRuiRo, soiRuiRo, traMst, type DsRuiRo } from './ruiRo.js'
import type { HoaDon } from './types.js'

const CTY = '2600000001'
const NCC_XAU = '0101234567' // giả: nằm trong danh sách rủi ro
const NCC_TOT = '0109999999'
const KHACH_XAU = '0301112223'

const hd = (h: Partial<HoaDon>): HoaDon => ({
  loai: 'mua', kyHieuMau: '1', kyHieu: 'C25TAA', so: '1', ngay: '15/05/2025',
  mstBan: NCC_TOT, tenBan: 'NCC tốt', mstMua: CTY, tenMua: 'Cty mình',
  chuaThue: 100_000_000, thue: 8_000_000, trangThai: 'Hóa đơn mới', file: 'x.xlsx', ...h,
})

const ds: DsRuiRo = {
  cacFile: [{ ten: 'T6.2026.xlsx', napLuc: 1, soDong: 2 }],
  nhom: [{ sheet: 'Phụ lục 1', moTa: 'DANH SÁCH NNT KHÔNG HOẠT ĐỘNG TẠI ĐỊA CHỈ ĐÃ ĐĂNG KÝ' }, { sheet: 'PL 3', moTa: 'DANH SÁCH DN ĐÃ CHUYỂN CƠ QUAN CÔNG AN' }],
  dong: [
    { mst: NCC_XAU, ten: 'CTY GIẢ A', nhom: 0, soCv: '123/TB', ngayCv: '2026-06-01', bienPhap: '', trangThai: 'NNT không hoạt động tại địa chỉ đã đăng ký', ngayChuyen: '2025-05-20' },
    { mst: KHACH_XAU, ten: 'CTY GIẢ B', nhom: 1, soCv: '9/CA', ngayCv: '2026-06-02', bienPhap: 'Đã chuyển hồ sơ CA', trangThai: '', ngayChuyen: '' },
  ],
}

describe('Soi đối tác theo danh sách DN rủi ro về hoá đơn', () => {
  it('tra MST: khớp thẳng, chi nhánh khớp qua công ty mẹ, không khớp', () => {
    const b = bangRuiRo(ds)
    expect(traMst(` ${NCC_XAU} `, b)).toMatchObject({ mst: NCC_XAU, quaDonViChuQuan: false })
    expect(traMst(`${NCC_XAU}-001`, b)).toMatchObject({ mst: NCC_XAU, quaDonViChuQuan: true })
    expect(traMst(NCC_TOT, b)).toBeUndefined()
    expect(traMst(NCC_XAU, bangRuiRo(null))).toBeUndefined()
  })

  it('bắt được nhà cung cấp rủi ro: đúng hoá đơn, quý, tiền thuế; bỏ hoá đơn đã bị thay thế', () => {
    const kho = napHoaDon(khoTrong(), CTY, [
      hd({ so: '1' }), // NCC tốt
      hd({ so: '10', mstBan: NCC_XAU, tenBan: 'CTY GIẢ A', ngay: '10/05/2025', thue: 8_000_000 }), // trước ngày ngừng
      hd({ so: '11', mstBan: NCC_XAU, tenBan: 'CTY GIẢ A', ngay: '25/05/2025', chuaThue: 50_000_000, thue: 4_000_000 }), // sau ngày ngừng
      hd({ so: '12', mstBan: NCC_XAU, tenBan: 'CTY GIẢ A', ngay: '26/05/2025', trangThai: 'Hóa đơn bị thay thế' }),
      hd({ loai: 'ban', so: '5', mstBan: CTY, mstMua: KHACH_XAU, tenMua: 'CTY GIẢ B', ngay: '01/07/2025' }),
    ])
    const kq = soiRuiRo(kho, CTY, ds)
    expect(kq).toMatchObject({ soMstDanhSach: 2, soNhaCungCap: 2, soKhachHang: 1 })
    expect(kq.doiTac.map((d) => [d.l, d.mst, d.hoaDon.map((h) => h.so), d.tongT, d.cacKy])).toEqual([
      ['mua', NCC_XAU, ['10', '11'], 12_000_000, ['2025-Q2']],
      ['ban', KHACH_XAU, ['5'], 8_000_000, ['2025-Q3']],
    ])
    expect(kq.doiTac[0].hoaDon.map((h) => h.sauNgung)).toEqual([false, true])
    expect(kq.doiTac[1].congAn).toBe(true)
    expect(kq.canhBao.map((c) => c.muc)).toEqual(['loi', 'chu_y'])
    expect(kq.canhBao[0].noiDung).toContain('Nhà cung cấp CTY GIẢ A (MST 0101234567)')
    expect(kq.canhBao[0].noiDung).toContain('thuế 12.000.000 đ')
    expect(kq.canhBao[0].noiDung).toContain('1 hoá đơn lập SAU ngày DN chuyển trạng thái không hoạt động')
    expect(kq.canhBao[1].noiDung).toContain('ĐÃ CHUYỂN HỒ SƠ SANG CÔNG AN')
  })

  it('không có danh sách / không ai dính: không cảnh báo, vẫn đếm số đối tác đã soi', () => {
    const kho = napHoaDon(khoTrong(), CTY, [hd({ so: '1' })])
    expect(soiRuiRo(kho, CTY, null)).toMatchObject({ soMstDanhSach: 0, soNhaCungCap: 1, doiTac: [], canhBao: [] })
    expect(soiRuiRo(kho, CTY, ds).canhBao).toEqual([])
  })

  it('đọc file Excel danh sách: tự dò cột theo tiêu đề, MST kiểu số mất số 0 đầu, ngày kiểu số', () => {
    const d = docDsRuiRo([
      { ten: 'Hướng dẫn', rows: [['Không có cột mã số']] },
      {
        ten: 'Phụ lục 1',
        rows: [
          ['DANH SÁCH NGƯỜI NỘP THUẾ CÓ DẤU HIỆU RỦI RO'],
          [],
          ['STT', 'MST', 'Tên người nộp thuế', 'Số thông báo', 'Ngày thông báo', 'Trạng thái', 'Ngày chuyển trạng thái'],
          [1, 101234567, 'CTY GIẢ A', '123/TB', 46174, 'Không hoạt động', '20/05/2025'],
          [2, '0301112223-001', 'CN CTY GIẢ B', '', '', '', ''],
          [3, 'abc', 'dòng rác', '', '', '', ''],
        ],
      },
    ], 'T6.2026.xlsx', 5)
    expect(d.nhom).toEqual([{ sheet: 'Phụ lục 1', moTa: 'DANH SÁCH NGƯỜI NỘP THUẾ CÓ DẤU HIỆU RỦI RO' }])
    expect(d.cacFile).toEqual([{ ten: 'T6.2026.xlsx', napLuc: 5, soDong: 2 }])
    expect(d.dong[0]).toMatchObject({ mst: '0101234567', ten: 'CTY GIẢ A', soCv: '123/TB', ngayCv: '2026-06-01', ngayChuyen: '2025-05-20' })
    expect(d.dong[1].mst).toBe('0301112223-001')
    expect(() => docDsRuiRo([{ ten: 'x', rows: [['a']] }], 'sai.xlsx')).toThrow(/MST/)
  })

  it('gộp nhiều tháng; đọc được bản cất nén gzip của app hoá đơn', async () => {
    const t7: DsRuiRo = { cacFile: [{ ten: 'T7.2026.xlsx', napLuc: 2, soDong: 1 }], nhom: [ds.nhom[0]], dong: [{ ...ds.dong[0], mst: '0105555555' }] }
    const gop = gopDsRuiRo(ds, t7)
    expect(gop.cacFile.map((f) => f.ten)).toEqual(['T6.2026.xlsx', 'T7.2026.xlsx'])
    expect(bangRuiRo(gop).size).toBe(3)
    const nen = new Uint8Array(await new Response(new Response(JSON.stringify(gop)).body!.pipeThrough(new CompressionStream('gzip'))).arrayBuffer())
    expect(nen[0]).toBe(0x1f)
    expect(await giaiNenDs(nen)).toEqual(gop)
    expect(await giaiNenDs(new TextEncoder().encode(JSON.stringify(ds)))).toEqual(ds)
  })
})

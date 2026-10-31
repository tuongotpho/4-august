import { describe, expect, it } from 'vitest'
import { docBctc, laBctc, soatBctc } from './bctc'

// File BCTC tự dựng (số liệu bịa, không phải báo cáo thật) theo đúng khung XML HTKK mẫu 402
function taoXml(o: { cuoi: Record<string, number>; dau?: Record<string, number>; kq: Record<string, number>; lc?: Record<string, number>; ma?: string }) {
  const bang = (b: Record<string, number> = {}) => Object.entries(b).map(([k, v]) => `<ct${k}>${v}</ct${k}>`).join('')
  return `<?xml version="1.0" encoding="UTF-8"?><HSoThueDTu xmlns="http://kekhaithue.gdt.gov.vn/TKhaiThue"><HSoKhaiThue id="_NODE_TO_SIGN">
<TTinChung><TTinTKhaiThue><TKhaiThue><maTKhai>${o.ma ?? '402'}</maTKhai><tenTKhai>Báo cáo tài chính (TT200/2014/TT-BTC)</tenTKhai><loaiTKhai>C</loaiTKhai><soLan>0</soLan>
<KyKKhaiThue><kieuKy>Y</kieuKy><kyKKhai>2030</kyKKhai><kyKKhaiTuNgay>01/01/2030</kyKKhaiTuNgay><kyKKhaiDenNgay>31/12/2030</kyKKhaiDenNgay></KyKKhaiThue>
<ngayLapTKhai>2031-03-20</ngayLapTKhai><nguoiKy>Người Thử</nguoiKy></TKhaiThue><NNT><mst>0100000001</mst><tenNNT>Công ty thử</tenNNT></NNT></TTinTKhaiThue></TTinChung>
<CTieuTKhaiChinh><bctcDaKiemToan>false</bctcDaKiemToan><CDKT_HoatDongLienTuc><ThuyetMinh><ct100></ct100></ThuyetMinh>
<SoCuoiNam>${bang(o.cuoi)}</SoCuoiNam><SoDauNam>${bang(o.dau)}</SoDauNam></CDKT_HoatDongLienTuc></CTieuTKhaiChinh>
<PLuc><PL_KQHDSXKD><NamNay>${bang(o.kq)}</NamNay><NamTruoc></NamTruoc></PL_KQHDSXKD>${o.lc ? `<PL_LCTTTT><NamNay>${bang(o.lc)}</NamNay><NamTruoc></NamTruoc></PL_LCTTTT>` : ''}</PLuc>
</HSoKhaiThue></HSoThueDTu>`
}

// Năm đầu hoạt động, số khớp: góp 500 triệu bằng tiền, lãi sau thuế 8 triệu
const KQ = { '01': 1_100_000, '02': 0, '10': 1_100_000, '11': 1_000_000, '20': 100_000, '21': 0, '22': 0, '25': 80_000, '26': 10_000, '30': 10_000, '31': 0, '32': 0, '40': 0, '50': 10_000, '51': 2_000, '52': 0, '60': 8_000 }
const KHOP = {
  cuoi: { '100': 520_000, '110': 450_000, '111': 450_000, '130': 40_000, '131': 40_000, '140': 30_000, '141': 30_000, '270': 520_000, '300': 12_000, '310': 12_000, '311': 10_000, '313': 2_000, '400': 508_000, '410': 508_000, '411': 500_000, '421': 8_000, '440': 520_000 },
  kq: KQ,
  // thu = 1.100.000 × 1,08 − 40.000 = 1.148.000 ; trả = (1.000.000 + 30.000) × 1,08 − 10.000 = 1.102.400 ; lương + chi khác 95.600 -> HĐKD −50.000
  lc: { '01': 1_148_000, '02': -1_102_400, '03': -80_000, '07': -15_600, '20': -50_000, '31': 500_000, '40': 500_000, '50': 450_000, '60': 0, '70': 450_000 },
}

describe('BCTC (TT200, tờ khai 402)', () => {
  it('đọc đủ 3 bảng, kỳ, người ký; mẫu khác thì bỏ qua', () => {
    const b = docBctc(taoXml(KHOP))!
    expect(b).toMatchObject({ cheDo: 'TT200', nam: '2030', tuNgay: '01/01/2030', nguoiKy: 'Người Thử', daKiemToan: false, coThuyetMinh: false })
    expect(b.cdkt.cuoi['411']).toBe(500_000)
    expect(b.cdkt.dau).toEqual({})
    expect(b.kqkd.nay['60']).toBe(8_000)
    expect(b.lctt).toMatchObject({ phuongPhap: 'trucTiep' })
    expect(laBctc('402')).toBe(true)
    expect(docBctc(taoXml({ ...KHOP, ma: '842' }))).toBeNull()
    expect(docBctc('<a>hong')).toBeNull()
  })

  it('báo cáo khớp: không có cảnh báo', () => {
    const kq = soatBctc(docBctc(taoXml(KHOP))!)
    expect(kq.filter((x) => x.muc === 'canhBao')).toEqual([])
    expect(kq[0].muc).toBe('dat')
    expect(kq.some((x) => /thuyết minh/.test(x.noiDung))).toBe(true)
  })

  it('bắt đúng các lỗi kiểu BCTC 2024 đã soát (báo cáo 19)', () => {
    // Lợi nhuận không vào 421 (nợ phải trả ép cho cân), vốn góp gộp vào tiền kinh doanh, chi phí tròn số
    const loi = {
      cuoi: { ...KHOP.cuoi, '311': 18_000, '310': 20_000, '300': 20_000, '421': 0, '410': 500_000, '400': 500_000 },
      kq: { ...KQ, '25': 80_000_000, '26': 10_000_000, '20': 100_000_000, '11': -98_900_000 + 1_000_000, '30': 10_000, '50': 10_000 },
      lc: { '01': 1_648_400, '02': -1_102_400, '03': -80_000, '07': -16_000, '20': 450_000, '31': 0, '40': 0, '50': 450_000, '60': 0, '70': 450_000 },
    }
    loi.kq['10'] = 1_100_000; loi.kq['20'] = loi.kq['10'] - loi.kq['11']
    const kq = soatBctc(docBctc(taoXml(loi))!)
    const chu = kq.map((x) => `${x.muc}: ${x.noiDung}`).join('\n')
    expect(chu).toMatch(/canhBao: Lợi nhuận sau thuế năm nay 8\.000 .*mã 421.*tăng 0/)
    expect(chu).toMatch(/canhBao: Vốn góp \(mã 411\) tăng 500\.000 .*= 0/)
    expect(chu).toMatch(/canhBao: Tiền thu bán hàng \(mã 01\) 1\.648\.400 nằm ngoài khoảng hợp lý/)
    expect(chu).toMatch(/thongTin: Số tròn triệu: Chi phí bán hàng \(mã 25\) 80\.000\.000; Chi phí quản lý doanh nghiệp \(mã 26\) 10\.000\.000/)
    expect(kq[0].muc).toBe('canhBao')
  })

  it('bắt phép cộng sai và bảng không cân', () => {
    const sai = { ...KHOP, cuoi: { ...KHOP.cuoi, '100': 521_000, '270': 521_000 } }
    const chu = soatBctc(docBctc(taoXml(sai))!).map((x) => x.noiDung).join('\n')
    expect(chu).toMatch(/mã 100 = 521\.000 nhưng cộng các mã 110, 130, 140 = 520\.000/)
    expect(chu).toMatch(/không cân: tổng tài sản 521\.000 ≠ tổng nguồn vốn 520\.000/)
  })
})

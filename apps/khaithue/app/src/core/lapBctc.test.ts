import { describe, expect, it } from 'vitest'
import { khoTrong, type Kho } from './kho'
import { soatBctc, type SoLieuBctc } from './bctc'
import { cheDoGoiY, cheDoTheoNam, lapBctc, lapBctcTheoMau, nhanDienSieuNho, thueSuatTndn, xepGiaoDich } from './lapBctc'
import { cdktTT200SangTT99, kqkdTT200SangTT99 } from './mauBctc99'

// Dữ liệu bịa để thử, không phải công ty thật
const MST = '0100000001'
const truoc2025: SoLieuBctc = {
  cheDo: 'TT200', nam: '2025', tuNgay: '01/01/2025', denNgay: '31/12/2025', ngayLap: '2026-03-30', nguoiKy: '', daKiemToan: false,
  cdkt: { cuoi: { '110': 500_000_000, '111': 500_000_000, '130': 50_000_000, '131': 50_000_000, '140': 30_000_000, '141': 30_000_000, '100': 580_000_000, '270': 580_000_000, '311': 40_000_000, '300': 40_000_000, '310': 40_000_000, '411': 500_000_000, '421': 40_000_000, '400': 540_000_000, '410': 540_000_000, '440': 580_000_000 }, dau: {} },
  kqkd: { nay: { '01': 1_000_000_000, '10': 1_000_000_000, '21': 100_000, '60': 40_000_000 }, truoc: {} },
  lctt: { phuongPhap: 'trucTiep', nay: {}, truoc: {} },
  coThuyetMinh: true,
}

function taoKho(): Kho {
  const k = khoTrong()
  k.congTy[MST] = { hoSo: { mst: MST, tenNNT: 'Công ty thử' } as never, kyNguon: '', suaTay: true }
  k.toKhaiKhac = { [MST]: { 'x': { maTKhai: '402', tenTKhai: 'BCTC', ky: '2025', loaiTKhai: 'C', soLan: 0, ngayLap: '2026-03-30', tenFile: 'a.xml', bctc: truoc2025 } } }
  k.hoaDon = {
    [MST]: {
      b1: { l: 'ban', mb: MST, mm: '0200000002', kh: 'C26TAA', so: '1', ng: '10/03/2026', ten: 'Khách A', v: 1_000_000_000, t: 80_000_000, tt: 'Hóa đơn mới' },
      b2: { l: 'ban', mb: MST, mm: '0200000002', kh: 'C26TAA', so: '2', ng: '10/04/2026', ten: 'Khách A', v: 500_000_000, t: 40_000_000, tt: 'Hóa đơn bị thay thế' },
      m1: { l: 'mua', mb: '0300000003', kh: 'C26TBB', so: '9', ng: '05/03/2026', ten: 'Nhà cung cấp B', v: 800_000_000, t: 64_000_000, tt: 'Hóa đơn mới' },
      cu: { l: 'ban', mb: MST, mm: '0200000002', kh: 'C25TAA', so: '7', ng: '10/12/2025', ten: 'Khách A', v: 9_999, t: 0, tt: 'Hóa đơn mới' },
    },
  }
  k.tncn = { [MST]: { '2026-Q1': { ct21: 30_000_000 }, '2026-Q2': { ct21: 30_000_000 }, '2026-Q3': { ct21: 30_000_000 }, '2026-Q4': { ct21: 30_000_000 } } }
  k.saoKe = {
    [MST]: {
      s1: {
        id: 's1', tenFile: 'sk.xlsx', nganHang: 'MB', soTaiKhoan: '123', tuNgay: '01/01/2026', denNgay: '31/12/2026',
        giaoDich: [
          { id: '1', ngay: '15/03/2026', vao: 0, ra: 120_000_000, noiDung: 'CHUYEN LUONG THANG 1-3', doiUng: '', soDu: 380_000_000 },
          { id: '2', ngay: '31/03/2026', vao: 50_000, ra: 0, noiDung: 'TRA LAI TIEN GUI', doiUng: '', soDu: 380_050_000 },
          { id: '3', ngay: '20/06/2026', vao: 0, ra: 10_000_000, noiDung: 'RUT TIEN MAT', doiUng: '', soDu: 370_050_000 },
          { id: '4', ngay: '20/07/2026', vao: 7_000_000, ra: 0, noiDung: 'CK KHONG RO', doiUng: '', soDu: 377_050_000 },
        ],
      },
    },
  }
  return k
}

describe('lập BCTC từ dữ liệu app', () => {
  it('chế độ theo năm và thuế suất TNDN', () => {
    expect(cheDoTheoNam(2025)).toBe('TT200')
    expect(cheDoTheoNam(2026)).toBe('TT99')
    expect(thueSuatTndn(2024, 2e9)).toBe(0.2)
    expect(thueSuatTndn(2026, 2e9)).toBe(0.15)
    expect(thueSuatTndn(2026, 9e9)).toBe(0.17)
    expect(thueSuatTndn(2026, 60e9)).toBe(0.2)
  })

  it('xếp giao dịch ngân hàng theo nội dung', () => {
    const x = (noiDung: string, vao: number, ra: number) => xepGiaoDich({ noiDung, doiUng: '', vao, ra }).ma
    expect(x('CHUYEN LUONG T3', 0, 1)).toBe('03')
    expect(x('TRA LAI TIEN GUI', 1, 0)).toBe('27')
    expect(x('RUT TIEN MAT', 0, 1)).toBe('noiBo')
    expect(x('NOP THUE TNDN NAM 2025', 0, 1)).toBe('05')
    expect(x('NOP THUE GTGT Q4', 0, 1)).toBe('07')
    expect(x('GOP VON DIEU LE', 1, 0)).toBe('31')
    expect(x('CK KHONG RO', 1, 0)).toBe('06')
  })

  it('đổi số TT200 sang mã TT99', () => {
    const d = cdktTT200SangTT99({ '270': 5, '421': 2, '313': 1, '152': 3, '410': 9, '135': 4 })
    expect(d.so).toEqual({ '280': 5, '420': 2, '314': 1, '162': 3 })
    expect(d.khongGhep).toEqual(['135'])
    expect(kqkdTT200SangTT99({ '21': 7, '22': 8, '23': 9, '60': 1 })).toEqual({ '22': 7, '23': 8, '24': 9, '60': 1 })
  })

  it('năm 2026 lập theo TT99: số đầu năm đổi mã, mỗi số có nguồn, phép cộng khớp, không ép cho cân', () => {
    const r = lapBctc(taoKho(), MST, 2026, { tonKhoCuoi: 50_000_000 })
    const b = r.bctc
    expect(b.cheDo).toBe('TT99')
    expect(b.cdkt.dau['420']).toBe(40_000_000) // 421 cũ -> 420
    expect(b.cdkt.dau['280']).toBe(580_000_000)
    expect(b.kqkd.truoc['22']).toBe(100_000) // DT tài chính 21 cũ -> 22
    // Doanh thu: chỉ hoá đơn năm 2026 còn hiệu lực
    expect(b.kqkd.nay['01']).toBe(1_000_000_000)
    // Giá vốn = tồn đầu 30tr + mua 800tr − tồn cuối 50tr
    expect(b.kqkd.nay['11']).toBe(780_000_000)
    expect(b.kqkd.nay['22']).toBe(50_000) // lãi tiền gửi nhận diện trên sao kê
    expect(b.kqkd.nay['26']).toBe(120_000_000) // lương 4 quý
    const lntt = 1_000_000_000 - 780_000_000 + 50_000 - 120_000_000
    expect(b.kqkd.nay['50']).toBe(lntt)
    expect(b.kqkd.nay['51']).toBe(Math.round(lntt * 0.15))
    expect(b.cdkt.cuoi['420']).toBe(40_000_000 + b.kqkd.nay['60'])
    expect(b.cdkt.cuoi['421']).toBeUndefined()
    expect(b.cdkt.cuoi['110']).toBe(377_050_000) // số dư sao kê cuối năm
    expect(b.lctt!.nay['03']).toBe(-120_000_000)
    expect(b.lctt!.nay['27']).toBe(50_000)
    expect(b.lctt!.nay['70']).toBe(b.lctt!.nay['60'] + b.lctt!.nay['50'])
    expect(r.chuaPhanLoai.map((x) => x.noiDung)).toEqual(['CK KHONG RO'])
    expect(r.nguon['cdkt:420'].moTa).toMatch(/tự tính/)
    expect(r.nguon['kqkd:11'].thieu).toBeUndefined()
    // Không ép cho cân: chênh lệch báo đúng số
    expect(r.chenhLech).toBe(b.cdkt.cuoi['280'] - b.cdkt.cuoi['440'])
    // Phép cộng nội bộ các bảng phải khớp (soát theo mẫu TT99)
    const loiCong = soatBctc(b).filter((x) => /nhưng cộng các mã|tính lại theo công thức/.test(x.noiDung))
    expect(loiCong).toEqual([])
  })

  it('năm 2025 vẫn lập theo TT200; thiếu dữ liệu thì liệt kê rõ', () => {
    const r = lapBctc(taoKho(), MST, 2025)
    expect(r.bctc.cheDo).toBe('TT200')
    expect(r.bctc.cdkt.cuoi['270']).toBeDefined()
    expect(r.bctc.cdkt.cuoi['421']).toBeDefined()
    expect(r.thieu.join('\n')).toMatch(/Chưa có BCTC năm 2024/)
    expect(r.thieu.join('\n')).toMatch(/tồn kho cuối năm/)
  })

  it('mẫu TT58 (doanh nghiệp siêu nhỏ): gộp thành 9 + 5 chỉ tiêu, cân, khớp lợi nhuận', () => {
    const kho = taoKho()
    const chiTiet = lapBctc(kho, MST, 2027, { tonKhoCuoi: 50_000_000 })
    const r = lapBctcTheoMau(kho, MST, 2027, 'TT58', { tonKhoCuoi: 50_000_000 })
    const c = r.bctc.cdkt.cuoi
    const k = r.bctc.kqkd.nay
    expect(r.bctc.cheDo).toBe('TT58')
    expect(r.bctc.lctt).toBeNull()
    expect(Object.keys(c).sort()).toEqual(['110', '120', '130', '140', '150', '200', '300', '310', '320', '400', '410', '420', '430', '500'])
    expect(c['200']).toBe(chiTiet.bctc.cdkt.cuoi['280'])
    expect(c['500']).toBe(chiTiet.bctc.cdkt.cuoi['440'])
    expect(c['320']).toBe(chiTiet.bctc.cdkt.cuoi['314'])
    expect(c['420']).toBe(chiTiet.bctc.cdkt.cuoi['420'])
    expect(k['20']).toBe(chiTiet.bctc.kqkd.nay['60'])
    expect(k['03']).toBe(k['01'] - k['02'])
    expect(r.chenhLech).toBe(chiTiet.chenhLech)
    expect(soatBctc(r.bctc).filter((x) => /nhưng cộng các mã|tính lại theo công thức/.test(x.noiDung))).toEqual([])
    expect(soatBctc(r.bctc).some((x) => /thuyết minh|lưu chuyển tiền tệ/.test(x.noiDung))).toBe(false)
  })

  it('nhận diện doanh nghiệp siêu nhỏ và gợi ý mẫu', () => {
    const kho = taoKho()
    kho.tncn[MST]['2027-Q1'] = { ct16: 5, ct21: 1 }
    kho.tncn[MST]['2027-Q2'] = { ct16: 5, ct21: 1 }
    const n = nhanDienSieuNho(kho, MST, 2027)
    expect(n.laoDong).toBe(5)
    expect(n.sieuNho).toBe(true)
    expect(cheDoGoiY(kho, MST, 2027)).toBe('TT58')
    expect(cheDoGoiY(kho, MST, 2026)).toBe('TT133')
    expect(cheDoGoiY(kho, MST, 2025)).toBe('TT200')
    expect(nhanDienSieuNho(taoKho(), MST, 2028).sieuNho).toBe(false) // chưa có tờ khai lao động -> không kết luận
  })

  it('mẫu TT133 (doanh nghiệp nhỏ và vừa): gộp đúng mã B01a/B02/B03-DNN, cân, phép cộng khớp', () => {
    const kho = taoKho()
    const chiTiet = lapBctc(kho, MST, 2026, { tonKhoCuoi: 50_000_000 })
    const r = lapBctcTheoMau(kho, MST, 2026, 'TT133', { tonKhoCuoi: 50_000_000 })
    const c = r.bctc.cdkt.cuoi
    const k = r.bctc.kqkd.nay
    const l = r.bctc.lctt!.nay
    expect(r.bctc.cheDo).toBe('TT133')
    expect(c['200']).toBe(chiTiet.bctc.cdkt.cuoi['280'])
    expect(c['500']).toBe(chiTiet.bctc.cdkt.cuoi['440'])
    expect(c['417']).toBe(chiTiet.bctc.cdkt.cuoi['420'])
    expect(c['313']).toBe(chiTiet.bctc.cdkt.cuoi['314'])
    expect(c['314']).toBe(chiTiet.bctc.cdkt.cuoi['315'])
    expect(c['181']).toBe(chiTiet.bctc.cdkt.cuoi['162'] ?? 0)
    expect(r.bctc.cdkt.dau['417']).toBe(40_000_000) // 421 (TT200) -> 420 (TT99) -> 417 (TT133)
    expect(k['24']).toBe((chiTiet.bctc.kqkd.nay['25'] ?? 0) + chiTiet.bctc.kqkd.nay['26'])
    expect(k['21']).toBe(chiTiet.bctc.kqkd.nay['22']) // doanh thu tài chính
    expect(k['60']).toBe(chiTiet.bctc.kqkd.nay['60'])
    expect(l['25']).toBe(50_000) // lãi tiền gửi: mã 27 -> 25
    expect(l['70']).toBe(chiTiet.bctc.lctt!.nay['70'])
    expect(r.chenhLech).toBe(chiTiet.chenhLech)
    expect(soatBctc(r.bctc).filter((x) => /nhưng cộng các mã|tính lại theo công thức/.test(x.noiDung))).toEqual([])
    expect(r.nguon['cdkt:417'].moTa).toMatch(/tự tính/)
  })
})

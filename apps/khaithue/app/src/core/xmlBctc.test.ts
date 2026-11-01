// XML BCTC theo khung HTKK. Ngoài các phép thử dưới đây, file xuất ra ghi vào .xml-ra/ để `npm run kiem-xsd` kiểm bằng .xsd của HTKK.
import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { docCayXml } from './xemHoaDon.js'
import { lapBctcTheoMau } from './lapBctc.js'
import { khoTrong } from './kho.js'
import { tenFileXmlBctc, xmlBctcTT133, xmlBctcTT58 } from './xmlBctc.js'
import type { HoSoDN } from './types.js'

const RA = path.resolve('.xml-ra')
fs.mkdirSync(RA, { recursive: true })

// Công ty bịa để thử
const DN: HoSoDN = {
  mst: '0100000001', tenNNT: 'Công ty TNHH Thử & Cộng sự', dchiNNT: 'Số 1 phố Thử', phuongXa: 'Phường Thử', maXaNNT: '', maTinhNNT: '101', tenTinhNNT: 'Hà Nội',
  dthoaiNNT: '0900000000', emailNNT: 'thu@example.com', maCQTNoiNop: '10100', tenCQTNoiNop: 'Thuế cơ sở thử', nguoiKy: 'Nguyễn Văn Thử',
}

function taoBan(mau: 'TT133' | 'TT58', nam: number) {
  const k = khoTrong()
  k.congTy[DN.mst] = { hoSo: DN, kyNguon: '', suaTay: true }
  k.hoaDon = { [DN.mst]: {
    b1: { l: 'ban', mb: DN.mst, mm: '0200000002', kh: 'C26TAA', so: '1', ng: `10/03/${nam}`, ten: 'Khách A', v: 1_000_000_000, t: 80_000_000, tt: 'Hóa đơn mới' },
    m1: { l: 'mua', mb: '0300000003', kh: 'C26TBB', so: '9', ng: `05/03/${nam}`, ten: 'NCC B', v: 800_000_000, t: 64_000_000, tt: 'Hóa đơn mới' },
  } }
  return lapBctcTheoMau(k, DN.mst, nam, mau, { tonKhoCuoi: 20_000_000 }).bctc
}

const con = (n: ReturnType<typeof docCayXml> | undefined, ...duong: string[]) => duong.reduce<ReturnType<typeof docCayXml> | undefined>((x, t) => x?.con.find((c) => c.ten === t), n)

describe('XML BCTC theo khung HTKK', () => {
  it('mẫu 683 (TT133): đầu tờ khai, đủ 47 ô B01a, 16 ô B02, 24 ô B03 trực tiếp, đúng số', () => {
    const b = taoBan('TT133', 2026)
    const xml = xmlBctcTT133(b, DN, '2027-03-25', { nguoiLapBieu: 'Người Lập' })
    fs.writeFileSync(path.join(RA, tenFileXmlBctc('TT133', b, DN.mst)), xml)
    const goc = docCayXml(xml)
    const hs = con(goc, 'HSoKhaiThue')
    const tk = con(hs, 'TTinChung', 'TTinTKhaiThue', 'TKhaiThue')
    expect(con(tk, 'maTKhai')?.chu).toBe('683')
    expect(con(tk, 'pbanTKhaiXML')?.chu).toBe('2.3.2')
    expect(con(tk, 'KyKKhaiThue', 'kieuKy')?.chu).toBe('Y')
    expect(con(tk, 'KyKKhaiThue', 'kyKKhai')?.chu).toBe('2026')
    expect(con(tk, 'KyKKhaiThue', 'kyKKhaiTuNgay')?.chu).toBe('01/01/2026')
    const chinh = con(hs, 'CTieuTKhaiChinh')
    expect(con(chinh, 'SoCuoiNam')?.con.length).toBe(47)
    expect(con(chinh, 'ThuyetMinh')?.con.length).toBe(47)
    expect(Number(con(chinh, 'SoCuoiNam', 'ct200')?.chu)).toBe(b.cdkt.cuoi['200'])
    expect(Number(con(chinh, 'SoCuoiNam', 'ct417')?.chu)).toBe(b.cdkt.cuoi['417'])
    expect(con(chinh, 'nguoiDaiDienTheoPhapLuat')?.chu).toBe('Nguyễn Văn Thử')
    expect(con(hs, 'PLuc', 'PL_KQHDSXKD', 'NamNay')?.con.length).toBe(16)
    expect(Number(con(hs, 'PLuc', 'PL_KQHDSXKD', 'NamNay', 'ct60')?.chu)).toBe(b.kqkd.nay['60'])
    expect(con(hs, 'PLuc', 'PL_LCTTTT', 'NamNay')?.con.length).toBe(24)
    expect(xml).toContain('<tenNNT>Công ty TNHH Thử &amp; Cộng sự</tenNNT>')
    expect(tenFileXmlBctc('TT133', b, DN.mst)).toBe('0100000001000-133_B01A_DNN_BCTC-01012026_31122026_VND-L00.xml')
  })

  it('mẫu 1280 (TT58): 14 ô B01-DNSN, 5 ô B02-DNSN, phần ký', () => {
    const b = taoBan('TT58', 2027)
    const xml = xmlBctcTT58(b, DN, '2028-03-25')
    fs.writeFileSync(path.join(RA, tenFileXmlBctc('TT58', b, DN.mst)), xml)
    const hs = con(docCayXml(xml), 'HSoKhaiThue')
    expect(con(hs, 'TTinChung', 'TTinTKhaiThue', 'TKhaiThue', 'maTKhai')?.chu).toBe('1280')
    const chinh = con(hs, 'CTieuTKhaiChinh')
    expect(con(chinh, 'SoCuoiNam')?.con.map((c) => c.ten)).toEqual(['ct110', 'ct120', 'ct130', 'ct140', 'ct150', 'ct200', 'ct300', 'ct310', 'ct320', 'ct400', 'ct410', 'ct420', 'ct430', 'ct500'])
    expect(Number(con(chinh, 'SoCuoiNam', 'ct500')?.chu)).toBe(b.cdkt.cuoi['500'])
    expect(con(chinh, 'PhanKy', 'thuTruongDonVi')?.chu).toBe('Nguyễn Văn Thử')
    expect(con(hs, 'PLuc', 'PL_BCKQHDKD', 'NamNay')?.con.map((c) => c.ten)).toEqual(['ct01', 'ct02', 'ct03', 'ct10', 'ct20'])
  })

  it('từ chối nhầm mẫu', () => {
    expect(() => xmlBctcTT133(taoBan('TT58', 2027), DN, '2028-01-01')).toThrow()
    expect(() => xmlBctcTT58(taoBan('TT133', 2026), DN, '2027-01-01')).toThrow()
  })
})

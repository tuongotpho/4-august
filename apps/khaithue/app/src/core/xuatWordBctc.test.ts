import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { strFromU8, unzipSync } from 'fflate'
import { dienMauWord, soBaoCao } from './xuatWordBctc'

// Hai mẫu Word của Thông tư 58/2026/TT-BTC (bản người dùng cung cấp, chép vào public/mau/bctc)
const mau = (ten: string) => new Uint8Array(readFileSync(`public/mau/bctc/${ten}`))
const xmlCua = (docx: Uint8Array) => strFromU8(unzipSync(docx)['word/document.xml'])
/** Chữ trong từng dòng bảng, các ô nối bằng " | " */
const dongBang = (xml: string) =>
  [...xml.matchAll(/<w:tr[ >][\s\S]*?<\/w:tr>/g)].map((tr) =>
    [...tr[0].matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map((tc) => [...tc[0].matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('').trim()).join(' | '))
const TT = { donVi: 'Công ty TNHH Thử & Cộng sự', diaChi: 'Số 1, phố Thử, Hà Nội', taiNgay: '31/12/2027', nam: '2027', nguoiDaiDien: 'Nguyễn Văn Thử' }

describe('xuất Word đúng mẫu B01/B02-DNSN (TT58)', () => {
  it('số kiểu báo cáo: âm trong ngoặc', () => {
    expect(soBaoCao(1234567)).toBe('1.234.567')
    expect(soBaoCao(-5000)).toBe('(5.000)')
    expect(soBaoCao(0)).toBe('0')
  })

  it('B01-DNSN: điền đủ 14 mã vào đúng cột, đầu trang, ngày, đơn vị tính, người đại diện', () => {
    const cuoi = { '110': 1_262_321_417, '120': 175_698_500, '130': 105_416_780, '140': 0, '150': 0, '200': 1_543_436_697, '300': 441_096_917, '310': 425_127_890, '320': 15_969_027, '400': 1_102_339_780, '410': 1_000_000_000, '420': 102_339_780, '430': 0, '500': 1_543_436_697 }
    const dau = { '110': 1, '120': 2, '130': 3, '140': 0, '150': 0, '200': 6, '300': 4, '310': 3, '320': 1, '400': 2, '410': 2, '420': -1, '430': 1, '500': 6 }
    const { docx, daDien } = dienMauWord(mau('B01-DNSN.docx'), cuoi, dau, TT)
    expect(daDien.sort()).toEqual(Object.keys(cuoi).sort())
    const xml = xmlCua(docx)
    const d = dongBang(xml)
    expect(d).toContain('1. Tiền | 110 | 1.262.321.417 | 1')
    expect(d).toContain('2. Lợi nhuận sau thuế chưa phân phối | 420 | 102.339.780 | (1)')
    expect(d).toContain('TỔNG CỘNG NGUỒN VỐN (500=300+400) | 500 | 1.543.436.697 | 6')
    expect(d).toContain('TÀI SẢN |  |  | ') // dòng tiêu đề nhóm giữ nguyên, không có số
    expect(xml).toContain('ĐƠN VỊ: Công ty TNHH Thử &amp; Cộng sự')
    expect(xml).toContain('Số 1, phố Thử, Hà Nội')
    expect(xml).toContain('Tại ngày 31 tháng 12 năm 2027')
    expect(xml).toContain('Đơn vị tính: Đồng Việt Nam')
    expect(xml).toContain('Nguyễn Văn Thử')
    expect(xml).not.toMatch(/ĐƠN VỊ: \.{3}/)
    // File vẫn là Word hợp lệ: đủ các phần như mẫu
    expect(Object.keys(unzipSync(docx)).sort()).toEqual(Object.keys(unzipSync(mau('B01-DNSN.docx'))).sort())
  })

  it('B02-DNSN: điền 5 mã, dòng "Năm ...." dưới tiêu đề', () => {
    const nay = { '01': 9_339_794_273, '02': 9_245_858_823, '03': 93_935_450, '10': 15_969_027, '20': 77_966_423 }
    const truoc = { '01': 2_655_000_294, '02': 2_624_533_598, '03': 30_466_696, '10': 6_093_339, '20': 24_373_357 }
    const { docx, daDien } = dienMauWord(mau('B02-DNSN.docx'), nay, truoc, TT)
    expect(daDien.sort()).toEqual(['01', '02', '03', '10', '20'])
    const xml = xmlCua(docx)
    const d = dongBang(xml)
    expect(d).toContain('1. Doanh thu và thu nhập thuần | 01 | 9.339.794.273 | 2.655.000.294')
    expect(d).toContain('5. Lợi nhuận sau thuế TNDN {(20) = (03)-( 10)} | 20 | 77.966.423 | 24.373.357')
    expect(xml).toContain('Năm 2027')
    expect(d.some((x) => x.startsWith('Chỉ tiêu | Mãsố | NămNay | Năm trước'))).toBe(true) // tiêu đề cột không bị đụng
  })

  it('file không phải Word thì báo lỗi rõ', () => {
    expect(() => dienMauWord(new Uint8Array([1, 2, 3]), {}, {}, TT)).toThrow()
  })
})

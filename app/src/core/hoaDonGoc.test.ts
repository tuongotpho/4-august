import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { zipSync } from 'fflate'
import { docPdfGoc, docXmlGoc, kiemHoaDon, nhomHoaDon, phanLoaiDong, tongHopGoc, canhBaoGoc, type HoaDonGoc } from './hoaDonGoc.js'
import { khoTrong, napGoc, napHoaDon, napToKhai } from './kho.js'
import { moZip } from './nenZip.js'
import type { HoaDon, HoSoDN } from './types.js'

const CTY = '2601102955'
const NCC = '2601066601'

const xmlHD = (o: { so?: string; ngay?: string; mccqt?: string; kyBan?: boolean; them?: string } = {}) => `<?xml version="1.0" encoding="UTF-8"?>
<HDon><DLHDon Id="x"><TTChung><PBan>2.0.1</PBan><KHMSHDon>1</KHMSHDon><KHHDon>C24TNA</KHHDon><SHDon>${o.so ?? '18'}</SHDon><NLap>${o.ngay ?? '2024-12-03'}</NLap>${o.them ?? ''}</TTChung>
<NDHDon><NBan><Ten>CÔNG TY TNHH THƯƠNG MẠI NGA ANH PHÚ THỌ</Ten><MST>${CTY}</MST></NBan><NMua><Ten>CÔNG TY TNHH MTV RENTECH &amp; CO</Ten><MST>2600835029</MST></NMua>
<DSHHDVu><HHDVu><TChat>1</TChat><STT>1</STT><THHDVu>Ván vỏ băm</THHDVu><DVTinh>tấn</DVTinh><SLuong>63.81</SLuong><DGia>651089</DGia><ThTien>41545989</ThTien><TSuat>8%</TSuat></HHDVu>
<HHDVu><TChat>4</TChat><THHDVu>Ghi chú: giao tại kho</THHDVu></HHDVu></DSHHDVu>
<TToan><TgTCThue>41545989</TgTCThue><TgTThue>3323679</TgTThue><TgTTTBSo>44869668</TgTTTBSo></TToan></NDHDon></DLHDon>
${o.mccqt === '' ? '' : `<MCCQT Id="Id-1">${o.mccqt ?? '00A4F8E23213A34BFF952279A439BA5B24'}</MCCQT>`}
<DSCKS>${o.kyBan === false ? '' : '<NBan><Signature xmlns="http://www.w3.org/2000/09/xmldsig#" Id="seller"><Object><SignatureProperties><SignatureProperty><SigningTime>2024-12-03T12:51:52</SigningTime></SignatureProperty></SignatureProperties></Object></Signature></NBan>'}</DSCKS></HDon>`

// Ba mẫu PDF gặp trong 230 hoá đơn thật năm 2025 (chữ đã ghép dòng như pdfjs trả về)
const PDF_CHUYEN_DOI = [
  'HÓA ĐƠN GIÁ TRỊ GIA TĂNG', 'Ký hiệu : 1C25TKL', 'HÓA ĐƠN CHUYỂN ĐỔI TỪ HÓA ĐƠN ĐIỆN TỬ', 'Số : 64', 'Ngày 21 tháng 03 năm 2025',
  'Đơn vị bán hàng : CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ BẢO KHÁNH LINH', `Mã số thuế : ${NCC}`, 'Địa chỉ : Việt Trì', 'Họ tên người mua hàng :',
  'Tên đơn vị : CÔNG TY TNHH THƯƠNG MẠI NGA ANH PHÚ THỌ', 'Địa chỉ : Việt Trì', `Mã số thuế : ${CTY}`,
  'STT Tên hàng hóa, dịch vụ Đơn vị tính Số lượng Đơn giá Thành tiền', '1 Viên nén gỗ Tấn 40,83 2.250.000 91.867.500',
  'Cộng tiền hàng : 91.867.500', 'Thuế suất GTGT : 8% Tiền thuế GTGT : 7.349.400', 'Tổng cộng tiền thanh toán : 99.216.900',
  'Signature valid', 'Được ký bởi: CÔNG TY TNHH THƯƠNG', 'Ngày ký: 21 / 03 / 2025',
]
const PDF_TEN_TRAN_DONG = [
  'HÓA ĐƠN GIÁ TRỊ GIA TĂNG', 'Ký hiệu (Serial): 1C25TMV', 'Số (No.): 00000001', 'Ngày (date) 01 tháng (month) 01 năm (year) 2025',
  'Đơn vị bán hàng: CÔNG TY TNHH XÂY DỰNG THƯƠNG MẠI MẠNH VINH', 'Mã số thuế: 2600937045', 'Họ tên người mua:',
  'Đơn vị mua hàng: CÔNG TY TNHH THƯƠNG MẠI NGA ANH PHÚ THỌ', `Mã số thuế: ${CTY} Điện thoại:`,
  'STT Tên hàng hóa, dịch vụ Số lượng Đơn giá Thành tiền', 'Cước vận chuyển viên nén gỗ từ Hạ Hòa về Supe, Lâm', '1 Tấn 32,375 130.000 4.208.750', 'Thao, Phú Thọ',
  'Tổng cộng tiền hàng hóa, dịch vụ 4.208.750', 'Tiền thuế GTGT 8% 336.700', 'Tổng tiền thanh toán 4.545.450',
  'Ký bởi : TỔNG CỤC THUẾ Ký bởi : CÔNG TY TNHH XÂY DỰNG', 'Ký ngày : 01/01/2025 18:49:52 THƯƠNG MẠI MẠNH VINH',
]
const PDF_TONG_KHONG_HAI_CHAM = [
  'HÓA ĐƠN GIÁ TRỊ GIA TĂNG', 'Ký hiệu: 1C25THT', 'Số: 371700', 'Ngày 01 tháng 04 năm 2025', 'Tên người bán: Công ty TNHH Thương Mại Tổng hợp HTV',
  'Mã số thuế: 0108075931', 'Tên người mua: CÔNG TY TNHH THƯƠNG MẠI NGA ANH PHÚ THỌ', `Mã số thuế: ${CTY}`,
  'Thuế suất Tổng tiền chưa thuế Tổng tiền thuế Tổng tiền chưa thuế 9.627.273', '(Tổng cộng thành tiền', 'Tổng tiền thuế (Tổng 962.727', 'cộng tiền thuế)',
  'Tổng tiền thanh toán 10.590.000',
]

describe('Hoá đơn gốc: đọc XML', () => {
  it('phần đầu + dòng hàng (bỏ dòng ghi chú) + mã CQT + chữ ký + ngày ký', () => {
    const h = docXmlGoc(xmlHD(), 'C24TNA18.xml')!
    expect(h).toMatchObject({
      nguon: 'xml', kyHieuMau: '1', kyHieu: 'C24TNA', so: '18', ngay: '03/12/2024', mstBan: CTY, mstMua: '2600835029', tenMua: 'CÔNG TY TNHH MTV RENTECH & CO',
      chuaThue: 41545989, thue: 3323679, tong: 44869668, mccqt: '00A4F8E23213A34BFF952279A439BA5B24', kyBan: true, ngayKy: '03/12/2024', lienQuan: null,
    })
    expect(h.dong).toEqual([{ ten: 'Ván vỏ băm', dvt: 'tấn', sl: 63.81, dg: 651089, tt: 41545989, ts: '8%' }])
    expect(docXmlGoc('<ToKhai/>')).toBeNull()
  })
  it('hoá đơn thay thế: đọc hoá đơn bị thay', () => {
    const h = docXmlGoc(xmlHD({ them: '<TTHDLQuan><TCHDon>1</TCHDon><KHMSHDCLQuan>1</KHMSHDCLQuan><KHHDCLQuan>C24TNA</KHHDCLQuan><SHDCLQuan>00000017</SHDCLQuan><NLHDCLQuan>2024-11-30</NLHDCLQuan></TTHDLQuan>' }))!
    expect(h.lienQuan).toEqual({ loai: 'thayThe', kyHieu: 'C24TNA', so: '17', ngay: '30/11/2024' })
  })
})

describe('Hoá đơn gốc: đọc PDF (3 mẫu thật)', () => {
  it('bản chuyển đổi (Bảo Khánh Linh): dấu " : ", ngày ký có dấu cách, số lượng lẻ', () => {
    expect(docPdfGoc(PDF_CHUYEN_DOI, 'bkl.pdf')).toMatchObject({
      nguon: 'pdf', kyHieuMau: '1', kyHieu: 'C25TKL', so: '64', ngay: '21/03/2025', mstBan: NCC, mstMua: CTY, tenBan: 'CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ BẢO KHÁNH LINH',
      tenMua: 'CÔNG TY TNHH THƯƠNG MẠI NGA ANH PHÚ THỌ', chuaThue: 91867500, thue: 7349400, tong: 99216900, kyBan: true, ngayKy: '21/03/2025',
      dong: [{ ten: 'Viên nén gỗ', dvt: 'Tấn', sl: 40.83, dg: 2250000, tt: 91867500, ts: '' }],
    })
  })
  it('tên hàng tràn dòng trên + dưới (Mạnh Vinh), không bắt nhầm "18/01" thành "8/01"', () => {
    const h = docPdfGoc(PDF_TEN_TRAN_DONG, 'mv.pdf')!
    expect(h).toMatchObject({ kyHieu: 'C25TMV', so: '1', ngay: '01/01/2025', mstBan: '2600937045', mstMua: CTY, chuaThue: 4208750, thue: 336700, tong: 4545450, ngayKy: '01/01/2025' })
    expect(h.dong).toEqual([{ ten: 'Cước vận chuyển viên nén gỗ từ Hạ Hòa về Supe, Lâm Thao, Phú Thọ', dvt: 'Tấn', sl: 32.375, dg: 130000, tt: 4208750, ts: '' }])
    expect(nhomHoaDon(h, CTY)).toBe('vanChuyen')
  })
  it('nhãn tổng không có dấu hai chấm, lẫn trong dòng tiêu đề (HTV)', () => {
    expect(docPdfGoc(PDF_TONG_KHONG_HAI_CHAM, 'htv.pdf')).toMatchObject({ so: '371700', chuaThue: 9627273, thue: 962727, tong: 10590000 })
  })
  it('bản nháp / không đủ thông tin -> null', () => {
    expect(docPdfGoc(['HÓA ĐƠN', 'Số : <Chưa cấp số>', 'Ngày 01 tháng 01 năm 2025'])).toBeNull()
    expect(docPdfGoc(['TỜ KHAI THUẾ GIÁ TRỊ GIA TĂNG', 'Kỳ tính thuế: Quý 2 năm 2024'])).toBeNull()
  })
})

describe('Phân loại, kiểm tra, so với danh sách cổng thuế', () => {
  it('phân loại theo tên hàng (không phân biệt dấu); cước đứng trước viên nén', () => {
    expect(phanLoaiDong('VIEN NEN GO')).toBe('vienNen')
    expect(phanLoaiDong('Cước vận chuyển viên nén gỗ')).toBe('vanChuyen')
    expect(phanLoaiDong('Bút bi')).toBe('khac')
  })
  it('rơ-le: XML ký hiệu C thiếu mã CQT, thiếu chữ ký, ngày ký khác ngày lập, HĐ mua từ 5 triệu sau 01/07/2025', () => {
    const thieu = kiemHoaDon(docXmlGoc(xmlHD({ mccqt: '', kyBan: false, ngay: '2024-12-05' }))!, CTY).map((c) => c.noiDung)
    expect(thieu).toEqual([
      expect.stringContaining('là hoá đơn có mã của CQT nhưng XML không có mã'),
      expect.stringContaining('không có chữ ký số của người bán'),
    ])
    const tre = kiemHoaDon(docXmlGoc(xmlHD({ ngay: '2024-12-05' }))!, CTY).map((c) => c.noiDung)
    expect(tre).toEqual([expect.stringContaining('ngày ký 03/12/2024 khác ngày lập 05/12/2024')])
    const mua: HoaDonGoc = { ...docPdfGoc(PDF_CHUYEN_DOI)!, ngay: '21/08/2025', ngayKy: '21/08/2025' }
    expect(kiemHoaDon(mua, CTY).map((c) => c.noiDung)).toEqual([expect.stringContaining('từ 5 triệu')])
    expect(kiemHoaDon(docPdfGoc(PDF_CHUYEN_DOI)!, CTY)).toEqual([]) // trước 01/07/2025, PDF không in mã -> không báo
  })
  it('so khớp: có gốc / thiếu gốc / lệch tiền / gốc không có trong Excel; số tấn theo quý; bỏ HĐ bị thay thế', () => {
    const HS = { mst: CTY, tenNNT: 'Nga Anh' } as HoSoDN
    let kho = napToKhai(khoTrong(), { maTKhai: '842', loaiTKhai: 'C', soLan: 0, ngayLap: '', ky: { quy: 1, nam: 2025 }, hoSo: HS, ct: {}, plMua: [], plBan: [], ct9: null }, 'q1.xml').kho
    const ex = (h: Partial<HoaDon>): HoaDon => ({ loai: 'mua', kyHieuMau: '1', kyHieu: 'C25TKL', so: '64', ngay: '21/03/2025', mstBan: NCC, tenBan: 'BKL', mstMua: CTY, tenMua: '', chuaThue: 91867500, thue: 7349400, trangThai: 'Hóa đơn mới', file: 'x.xlsx', ...h })
    kho = napHoaDon(kho, CTY, [
      ex({}),
      ex({ kyHieu: 'C25TMV', so: '1', mstBan: '2600937045', chuaThue: 4208750, thue: 336701 }), // lệch 1 đồng thuế -> không tính lệch (sai số làm tròn)
      ex({ kyHieu: 'C25TKL', so: '65', chuaThue: 50000000, thue: 4000000 }), // chưa có file gốc
      ex({ kyHieu: 'C25THT', so: '371700', mstBan: '0108075931', chuaThue: 9600000, thue: 962727 }), // lệch tiền
    ])
    for (const l of [PDF_CHUYEN_DOI, PDF_TEN_TRAN_DONG, PDF_TONG_KHONG_HAI_CHAM]) kho = napGoc(kho, docPdfGoc(l, 'f.pdf')!).kho
    const xa = docPdfGoc(PDF_CHUYEN_DOI)!
    kho = napGoc(kho, { ...xa, so: '99', tenFile: 'la.pdf' }).kho // không có trong Excel
    const t = tongHopGoc(kho, CTY)
    expect(t.soKhop).toMatchObject({ soExcel: 4, soCoGoc: 3 })
    expect(t.soKhop.thieuGoc.map((x) => x.so)).toEqual(['65'])
    expect(t.soKhop.lechTien.map((x) => [x.so, x.excelV, x.gocV])).toEqual([['371700', 9600000, 9627273]])
    expect(t.soKhop.khongCoTrongExcel.map((x) => x.so)).toEqual(['99'])
    const q1 = t.theoQuy.find((q) => q.khoa === '2025-Q1')!
    expect(q1.muaVienNen).toEqual({ tấn: 81.66 }) // 2 hoá đơn BKL x 40,83 tấn (số 64 và 99)
    expect(q1.tienVanChuyen).toBe(4208750)
    expect(canhBaoGoc(t).map((c) => c.muc)).toEqual(['loi', 'chu_y'])
    // HĐ 64 bị thay thế theo cổng thuế -> không tính tấn nữa
    kho = napHoaDon(kho, CTY, [ex({ trangThai: 'Hóa đơn bị thay thế' })])
    expect(tongHopGoc(kho, CTY).theoQuy.find((q) => q.khoa === '2025-Q1')!.muaVienNen).toEqual({ tấn: 40.83 })
  })
  it('nạp hoá đơn gốc của công ty chưa biết -> báo, không nạp', () => {
    expect(napGoc(khoTrong(), docPdfGoc(PDF_CHUYEN_DOI)!).loi).toBe(true)
  })
  it('mở ZIP (cả ZIP lồng trong ZIP), bỏ file không đọc được', () => {
    const trong = zipSync({ 'b.pdf': new Uint8Array([3]) })
    const ngoai = zipSync({ 'thu muc/a.xml': new Uint8Array([1]), 'ghi chu.txt': new Uint8Array([2]), 'con.zip': trong, '__MACOSX/x.pdf': new Uint8Array([9]) })
    expect(moZip(ngoai).map((t) => t.ten).sort()).toEqual(['con.zip/b.pdf', 'thu muc/a.xml'])
  })
})

// Dữ liệu thật trên máy người dùng (không có thì bỏ qua): hoá đơn XML + PDF năm 2024 so với Excel cổng thuế
const FILE_CA = path.resolve(__dirname, '../../../du-lieu-rieng/doi-chieu.json')
const goc = fs.existsSync(FILE_CA) ? (JSON.parse(fs.readFileSync(FILE_CA, 'utf8')) as { goc: string }).goc : ''
describe.skipIf(!goc || !fs.existsSync(path.join(goc, '2024')))('Hoá đơn gốc thật năm 2024', () => {
  it('đọc PDF + XML thật: đủ thông tin, khớp đúng tiền với danh sách cổng thuế', async () => {
    const { pdfThanhDong } = await import('../../mcp/pdfChu.js')
    const { docCauHinh, napDuLieu } = await import('../../mcp/nguon.js')
    const d = napDuLieu(docCauHinh())
    const tim = (p: string): string[] => fs.readdirSync(p, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? tim(path.join(p, e.name)) : [path.join(p, e.name)]))
    let kho = d.kho
    let doc = 0
    for (const f of tim(path.join(goc, '2024')).filter((x) => /\.(pdf|xml)$/i.test(x))) {
      const h = /\.xml$/i.test(f) ? docXmlGoc(fs.readFileSync(f, 'utf8'), path.basename(f)) : docPdfGoc(await pdfThanhDong(new Uint8Array(fs.readFileSync(f))), path.basename(f))
      if (!h) continue
      const r = napGoc(kho, h)
      if (!r.loi) {
        kho = r.kho
        doc++
      }
    }
    const t = tongHopGoc(kho, d.kho.chon!)
    expect(doc).toBeGreaterThanOrEqual(140)
    expect(t.soKhop.soCoGoc).toBeGreaterThanOrEqual(60)
    expect(t.soKhop.lechTien).toEqual([])
  }, 120_000)
})

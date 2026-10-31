import { describe, expect, it } from 'vitest'
import { zipSync, strToU8 } from 'fflate'
import { checkInvoice, chieuHoaDon, docCayXml, khoaCuaGoc, khoaCuaXem, khoaHoaDon, parseInvoice, tachTrung } from './xemHoaDon.js'
import { docXmlGoc } from './hoaDonGoc.js'
import { moZip } from './nenZip.js'

// Dữ liệu GIẢ (MST, tên, tiền tự đặt) — không dùng hoá đơn thật
const BAN = '0109999991'
const MUA = '0108888882'

const chuKy = (ai: string, ten: string, luc: string) =>
  `<${ai}><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="${ai}"><ds:SignatureValue>QUJD</ds:SignatureValue><ds:KeyInfo><ds:X509Data><ds:X509SubjectName>CN=${ten},O=Thu,C=VN</ds:X509SubjectName></ds:X509Data></ds:KeyInfo><ds:Object><ds:SignatureProperties><ds:SignatureProperty><SigningTime>${luc}</SigningTime></ds:SignatureProperty></ds:SignatureProperties></ds:Object></ds:Signature></${ai}>`

interface Mau { so?: string; kh?: string; dong?: string; toan?: string; mccqt?: string | null; kyBan?: boolean; them?: string; tienTe?: string }
const xmlHD = (o: Mau = {}) => `﻿<?xml version="1.0" encoding="UTF-8"?>
<!-- hoá đơn thử -->
<HDon><DLHDon Id="d1"><TTChung><PBan>2.1.0</PBan><THDon>Hóa đơn giá trị gia tăng</THDon><KHMSHDon>1</KHMSHDon><KHHDon>${o.kh ?? 'C26TAA'}</KHHDon><SHDon>${o.so ?? '00000017'}</SHDon><NLap>2026-10-08</NLap><DVTTe>${o.tienTe ?? 'VND'}</DVTTe><TGia>1.00</TGia><HTTToan>TM/CK</HTTToan>${o.them ?? ''}
<TTKhac><TTin><TTruong>Trạng thái thanh toán</TTruong><KDLieu>string</KDLieu><DLieu>Đã thanh toán</DLieu></TTin><TTin><TTruong>Ghi chú</TTruong><DLieu/></TTin></TTKhac></TTChung>
<NDHDon><NBan><Ten>CÔNG TY THỬ BÁN &amp; CO</Ten><MST>${BAN}</MST><DChi>Số 1, Phường A</DChi><STKNHang>123</STKNHang><TNHang>NH Thử</TNHang><TTKhac/></NBan>
<NMua><Ten>CÔNG TY THỬ MUA</Ten><MST>${MUA}</MST><DChi>Số 2</DChi></NMua>
<DSHHDVu>${o.dong ?? `<HHDVu><TChat>1</TChat><STT>1</STT><THHDVu>Viên nén gỗ</THHDVu><DVTinh>Tấn</DVTinh><SLuong>10.5</SLuong><DGia>2000000</DGia><ThTien>21000000</ThTien><TSuat>8%</TSuat></HHDVu>
<HHDVu><TChat>3</TChat><STT>2</STT><THHDVu>Chiết khấu</THHDVu><ThTien>1000000</ThTien><TSuat>8%</TSuat></HHDVu>
<HHDVu><TChat>4</TChat><THHDVu>Giao tại kho</THHDVu></HHDVu>`}</DSHHDVu>
<TToan>${o.toan ?? '<THTTLTSuat><LTSuat><TSuat>8%</TSuat><ThTien>20000000</ThTien><TThue>1600000</TThue></LTSuat></THTTLTSuat><TgTCThue>20000000</TgTCThue><TgTThue>1600000</TgTThue><TgTTTBSo>21600000</TgTTTBSo><TgTTTBChu>Hai mươi mốt triệu sáu trăm nghìn đồng</TgTTTBChu>'}</TToan></NDHDon></DLHDon>
${o.mccqt === null ? '' : `<MCCQT Id="m">${o.mccqt ?? '00ABCDEF0123456789ABCDEF0123456789'}</MCCQT>`}
<DSCKS>${o.kyBan === false ? '' : chuKy('NBan', 'CÔNG TY THỬ BÁN', '2026-10-08T09:15:00')}${chuKy('CQT', 'CỤC THUẾ', '2026-10-08T09:16:00')}<NMua/></DSCKS></HDon>`

describe('Bộ đọc XML tối giản', () => {
  it('bỏ BOM, khai báo, chú thích; giải mã &amp; &#x41; &#66;; CDATA; tiền tố namespace', () => {
    const n = docCayXml('﻿<?xml version="1.0"?><!-- x --><a:Goc t="1 &amp; 2"><b>A &amp; &#x41;&#66;</b><c><![CDATA[<y>]]></c><d/></a:Goc>')
    expect(n.ten).toBe('Goc')
    expect(n.thuocTinh.t).toBe('1 & 2')
    expect(n.con.map((c) => c.ten)).toEqual(['b', 'c', 'd'])
    expect(n.con[0].chu).toBe('A & AB')
    expect(n.con[1].chu).toBe('<y>')
  })
  it('thuộc tính có dấu ">" trong ngoặc kép không làm lệch', () => {
    expect(docCayXml('<a x="1>2"><b/></a>').con[0].ten).toBe('b')
  })
  it.each([
    ['thẻ không đóng', '<a><b></a>'],
    ['thiếu thẻ đóng gốc', '<a><b></b>'],
    ['rỗng', ''],
    ['chữ ngoài thẻ gốc', 'xin chào'],
    ['hai thẻ gốc', '<a/><b/>'],
    ['cắt cụt giữa thẻ', '<a><b x="1'],
  ])('file hỏng (%s) -> báo lỗi', (_, xml) => {
    expect(() => docCayXml(xml)).toThrow('File XML bị hỏng')
  })
})

describe('parseInvoice: đọc hoá đơn để xem như bản in', () => {
  it('đọc đủ phần đầu, hai bên, dòng hàng, thuế suất, tổng, mã CQT, chữ ký', () => {
    const h = parseInvoice(xmlHD(), 'a.xml')
    expect(h).toMatchObject({
      tenFile: 'a.xml', loai: 'Hóa đơn giá trị gia tăng', mau: '1', kyHieu: 'C26TAA', so: '00000017', ngay: '2026-10-08', pban: '2.1.0',
      tienTe: 'VND', httt: 'TM/CK', tongTruocThue: 20_000_000, tongThue: 1_600_000, tong: 21_600_000,
      bangChu: 'Hai mươi mốt triệu sáu trăm nghìn đồng', mccqt: '00ABCDEF0123456789ABCDEF0123456789',
    })
    expect(h.ban?.o).toMatchObject({ Ten: 'CÔNG TY THỬ BÁN & CO', MST: BAN, STKNHang: '123' })
    expect(h.mua?.o.MST).toBe(MUA)
    expect(h.dong).toHaveLength(3)
    expect(h.dong[0]).toMatchObject({ ten: 'Viên nén gỗ', dvt: 'Tấn', sl: 10.5, dg: 2_000_000, tien: 21_000_000, ts: '8%' })
    expect(h.thueSuat).toEqual([{ ts: '8%', tien: 20_000_000, thue: 1_600_000 }])
    expect(h.khacChung).toEqual([{ k: 'Trạng thái thanh toán', v: 'Đã thanh toán' }]) // ô trống bị bỏ
    expect(h.kyBan).toEqual({ ten: 'CÔNG TY THỬ BÁN', chuThe: 'CN=CÔNG TY THỬ BÁN,O=Thu,C=VN', luc: '2026-10-08T09:15:00' })
    expect(h.kyCqt?.ten).toBe('CỤC THUẾ')
    expect(h.kyMua).toBeNull() // thẻ <NMua/> rỗng = không ký
  })
  it('hoá đơn khớp số học: dòng chiết khấu (TChat 3) trừ đi, dòng ghi chú (TChat 4) bỏ qua', () => {
    expect(parseInvoice(xmlHD()).kiem).toEqual([{ muc: 'dat', noiDung: 'Các phép cộng tiền hàng, thuế, tổng thanh toán khớp nhau.' }])
  })
  it('lệch cộng dòng / lệch thuế / lệch tổng -> cảnh báo từng loại', () => {
    const h = parseInvoice(xmlHD({ toan: '<THTTLTSuat><LTSuat><TSuat>8%</TSuat><TThue>1500000</TThue></LTSuat></THTTLTSuat><TgTCThue>20500000</TgTCThue><TgTThue>1600000</TgTThue><TgTTTBSo>22000000</TgTTTBSo>' }))
    const cb = h.kiem.filter((x) => x.muc === 'canhBao').map((x) => x.noiDung)
    expect(cb).toHaveLength(3)
    expect(cb[0]).toMatch(/Cộng các dòng hàng = 20\.000\.000.*20\.500\.000/)
    expect(cb[1]).toMatch(/Cộng thuế theo từng thuế suất = 1\.500\.000/)
    expect(cb[2]).toMatch(/Tổng tiền thanh toán" = 22\.000\.000/)
    expect(h.kiem.some((x) => x.muc === 'dat')).toBe(false)
  })
  it('lệch 1 đồng do làm tròn: không báo', () => {
    const h = parseInvoice(xmlHD({ toan: '<TgTCThue>20000000</TgTCThue><TgTThue>1600001</TgTThue><TgTTTBSo>21600000</TgTTTBSo>' }))
    expect(h.kiem[0].muc).toBe('dat')
  })
  it('có phí và chiết khấu thương mại toàn hoá đơn', () => {
    const toan = '<DSLPhi><LPhi><TLPhi>Phí môi trường</TLPhi><TPhi>100000</TPhi></LPhi></DSLPhi><TgTCThue>20000000</TgTCThue><TgTThue>1600000</TgTThue><TTCKTMai>50000</TTCKTMai><TgTTTBSo>21650000</TgTTTBSo>'
    const h = parseInvoice(xmlHD({ toan }))
    expect(h.phi).toEqual([{ ten: 'Phí môi trường', tien: 100_000 }])
    expect(h.kiem[0].muc).toBe('dat')
  })
  it('máy tính tiền: không chữ ký người bán, không mã CQT -> báo (thông tin + cảnh báo)', () => {
    const h = parseInvoice(xmlHD({ kh: 'C26MAA', mccqt: null, kyBan: false }))
    expect(h.kyBan).toBeNull()
    expect(h.kiem.map((x) => x.muc)).toEqual(['canhBao', 'thongTin'])
    expect(h.kiem[0].noiDung).toMatch(/MCCQT/)
    // ký hiệu K (không mã): không đòi mã CQT
    expect(parseInvoice(xmlHD({ kh: 'K26TAA', mccqt: null, kyBan: false })).kiem.map((x) => x.muc)).toEqual(['dat', 'thongTin'])
  })
  it('hoá đơn thay thế: đọc thông tin hoá đơn liên quan', () => {
    const h = parseInvoice(xmlHD({ them: '<TTHDLQuan><TCHDon>1</TCHDon><LHDCLQuan>1</LHDCLQuan><KHMSHDCLQuan>1</KHMSHDCLQuan><KHHDCLQuan>C26TAA</KHHDCLQuan><SHDCLQuan>16</SHDCLQuan><NLHDCLQuan>2026-10-01</NLHDCLQuan></TTHDLQuan>' }))
    expect(h.lienQuan).toMatchObject({ tc: '1', kh: 'C26TAA', so: '16', ngay: '2026-10-01' })
    expect(h.kiem.at(-1)?.noiDung).toMatch(/thay thế/)
  })
  it('ngoại tệ: ghi chú tỷ giá', () => {
    expect(parseInvoice(xmlHD({ tienTe: 'USD' })).kiem.some((x) => x.noiDung.includes('USD'))).toBe(true)
  })
  it('không phải hoá đơn (tờ khai) -> lỗi nêu thẻ gốc', () => {
    expect(() => parseInvoice('<HSoThueDTu><HSoKhaiThue/></HSoThueDTu>')).toThrow(/thẻ gốc là <HSoThueDTu>, cần <HDon>/)
  })
  it('file hỏng -> lỗi "bị hỏng"', () => {
    expect(() => parseInvoice(xmlHD().slice(0, 400))).toThrow('File XML bị hỏng')
  })
  it('<HDon> thiếu nội dung / thiếu số -> lỗi, không lưu', () => {
    expect(() => parseInvoice('<HDon><DLHDon/></HDon>')).toThrow(/thiếu phần/)
    expect(() => parseInvoice(xmlHD({ so: '' }))).toThrow(/thiếu ký hiệu hoặc số/)
  })
  it('checkInvoice chạy lại được trên hoá đơn đã đọc', () => {
    const h = parseInvoice(xmlHD())
    expect(checkInvoice({ ...h, tong: 1 }).some((x) => x.muc === 'canhBao')).toBe(true)
  })
})

describe('Chống trùng + chiều mua/bán', () => {
  it('khoá = MST bán + mẫu + ký hiệu + số (bỏ số 0 đầu)', () => {
    expect(khoaCuaXem(parseInvoice(xmlHD()))).toBe(`${BAN}|1|C26TAA|17`)
    expect(khoaHoaDon({ mstBan: BAN, mau: '1', kyHieu: 'c26taa', so: '17' })).toBe(`${BAN}|1|C26TAA|17`)
  })
  it('khoá từ phần đọc của sổ (docXmlGoc) trùng khoá từ phần xem', () => {
    const g = docXmlGoc(xmlHD(), 'a.xml')!
    expect(khoaCuaGoc(g)).toBe(khoaCuaXem(parseInvoice(xmlHD())))
  })
  it('chiều hoá đơn theo MST doanh nghiệp đang chọn', () => {
    expect(chieuHoaDon({ mstBan: BAN, mstMua: MUA }, BAN)).toBe('ban')
    expect(chieuHoaDon({ mstBan: BAN, mstMua: MUA }, MUA)).toBe('mua')
    expect(chieuHoaDon({ mstBan: BAN, mstMua: MUA }, '0100000000')).toBeNull()
  })
  it('tách mới / đã có: trùng kho và trùng ngay trong lô', () => {
    const ds = ['a', 'b', 'a', 'c']
    expect(tachTrung(ds, (x) => x, new Set(['c']))).toEqual({ moi: ['a', 'b'], daCo: ['a', 'c'] })
  })
  it('gói ZIP (kiểu extension tải hoá đơn: thư mục lồng, kèm file html báo cáo) mở ra đúng các file XML', () => {
    const zip = zipSync({
      'MUA-VAO/HD-DIEN-TU/XML/1.xml': strToU8(xmlHD({ so: '1' })),
      'MUA-VAO/HD-DIEN-TU/XML/2.xml': strToU8(xmlHD({ so: '2' })),
      'BC-HD-TAI-VE-MUA-VAO.html': strToU8('<html></html>'),
    })
    const xml = moZip(zip).filter((t) => /\.xml$/i.test(t.ten))
    expect(xml.map((t) => parseInvoice(new TextDecoder().decode(t.du)).so)).toEqual(['1', '2'])
  })
})

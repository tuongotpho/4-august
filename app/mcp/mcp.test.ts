// Kiểm máy chủ MCP từ đầu tới cuối, như một AI thật gọi vào: dựng thư mục hồ sơ giả (tờ khai XML quý 1
// + Excel hoá đơn quý 2), nối client MCP vào máy chủ, gọi từng công cụ và soát con số.

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import * as XLSX from 'xlsx'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { tinhGTGT } from '../src/core/gtgt.js'
import { xmlGTGT } from '../src/core/xml.js'
import type { HoaDon, HoSoDN } from '../src/core/types.js'
import { taoMayChu } from './mayChu.js'
import { nguonThuMuc } from './nguon.js'

XLSX.set_fs(fs)

const MST = '0109999999'
const hoSo: HoSoDN = {
  mst: MST, tenNNT: 'Công ty TNHH Thử Nghiệm', dchiNNT: 'Số 1', phuongXa: 'Phường A', maXaNNT: '00001', maTinhNNT: '25',
  tenTinhNNT: 'Phú Thọ', dthoaiNNT: '', emailNNT: '', maCQTNoiNop: '12345', tenCQTNoiNop: 'Thuế cơ sở 1', nguoiKy: 'Nguyễn Văn A',
}
const hd = (o: Partial<HoaDon>): HoaDon => ({
  loai: 'mua', kyHieuMau: '1', kyHieu: 'C26TAA', so: '1', ngay: '15/02/2026', mstBan: '0200000002', tenBan: 'NCC', mstMua: MST, tenMua: hoSo.tenNNT,
  chuaThue: 0, thue: 0, trangThai: 'Hóa đơn mới', file: '', ...o,
})

let goc: string
let client: Client

async function goi(ten: string, args: Record<string, unknown> = {}) {
  const r = await client.callTool({ name: ten, arguments: args })
  const text = (r.content as { text: string }[])[0].text
  return { loi: !!r.isError, kq: JSON.parse(text) }
}

beforeAll(async () => {
  goc = fs.mkdtempSync(path.join(os.tmpdir(), 'khaithue-mcp-'))
  fs.mkdirSync(path.join(goc, 'xml'))
  fs.mkdirSync(path.join(goc, 'excel'))
  // Quý 1/2026 đã nộp: chỉ có mua vào -> [43] = 5.000 chuyển sang quý 2
  const q1 = tinhGTGT([], [hd({ chuaThue: 50000, thue: 5000 })]).toKhai
  fs.writeFileSync(path.join(goc, 'xml', `${MST}000-01_GTGT_TT80-Q12026-L00.xml`), xmlGTGT(q1, { quy: 1, nam: 2026 }, hoSo, '2026-04-20'))
  // Quý 2/2026: Excel "Danh sách hoá đơn" lẫn cả bán ra (10% và 8%) lẫn mua vào, thêm 1 hoá đơn bị thay thế
  const rows = [
    ['DANH SÁCH HÓA ĐƠN'],
    ['Từ ngày 01/04/2026 đến ngày 30/06/2026'],
    ['STT', 'Ký hiệu mẫu số', 'Ký hiệu hóa đơn', 'Số hóa đơn', 'Ngày lập', 'MST người bán', 'Tên người bán', 'MST người mua', 'Tên người mua', 'Tổng tiền chưa thuế', 'Tổng tiền thuế', 'Trạng thái hóa đơn'],
    [1, '1', 'C26TNA', '1', '10/04/2026', MST, hoSo.tenNNT, '0100000001', 'Khách Mười', 100000000, 10000000, 'Hóa đơn mới'],
    [2, '1', 'C26TNA', '2', '20/05/2026', MST, hoSo.tenNNT, '0100000003', 'Khách Tám', 50000000, 4000000, 'Hóa đơn mới'],
    [3, '1', 'C26TBB', '7', '05/06/2026', '0200000002', 'Nhà Cung Cấp', MST, hoSo.tenNNT, 30000000, 3000000, 'Hóa đơn mới'],
    [4, '1', 'C26TBB', '6', '01/06/2026', '0200000002', 'Nhà Cung Cấp', MST, hoSo.tenNNT, 99000000, 9900000, 'Hóa đơn bị thay thế'],
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Sheet1')
  XLSX.writeFile(wb, path.join(goc, 'excel', 'DANH SÁCH HÓA ĐƠN.xlsx'))
  // File gốc của HĐ mua C26TBB-7 (XML, có dòng hàng viên nén)
  fs.writeFileSync(path.join(goc, 'xml', 'C26TBB7.xml'), `<HDon><DLHDon><TTChung><KHMSHDon>1</KHMSHDon><KHHDon>C26TBB</KHHDon><SHDon>7</SHDon><NLap>2026-06-05</NLap></TTChung><NDHDon><NBan><Ten>Nhà Cung Cấp</Ten><MST>0200000002</MST></NBan><NMua><Ten>${hoSo.tenNNT}</Ten><MST>${MST}</MST></NMua><DSHHDVu><HHDVu><TChat>1</TChat><THHDVu>Viên nén gỗ</THHDVu><DVTinh>tấn</DVTinh><SLuong>12.5</SLuong><DGia>2400000</DGia><ThTien>30000000</ThTien><TSuat>10%</TSuat></HHDVu></DSHHDVu><TToan><TgTCThue>30000000</TgTCThue><TgTThue>3000000</TgTThue></TToan></NDHDon></DLHDon><MCCQT>00ABC</MCCQT><DSCKS><NBan><Signature Id="seller"><SigningTime>2026-06-05T08:00:00</SigningTime></Signature></NBan></DSCKS></HDon>`)
  // Danh sách DN rủi ro (file Excel giả kiểu "PHỤ LỤC QR HDRR"): nhà cung cấp 0200000002 nằm trong đó
  fs.mkdirSync(path.join(goc, 'ruiro'))
  const rr = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(rr, XLSX.utils.aoa_to_sheet([
    ['DANH SÁCH NGƯỜI NỘP THUẾ KHÔNG HOẠT ĐỘNG TẠI ĐỊA CHỈ ĐÃ ĐĂNG KÝ'],
    ['STT', 'MST', 'Tên người nộp thuế', 'Số thông báo', 'Trạng thái', 'Ngày chuyển trạng thái'],
    [1, '0200000002', 'NHÀ CUNG CẤP', '45/TB', 'Không hoạt động tại địa chỉ đăng ký', '01/06/2026'],
    [2, '0300000009', 'DN KHÁC', '46/TB', '', ''],
  ]), 'Phụ lục 1')
  XLSX.writeFile(rr, path.join(goc, 'ruiro', 'T6.2026.xlsx'))

  const server = taoMayChu(nguonThuMuc(() => ({
    thuMuc: [{ duongDan: path.join(goc, 'xml'), chi: 'xml' }, { duongDan: path.join(goc, 'excel'), chi: 'excel' }],
    traVe: [], thuMucXuat: path.join(goc, 'ra'), ruiRo: [path.join(goc, 'ruiro')], nguon: 'test',
  })))
  const [a, b] = InMemoryTransport.createLinkedPair()
  client = new Client({ name: 'test', version: '1' })
  await Promise.all([server.connect(a), client.connect(b)])
})

afterAll(async () => {
  await client?.close()
  fs.rmSync(goc, { recursive: true, force: true })
})

describe('Máy chủ MCP khaithue', () => {
  it('khai báo đủ công cụ; chỉ xuat_xml_gtgt được ghi', async () => {
    const { tools } = await client.listTools()
    expect(tools.map((t) => t.name).sort()).toEqual([
      'chung_tu_nop_tien', 'cong_no', 'danh_sach_cong_ty', 'doi_soat', 'doi_tac', 'hoa_don_goc', 'lap_to_khai_gtgt', 'lo_hang', 'nap_ho_so', 'so_quy', 'so_theo_doi_gtgt', 'soi_rui_ro', 'tong_quan', 'tra_hoa_don', 'xuat_xml_gtgt',
    ])
    expect(tools.filter((t) => !t.annotations?.readOnlyHint).map((t) => t.name)).toEqual(['xuat_xml_gtgt'])
  })

  it('nạp hồ sơ: nhận đúng công ty, không file nào lỗi', async () => {
    const { kq } = await goi('nap_ho_so')
    expect(kq).toMatchObject({ soXml: 2, soExcel: 1, soSheetHoaDon: 1, loi: [], congTyMacDinh: MST })
  })

  it('lập tờ khai quý 2: [22] = [43] quý 1, đúng công thức và phụ lục, bỏ hoá đơn bị thay thế', async () => {
    const { loi, kq } = await goi('lap_to_khai_gtgt', { quy: 2, nam: 2026 })
    expect(loi).toBe(false)
    const ct = Object.fromEntries(kq.chiTieu.map((c: { ma: string; giaTri: number }) => [c.ma, c.giaTri]))
    expect(ct).toMatchObject({ '[22]': 5000, '[23]': 30000000, '[24]': 3000000, '[32]': 150000000, '[33]': 14000000, '[36]': 11000000, '[40]': 10995000, '[43]': 0 })
    expect(kq.phuLuc.mucII_banRaDuocGiam).toEqual([expect.objectContaining({ mst: '0100000003', giaTri: 50000000, thueGiam: 1000000 })])
    expect(kq.hoaDon).toMatchObject({ banRa: { soHoaDon: 2 }, muaVao: { soHoaDon: 1 }, boQuaDoThayTheHuy: 1 })
    expect(kq.coLoi).toBe(false)
    expect(kq._toKhai).toBeUndefined()
  })

  it('ghi đè [22] sai quy tắc -> báo LỖI và từ chối xuất XML', async () => {
    const { kq } = await goi('xuat_xml_gtgt', { quy: 2, nam: 2026, ct22: 1 })
    expect(kq.daGhi).toBe(false)
    expect(kq.canhBao.join('\n')).toContain('ĐẦU KỲ – CUỐI KỲ KHÔNG KHỚP')
    expect(fs.existsSync(path.join(goc, 'ra'))).toBe(false)
  })

  it('xuất XML rồi đọc lại bằng chính app: số liệu khớp', async () => {
    const { kq } = await goi('xuat_xml_gtgt', { quy: 2, nam: 2026, ngay_lap: '2026-07-20' })
    expect(kq.daGhi).toBe(true)
    expect(path.basename(kq.file)).toBe(`${MST}000-01_GTGT_TT80-Q22026-L00.xml`)
    // Bỏ file vừa xuất vào thư mục nguồn như người dùng nộp xong -> sổ có quý 2, chuỗi đầu kỳ liền mạch
    fs.copyFileSync(kq.file, path.join(goc, 'xml', path.basename(kq.file)))
    await goi('nap_ho_so')
    const so = (await goi('so_theo_doi_gtgt')).kq
    expect(so.gtgt.map((q: { quy: string; khopDauKyVoiQuyTruoc: boolean | null }) => [q.quy, q.khopDauKyVoiQuyTruoc])).toEqual([['2026-Q1', null], ['2026-Q2', true]])
    expect(so.gtgt[1].phienBan[0]).toMatchObject({ ct22: 5000, ct40: 10995000 })
  })

  it('tra hoá đơn, đối tác, tổng quan', async () => {
    const tra = (await goi('tra_hoa_don', { tim: 'khách tám' })).kq
    expect(tra.hoaDon).toEqual([expect.objectContaining({ kyHieu: 'C26TNA', so: '2', chuaThue: 50000000 })])
    expect((await goi('tra_hoa_don', { loai: 'mua', ca_huy: true })).kq.tongSoKhop).toBe(2)
    const dt = (await goi('doi_tac', { nam: 2026 })).kq
    expect(dt.tongBan).toBe(150000000)
    const tq = (await goi('tong_quan', { ngay_hom_nay: '2026-07-25' })).kq
    expect(tq.quy.find((q: { quy: string }) => q.quy === '2026-Q2')).toMatchObject({ phaiNop_ct40: 10995000, daNop: 0 })
  })

  it('MST không có -> trả lỗi rõ ràng, máy chủ không sập', async () => {
    const r = await goi('tong_quan', { mst: '0000000000' })
    expect(r.loi).toBe(true)
    expect(r.kq.loi).toContain('Không có công ty MST 0000000000')
    expect((await goi('danh_sach_cong_ty')).kq).toHaveLength(1)
  })

  it('soi DN rủi ro: bắt đúng nhà cung cấp trong danh sách, bỏ hoá đơn bị thay thế, đưa lên đầu cảnh báo tổng quan', async () => {
    const { kq } = await goi('soi_rui_ro')
    expect(kq).toMatchObject({ daCoDanhSach: true, soMstDanhSach: 2, daSoi: { nhaCungCap: 1, khachHang: 2 }, soDoiTacDinh: 1 })
    expect(kq.doiTac).toEqual([expect.objectContaining({
      chieu: 'nhà cung cấp', mst: '0200000002', tongThue: 3000000, cacQuy: ['2026-Q2'],
      hoaDon: [{ so: 'C26TBB-7', ngay: '05/06/2026', quy: '2026-Q2', chuaThue: 30000000, thue: 3000000, lapSauNgayNgungHoatDong: true }],
    })])
    const tq = (await goi('tong_quan', { ngay_hom_nay: '2026-07-01' })).kq
    expect(tq.canhBao[0]).toMatch(/^⛔ LỖI: Nhà cung cấp Nhà Cung Cấp \(MST 0200000002\) nằm trong DANH SÁCH DN RỦI RO/)
  })

  it('hoá đơn gốc: XML có dòng hàng khớp danh sách Excel, ra số tấn viên nén theo quý, chỉ ra hoá đơn chưa có file gốc', async () => {
    const { kq } = await goi('hoa_don_goc', { tim: 'C26TBB-7' })
    expect(kq.soFileGoc).toEqual({ tong: 1, xml: 1, pdf: 0 })
    expect(kq.soVoiCongThue).toMatchObject({ hoaDonConHieuLuc: 3, daCoGoc: 1, chuaCoGoc: 2, lechTien: [] })
    expect(kq.theoQuy).toEqual([expect.objectContaining({ khoa: '2026-Q2', muaVienNen: { tấn: 12.5 }, tienMuaVienNen: 30000000 })])
    expect(kq.chiTiet[0]).toMatchObject({ nhom: 'Viên nén / nguyên liệu gỗ', dong: [{ ten: 'Viên nén gỗ', sl: 12.5 }] })
  })

  it('lô hàng: bản thư mục chưa có lô (lô tạo trên web app) — vẫn ra luỹ kế tấn và gợi ý ghép lô', async () => {
    const { kq } = await goi('lo_hang')
    expect(kq).toMatchObject({ soLo: 0, laiGopCongDon: 0, soHoaDonChuaVaoLo: 3 })
    expect(kq.luyKeTheoNam).toEqual([{ nam: 2026, tanMua: 12.5, tanBan: 0, hoaDonThieuGoc: 2 }])
    expect(kq.goiYGhepLo).toEqual([])
  })

  it('công nợ: chưa có sao kê -> nói rõ, không bịa số', async () => {
    const { kq } = await goi('cong_no')
    expect(kq).toMatchObject({ daCoSaoKe: false })
    expect(kq.huongDan).toContain('Chưa có sao kê')
  })

  it('sổ quỹ: chưa có phiếu -> tồn 0, không cảnh báo', async () => {
    const { kq } = await goi('so_quy')
    expect(kq).toMatchObject({ tongThu: 0, tongChi: 0, tonCuoi: 0, phieu: [], canhBao: [] })
  })
})

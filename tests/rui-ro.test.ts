// @vitest-environment node
// Danh sách DN rủi ro về hóa đơn (file Excel cơ quan thuế) — file Excel giả dựng ngay trong test,
// cùng bố cục file thật "PHỤ LỤC QR HDRR THANG 09.2026.xlsx" (2 sheet, vài dòng tiêu đề, MST vừa là chữ vừa là số).
import PizZip from 'pizzip'
import { describe, expect, it } from 'vitest'
import * as cc from '../mcp/congCu' // nạp trước: gắn DOMParser (xmldom) như máy chủ thật
import { tinDaTaoHoSo } from '../mcp/telegram'
import { emptyDossier, emptyInvoice } from '../src/lib/model'
import { bangRuiRo, giaiNenDs, gopDsRuiRo, nenDs, traMst } from '../src/lib/ruiRo'
import { docDsRuiRo } from '../src/lib/ruiRoExcel'
import { warningsOf } from '../src/lib/status'
import { DEFAULT_SETTINGS, type Dossier, type Invoice } from '../src/lib/types'

type O = string | number | null
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

/** Dựng .xlsx tối giản: chữ vào sharedStrings, số để kiểu số (như Excel thật). */
function xlsx(sheets: { ten: string; rows: O[][] }[]): Uint8Array {
  const chuoi: string[] = []
  const si = (s: string) => (chuoi.includes(s) ? chuoi.indexOf(s) : chuoi.push(s) - 1)
  const zip = new PizZip()
  const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
  sheets.forEach((sh, k) => {
    const rows = sh.rows
      .map((r, i) => `<row r="${i + 1}">${r.map((v, j) => {
        if (v == null) return ''
        const ref = `${String.fromCharCode(65 + j)}${i + 1}`
        return typeof v === 'number' ? `<c r="${ref}"><v>${v}</v></c>` : `<c r="${ref}" t="s"><v>${si(v)}</v></c>`
      }).join('')}</row>`)
      .join('')
    zip.file(`xl/worksheets/sheet${k + 1}.xml`, `<?xml version="1.0"?><worksheet xmlns="${NS}"><sheetData>${rows}</sheetData></worksheet>`)
  })
  zip.file('xl/workbook.xml', `<?xml version="1.0"?><workbook xmlns="${NS}" xmlns:r="${R}"><sheets>${sheets
    .map((s, k) => `<sheet name="${esc(s.ten)}" sheetId="${k + 1}" r:id="rId${k + 1}"/>`).join('')}</sheets></workbook>`)
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
    .map((_, k) => `<Relationship Id="rId${k + 1}" Type="${R}/worksheet" Target="worksheets/sheet${k + 1}.xml"/>`).join('')}</Relationships>`)
  zip.file('xl/sharedStrings.xml', `<?xml version="1.0"?><sst xmlns="${NS}">${chuoi.map((s) => `<si><t>${esc(s)}</t></si>`).join('')}</sst>`)
  return zip.generate({ type: 'uint8array' })
}

const HDR = ['STT', 'MST', 'Số CV', 'Ngày CV', 'Tên doanh nghiệp dấu hiệu rủi ro', 'Biện pháp đã thực hiện', 'Ngày cấp MST', 'Trạng thái hoạt động', 'Ngày chuyển trạng thái']
const KHONG_HD = 'NNT không hoạt động tại địa chỉ đã đăng ký'

const FILE_T9 = xlsx([
  {
    ten: 'Phụ lục 1',
    rows: [
      ['CỤC THUẾ'],
      ['DANH SÁCH NGƯỜI NỘP THUẾ KHÔNG HOẠT ĐỘNG TẠI ĐỊA CHỈ ĐÃ ĐĂNG KÝ'],
      HDR,
      // 46241 = 07/08/2026 (số seri ngày của Excel)
      [null, '0100000001', '3197/TCS10-QLDN', 46241, 'CÔNG TY TNHH RỦI RO MỘT', 'CQT ban hành thông báo NNT có dấu hiệu rủi ro về thuế, hóa đơn', '30.09.1998', KHONG_HD, '06.08.2026'],
      // MST lưu kiểu SỐ, mất số 0 đầu
      [null, 100000002, '15198/TCS28-QLDN', 46227, 'CÔNG TY TNHH RỦI RO HAI', 'CQT ban hành thông báo NNT có dấu hiệu rủi ro về thuế, hóa đơn', '25.08.2025', KHONG_HD, '23.07.2026'],
      [null, null, null, null, null, null, null, null, null],
    ],
  },
  {
    ten: 'PL 3 CA khong hoa don',
    rows: [
      ['DANH SÁCH DOANH NGHIỆP ĐÃ BỊ CƠ QUAN THUẾ CHUYỂN HỒ SƠ SANG CƠ QUAN CẢNH SÁT ĐIỀU TRA'],
      [null, 'Kèm theo Thông báo số ........'],
      [...HDR, 'Số hóa đơn', 'ký hiệu hóa đơn ', 'MST nguoi mua', 'Ten nguoi mua'],
      [null, '0300000003', '2662/tcs7-qldn2', 46248, 'CÔNG TY TNHH CHUYỂN CÔNG AN', 'đã chuyển hồ sơ sang công an', '08.05.2009', KHONG_HD, '17.08.2026', null, null, '0999999999', 'Người mua X'],
    ],
  },
])

describe('đọc file Excel DN rủi ro', () => {
  const ds = docDsRuiRo(FILE_T9, 'PL T9.xlsx')

  it('đọc đủ 2 sheet, dò cột theo tên, bỏ dòng trống', () => {
    expect(ds.nhom.map((n) => n.sheet)).toEqual(['Phụ lục 1', 'PL 3 CA khong hoa don'])
    expect(ds.nhom[0].moTa).toMatch(/^DANH SÁCH NGƯỜI NỘP THUẾ/)
    expect(ds.dong.map((d) => d.mst)).toEqual(['0100000001', '0100000002', '0300000003'])
    expect(ds.dong[0]).toMatchObject({ ten: 'CÔNG TY TNHH RỦI RO MỘT', soCv: '3197/TCS10-QLDN', ngayCv: '2026-08-07', ngayChuyen: '2026-08-06', nhom: 0 })
    expect(ds.dong[2]).toMatchObject({ ten: 'CÔNG TY TNHH CHUYỂN CÔNG AN', nhom: 1 }) // không lấy nhầm cột "Ten nguoi mua"
    expect(ds.cacFile).toEqual([{ ten: 'PL T9.xlsx', napLuc: expect.any(Number), soDong: 3 }])
  })

  it('file không có cột MST -> báo lỗi rõ ràng', () => {
    expect(() => docDsRuiRo(xlsx([{ ten: 'S', rows: [['A', 'B']] }]))).toThrow(/MST/)
    expect(() => docDsRuiRo(new Uint8Array([1, 2, 3]))).toThrow(/xlsx/)
  })

  it('gộp file tháng sau: giữ DN cũ, không nhân đôi dòng trùng', () => {
    const t10 = docDsRuiRo(xlsx([{ ten: 'Phụ lục 1', rows: [
      ['DANH SÁCH NGƯỜI NỘP THUẾ KHÔNG HOẠT ĐỘNG TẠI ĐỊA CHỈ ĐÃ ĐĂNG KÝ'], HDR,
      [null, '0100000001', '3197/TCS10-QLDN', 46241, 'CÔNG TY TNHH RỦI RO MỘT', '', '', KHONG_HD, '06.08.2026'],
      [null, '0400000004', '1/TB', 46270, 'CÔNG TY MỚI THÁNG 10', '', '', 'NNT đang hoạt động', null],
    ] }]), 'PL T10.xlsx')
    const g = gopDsRuiRo(ds, t10)
    expect(g.dong.map((d) => d.mst).sort()).toEqual(['0100000001', '0100000002', '0300000003', '0400000004'])
    expect(g.nhom).toHaveLength(2)
    expect(g.cacFile.map((f) => f.ten)).toEqual(['PL T9.xlsx', 'PL T10.xlsx'])
  })

  it('cất nén gzip rồi đọc lại y nguyên; vẫn đọc được bản JSON thường cất trước đây', async () => {
    const b = await nenDs(ds)
    expect([b[0], b[1]]).toEqual([0x1f, 0x8b])
    expect(await giaiNenDs(b)).toEqual(ds)
    expect(await giaiNenDs(new TextEncoder().encode(JSON.stringify(ds)))).toEqual(ds)
  })

  it('tra MST: khớp đúng, chi nhánh MST-xxx khớp DN chủ quản, bỏ khoảng trắng', () => {
    const b = bangRuiRo(ds)
    expect(traMst('0100000001', b)?.quaDonViChuQuan).toBe(false)
    expect(traMst(' 0100 000 001 ', b)?.mst).toBe('0100000001')
    expect(traMst('0100000001-002', b)).toMatchObject({ mst: '0100000001', quaDonViChuQuan: true })
    expect(traMst('0100000009', b)).toBeUndefined()
    expect(traMst('', b)).toBeUndefined()
  })
})

const hd = (o: Partial<Invoice>): Invoice => ({ ...emptyInvoice(), soHd: '7', ngayHd: '2026-09-01', tongTien: 1_000_000, ...o })
const hs = (o: Partial<Dossier>): Dossier => ({ ...emptyDossier(), ...o })

describe('cảnh báo trên hồ sơ', () => {
  const ds = docDsRuiRo(FILE_T9, 'PL T9.xlsx')
  const bang = bangRuiRo(ds)

  it('người bán trong danh sách -> cảnh báo đỏ đứng đầu, có cả hồ sơ HĐ cũ', () => {
    const d = hs({ invoices: [hd({ mstNguoiBan: '0100000001', tenNguoiBan: 'Rủi ro 1' })] })
    const w = warningsOf(d, DEFAULT_SETTINGS, undefined, bang)
    expect(w[0]).toMatch(/^⛔ HĐ 7: người bán CÔNG TY TNHH RỦI RO MỘT \(MST 0100000001\) nằm trong DANH SÁCH DN RỦI RO/)
    expect(w[0]).toMatch(/lập SAU ngày DN chuyển trạng thái không hoạt động/)
    expect(warningsOf({ ...d, hoSoCu: true }, DEFAULT_SETTINGS, undefined, bang)[0]).toMatch(/DN RỦI RO/)
  })

  it('DN đã chuyển công an -> nói rõ', () => {
    const w = warningsOf(hs({ invoices: [hd({ mstNguoiBan: '0300000003' })] }), DEFAULT_SETTINGS, undefined, bang)
    expect(w[0]).toMatch(/ĐÃ CHUYỂN HỒ SƠ SANG CÔNG AN/)
  })

  it('hóa đơn lập TRƯỚC ngày DN ngừng hoạt động: vẫn cảnh báo nhưng không nói "lập SAU"', () => {
    const w = warningsOf(hs({ invoices: [hd({ mstNguoiBan: '0100000001', ngayHd: '2026-01-10' })] }), DEFAULT_SETTINGS, undefined, bang)
    expect(w[0]).toMatch(/DN RỦI RO/)
    expect(w[0]).not.toMatch(/lập SAU/)
  })

  it('chưa nạp danh sách / người bán sạch -> không cảnh báo', () => {
    const d = hs({ invoices: [hd({ mstNguoiBan: '0100000001' })] })
    expect(warningsOf(d, DEFAULT_SETTINGS).some((w) => /RỦI RO/.test(w))).toBe(false)
    expect(warningsOf(hs({ invoices: [hd({ mstNguoiBan: '0100000009' })] }), DEFAULT_SETTINGS, undefined, bang).some((w) => /RỦI RO/.test(w))).toBe(false)
  })

  it('MCP: tra_dn_rui_ro dò cả kho và tra 1 MST; cảnh báo có trong xem_ho_so', () => {
    const du: cc.DuLieu = {
      hoSo: [
        hs({ id: 'x', noiDung: 'Tiếp khách', invoices: [hd({ mstNguoiBan: '0100000002-001', tenNguoiBan: 'Chi nhánh Hai' })] }),
        hs({ id: 'y', invoices: [hd({ soHd: '8', mstNguoiBan: '0100000009' })] }),
      ],
      caiDat: DEFAULT_SETTINGS,
      tenFile: new Map(),
      dsRuiRo: ds,
    }
    const ca = cc.traDnRuiRo(du, {})
    expect(ca).toMatchObject({ daNap: true, soMst: 3, soHoaDonKhop: 1 })
    expect('hoaDon' in ca && ca.hoaDon[0]).toMatchObject({ hoSoId: 'x', soHd: '7' })
    expect(cc.traDnRuiRo(du, { mst: '0300000003' })).toMatchObject({ coTrongDanhSach: true, laChiNhanh: false })
    expect(cc.traDnRuiRo(du, { mst: '0100000009' })).toMatchObject({ coTrongDanhSach: false })
    expect(cc.traDnRuiRo({ ...du, dsRuiRo: null }, {})).toMatchObject({ daNap: false })
    expect(cc.xemHoSo(du, { id: 'x' }).canhBao[0]).toMatch(/là chi nhánh của DN nằm trong DANH SÁCH DN RỦI RO/)
  })

  it('tạo hồ sơ (đường bot Telegram dùng): trả chi tiết rủi ro của từng hóa đơn mới', async () => {
    const ghi: cc.NoiGhi = { luuHoSo: async () => {}, luuFile: async () => {}, xoaHoSo: async () => {}, nhatKy: async () => {} }
    const du = (): cc.DuLieu => ({ hoSo: [], caiDat: DEFAULT_SETTINGS, tenFile: new Map(), dsRuiRo: ds })
    const kq = await cc.taoHoSo(du(), ghi, { hoa_don_nhap_tay: [
      { soHd: '21', ngayHd: '2026-09-01', mstNguoiBan: '0300000003', tenNguoiBan: 'X', tongTien: 500_000 },
      { soHd: '22', ngayHd: '2026-09-01', mstNguoiBan: '0100000009', tenNguoiBan: 'Sạch', tongTien: 500_000 },
    ] })
    expect(kq.daKiemTraRuiRo).toBe(true)
    expect(kq.hoaDonMoi[0].dnRuiRo).toMatchObject({ mst: '0300000003', ten: 'CÔNG TY TNHH CHUYỂN CÔNG AN', daChuyenCongAn: true, lapSauKhiNgung: true, laChiNhanh: false })
    expect(kq.hoaDonMoi[1].dnRuiRo).toBeUndefined()
    expect(kq.canhBao.some((c) => /ĐÃ CHUYỂN HỒ SƠ SANG CÔNG AN/.test(c))).toBe(true)

    const chuaNap = await cc.taoHoSo({ ...du(), dsRuiRo: null }, ghi, { hoa_don_nhap_tay: [{ soHd: '23', ngayHd: '2026-09-02', mstNguoiBan: '0300000003', tongTien: 1 }] })
    expect(chuaNap.daKiemTraRuiRo).toBe(false)
    expect(chuaNap.hoaDonMoi[0].dnRuiRo).toBeUndefined()
  })

  it('Telegram: cảnh báo rủi ro đứng ĐẦU tin, không lặp lại ở phần nhắc nhở; người bán sạch / chưa nạp thì nói rõ', async () => {
    const ghi: cc.NoiGhi = { luuHoSo: async () => {}, luuFile: async () => {}, xoaHoSo: async () => {}, nhatKy: async () => {} }
    const du = (): cc.DuLieu => ({ hoSo: [], caiDat: DEFAULT_SETTINGS, tenFile: new Map(), dsRuiRo: ds })
    const o = { ten: 'hd.pdf', chuaDoc: false, appUrl: 'https://app' }
    const tao = (d: cc.DuLieu, mst: string, soHd: string) => cc.taoHoSo(d, ghi, { hoa_don_nhap_tay: [{ soHd, ngayHd: '2026-09-01', mstNguoiBan: mst, tenNguoiBan: 'NB', tongTien: 1_000 }] })

    const tin = tinDaTaoHoSo(await tao(du(), '0300000003-002', '31'), o).split('\n')
    expect(tin[0]).toBe('⚠️ Đã tạo hồ sơ mới — CÓ RỦI RO')
    expect(tin[1]).toBe('🚨 CẢNH BÁO: NGƯỜI BÁN NẰM TRONG DANH SÁCH DN RỦI RO VỀ HÓA ĐƠN — ĐÃ CHUYỂN HỒ SƠ SANG CÔNG AN')
    expect(tin[2]).toBe('CÔNG TY TNHH CHUYỂN CÔNG AN (MST 0300000003) — người bán là chi nhánh của DN này')
    expect(tin).toContain('• Hóa đơn lập SAU ngày DN chuyển trạng thái không hoạt động')
    expect(tin.filter((l) => /DN RỦI RO/.test(l))).toHaveLength(1) // chỉ dòng 🚨, không lặp lại câu ⛔ ở phần nhắc nhở
    expect(tin.at(-1)).toMatch(/^https:\/\/app\/\?hs=/)

    const sach = tinDaTaoHoSo(await tao(du(), '0100000009', '32'), o)
    expect(sach).toMatch(/^✅ Đã tạo hồ sơ mới/)
    expect(sach).toContain('✓ Người bán không nằm trong danh sách DN rủi ro.')
    expect(tinDaTaoHoSo(await tao({ ...du(), dsRuiRo: null }, '0300000003', '33'), o)).toContain('ℹ️ Chưa nạp danh sách DN rủi ro')
  })
})

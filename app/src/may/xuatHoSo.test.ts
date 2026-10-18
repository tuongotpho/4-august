import { describe, expect, it, vi } from 'vitest'
import { unzipSync, strFromU8 } from 'fflate'
import * as XLSX from 'xlsx'
import { datLo, datPhieuQuy, khoTrong, napHoaDon, napToKhai, type Kho } from '../core/kho'
import { danhSachTepXuat, tenAnToanZip, type NguonXuat } from '../core/xuatHoSo'
import type { HoSoDN } from '../core/types'

// Giả lập tải file từ mây: trả nội dung theo đường dẫn; 1 file "hỏng"
vi.mock('./dongBo', () => ({
  taiTep: async (duongDan: string) => {
    if (duongDan.includes('hong')) throw new Error('object-not-found')
    return new TextEncoder().encode(`noi dung ${duongDan}`).buffer
  },
}))
const { xuatHoSo } = await import('./xuatHoSo')

const MST = '2601102955'
function kho(): Kho {
  let k = napToKhai(khoTrong(), { maTKhai: '842', loaiTKhai: 'C', soLan: 0, ngayLap: '', ky: { quy: 1, nam: 2025 }, hoSo: { mst: MST, tenNNT: 'Cty Nga Anh: Phú Thọ' } as HoSoDN, ct: { ct34: 100, ct40: 8 }, plMua: [], plBan: [], ct9: null }, 'q1.xml').kho
  k = napHoaDon(k, MST, [{ loai: 'ban', kyHieuMau: '1', kyHieu: 'C25TNA', so: '1', ngay: '02/01/2025', mstBan: MST, tenBan: '', mstMua: '2600835029', tenMua: 'RENTECH', chuaThue: 100, thue: 8, trangThai: 'Hóa đơn mới', file: '' }])
  k = datLo(k, MST, { id: 'l1', ten: 'Lô 02/01', ngayTao: '', ghiChu: '', hoaDon: ['ban||C25TNA|1'], giayTo: [] })
  k = datPhieuQuy(k, MST, 'p1', { id: 'p1', loai: 'thu', so: 'PT001', ngay: '05/01/2025', soTien: 108, nhom: 'banHang', noiDung: 'Thu HĐ 1', doiTac: 'RENTECH', hoaDon: ['ban||C25TNA|1'] })
  return k
}
const nguon: NguonXuat = {
  toKhai: [{ mst: MST, ky: '2025-Q1', tenFile: 'tk-q1.xml', duongDan: 'a/tk1' }, { mst: MST, ky: '2025-Q1', tenFile: 'tk-q1.xml', duongDan: 'a/tk1b' }, { mst: '0100000000', ky: '2025-Q1', tenFile: 'khac.xml', duongDan: 'a/khac' }],
  chungTu: [{ mst: MST, ngay: '30/04/2025', so: '77', tenFile: 'ct.xml', duongDan: 'a/ct' }],
  tepHoaDon: { [MST]: [{ ten: 'DS hoá đơn Q1.xlsx', ky: '2025-Q1', duongDan: 'a/hd' }, { ten: 'C25TKL-64.pdf', ky: '2025-Q1', duongDan: 'a/hong' }] },
  daXuat: { [MST]: [{ tenFile: 'app.xml', ky: '2025-Q2', duongDan: 'a/dx' }] },
  loHang: [{ mst: MST, lo: { ten: 'Lô 02/01: BKL', giayTo: [{ ten: 'phiếu cân.jpg', duongDan: 'a/pc', loai: 'phieuCan' }] } }],
  saoKe: [],
}

describe('Xuất toàn bộ hồ sơ', () => {
  it('xếp thư mục theo loại + kỳ; tên an toàn; trùng tên thì đánh số; chỉ lấy file của công ty đó', () => {
    expect(tenAnToanZip('a/b:c*?"<>|d')).toBe('a_b_c_d')
    expect(danhSachTepXuat(nguon, MST).map((t) => t.trongZip)).toEqual([
      '1-To-khai/2025-Q1/tk-q1.xml', '1-To-khai/2025-Q1/tk-q1 (2).xml', '2-Chung-tu-nop-tien/2025/ct.xml',
      '3-Hoa-don/2025-Q1/DS hoá đơn Q1.xlsx', '3-Hoa-don/2025-Q1/C25TKL-64.pdf', '4-To-khai-app-da-xuat/2025-Q2/app.xml',
      '5-Lo-hang/Lô 02_01_ BKL/phieuCan-phiếu cân.jpg',
    ])
  })
  it('gói ZIP: đủ file gốc (file lỗi ghi vào 0-Loi-tai.txt), Excel tổng hợp mở được, bản sao dữ liệu đọc lại được', async () => {
    const tienDo: number[] = []
    const kq = await xuatHoSo(kho(), MST, nguon, (x) => tienDo.push(x))
    expect([kq.soTep, kq.soLoi]).toEqual([6, 1])
    expect(kq.ten).toMatch(/^Ho-so-thue_2601102955_Cty-Nga-Anh_-Phú-Thọ_\d{4}-\d{2}-\d{2}\.zip$/)
    const z = unzipSync(new Uint8Array(await kq.blob.arrayBuffer()))
    expect(Object.keys(z).sort()).toEqual([
      '0-DOC-TRUOC.txt', '0-Du-lieu-app.json', '0-Loi-tai.txt', '0-Tong-hop.xlsx',
      '1-To-khai/2025-Q1/tk-q1 (2).xml', '1-To-khai/2025-Q1/tk-q1.xml', '2-Chung-tu-nop-tien/2025/ct.xml',
      '3-Hoa-don/2025-Q1/DS hoá đơn Q1.xlsx', '4-To-khai-app-da-xuat/2025-Q2/app.xml', '5-Lo-hang/Lô 02_01_ BKL/phieuCan-phiếu cân.jpg',
    ])
    expect(strFromU8(z['1-To-khai/2025-Q1/tk-q1.xml'])).toBe('noi dung a/tk1')
    expect(strFromU8(z['0-Loi-tai.txt'])).toContain('3-Hoa-don/2025-Q1/C25TKL-64.pdf: object-not-found')
    expect(strFromU8(z['0-DOC-TRUOC.txt'])).toContain('Số file gốc: 7 (1 file không tải được')
    const wb = XLSX.read(z['0-Tong-hop.xlsx'])
    expect(wb.SheetNames).toEqual(['Thong tin', 'Tong quan quy', 'Can xu ly', 'Hoa don', 'Doi tac', 'Lo hang', 'So quy tien mat', 'Cong no', 'Chung tu nop tien'])
    const hd = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['Hoa don'], { header: 1 })
    expect(hd[1]).toEqual(expect.arrayContaining(['Bán ra', 'C25TNA', '1', '02/01/2025', '2600835029', 'RENTECH', 100, 8]))
    const quy = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['So quy tien mat'], { header: 1 })
    expect(quy[2]).toEqual(expect.arrayContaining(['05/01/2025', 'PT001', 'Thu', 108]))
    const json = JSON.parse(strFromU8(z['0-Du-lieu-app.json']))
    expect(json).toMatchObject({ mst: MST, loHang: { l1: { ten: 'Lô 02/01' } }, soQuy: { phieu: { p1: { so: 'PT001' } } } })
    expect(Object.keys(json.hoaDon)).toEqual(['ban||C25TNA|1'])
    expect(tienDo.at(-1)).toBe(7)
  })
  it('chưa đăng nhập: vẫn xuất được Excel + dữ liệu trên máy, ghi rõ không có file gốc', async () => {
    const kq = await xuatHoSo(kho(), MST, null, () => undefined)
    const z = unzipSync(new Uint8Array(await kq.blob.arrayBuffer()))
    expect(Object.keys(z).sort()).toEqual(['0-DOC-TRUOC.txt', '0-Du-lieu-app.json', '0-Tong-hop.xlsx'])
    expect(strFromU8(z['0-DOC-TRUOC.txt'])).toContain('Chưa đăng nhập')
  })
})

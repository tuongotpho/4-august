import PizZip from 'pizzip'
import { describe, expect, it } from 'vitest'
import { emptyDossier, emptyInvoice } from '../src/lib/model'
import { dongLichTuan, khoangTuan, taoDocxLichTuan, thongTinMacDinh, thuCua, vietTat } from '../src/lib/lichTuan'
import { DEFAULT_SETTINGS } from '../src/lib/types'

const hs = (ngayHd: string, noiDung: string, doiTac: string, donVi: string[]) => ({
  ...emptyDossier(), noiDung, doiTac, thanhPhan: donVi.map((d) => ({ donVi: d, soNguoi: 2 })), invoices: [{ ...emptyInvoice(), ngayHd }],
})
const a = hs('2026-06-26', 'Họp đề tài CBM', '', ['Phòng KTAT'])
const b = hs('2026-06-24', 'Làm việc với Tổng công ty Điện lực miền Bắc', 'Tổng công ty Điện lực miền Bắc', ['Tổng công ty (NPC)', 'Ban GĐ NPSC', ' ', 'phòng KTAT'])

describe('lịch tuần', () => {
  it('dòng lịch: xếp theo ngày, thành phần nối dấu phẩy, địa điểm mặc định = đối tác, ưu tiên địa điểm đã nhớ', () => {
    const dong = dongLichTuan([a, b], { [a.id]: 'Phòng họp NPSC' })
    expect(dong.map((d) => [d.ngay, d.thanhPhan, d.diaDiem])).toEqual([
      ['2026-06-24', 'Tổng công ty (NPC), Ban GĐ NPSC, phòng KTAT', 'Tổng công ty Điện lực miền Bắc'],
      ['2026-06-26', 'Phòng KTAT', 'Phòng họp NPSC'],
    ])
  })

  it('viết tắt tên đơn vị: không phân biệt dấu / hoa thường / "cty", bỏ ngoặc trùng', () => {
    expect(vietTat('Tập đoàn Điện lực Việt Nam')).toBe('EVN')
    expect(vietTat('Tổng công ty Điện lực miền Bắc (NPC)')).toBe('NPC')
    expect(vietTat('Tổng cty điện lực Miền Bắc')).toBe('NPC')
    expect(vietTat('Công ty Công nghệ Thông tin Điện lực miền Bắc')).toBe('NPC IT')
    expect(vietTat('Công ty Điện lực Hưng Yên')).toBe('PC Hưng Yên')
    expect(vietTat('Cty  điện lực Hưng Yên')).toBe('PC Hưng Yên')
    // mọi PC tỉnh, không chỉ Hưng Yên
    expect(vietTat('Công ty Điện lực Tuyên Quang')).toBe('PC Tuyên Quang')
    expect(vietTat('Công ty Điện lực Thái Nguyên (PC Thái Nguyên)')).toBe('PC Thái Nguyên')
    expect(vietTat('Công ty Dịch vụ Điện lực miền Bắc')).toBe('Công ty Dịch vụ Điện lực miền Bắc')
    expect(vietTat('Công ty Điện lực')).toBe('Công ty Điện lực')
    expect(vietTat('Tổng công ty (NPC)')).toBe('Tổng công ty (NPC)')
    expect(vietTat('Phòng Kỹ thuật An toàn')).toBe('Phòng KTAT')
    expect(vietTat('Phòng Kế hoạch vật tư')).toBe('Phòng KHVT')
    expect(vietTat('Ban GĐ NPSC')).toBe('Ban GĐ NPSC')
    expect(vietTat('Kỹ thuật an toàn và Kế hoạch vật tư')).toBe('KTAT và KHVT')
    const b2 = hs('2026-06-24', 'x', '', ['Tổng công ty Điện lực miền Bắc', 'Phòng Kỹ thuật An toàn'])
    expect(dongLichTuan([b2])[0].thanhPhan).toBe('NPC, Phòng KTAT')
  })

  it('thứ và khoảng tuần thứ Hai – Chủ nhật', () => {
    expect(thuCua('2026-06-24')).toBe('Thứ Tư')
    expect(thuCua('2026-06-28')).toBe('Chủ nhật')
    expect(khoangTuan(['2026-06-26', '2026-06-24'])).toBe('(Từ ngày 22/06/2026 đến ngày 28/06/2026)')
    expect(khoangTuan(['2026-06-28'])).toBe('(Từ ngày 22/06/2026 đến ngày 28/06/2026)')
    expect(khoangTuan([''])).toContain('……')
  })

  it('file Word: A4 ngang, đủ 4 cột, có nội dung, ký tự đặc biệt được thoát', async () => {
    const dong = dongLichTuan([a, b])
    dong[1].noiDung = 'Họp <đề tài> & "CBM"'
    const tt = thongTinMacDinh({ ...DEFAULT_SETTINGS, donVi: 'Công ty X', boPhan: 'Phòng KTAT', hoTen: 'Nguyễn Văn A' }, dong)
    const zip = new PizZip(await taoDocxLichTuan(dong, tt).arrayBuffer())
    const xml = zip.file('word/document.xml')!.asText()
    expect(xml).toContain('w:orient="landscape"')
    for (const t of ['Ngày', 'Nội dung làm việc', 'Thành phần làm việc', 'Địa điểm', 'Thứ Tư', '24/06/2026', 'CÔNG TY X', 'Nguyễn Văn A', 'Tổng công ty (NPC), Ban GĐ NPSC, phòng KTAT'])
      expect(xml).toContain(t)
    expect(xml).toContain('Họp &lt;đề tài&gt; &amp; &quot;CBM&quot;')
    expect(new DOMParser().parseFromString(xml, 'application/xml').getElementsByTagName('parsererror')).toHaveLength(0)
  })
})

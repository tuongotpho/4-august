import PizZip from 'pizzip'
import { describe, expect, it } from 'vitest'
import { emptyDossier, emptyInvoice } from '../src/lib/model'
import { dongLichTuan, khoangTuan, taoDocxLichTuan, thongTinMacDinh, thuCua } from '../src/lib/lichTuan'
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

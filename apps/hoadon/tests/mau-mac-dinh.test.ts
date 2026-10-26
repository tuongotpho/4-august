import { readFileSync, writeFileSync } from 'node:fs'
import PizZip from 'pizzip'
import { describe, expect, it } from 'vitest'
import { fillTemplate, inspectTemplate } from '../src/lib/docx'
import { emptyDossier, emptyInvoice } from '../src/lib/model'
import { buildTemplateData, oThieu } from '../src/lib/tags'
import { DEFAULT_SETTINGS } from '../src/lib/types'

// Mẫu in mặc định (public/mau): đọc được, không có ô gõ sai tên, điền ra đúng chữ.
const buf = (f: string) => {
  const b = readFileSync(`public/mau/${f}`)
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
}
const chu = async (blob: Blob) => {
  const xml = new PizZip(await blob.arrayBuffer()).file('word/document.xml')!.asText()
  return [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('')
}

const hd = (soHd: string, tongTien: number) => ({
  ...emptyInvoice(), soHd, kyHieu: '1C26TAA', ngayHd: '2026-09-25', tenNguoiBan: 'Công ty TNHH Thử', mstNguoiBan: '0100000000', tongTien,
  stkNguoiBan: '123', tenTaiKhoan: 'CONG TY THU', nganHangNguoiBan: 'Ngân hàng Thử',
})
const hoSo = (invoices: ReturnType<typeof hd>[]) => ({
  ...emptyDossier(), noiDung: 'Làm việc thử', nguoiDeNghi: 'Người Thử', ngayToTrinh: '2026-09-18', ngayDntt: '2026-10-26', invoices,
})

describe('mẫu mặc định', () => {
  for (const [f, kind] of [['to-trinh.docx', 'toTrinh'], ['de-nghi-thanh-toan.docx', 'dntt']] as const) {
    it(`${f}: đọc được, mọi ô đúng tên, đủ ô bắt buộc`, () => {
      const k = inspectTemplate(buf(f))
      expect(k.ok, k.error).toBe(true)
      expect(k.unknown).toEqual([])
      expect(oThieu(kind, k.tags)).toEqual([])
    })
  }

  it('mẫu tải lên là file ĐÃ ĐIỀN (không còn ô) -> báo thiếu mọi mục', () => {
    expect(oThieu('dntt', [])).toEqual(['người đề nghị', 'nội dung', 'tổng tiền', 'hóa đơn'])
    expect(oThieu('toTrinh', ['ngay_to_trinh_ngay', 'ngay_to_trinh_thang', 'noi_dung'])).toEqual(['thành phần tham gia', 'số tiền dự trù'])
    expect(oThieu('toTrinh', ['thanh_phan.don_vi', 'noi_dung', 'du_tru', 'ngay_to_trinh'])).toEqual([])
  })

  it('đề nghị thanh toán (Mẫu 05-TT, TT 99/2025): điền ngày, người, tiền, từng hóa đơn', async () => {
    const d = hoSo([hd('101', 1_000_000), hd('102', 2_000_000)])
    const blob = fillTemplate(buf('de-nghi-thanh-toan.docx'), buildTemplateData(d, DEFAULT_SETTINGS))
    if (process.env.XUAT_THU) writeFileSync(process.env.XUAT_THU, Buffer.from(await blob.arrayBuffer()))
    const t = await chu(blob)
    expect(t).toContain('Thông tư số 99/2025/TT-BTC')
    expect(t).toContain('Ngày 26 tháng 10 năm 2026')
    expect(t).toContain('Họ và tên người đề nghị thanh toán: Người Thử')
    expect(t).toContain('Nội dung thanh toán: Làm việc thử;')
    expect(t).toContain('Số tiền : 3.000.000 VNĐ')
    expect(t).toContain('01 tờ trình ngày 18 tháng 09 năm 2026.')
    expect(t).toContain('số 101 (1C26TAA) ngày 25/09/2026.')
    expect(t).toContain('số 102 (1C26TAA) ngày 25/09/2026.')
    expect(t).not.toContain('Thông tin thanh toán') // dưới 5 triệu: không in tài khoản người bán
    expect(t).not.toMatch(/[{}]/)
  })

  it('đề nghị thanh toán: hóa đơn từ 5 triệu thì in thông tin tài khoản người bán', async () => {
    const t = await chu(fillTemplate(buf('de-nghi-thanh-toan.docx'), buildTemplateData(hoSo([hd('103', 6_000_000)]), DEFAULT_SETTINGS)))
    expect(t).toContain('Thông tin thanh toán:')
    expect(t).toContain('Tên tài khoản: CONG TY THU')
    expect(t).toContain('Số tài khoản: 123')
  })
})

// XUẤT BÁO CÁO TÀI CHÍNH RA WORD ĐÚNG MẪU: mở chính file mẫu Word của Thông tư (public/mau/bctc/*.docx), điền số vào ô
// "Số cuối năm / Số đầu năm" (hoặc "Năm nay / Năm trước") của đúng dòng theo MÃ SỐ, điền đơn vị, địa chỉ, ngày, đơn vị tính,
// tên người đại diện. Không dựng lại bảng — khổ giấy, phông, viền, khung ký giữ nguyên như mẫu.
// Chạy được cả trên trình duyệt lẫn trong test (fflate).
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'

export interface ThongTinMau {
  donVi: string
  diaChi: string
  /** Dòng "Tại ngày ... tháng ... năm ..." (B01): dd/MM/yyyy */
  taiNgay?: string
  /** Dòng "Năm ......" dưới tiêu đề (B02) */
  nam?: string
  donViTinh?: string
  /** Tên người đại diện theo pháp luật, ghi dưới khung ký */
  nguoiDaiDien?: string
}

const xmlChu = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Số theo kiểu báo cáo tài chính: 1.234.567; số âm ghi trong ngoặc (1.234.567) */
export const soBaoCao = (v: number) => (v < 0 ? `(${Math.round(-v).toLocaleString('vi-VN')})` : Math.round(v).toLocaleString('vi-VN'))

/** Thay nội dung một <w:t> đúng bằng `cu` (khớp nguyên văn, bỏ khoảng trắng hai đầu) */
function thayRun(xml: string, kiemTra: (t: string) => boolean, moi: (t: string) => string): string {
  return xml.replace(/(<w:t(?:\s[^>]*)?>)([^<]*)(<\/w:t>)/g, (m, mo: string, t: string, dong: string) =>
    kiemTra(t) ? `${mo.includes('xml:space') ? mo : mo.replace('<w:t', '<w:t xml:space="preserve"')}${xmlChu(moi(t))}${dong}` : m)
}

/** Ghi chữ vào một ô đang trống: thêm một <w:r> mang đúng định dạng chữ (rPr) của đoạn trong ô */
function ghiVaoO(tc: string, chu: string): string {
  const p = tc.lastIndexOf('</w:p>')
  if (p < 0) return tc
  const rPr = /<w:pPr>[\s\S]*?(<w:rPr>[\s\S]*?<\/w:rPr>)[\s\S]*?<\/w:pPr>/.exec(tc)?.[1] ?? ''
  return `${tc.slice(0, p)}<w:r>${rPr}<w:t xml:space="preserve">${xmlChu(chu)}</w:t></w:r>${tc.slice(p)}`
}

const chuCuaO = (tc: string) => [...tc.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('').trim()

/**
 * Điền số vào bảng: dòng nào có một ô chứa đúng một mã số (vd "110", "01") thì ghi `cot1[ma]` vào ô kế cuối và `cot2[ma]` vào ô
 * cuối của dòng (mẫu B01/B02-DNSN: Số cuối năm | Số đầu năm, Năm nay | Năm trước). Trả về các mã đã điền.
 */
function dienBang(xml: string, cot1: Record<string, number>, cot2: Record<string, number>): { xml: string; daDien: string[] } {
  const daDien: string[] = []
  const moi = xml.replace(/<w:tr[ >][\s\S]*?<\/w:tr>/g, (tr) => {
    const o = [...tr.matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map((m) => m[0])
    if (o.length < 3) return tr
    const ma = o.map(chuCuaO).find((t, i) => i > 0 && /^\d{2,3}[ab]?$/.test(t))
    if (!ma || !(ma in cot1 || ma in cot2)) return tr
    const iA = o.length - 2
    const iB = o.length - 1
    if (chuCuaO(o[iA]) || chuCuaO(o[iB])) return tr // ô đã có chữ: không ghi đè mẫu
    let kq = tr
    if (ma in cot1) kq = kq.replace(o[iA], ghiVaoO(o[iA], soBaoCao(cot1[ma])))
    if (ma in cot2) kq = kq.replace(o[iB], ghiVaoO(o[iB], soBaoCao(cot2[ma])))
    daDien.push(ma)
    return kq
  })
  return { xml: moi, daDien }
}

/** Điền thông tin đầu trang, ngày, đơn vị tính, người đại diện */
function dienThongTin(xml: string, tt: ThongTinMau): string {
  let x = xml
  x = thayRun(x, (t) => /^ĐƠN VỊ:\s*\.+\s*$/.test(t), () => `ĐƠN VỊ: ${tt.donVi}`)
  // "Địa chỉ:" là một run, dấu chấm là run ngay sau
  x = x.replace(/(<w:t(?:\s[^>]*)?>Địa chỉ:<\/w:t>[\s\S]*?<w:t)((?:\s[^>]*)?>)(\.{3,}\s*)(<\/w:t>)/, (_m, a: string, b: string, _c: string, d: string) =>
    `${a}${b.includes('xml:space') ? b : ' xml:space="preserve"' + b} ${xmlChu(tt.diaChi)}${d}`)
  if (tt.taiNgay) {
    const [dd, mm, yyyy] = tt.taiNgay.split('/')
    x = thayRun(x, (t) => /^Tại ngày\s*\.+\s*tháng\s*\.+\s*năm\s*\.+\s*$/.test(t), () => `Tại ngày ${dd} tháng ${mm} năm ${yyyy}`)
  }
  if (tt.nam) x = thayRun(x, (t) => /^Năm\s*\.{3,}\s*$/.test(t), () => `Năm ${tt.nam}`)
  x = thayRun(x, (t) => /^Đơn vị tính:\s*\.+\s*$/.test(t), () => `Đơn vị tính: ${tt.donViTinh ?? 'Đồng Việt Nam'}`)
  if (tt.nguoiDaiDien) {
    // Thêm tên dưới khung ký "NGƯỜI ĐẠI DIỆN THEO PHÁP LUẬT" (chừa 3 dòng trống để ký, đóng dấu)
    x = x.replace(/<w:tc>(?:(?!<\/w:tc>)[\s\S])*?NGƯỜI ĐẠI DIỆN[\s\S]*?<\/w:tc>/, (tc) => {
      const rPr = /<w:rPr>[\s\S]*?<\/w:rPr>/.exec(tc)?.[0]?.replace(/<w:i\/>|<w:iCs\/>/g, '') ?? ''
      const rong = '<w:p><w:pPr><w:jc w:val="center"/></w:pPr></w:p>'.repeat(3)
      const ten = `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r>${rPr.replace('<w:rPr>', '<w:rPr><w:b/>')}<w:t xml:space="preserve">${xmlChu(tt.nguoiDaiDien!)}</w:t></w:r></w:p>`
      return tc.replace(/<\/w:tc>$/, `${rong}${ten}</w:tc>`)
    })
  }
  return x
}

/** Điền một file mẫu Word BCTC. Ném lỗi nếu file không phải mẫu (không có word/document.xml) */
export function dienMauWord(mau: Uint8Array, cot1: Record<string, number>, cot2: Record<string, number>, tt: ThongTinMau): { docx: Uint8Array; daDien: string[] } {
  const tep = unzipSync(mau)
  const goc = tep['word/document.xml']
  if (!goc) throw new Error('File mẫu không phải Word (.docx) hợp lệ')
  const { xml, daDien } = dienBang(strFromU8(goc), cot1, cot2)
  tep['word/document.xml'] = strToU8(dienThongTin(xml, tt))
  return { docx: zipSync(tep, { level: 6 }), daDien }
}

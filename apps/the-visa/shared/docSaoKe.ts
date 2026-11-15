// Dựng kỳ sao kê VPBank từ chữ OCR (có toạ độ). Không phụ thuộc trình duyệt hay Node.
// Mẫu sao kê: bảng 7 cột Ngày GD | Ngày HT | Chi tiết | Số tiền GD | Loại tiền | Phí | Số tiền thanh toán.
import type { Chu, GiaoDich, Ky } from './kieu.js'

const RE_TIEN = /^[-–—]?\d{1,3}(?:[,.]\d{3})*[.,]00$/ // VND trên sao kê luôn có phần lẻ .00
const RE_NGAY = /^(\d{2})\/(\d{2})\/(\d{2})$/
const RE_NGAY4 = /(\d{2})\/(\d{2})\/(\d{4})/g

/** "-1,200,206.00" -> -1200206 (bỏ phần lẻ .00).
 *  Chấp nhận cả kiểu OCR đặt sai dấu phân cách ("-29.22000"): sao kê VND luôn có phần lẻ "00". */
export function docTien(s: string): number | null {
  const t = s.replace(/[–—]/g, '-').replace(/[^\d,.\-]/g, '')
  const am = t.startsWith('-')
  if (RE_TIEN.test(t)) {
    const v = Number(t.replace('-', '').slice(0, -3).replace(/[,.]/g, ''))
    return am ? -v : v
  }
  const so = t.replace('-', '').replace(/[,.]/g, '')
  if (/^-?\d[\d.,]*\d$/.test(t) && /[.,]/.test(t) && so.length >= 4 && so.endsWith('00')) {
    const v = Number(so.slice(0, -2))
    return am ? -v : v
  }
  return null
}

const iso4 = (d: string, m: string, y: string) => `${y}-${m}-${d}`
/** "dd/mm/yy" -> YYYY-MM-DD; chấp nhận OCR rơi mất dấu "/" ("11/0626", "110626") */
const iso2 = (s: string) => {
  const m = RE_NGAY.exec(s)
  if (m) return `20${m[3]}-${m[2]}-${m[1]}`
  const so = s.replace(/\D/g, '')
  if (so.length !== 6 || !/^[\d/]+$/.test(s)) return null
  const [d, th, y] = [so.slice(0, 2), so.slice(2, 4), so.slice(4)]
  return +d >= 1 && +d <= 31 && +th >= 1 && +th <= 12 ? `20${y}-${th}-${d}` : null
}

interface Dong {
  y: number
  chu: Chu[]
  text: string
}

/** Gom chữ thành dòng theo toạ độ dọc (OCR hay tách cột thành khối riêng, nên tự gom lại) */
export function gomDong(chu: Chu[]): Dong[] {
  const ds = chu.filter((c) => c.text.trim()).sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2)
  const dong: { y: number; cao: number; chu: Chu[] }[] = []
  for (const c of ds) {
    const y = (c.y0 + c.y1) / 2
    const cao = c.y1 - c.y0
    const d = dong[dong.length - 1]
    if (d && Math.abs(y - d.y) < Math.max(cao, d.cao) * 0.55) {
      d.chu.push(c)
      d.y = (d.y * (d.chu.length - 1) + y) / d.chu.length
    } else dong.push({ y, cao, chu: [c] })
  }
  return dong.map((d) => {
    const c = d.chu.sort((a, b) => a.x0 - b.x0)
    return { y: d.y, chu: c, text: c.map((x) => x.text).join(' ') }
  })
}

export interface KetQuaDoc {
  ky: Ky | null
  loi: string[]
  /** đã gặp dòng "Đã thanh toán" cuối bảng giao dịch -> các trang sau không cần đọc */
  hetBang: boolean
}

/** Các trang (mỗi trang một mảng chữ + bề rộng ảnh) -> kỳ sao kê */
export function dungKy(trang: { chu: Chu[]; rong: number }[], tenFile = ''): KetQuaDoc {
  const loi: string[] = []
  let tu = '', den = ''
  let tongDong: number[] | null = null
  let hanTra: string | undefined, toiThieu: number | undefined, hanMuc: number | undefined
  let tongPS: number | undefined, tongTra: number | undefined
  const gd: GiaoDich[] = []
  let cho: string | null = null // ngày GD in lệch lên dòng trên (hay gặp ở đầu trang)
  let ketThuc = false

  for (const t of trang) {
    if (ketThuc) break
    const R = t.rong
    let xMoTa = 0
    let cuoi: GiaoDich | null = null
    for (const d of gomDong(t.chu)) {
      const txt = d.text
      // Kỳ sao kê
      if (!tu && /cycle|sao k/i.test(txt)) {
        const m = [...txt.matchAll(RE_NGAY4)]
        if (m.length >= 2) {
          tu = iso4(m[0][1], m[0][2], m[0][3])
          den = iso4(m[1][1], m[1][2], m[1][3])
        }
      }
      if (hanMuc === undefined && /limit|H[aạ]n m[uứ]c/i.test(txt)) {
        const v = d.chu.map((c) => docTien(c.text)).find((v) => v !== null)
        if (v) hanMuc = Math.abs(v)
      }
      const tien = d.chu.map((c) => docTien(c.text)).filter((v): v is number => v !== null)
      // Dòng hạn trả: dd/mm/yyyy + 3 số tiền
      const n4 = [...txt.matchAll(RE_NGAY4)]
      if (!hanTra && n4.length === 1 && tien.length >= 3 && !RE_NGAY.test(d.chu[0].text)) {
        hanTra = iso4(n4[0][1], n4[0][2], n4[0][3])
        toiThieu = Math.abs(tien[0])
      }
      // Dòng tóm tắt: đầu kỳ + phát sinh + đã trả = cuối kỳ
      if (!tongDong && tien.length >= 4) {
        for (let i = 0; i + 3 < tien.length; i++) {
          const [a, b, c, e] = tien.slice(i, i + 4)
          if (a + b + c === e && b !== 0) { tongDong = [a, b, c, e]; break }
        }
      }
      // dòng tổng CUỐI bảng giao dịch (bảng tóm tắt ở trang 1 cũng có chữ này nhưng nằm trên mọi giao dịch)
      if (gd.length && /Total debit|T[oổ]ng d[uư] n[oợ]/i.test(txt) && tien.length) tongPS = Math.abs(tien[tien.length - 1])
      if (gd.length && /Paid during|[ĐD][aã] thanh to[aá]n \//i.test(txt) && tien.length && tongPS !== undefined) {
        tongTra = Math.abs(tien[tien.length - 1])
        ketThuc = true
        break
      }

      // Dòng giao dịch
      const dau = d.chu.filter((c) => c.x0 < R * 0.3).map((c) => iso2(c.text.replace(/[^\d/]/g, ''))).filter((v): v is string => !!v)
      if (dau.length === 1 && tien.length === 0 && d.chu.length <= 2) { cho = dau[0]; continue }
      if (dau.length >= 1 && tien.length >= 1) {
        const ngay = dau.length >= 2 ? dau[0] : cho ?? dau[0]
        const ngayHT = dau.length >= 2 ? dau[1] : dau[0]
        cho = null
        const vtTien = d.chu.findIndex((c) => docTien(c.text) !== null)
        const moTaChu = d.chu.slice(0, vtTien).filter((c) => !iso2(c.text.replace(/[^\d/]/g, '')))
        if (moTaChu.length) xMoTa = moTaChu[0].x0
        const tienChu = d.chu.filter((c) => docTien(c.text) !== null)
        const tGD = tien[0], tTT = tien[tien.length - 1]
        const chuan = (c: Chu | undefined) => !!c && RE_TIEN.test(c.text.replace(/[–—]/g, '-').replace(/[^\d,.\-]/g, ''))
        const g: GiaoDich = {
          id: `${ngay}-${gd.length + 1}`, ngay, ngayHT,
          moTa: moTaChu.map((c) => c.text).join(' ').trim(),
          soTien: tTT,
        }
        if (tien.length >= 2 && Math.abs(tGD) !== Math.abs(tTT)) {
          // 2 cột lệch nhau: tin cột có định dạng chuẩn "x,xxx.00"; cả hai chuẩn (hoặc đều không) thì đánh dấu để người dùng soát
          const cGD = chuan(tienChu[0]), cTT = chuan(tienChu[tienChu.length - 1])
          if (cGD && !cTT) g.soTien = tGD
          else if (!(cTT && !cGD)) g.nghiSai = `hai cột số tiền khác nhau: ${tGD} / ${tTT}`
        }
        else if (tien.length >= 2 && Math.sign(tGD) !== Math.sign(tTT)) g.soTien = -Math.abs(tTT) // một cột mất dấu trừ
        const lech = (Date.parse(ngayHT) - Date.parse(ngay)) / 864e5
        if (!(lech >= 0 && lech <= 15)) g.nghiSai = `ngày GD ${ngay} / ngày hạch toán ${ngayHT} không hợp lý`
        gd.push(g)
        cuoi = g
        continue
      }
      // Dòng nối tiếp phần mô tả (xuống dòng trong ô "Chi tiết")
      if (cuoi && tien.length === 0 && dau.length === 0 && xMoTa && Math.abs(d.chu[0].x0 - xMoTa) < R * 0.04 && d.chu[d.chu.length - 1].x1 < R * 0.55) {
        cuoi.moTa += (/\S[_-]$/.test(cuoi.moTa) ? '' : ' ') + txt
        continue
      }
      if (cuoi && tien.length === 0 && dau.length === 0) cuoi = null
    }
  }

  if (!tu) loi.push('Không tìm thấy dòng "Kỳ sao kê"')
  if (!tongDong) loi.push('Không tìm thấy dòng tóm tắt (dư nợ đầu kỳ / phát sinh / đã trả / cuối kỳ)')
  if (!gd.length) loi.push('Không đọc được giao dịch nào')
  if (!tu || !tongDong) return { ky: null, loi, hetBang: ketThuc }
  const [a, b, c, e] = tongDong
  const ky: Ky = {
    id: `${tu}_${den}`, tu, den, hanMuc, hanTra, toiThieu,
    dauKy: -a, phatSinh: -b, daTra: c, cuoiKy: -e,
    giaoDich: gd, tenFile,
  }
  if (tongPS !== undefined && tongPS !== ky.phatSinh) loi.push(`Dòng "Tổng dư nợ phát sinh" (${tongPS}) khác bảng tóm tắt (${ky.phatSinh})`)
  if (tongTra !== undefined && tongTra !== ky.daTra) loi.push(`Dòng "Đã thanh toán" (${tongTra}) khác bảng tóm tắt (${ky.daTra})`)
  return { ky, loi, hetBang: ketThuc }
}

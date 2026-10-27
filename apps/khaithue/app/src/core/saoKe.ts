// SAO KÊ NGÂN HÀNG -> CÔNG NỢ. Đọc file Excel/CSV sao kê (tự dò cột theo tiêu đề, mỗi ngân hàng một mẫu),
// ghép từng giao dịch với hoá đơn (số tiền thanh toán + MST/tên đối tác trong nội dung + ngày), ra phải thu / phải trả
// theo đối tác, và cảnh báo hoá đơn mua từ 5 triệu chưa thấy chuyển khoản (Luật thuế GTGT 2024, từ 01/07/2025).
// Ghép tự động chỉ là gợi ý có căn cứ: người dùng gán tay được (ghepTay) và bản gán tay luôn thắng.

import type { CanhBao, HoaDon, LoaiHD } from './types.js'
import type { Kho } from './kho.js'
import { conHieuLuc } from './excel.js'
import { chuanTen } from './tongQuan.js'
import { NGUONG_KHONG_TIEN_MAT } from './hoaDonGoc.js'
import { tien } from './nhan.js'

type O = string | number | boolean | null | undefined

export interface GiaoDich {
  id: string // số thứ tự trong file (ổn định giữa các lần đọc cùng file)
  ngay: string // dd/MM/yyyy
  /** Tiền VÀO tài khoản (ghi có) */
  vao: number
  /** Tiền RA khỏi tài khoản (ghi nợ) */
  ra: number
  noiDung: string
  doiUng: string // tên / số tài khoản đối ứng nếu sao kê có cột riêng
  soDu: number | null
  /** Số bút toán / mã giao dịch của ngân hàng (số hiệu chứng từ trên sổ tiền gửi) */
  soCT?: string
}

export interface SaoKe {
  id: string
  tenFile: string
  nganHang: string // đoán từ tiêu đề file, có thể trống
  soTaiKhoan: string
  tuNgay: string
  denNgay: string
  giaoDich: GiaoDich[]
  /** Gán tay: giao dịch -> các khoá hoá đơn (rỗng = "không liên quan hoá đơn") */
  ghepTay?: Record<string, string[]>
}

// ───────────── Đọc file ─────────────

const chuan = (o: O) => String(o ?? '').normalize('NFC').replace(/\s+/g, ' ').trim()
const thuong = (o: O) => chuan(o).toLowerCase()

function soTien(o: O): number {
  if (typeof o === 'number') return Math.round(Math.abs(o))
  const s = chuan(o).replace(/[^\d.,-]/g, '')
  if (!s) return 0
  // "1.234.567" / "1,234,567" / "1,234,567.00" / "1.234.567,00"
  const boThapPhan = s.replace(/[.,]\d{1,2}$/, '')
  const n = Number(boThapPhan.replace(/[.,]/g, ''))
  return Number.isFinite(n) ? Math.abs(n) : 0
}

function ngayGD(o: O): string {
  if (typeof o === 'number' && o > 20000 && o < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(o) * 86400000)
    return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
  }
  const s = chuan(o)
  const m = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(s)
  if (m) return `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}`
  const i = /(\d{4})-(\d{2})-(\d{2})/.exec(s)
  return i ? `${i[3]}/${i[2]}/${i[1]}` : ''
}

const COT = {
  ngay: [/^ngày (giao dịch|gd|hạch toán|hiệu lực|thực hiện)/, /^ngày$/, /^transaction date/, /^date/, /^ngày/],
  ra: [/ghi nợ|phát sinh nợ|số tiền nợ|^nợ$|^ps nợ|tiền ra|^rút|debit|withdraw/],
  vao: [/ghi có|phát sinh có|số tiền có|^có$|^ps có|tiền vào|^gửi|credit|deposit/],
  soTien: [/^số tiền( giao dịch)?$|^amount$/],
  noiDung: [/nội dung|diễn giải|mô tả|chi tiết|description|remark|narrative/],
  doiUng: [/đối ứng|người (chuyển|nhận|hưởng)|tên (tài khoản|tk) đối|beneficiary|counterparty|đơn vị (thụ|chuyển)/],
  soDu: [/số dư|balance/],
  soCT: [/^bút toán|số bút toán|số (ct|chứng từ|tham chiếu)|mã giao dịch|transaction no|reference|^số gd/],
}

/** Đọc một sheet sao kê (mảng dòng như sheet_to_json header:1 raw:true). Không nhận ra cột thì null. */
export function docSaoKe(rows: O[][], tenFile: string): SaoKe | null {
  let iTd = -1
  let c: Record<keyof typeof COT, number> | null = null
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const td = (rows[i] ?? []).map(thuong)
    const tim = (res: RegExp[]) => {
      for (const re of res) {
        const k = td.findIndex((t) => t && re.test(t))
        if (k >= 0) return k
      }
      return -1
    }
    const thu = { ngay: tim(COT.ngay), ra: tim(COT.ra), vao: tim(COT.vao), soTien: tim(COT.soTien), noiDung: tim(COT.noiDung), doiUng: tim(COT.doiUng), soDu: tim(COT.soDu), soCT: tim(COT.soCT) }
    if (thu.ngay >= 0 && thu.noiDung >= 0 && ((thu.ra >= 0 && thu.vao >= 0) || thu.soTien >= 0)) {
      iTd = i
      c = thu
      break
    }
  }
  if (!c) return null
  const dau = rows.slice(0, iTd).flat().map(chuan).join(' ')
  const giaoDich: GiaoDich[] = []
  rows.slice(iTd + 1).forEach((r, i) => {
    if (!r) return
    const ngay = ngayGD(r[c!.ngay])
    if (!ngay) return
    let vao = c!.vao >= 0 ? soTien(r[c!.vao]) : 0
    let ra = c!.ra >= 0 ? soTien(r[c!.ra]) : 0
    if (c!.vao < 0 || c!.ra < 0) {
      // một cột "Số tiền" có dấu: âm = ra, dương = vào
      const raw = r[c!.soTien]
      const am = typeof raw === 'number' ? raw < 0 : /^\s*-|\(.*\)/.test(chuan(raw))
      const st = soTien(raw)
      vao = am ? 0 : st
      ra = am ? st : 0
    }
    if (!vao && !ra) return
    giaoDich.push({ id: `${iTd + 2 + i}`, ngay, vao, ra, noiDung: chuan(r[c!.noiDung]), doiUng: c!.doiUng >= 0 ? chuan(r[c!.doiUng]) : '', soDu: c!.soDu >= 0 ? soTien(r[c!.soDu]) || null : null, ...(c!.soCT >= 0 && chuan(r[c!.soCT]) ? { soCT: chuan(r[c!.soCT]) } : {}) })
  })
  if (!giaoDich.length) return null
  const iso = (d: string) => d.split('/').reverse().join('')
  const sx = [...giaoDich].sort((a, b) => iso(a.ngay).localeCompare(iso(b.ngay)))
  const nhTho = /(vietcombank|vcb|bidv|agribank|techcombank|vietinbank|mb ?bank|quân đội|military commercial|acb|vpbank|sacombank|tpbank|shb|hdbank|ocb|msb|seabank|vib|lienvietpostbank|lpbank)/i.exec(dau + ' ' + tenFile)?.[1] ?? ''
  const nh = /quân đội|military|mb ?bank/i.test(nhTho) ? 'MB' : nhTho
  return {
    id: '', tenFile, nganHang: nh.toUpperCase(), soTaiKhoan: /(?:số tài khoản|tài khoản|account (?:no|number))[^\d]{0,20}(\d{6,20})/i.exec(dau)?.[1] ?? '',
    tuNgay: sx[0].ngay, denNgay: sx.at(-1)!.ngay, giaoDich,
  }
}

// ───────────── Ghép giao dịch với hoá đơn, công nợ ─────────────

export interface HoaDonCongNo {
  khoa: string
  l: LoaiHD
  kh: string
  so: string
  ng: string
  mst: string // MST đối tác
  ten: string
  tong: number // tiền thanh toán (chưa thuế + thuế)
  daTra: number // đã thanh toán (chuyển khoản ghép được + tiền mặt theo sổ quỹ)
  tienMat: number // phần trả / thu bằng tiền mặt (sổ quỹ)
  giaoDich: string[] // "idSaoKe#idGD"
}

export interface DoiTacCongNo {
  l: LoaiHD
  mst: string
  ten: string
  tongHoaDon: number
  daThanhToan: number
  conNo: number // phải thu (bán) / phải trả (mua)
  soHoaDon: number
}

export interface KetQuaCongNo {
  soGiaoDich: number
  daGhep: number
  chuaGhep: { saoKe: string; gd: GiaoDich }[]
  hoaDon: HoaDonCongNo[]
  doiTac: DoiTacCongNo[]
  phaiThu: number
  phaiTra: number
  /** Hoá đơn mua từ 5 triệu (lập từ 01/07/2025) chưa thấy chuyển khoản */
  muaChuaChuyenKhoan: HoaDonCongNo[]
  canhBao: CanhBao[]
}

const isoN = (dmy: string) => dmy.split('/').reverse().join('-')
const ngayMs = (dmy: string) => Date.parse(isoN(dmy))

/** Bỏ dấu tiếng Việt, viết hoa (nội dung chuyển khoản ngân hàng thường không dấu) */
const khongDau = (s: string) => chuanTen(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/Đ/g, 'D').replace(/đ/g, 'd').toUpperCase()
const TU_CHUNG = new Set(('CONG TY TNHH CO PHAN MOT THANH VIEN THUONG MAI DICH VU SAN XUAT VA XAY DUNG DAU TU PHAT TRIEN VAN TAI ' +
  'NANG LUONG XANH VIET NAM PHU THO HA NOI MTV CP TM DV CHI NHANH TONG HOP KINH DOANH').split(' '))

/** Nội dung chuyển khoản có nhắc tới đối tác (MST: 3 điểm; ≥ 2 chữ đặc trưng trong tên: 2 điểm; số hoá đơn: 1 điểm) */
function nhacToi(gd: GiaoDich, h: HoaDonCongNo): number {
  const nd = khongDau(`${gd.noiDung} ${gd.doiUng}`)
  let diem = 0
  if (h.mst && nd.replace(/\s/g, '').includes(h.mst)) diem += 3
  const tu = [...new Set(khongDau(h.ten).split(' ').filter((t) => t.length >= 2 && !TU_CHUNG.has(t)))]
  const trung = tu.filter((t) => new RegExp(`(^|[^A-Z0-9])${t}([^A-Z0-9]|$)`).test(nd)).length
  if (tu.length && trung >= Math.min(2, tu.length)) diem += 2
  if (new RegExp(`(HD|HOA DON|SO)\\s*0*${h.so}([^0-9]|$)`).test(nd)) diem += 1
  return diem
}

export function tinhCongNo(kho: Kho, mst: string, dsSaoKe: SaoKe[], cuaSoNgay = 120, tienMat: Record<string, number> = {}): KetQuaCongNo {
  const hoaDon: HoaDonCongNo[] = Object.entries(kho.hoaDon?.[mst] ?? {})
    .filter(([, g]) => conHieuLuc({ trangThai: g.tt ?? '' } as HoaDon))
    .map(([khoa, g]) => ({ khoa, l: g.l, kh: g.kh, so: g.so, ng: g.ng, mst: (g.l === 'mua' ? g.mb : g.mm) ?? '', ten: g.ten, tong: g.v + g.t, daTra: 0, tienMat: 0, giaoDich: [] }))
  const theoKhoa = new Map(hoaDon.map((h) => [h.khoa, h]))
  // Tiền mặt (sổ quỹ) trừ trước: phiếu thu/chi đã gắn đích danh hoá đơn
  for (const [k, st] of Object.entries(tienMat)) {
    const h = theoKhoa.get(k)
    if (!h) continue
    const lay = Math.min(st, h.tong - h.daTra)
    h.daTra += lay
    h.tienMat += lay
  }
  const chuaGhep: KetQuaCongNo['chuaGhep'] = []
  let soGD = 0
  let daGhep = 0
  for (const sk of dsSaoKe) {
    for (const gd of sk.giaoDich) {
      soGD++
      const ma = `${sk.id}#${gd.id}`
      const tay = sk.ghepTay?.[gd.id]
      if (tay) {
        // gán tay: chia tiền giao dịch lần lượt cho các hoá đơn được gán
        let con = gd.vao || gd.ra
        for (const k of tay) {
          const h = theoKhoa.get(k)
          if (!h) continue
          const lay = Math.min(con, h.tong - h.daTra)
          h.daTra += lay
          con -= lay
          h.giaoDich.push(ma)
        }
        daGhep++
        continue
      }
      const l: LoaiHD = gd.vao ? 'ban' : 'mua'
      const tienGD = gd.vao || gd.ra
      // ứng viên: cùng chiều, còn nợ, hoá đơn lập trong cửa sổ trước giao dịch (cho phép trả trước tới 7 ngày)
      const ung = hoaDon.filter((h) => h.l === l && h.daTra < h.tong && ngayMs(h.ng) <= ngayMs(gd.ngay) + 86400000 * 7 && ngayMs(gd.ngay) - ngayMs(h.ng) <= cuaSoNgay * 86400000)
      // 1) đúng số tiền một hoá đơn, ưu tiên hoá đơn có tên/MST trong nội dung, rồi hoá đơn gần ngày nhất
      const dungTien = ung.filter((h) => Math.abs(h.tong - h.daTra - tienGD) <= 1)
        .sort((a, b) => nhacToi(gd, b) - nhacToi(gd, a) || ngayMs(b.ng) - ngayMs(a.ng))
      if (dungTien.length && (nhacToi(gd, dungTien[0]) > 0 || dungTien.length === 1)) {
        dungTien[0].daTra += tienGD
        dungTien[0].giaoDich.push(ma)
        daGhep++
        continue
      }
      // 2) trả gộp nhiều hoá đơn của CÙNG đối tác (nội dung nhắc tới đối tác): trừ dần hoá đơn cũ nhất trước
      const cungDT = ung.filter((h) => nhacToi(gd, h) >= 2).sort((a, b) => ngayMs(a.ng) - ngayMs(b.ng))
      const tongNo = cungDT.reduce((s, h) => s + h.tong - h.daTra, 0)
      if (cungDT.length && tienGD <= tongNo + 1) {
        let con = tienGD
        for (const h of cungDT) {
          if (con <= 0) break
          const lay = Math.min(con, h.tong - h.daTra)
          h.daTra += lay
          con -= lay
          h.giaoDich.push(ma)
        }
        daGhep++
        continue
      }
      chuaGhep.push({ saoKe: sk.tenFile, gd })
    }
  }
  const dt = new Map<string, DoiTacCongNo>()
  for (const h of hoaDon) {
    const k = `${h.l}|${h.mst || chuanTen(h.ten)}`
    const x = dt.get(k) ?? { l: h.l, mst: h.mst, ten: h.ten, tongHoaDon: 0, daThanhToan: 0, conNo: 0, soHoaDon: 0 }
    x.tongHoaDon += h.tong
    x.daThanhToan += h.daTra
    x.conNo += h.tong - h.daTra
    x.soHoaDon++
    dt.set(k, x)
  }
  const doiTac = [...dt.values()].sort((a, b) => b.conNo - a.conNo)
  const coSaoKe = dsSaoKe.length > 0
  // chỉ xét hoá đơn nằm trong khoảng thời gian các sao kê đã nạp (ngoài khoảng thì chưa biết)
  const trongKhoang = (ng: string) => dsSaoKe.some((s) => ngayMs(ng) >= ngayMs(s.tuNgay) - cuaSoNgay * 86400000 && ngayMs(ng) <= ngayMs(s.denNgay))
  const muaChuaChuyenKhoan = hoaDon.filter((h) => h.l === 'mua' && h.tong >= NGUONG_KHONG_TIEN_MAT && isoN(h.ng) >= '2025-07-01' && h.daTra - h.tienMat < h.tong - 1 && coSaoKe && trongKhoang(h.ng))
  const canhBao: CanhBao[] = []
  for (const h of muaChuaChuyenKhoan) {
    canhBao.push({ muc: 'chu_y', noiDung: `HĐ mua ${h.kh}-${h.so} ngày ${h.ng} (${h.ten}) ${tien(h.tong)} đ: ${h.daTra - h.tienMat ? `mới thấy chuyển khoản ${tien(h.daTra - h.tienMat)} đ` : 'chưa thấy chuyển khoản'}${h.tienMat ? ` (trả tiền mặt ${tien(h.tienMat)} đ)` : ''} trong sao kê — từ 5 triệu phải thanh toán không dùng tiền mặt mới được khấu trừ thuế` })
  }
  return {
    soGiaoDich: soGD, daGhep, chuaGhep, hoaDon, doiTac,
    phaiThu: doiTac.filter((d) => d.l === 'ban').reduce((s, d) => s + d.conNo, 0),
    phaiTra: doiTac.filter((d) => d.l === 'mua').reduce((s, d) => s + d.conNo, 0),
    muaChuaChuyenKhoan, canhBao,
  }
}

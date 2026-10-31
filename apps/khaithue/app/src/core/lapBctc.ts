// LẬP BÁO CÁO TÀI CHÍNH (bản nháp) từ dữ liệu đã có trong app — giai đoạn B (báo cáo 19).
// Năm tài chính từ 2026: mẫu THÔNG TƯ 99/2025/TT-BTC (B01-DN Báo cáo tình hình tài chính, B02-DN, B03-DN trực tiếp — mauBctc99.ts);
// năm 2025 trở về trước: mẫu TT200 như BCTC đã nộp. Năm đầu dùng TT99, số đầu năm đổi mã từ BCTC TT200 năm trước. Mỗi con số ghi rõ NGUỒN; chỗ app không có dữ liệu thì nhập tay (đánh dấu "nhập tay").
// KHÔNG ÉP CHO CÂN: tài sản và nguồn vốn tính độc lập, lệch bao nhiêu báo đúng bấy nhiêu để người lập tìm nguyên nhân.
// Kết quả có cùng dạng với BCTC đã nộp (SoLieuBctc) nên dùng chung bảng hiển thị và phép soát soatBctc().
import type { SoLieuBctc } from './bctc.js'
import { cdktTT200SangTT99, kqkdTT200SangTT99 } from './mauBctc99.js'
import { sangTT58 } from './mauBctc58.js'
import { sangTT133 } from './mauBctc133.js'
import { nhomHoaDon } from './hoaDonGoc.js'
import { tinhTrangKy, type Kho } from './kho.js'
import { boGiaoDichTrung, tinhCongNo, type GiaoDich, type SaoKe } from './saoKe.js'
import { lapSoQuy, QUY_TRONG } from './soQuy.js'

export interface NhapTayBctc {
  /** Hàng tồn kho cuối năm theo kiểm kê (mã 141) — bắt buộc phải có để tính giá vốn */
  tonKhoCuoi?: number
  /** Tỷ lệ lương tính vào chi phí bán hàng (0–1); còn lại vào chi phí quản lý. Mặc định 0 (như BCTC 2025) */
  tyLeLuongBanHang?: number
  /** Chi phí không được trừ khi tính thuế TNDN (cộng vào thu nhập tính thuế) */
  chiPhiKhongTru?: number
  /** Vốn góp thêm trong năm (bỏ trống = lấy giao dịch sao kê có chữ "góp vốn") */
  vonGopTang?: number
  /** Doanh thu tài chính (bỏ trống = cộng lãi tiền gửi nhận diện trên sao kê) */
  doanhThuTaiChinh?: number
}

export interface NguonSo {
  moTa: string
  nhapTay?: boolean
  /** Thiếu dữ liệu: số đang tạm tính, cần bổ sung */
  thieu?: boolean
}

export interface GiaoDichChuaRo {
  ngay: string
  noiDung: string
  vao: number
  ra: number
  /** Mã lưu chuyển tiền đang tạm xếp (06 / 07) */
  ma: string
}

export interface BanLapBctc {
  bctc: SoLieuBctc
  /** Nguồn từng ô: "cdkt:110", "kqkd:01", "lctt:01" */
  nguon: Record<string, NguonSo>
  /** Tổng tài sản − tổng nguồn vốn (0 = cân). Không tự bù vào khoản nào */
  chenhLech: number
  /** Những dữ liệu còn thiếu, ảnh hưởng tới độ đúng */
  thieu: string[]
  chuaPhanLoai: GiaoDichChuaRo[]
  /** Tiền thực tế cuối năm (số dư sao kê + tồn quỹ) — null nếu không có dữ liệu */
  tienThucTe: number | null
}

const nam = (dmy: string) => dmy.slice(6, 10)
const isoDmy = (dmy: string) => dmy.split('/').reverse().join('-')
const tien = (v: number) => Math.round(v).toLocaleString('vi-VN')
const conHieuLuc = (tt: string) => !/bị thay thế|xóa bỏ|xoá bỏ|hủy bỏ|huỷ bỏ/i.test(tt ?? '')
const khongDau = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/Đ/g, 'D').replace(/đ/g, 'd').toUpperCase()

/** Thuế suất TNDN: từ kỳ tính thuế 2025 doanh thu năm ≤ 3 tỷ: 15%, ≤ 50 tỷ: 17%; còn lại 20% */
export function thueSuatTndn(namTinh: number, doanhThu: number): number {
  if (namTinh < 2025) return 0.2
  if (doanhThu <= 3_000_000_000) return 0.15
  if (doanhThu <= 50_000_000_000) return 0.17
  return 0.2
}

/**
 * Xếp một giao dịch ngân hàng chưa ghép hoá đơn vào dòng lưu chuyển tiền theo nội dung.
 * 'noiBo' = chuyển giữa ngân hàng và quỹ tiền mặt (không phải dòng tiền vào / ra doanh nghiệp).
 */
export function xepGiaoDich(gd: Pick<GiaoDich, 'noiDung' | 'doiUng' | 'vao' | 'ra'>): { ma: string; ro: boolean } {
  const nd = khongDau(`${gd.noiDung} ${gd.doiUng}`)
  const vao = gd.vao > 0
  if (/RUT TIEN|RUT TM|\bATM\b|RUT MAT/.test(nd) && !vao) return { ma: 'noiBo', ro: true }
  if (/NOP TIEN MAT|NOP TM|NOP TIEN VAO TK/.test(nd) && vao) return { ma: 'noiBo', ro: true }
  if (/GOP VON|VON GOP/.test(nd) && vao) return { ma: '31', ro: true }
  if (/GIAI NGAN/.test(nd) && vao) return { ma: '33', ro: true }
  if (/TRA (NO )?GOC|THU NO GOC/.test(nd) && !vao) return { ma: '34', ro: true }
  if (/TRA LAI VAY|THU LAI VAY|LAI VAY/.test(nd) && !vao) return { ma: '04', ro: true }
  if (vao && /TRA LAI|LAI TIEN GUI|LAI NHAP VON|LAI KHONG KY HAN|\bINTEREST\b/.test(nd)) return { ma: '27', ro: true }
  if (/LUONG/.test(nd) && !vao) return { ma: '03', ro: true }
  if (/THUE|NSNN|KBNN|NGAN SACH|KHO BAC/.test(nd) && !vao) return { ma: /TNDN|THU NHAP DOANH NGHIEP|1052/.test(nd) ? '05' : '07', ro: true }
  if (/\bPHI\b|PHI DICH VU|PHI QUAN LY|SMS|\bFEE\b/.test(nd) && !vao) return { ma: '07', ro: true }
  return { ma: vao ? '06' : '07', ro: false }
}

/** Lập bản nháp BCTC năm `namLap` cho công ty `mst`. Số đầu năm lấy từ BCTC năm trước đã nạp (nếu có). */
/** Chế độ mẫu BCTC theo năm tài chính: TT99 áp dụng cho năm tài chính bắt đầu từ 01/01/2026 */
export const cheDoTheoNam = (namLap: number) => (namLap >= 2026 ? 'TT99' : 'TT200')

export type CheDoBctc = 'TT200' | 'TT133' | 'TT99' | 'TT58'

export interface NhanDienSieuNho {
  sieuNho: boolean
  laoDong: number | null
  doanhThu: number
  nguonVon: number | null
  giaiThich: string
}

/**
 * Doanh nghiệp siêu nhỏ (ngành thương mại, dịch vụ — Nghị định 80/2021): bình quân năm ≤ 10 lao động đóng BHXH và
 * (tổng doanh thu năm ≤ 10 tỷ HOẶC tổng nguồn vốn ≤ 3 tỷ). App lấy số lao động theo tờ khai 05/KK-TNCN (chỉ tiêu [16], gần đúng
 * với lao động đóng BHXH), doanh thu theo hoá đơn bán ra, nguồn vốn theo BCTC năm trước — chỉ để GỢI Ý, người lập tự xác nhận.
 */
export function nhanDienSieuNho(kho: Kho, mst: string, namLap: number): NhanDienSieuNho {
  const Y = String(namLap)
  const ld = [1, 2, 3, 4].map((q) => kho.tncn[mst]?.[`${Y}-Q${q}`]?.ct16).filter((x): x is number => x != null)
  const laoDong = ld.length ? ld.reduce((a, x) => a + x, 0) / ld.length : null
  let doanhThu = 0
  for (const h of Object.values(kho.hoaDon?.[mst] ?? {})) if (h.l === 'ban' && h.ng.slice(6, 10) === Y && conHieuLuc(h.tt)) doanhThu += h.v
  const truoc = Object.values(kho.toKhaiKhac?.[mst] ?? {}).filter((t) => t.bctc && t.ky === String(namLap - 1)).sort((a, b) => b.soLan - a.soLan)[0]?.bctc
  const nguonVon = truoc ? truoc.cdkt.cuoi['440'] ?? truoc.cdkt.cuoi['500'] ?? null : null
  const sieuNho = laoDong != null && laoDong <= 10 && (doanhThu <= 10_000_000_000 || (nguonVon != null && nguonVon <= 3_000_000_000))
  const giaiThich = `Lao động bình quân ${laoDong == null ? 'chưa rõ (thiếu 05/KK-TNCN)' : laoDong.toFixed(1)} (≤ 10); doanh thu năm ${tien(doanhThu)} (≤ 10 tỷ)` +
    `${nguonVon != null ? `; tổng nguồn vốn đầu năm ${tien(nguonVon)} (≤ 3 tỷ)` : ''} — tiêu chí ngành thương mại, dịch vụ.`
  return { sieuNho, laoDong, doanhThu, nguonVon, giaiThich }
}

/**
 * Mẫu gợi ý (chủ doanh nghiệp chốt 01/11/2026): trước 2026 TT200 như các năm đã nộp; năm 2026 TT133 (chế độ doanh nghiệp nhỏ và vừa,
 * TT58 chưa áp dụng cho năm tài chính bắt đầu 01/01/2026); từ 2027 TT58 nếu là doanh nghiệp siêu nhỏ, không thì TT133.
 */
export function cheDoGoiY(kho: Kho, mst: string, namLap: number): CheDoBctc {
  if (namLap < 2026) return 'TT200'
  if (namLap >= 2027 && nhanDienSieuNho(kho, mst, namLap).sieuNho) return 'TT58'
  return 'TT133'
}

/** Lập BCTC theo mẫu chọn: TT58 = lập chi tiết theo năm (TT200/TT99) rồi gộp sang 9 + 5 chỉ tiêu của doanh nghiệp siêu nhỏ */
export function lapBctcTheoMau(kho: Kho, mst: string, namLap: number, mau: CheDoBctc, nhap: NhapTayBctc = {}): BanLapBctc {
  const ban = lapBctc(kho, mst, namLap, nhap)
  const coSo = ban.bctc.cheDo
  if (mau === 'TT133') {
    const b = sangTT133(ban.bctc)
    const n = (k: string) => ban.nguon[k]
    const nguon: Record<string, NguonSo> = {
      'cdkt:110': n('cdkt:110'), 'cdkt:131': n('cdkt:131'), 'cdkt:141': n('cdkt:141'), 'cdkt:181': n(`cdkt:${coSo === 'TT99' ? '162' : '152'}`),
      'cdkt:311': n('cdkt:311'), 'cdkt:313': n(`cdkt:${coSo === 'TT99' ? '314' : '313'}`), 'cdkt:314': n(`cdkt:${coSo === 'TT99' ? '315' : '314'}`),
      'cdkt:411': n('cdkt:411'), 'cdkt:417': n(`cdkt:${coSo === 'TT99' ? '420' : '421'}`),
      'kqkd:01': n('kqkd:01'), 'kqkd:11': n('kqkd:11'), 'kqkd:21': n(`kqkd:${coSo === 'TT99' ? '22' : '21'}`),
      'kqkd:24': { moTa: `Chi phí bán hàng + chi phí quản lý (TT133 gộp thành chi phí quản lý kinh doanh). ${n('kqkd:26')?.moTa ?? ''}`, thieu: n('kqkd:26')?.thieu },
      'kqkd:51': n('kqkd:51'),
      'lctt:01': n('lctt:01'), 'lctt:02': n('lctt:02'), 'lctt:03': n('lctt:03'), 'lctt:06': n('lctt:06'), 'lctt:07': n('lctt:07'),
      'lctt:25': { moTa: 'Lãi tiền gửi nhận được (TT133: mã 25 hoạt động đầu tư).' }, 'lctt:31': n('lctt:31'), 'lctt:70': n('lctt:70'),
    }
    for (const k of Object.keys(nguon)) if (!nguon[k]) delete nguon[k]
    return { ...ban, bctc: b, nguon, chenhLech: b.cdkt.cuoi['200'] - b.cdkt.cuoi['500'] }
  }
  if (mau !== 'TT58') return ban
  const b = sangTT58(ban.bctc)
  const nguon: Record<string, NguonSo> = {
    'cdkt:110': ban.nguon['cdkt:110'],
    'cdkt:120': { moTa: `Phải thu khách hàng + trả trước người bán + thuế GTGT được khấu trừ (gộp từ bảng chi tiết ${coSo}).` },
    'cdkt:130': ban.nguon['cdkt:141'],
    'cdkt:310': { moTa: `Phải trả người bán + người mua trả trước + phải trả người lao động (gộp từ bảng chi tiết ${coSo}).` },
    'cdkt:320': ban.nguon[`cdkt:${coSo === 'TT99' ? '314' : '313'}`],
    'cdkt:410': ban.nguon['cdkt:411'],
    'cdkt:420': ban.nguon[`cdkt:${coSo === 'TT99' ? '420' : '421'}`],
    'kqkd:01': { moTa: 'Doanh thu thuần bán hàng + doanh thu tài chính + thu nhập khác. ' + (ban.nguon['kqkd:01']?.moTa ?? '') },
    'kqkd:02': { moTa: 'Giá vốn + chi phí bán hàng + chi phí quản lý + chi phí tài chính + chi phí khác. ' + (ban.nguon['kqkd:11']?.moTa ?? ''), thieu: ban.nguon['kqkd:11']?.thieu },
    'kqkd:10': ban.nguon['kqkd:51'],
  }
  return { ...ban, bctc: b, nguon, chenhLech: b.cdkt.cuoi['200'] - b.cdkt.cuoi['500'] }
}

/** Mã các chỉ tiêu app tự tính, theo từng mẫu (chỉ những mã khác nhau giữa TT200 và TT99) */
const MA = {
  TT200: { vat: '152', tsKhac: '150', thue: '313', nld: '314', ln: '421', tongTS: '270', dtTC: '21', cpTC: '22', cpVay: '23' },
  TT99: { vat: '162', tsKhac: '160', thue: '314', nld: '315', ln: '420', tongTS: '280', dtTC: '22', cpTC: '23', cpVay: '24' },
}

export function lapBctc(kho: Kho, mst: string, namLap: number, nhap: NhapTayBctc = {}): BanLapBctc {
  const Y = String(namLap)
  const cheDo = cheDoTheoNam(namLap)
  const M = MA[cheDo]
  const nguon: Record<string, NguonSo> = {}
  const thieu: string[] = []
  const ghi = (k: string, moTa: string, them: Omit<NguonSo, 'moTa'> = {}) => (nguon[k] = { moTa, ...them })

  // ---------- Số đầu năm: BCTC năm trước (bản bổ sung mới nhất) ----------
  const truoc = Object.values(kho.toKhaiKhac?.[mst] ?? {})
    .filter((t) => t.bctc && t.ky === String(namLap - 1))
    .sort((a, b) => b.soLan - a.soLan)[0]?.bctc
  let dau = truoc?.cdkt.cuoi ?? {}
  let kqTruoc = truoc?.kqkd.nay ?? {}
  if (truoc && truoc.cheDo !== 'TT99' && cheDo === 'TT99') {
    const doi = cdktTT200SangTT99(dau)
    dau = doi.so
    kqTruoc = kqkdTT200SangTT99(kqTruoc)
    if (doi.khongGhep.length) thieu.push(`Số đầu năm: các mã TT200 ${doi.khongGhep.join(', ')} không có chỉ tiêu tương ứng rõ ràng ở mẫu TT99 — tự xếp lại khi lập.`)
  }
  if (!truoc) thieu.push(`Chưa có BCTC năm ${namLap - 1} trong app — số đầu năm đang để 0. Nạp file XML BCTC năm ${namLap - 1} ở mục "BCTC đã nộp".`)
  const d = (m: string) => dau[m] ?? 0

  // ---------- Hoá đơn trong năm ----------
  let dtBan = 0, vatRa = 0, muaHang = 0, chiPhiKhac = 0, vatVao = 0, soBan = 0, soMua = 0, muaChuaRoNhom = 0
  for (const [k, h] of Object.entries(kho.hoaDon?.[mst] ?? {})) {
    if (nam(h.ng) !== Y || !conHieuLuc(h.tt)) continue
    if (h.l === 'ban') {
      dtBan += h.v; vatRa += h.t; soBan++
    } else {
      soMua++
      vatVao += h.t
      const g = kho.goc?.[mst]?.[k]
      const nhom = g ? nhomHoaDon(g, mst) : null
      if (nhom === 'khac') chiPhiKhac += h.v
      else {
        muaHang += h.v
        if (!g) muaChuaRoNhom++
      }
    }
  }
  if (!soBan) thieu.push(`Chưa có hoá đơn bán ra năm ${Y} — nạp danh sách hoá đơn (Excel tải từ cổng thuế) ở tab Tổng quan.`)
  if (muaChuaRoNhom) thieu.push(`${muaChuaRoNhom} hoá đơn mua vào chưa có file gốc nên chưa biết là hàng hoá hay chi phí — đang tính hết vào hàng mua (giá vốn). Nạp XML hoá đơn gốc để tách chi phí.`)

  // ---------- Lương (tờ khai 05/KK-TNCN 4 quý, chỉ tiêu [21]) ----------
  let luong = 0
  const quyThieu: number[] = []
  for (let q = 1; q <= 4; q++) {
    const ct = kho.tncn[mst]?.[`${Y}-Q${q}`]
    if (ct) luong += ct.ct21 ?? 0
    else quyThieu.push(q)
  }
  if (quyThieu.length) thieu.push(`Thiếu tờ khai 05/KK-TNCN quý ${quyThieu.join(', ')}/${Y} — chi phí lương có thể thiếu.`)
  const tyLeBH = Math.min(1, Math.max(0, nhap.tyLeLuongBanHang ?? 0))

  // ---------- Tiền: sao kê (bỏ trùng) + sổ quỹ ----------
  const dsSaoKe: SaoKe[] = Object.values(kho.saoKe?.[mst] ?? {})
  const quy = kho.soQuy?.[mst] ?? QUY_TRONG()
  const congNo = tinhCongNo(kho, mst, dsSaoKe, 120, lapSoQuy(kho, mst, quy).daTraTheoHoaDon)
  const loaiCuaGd = new Map<string, 'ban' | 'mua'>()
  for (const h of congNo.hoaDon) for (const g of h.giaoDich) loaiCuaGd.set(g, h.l)
  const lc: Record<string, number> = {}
  const cong = (ma: string, v: number) => (lc[ma] = (lc[ma] ?? 0) + v)
  const chuaPhanLoai: GiaoDichChuaRo[] = []
  const { ds: saoKeSach } = boGiaoDichTrung(dsSaoKe)
  let laiNhanDien = 0
  const soDuCuoi = new Map<string, { ngay: string; soDu: number }>()
  for (const sk of saoKeSach) {
    for (const gd of sk.giaoDich) {
      if (nam(gd.ngay) === Y && gd.soDu != null) {
        const tk = sk.soTaiKhoan || sk.id
        const cu = soDuCuoi.get(tk)
        if (!cu || isoDmy(gd.ngay) >= isoDmy(cu.ngay)) soDuCuoi.set(tk, { ngay: gd.ngay, soDu: gd.soDu })
      }
      if (nam(gd.ngay) !== Y) continue
      const ln = gd.vao - gd.ra
      const l = loaiCuaGd.get(`${sk.id}#${gd.id}`)
      if (l === 'ban') { cong('01', ln); continue }
      if (l === 'mua') { cong('02', ln); continue }
      const x = xepGiaoDich(gd)
      if (x.ma === 'noiBo') continue
      if (x.ma === '27') laiNhanDien += gd.vao
      cong(x.ma, ln)
      if (!x.ro) chuaPhanLoai.push({ ngay: gd.ngay, noiDung: gd.noiDung, vao: gd.vao, ra: gd.ra, ma: x.ma })
    }
  }
  if (!dsSaoKe.length) thieu.push(`Chưa có sao kê ngân hàng năm ${Y} — không tính được tiền và lưu chuyển tiền. Nạp sao kê ở tab Công nợ.`)
  for (const p of Object.values(quy.phieu)) {
    if (nam(p.ngay) !== Y) continue
    const v = p.loai === 'thu' ? p.soTien : -p.soTien
    if (p.nhom === 'rutNganHang' || p.nhom === 'nopNganHang') continue
    if (p.nhom === 'banHang') cong('01', v)
    else if (p.nhom === 'muaHang' || p.nhom === 'vanChuyen') cong('02', v)
    else if (p.nhom === 'luong') cong('03', v)
    else cong(p.loai === 'thu' ? '06' : '07', v)
  }
  // Lãi tiền gửi theo TT200 nằm ở hoạt động đầu tư (mã 27)
  const tongNhom = (ms: string[]) => ms.reduce((a, m) => a + (lc[m] ?? 0), 0)
  lc['20'] = tongNhom(['01', '02', '03', '04', '05', '06', '07'])
  lc['30'] = tongNhom(['21', '22', '23', '24', '25', '26', '27'])
  lc['40'] = tongNhom(['31', '32', '33', '34', '35', '36'])
  lc['50'] = lc['20'] + lc['30'] + lc['40']
  lc['60'] = d('110')
  lc['61'] = 0
  lc['70'] = lc['60'] + lc['50']
  const tonQuyCuoi = Object.keys(quy.phieu).length || quy.caiDat.tonDau ? lapSoQuy(kho, mst, quy, '', `31/12/${Y}`).tonCuoi : 0
  const tienThucTe = soDuCuoi.size || Object.keys(quy.phieu).length ? [...soDuCuoi.values()].reduce((a, x) => a + x.soDu, 0) + tonQuyCuoi : null

  // ---------- Kết quả kinh doanh ----------
  const tonCuoi = nhap.tonKhoCuoi ?? d('141')
  if (nhap.tonKhoCuoi == null) thieu.push('Chưa nhập hàng tồn kho cuối năm theo kiểm kê — đang tạm lấy bằng tồn đầu năm (giá vốn có thể sai).')
  const giaVon = d('141') + muaHang - tonCuoi
  const dtTC = nhap.doanhThuTaiChinh ?? laiNhanDien
  const cpBH = Math.round(luong * tyLeBH)
  const cpQL = luong - cpBH + chiPhiKhac
  const lnThuan = dtBan - giaVon + dtTC - cpBH - cpQL
  const lnTruocThue = lnThuan
  const thueSuat = thueSuatTndn(namLap, dtBan)
  const thuNhapTinhThue = Math.max(0, lnTruocThue + (nhap.chiPhiKhongTru ?? 0))
  const tndn = Math.round(thuNhapTinhThue * thueSuat)
  const lnst = lnTruocThue - tndn
  const kq: Record<string, number> = {
    '01': dtBan, '02': 0, '10': dtBan, '11': giaVon, '20': dtBan - giaVon, [M.dtTC]: dtTC, [M.cpTC]: 0, [M.cpVay]: 0, '25': cpBH, '26': cpQL,
    '30': lnThuan, '31': 0, '32': 0, '40': 0, '50': lnTruocThue, '51': tndn, '52': 0, '60': lnst,
  }

  // ---------- Bảng cân đối (tính độc lập từng khoản) ----------
  const c: Record<string, number> = {}
  c['110'] = c['111'] = tienThucTe ?? lc['70']
  // Công nợ ròng = đầu năm + hoá đơn (gồm thuế) − tiền đã thu / trả trong năm
  const thuRong = d('131') - d('312') + dtBan + vatRa - (lc['01'] ?? 0)
  const traRong = d('311') - d('132') + muaHang + chiPhiKhac + vatVao + (lc['02'] ?? 0)
  c['131'] = Math.max(0, thuRong); c['312'] = Math.max(0, -thuRong)
  c['311'] = Math.max(0, traRong); c['132'] = Math.max(0, -traRong)
  c['141'] = c['140'] = tonCuoi
  // Thuế GTGT: tờ khai quý 4 (bản bổ sung mới nhất, không thì bản lần đầu)
  const q4 = tinhTrangKy(kho, mst, `${Y}-Q4`)
  const pb = q4.boSungMoiNhat ?? q4.lanDau
  if (!pb) thieu.push(`Chưa có tờ khai GTGT quý 4/${Y} — thuế GTGT còn phải nộp / còn được khấu trừ cuối năm đang để 0.`)
  c[M.vat] = pb?.ct43 ?? 0
  const vatPhaiNop = pb?.ct40 ?? 0
  // Thuế TNDN năm nay chưa nộp: trừ số tạm nộp (chứng từ nộp tiền mã 1052 ghi kỳ thuế năm nay)
  let tamNop = 0
  for (const ct of Object.values(kho.chungTu?.[mst] ?? {})) for (const x of ct.dong) if (x.ndkt === '1052' && x.kyThue.includes(Y)) tamNop += x.tien
  c[M.thue] = vatPhaiNop + Math.max(0, tndn - tamNop)
  const traLuong = -(lc['03'] ?? 0)
  c[M.nld] = Math.max(0, luong - traLuong)
  c['411a'] = c['411'] = d('411') + (nhap.vonGopTang ?? Math.max(0, lc['31'] ?? 0))
  c[`${M.ln}a`] = d(M.ln)
  c[`${M.ln}b`] = lnst
  c[M.ln] = c[`${M.ln}a`] + c[`${M.ln}b`]
  c['130'] = c['131'] + c['132']
  c[M.tsKhac] = c[M.vat]
  c['100'] = c['110'] + c['130'] + c['140'] + c[M.tsKhac]
  c['200'] = 0
  c[M.tongTS] = c['100'] + c['200']
  c['310'] = c['311'] + c['312'] + c[M.thue] + c[M.nld]
  c['330'] = 0
  c['300'] = c['310'] + c['330']
  if (cheDo === 'TT99') c['400'] = c['411'] + c[M.ln]
  else {
    c['410'] = c['411'] + c[M.ln]
    c['430'] = 0
    c['400'] = c['410'] + c['430']
  }
  c['440'] = c['300'] + c['400']
  const chenhLech = c[M.tongTS] - c['440']

  // ---------- Nguồn từng ô ----------
  ghi('kqkd:01', `Cộng tiền chưa thuế ${soBan} hoá đơn bán ra năm ${Y} còn hiệu lực (bỏ hoá đơn bị thay thế / huỷ).`, soBan ? {} : { thieu: true })
  ghi('kqkd:11', `Tồn đầu năm ${tien(d('141'))} + hàng mua trong năm ${tien(muaHang)} (hoá đơn mua vào chưa thuế, trừ hoá đơn chi phí) − tồn cuối năm ${tien(tonCuoi)}.`, nhap.tonKhoCuoi == null ? { thieu: true } : {})
  ghi(`kqkd:${M.dtTC}`, nhap.doanhThuTaiChinh != null ? 'Nhập tay.' : `Lãi tiền gửi nhận diện trên sao kê (nội dung có "trả lãi", "lãi tiền gửi"…): ${tien(laiNhanDien)}.`, nhap.doanhThuTaiChinh != null ? { nhapTay: true } : {})
  ghi('kqkd:25', `Lương × ${Math.round(tyLeBH * 100)}% tính vào bán hàng.`, { nhapTay: nhap.tyLeLuongBanHang != null })
  ghi('kqkd:26', `Lương phần quản lý ${tien(luong - cpBH)} (tổng lương ${tien(luong)} = chỉ tiêu [21] của 05/KK-TNCN 4 quý) + hoá đơn chi phí ${tien(chiPhiKhac)}.`, quyThieu.length ? { thieu: true } : {})
  ghi('kqkd:51', `Thu nhập tính thuế ${tien(thuNhapTinhThue)}${nhap.chiPhiKhongTru ? ` (đã cộng chi phí không được trừ ${tien(nhap.chiPhiKhongTru)})` : ''} × ${Math.round(thueSuat * 100)}%${namLap >= 2025 ? ' (doanh thu năm ≤ 3 tỷ: 15%, ≤ 50 tỷ: 17%)' : ''}.`)
  ghi('cdkt:110', tienThucTe != null ? `Số dư sao kê ngày cuối năm (${soDuCuoi.size} tài khoản) + tồn quỹ tiền mặt ${tien(tonQuyCuoi)}.` : 'Chưa có sao kê / sổ quỹ — tạm lấy theo lưu chuyển tiền.', tienThucTe == null ? { thieu: true } : {})
  ghi('cdkt:131', `Phải thu đầu năm + hoá đơn bán (gồm thuế ${tien(dtBan + vatRa)}) − tiền khách trả trong năm (${tien(lc['01'] ?? 0)}); âm thì là người mua trả trước (mã 312).`)
  ghi('cdkt:311', `Phải trả đầu năm + hoá đơn mua (gồm thuế ${tien(muaHang + chiPhiKhac + vatVao)}) − tiền đã trả người bán (${tien(-(lc['02'] ?? 0))}); âm thì là trả trước người bán (mã 132).`)
  ghi('cdkt:141', nhap.tonKhoCuoi != null ? 'Nhập tay theo kiểm kê.' : 'CHƯA NHẬP — tạm bằng tồn đầu năm.', nhap.tonKhoCuoi != null ? { nhapTay: true } : { thieu: true })
  ghi(`cdkt:${M.vat}`, pb ? `Chỉ tiêu [43] tờ khai GTGT quý 4/${Y} (thuế còn được khấu trừ chuyển kỳ sau).` : 'Chưa có tờ khai GTGT quý 4.', pb ? {} : { thieu: true })
  ghi(`cdkt:${M.thue}`, `Thuế GTGT còn phải nộp [40] quý 4 ${tien(vatPhaiNop)} + thuế TNDN năm nay ${tien(tndn)} − đã tạm nộp ${tien(tamNop)}.`)
  ghi(`cdkt:${M.nld}`, `Lương chi phí ${tien(luong)} − lương đã trả trong năm ${tien(traLuong)}.`)
  ghi('cdkt:411', nhap.vonGopTang != null ? 'Vốn góp đầu năm + nhập tay vốn góp thêm.' : 'Vốn góp đầu năm + giao dịch sao kê có chữ "góp vốn".', { nhapTay: nhap.vonGopTang != null })
  ghi(`cdkt:${M.ln}`, `Lợi nhuận chưa phân phối đầu năm ${tien(d('421'))} + lợi nhuận sau thuế năm nay ${tien(lnst)} — tự tính, không sửa tay.`)
  ghi('lctt:01', 'Giao dịch ngân hàng đã ghép hoá đơn bán (tab Công nợ) + phiếu thu tiền bán hàng.')
  ghi('lctt:02', 'Giao dịch ngân hàng đã ghép hoá đơn mua + phiếu chi mua hàng, cước vận chuyển.')
  ghi('lctt:03', 'Giao dịch có chữ "lương" + phiếu chi lương.')
  ghi('lctt:06', `Tiền vào chưa ghép hoá đơn, chưa nhận ra loại (${chuaPhanLoai.filter((x) => x.ma === '06').length} giao dịch) + phiếu thu khác.`, chuaPhanLoai.some((x) => x.ma === '06') ? { thieu: true } : {})
  ghi('lctt:07', `Thuế khác, phí ngân hàng, tiền ra chưa nhận ra loại (${chuaPhanLoai.filter((x) => x.ma === '07').length} giao dịch) + phiếu chi khác.`, chuaPhanLoai.some((x) => x.ma === '07') ? { thieu: true } : {})
  ghi('lctt:31', 'Giao dịch sao kê có chữ "góp vốn".')
  ghi('lctt:70', tienThucTe != null ? `Tiền đầu kỳ + lưu chuyển trong kỳ. Tiền thực tế (sao kê + quỹ) = ${tien(tienThucTe)}${Math.abs(tienThucTe - lc['70']) > 1 ? ` — LỆCH ${tien(tienThucTe - lc['70'])}` : ''}.` : 'Tiền đầu kỳ + lưu chuyển trong kỳ.')
  if (chuaPhanLoai.length) thieu.push(`${chuaPhanLoai.length} giao dịch ngân hàng chưa ghép hoá đơn và chưa nhận ra loại — đang tạm xếp vào "thu khác / chi khác". Ghép ở tab Công nợ để chính xác.`)
  if (tienThucTe != null && Math.abs(tienThucTe - lc['70']) > 1) thieu.push(`Tiền cuối năm theo sao kê + quỹ (${tien(tienThucTe)}) khác tiền đầu năm + dòng tiền trong năm (${tien(lc['70'])}), lệch ${tien(tienThucTe - lc['70'])} — thiếu sao kê một số tháng, hoặc số đầu năm sai.`)

  const bctc: SoLieuBctc = {
    cheDo,
    nam: Y,
    tuNgay: `01/01/${Y}`,
    denNgay: `31/12/${Y}`,
    ngayLap: new Date().toISOString().slice(0, 10),
    nguoiKy: '',
    daKiemToan: false,
    cdkt: { cuoi: c, dau },
    kqkd: { nay: kq, truoc: kqTruoc },
    lctt: { phuongPhap: 'trucTiep', nay: lc, truoc: truoc?.lctt?.nay ?? {} },
    coThuyetMinh: false,
  }
  return { bctc, nguon, chenhLech, thieu, chuaPhanLoai, tienThucTe }
}

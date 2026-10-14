// Mô hình dữ liệu dùng chung cho web app, máy chủ (bot Telegram) và script nhập Excel.
// Chỉ theo dõi LỊCH GIẢNG. Ngày lưu dạng 'YYYY-MM-DD', giờ 'HH:mm' (giờ Việt Nam).

export type Buoi = 'sang' | 'chieu' | 'toi' | 'ca_ngay' | 'nhieu_ngay'
export type HinhThuc = 'online' | 'truc_tiep'
export type ThanhToan = 'chua' | 'da'
export type Nguon = 'web' | 'telegram' | 'excel'

export interface LopGiang {
  id: string
  ngay: string // YYYY-MM-DD (ngày đầu nếu học nhiều ngày)
  soNgay: number // 1 = một ngày; 2 = "22-23/2"…
  gioBD: string // 'HH:mm' hoặc '' nếu chưa rõ
  gioKT: string
  buoi: Buoi
  hinhThuc: HinhThuc
  doiTac: string // công ty đối tác gửi lớp (TIEC, ESC…)
  lienHe: string // người liên hệ bên đối tác
  khachHang: string // đơn vị được đào tạo
  diaDiem: string
  noiDung: string // chủ đề / ghi chú công việc
  chiPhi: number | null // thù lao (đồng); null = chưa thỏa thuận
  huy: boolean // lớp bị hủy (giữ lại để tra cứu)
  thanhToan: ThanhToan
  ngayTT: string // ngày nhận tiền, '' nếu chưa
  ghiChu: string
  nguon: Nguon
  tinGoc: string // tin nhắn gốc (Zalo dán sang Telegram) để đối chiếu
  eventId: string // sự kiện trên Google Calendar ('' = chưa đồng bộ)
  canDongBo: boolean // có thay đổi chưa đẩy lên Google Calendar
  taoLuc: number
  suaLuc: number
}

export interface CaiDat {
  /** Tên khác -> tên chuẩn của đối tác ("AT green" -> "Green"). Khóa = boDau(tên khác). */
  biDanhDoiTac: Record<string, string>
  /** Đồng bộ Google Calendar qua Apps Script (xem apps-script/Lich.gs) */
  lich: { url: string; khoa: string; bat: boolean }
}

export const CAI_DAT_MAC_DINH: CaiDat = { biDanhDoiTac: {}, lich: { url: '', khoa: '', bat: false } }

export const TEN_BUOI: Record<Buoi, string> = {
  sang: 'Sáng',
  chieu: 'Chiều',
  toi: 'Tối',
  ca_ngay: 'Cả ngày',
  nhieu_ngay: 'Nhiều ngày',
}

export const TEN_HINH_THUC: Record<HinhThuc, string> = { online: 'Online', truc_tiep: 'Trực tiếp' }

export function newId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}

export function lopMoi(p: Partial<LopGiang> = {}): LopGiang {
  const bayGio = Date.now()
  const l: LopGiang = {
    id: newId(),
    ngay: homNay(),
    soNgay: 1,
    gioBD: '',
    gioKT: '',
    buoi: 'sang',
    hinhThuc: 'truc_tiep',
    doiTac: '',
    lienHe: '',
    khachHang: '',
    diaDiem: '',
    noiDung: '',
    chiPhi: null,
    huy: false,
    thanhToan: 'chua',
    ngayTT: '',
    ghiChu: '',
    nguon: 'web',
    tinGoc: '',
    eventId: '',
    canDongBo: true,
    taoLuc: bayGio,
    suaLuc: bayGio,
    ...p,
  }
  if (!p.buoi) l.buoi = doanBuoi(l.gioBD, l.gioKT, l.soNgay)
  return l
}

/** Dữ liệu cũ / thiếu ô -> đủ ô, đúng kiểu */
export function chuanLop(x: Partial<LopGiang> & { id: string }): LopGiang {
  const l = lopMoi({ ...x })
  l.id = x.id
  l.soNgay = Math.max(1, Math.round(Number(x.soNgay) || 1))
  l.chiPhi = x.chiPhi === null || x.chiPhi === undefined || x.chiPhi === ('' as unknown) ? null : Number(x.chiPhi) || 0
  l.canDongBo = !!x.canDongBo
  l.huy = !!x.huy
  return l
}

// ---------------- Ngày giờ ----------------

/** Hôm nay theo giờ Việt Nam (máy chủ có thể đặt ở nước ngoài) */
export function homNay(d = new Date()): string {
  return new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10)
}

export function congNgay(ngay: string, n: number): string {
  const d = new Date(ngay + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function soNgayGiua(tu: string, den: string): number {
  return Math.round((Date.parse(den + 'T00:00:00Z') - Date.parse(tu + 'T00:00:00Z')) / 86400_000)
}

/** Thứ trong tuần kiểu Việt Nam: 'CN', 'T2'…'T7' */
export function thu(ngay: string): string {
  const t = new Date(ngay + 'T00:00:00Z').getUTCDay()
  return t === 0 ? 'CN' : `T${t + 1}`
}

/** '2026-03-07' -> '07/03/2026' */
export function ngayVN(ngay: string, coNam = true): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay)) return ngay || ''
  const [y, m, d] = ngay.split('-')
  return coNam ? `${d}/${m}/${y}` : `${d}/${m}`
}

export function doanBuoi(gioBD: string, gioKT: string, soNgay = 1): Buoi {
  if (soNgay > 1) return 'nhieu_ngay'
  if (!gioBD) return 'sang'
  const bd = phut(gioBD)
  const kt = gioKT ? phut(gioKT) : bd + 180
  if (kt - bd >= 6 * 60) return 'ca_ngay'
  if (bd >= 18 * 60) return 'toi'
  if (bd >= 12 * 60) return 'chieu'
  return 'sang'
}

const phut = (g: string) => {
  const [h, m] = g.split(':').map(Number)
  return h * 60 + (m || 0)
}

/** Giờ mặc định khi chỉ biết buổi */
export const GIO_MAC_DINH: Record<Buoi, [string, string]> = {
  sang: ['08:00', '11:30'],
  chieu: ['13:30', '17:00'],
  toi: ['19:30', '21:30'],
  ca_ngay: ['08:00', '16:30'],
  nhieu_ngay: ['08:00', '16:30'],
}

// ---------------- Trạng thái tính ra ----------------

/** Ngày cuối của lớp (lớp nhiều ngày) */
export const ngayCuoi = (l: LopGiang) => congNgay(l.ngay, l.soNgay - 1)

/** Đã giảng = ngày cuối đã qua (hoặc là hôm nay và đã qua giờ kết thúc) và không bị hủy */
export function daGiang(l: LopGiang, bayGio = new Date()): boolean {
  if (l.huy) return false
  const hn = homNay(bayGio)
  const cuoi = ngayCuoi(l)
  if (cuoi < hn) return true
  if (cuoi > hn) return false
  const gioVN = new Date(bayGio.getTime() + 7 * 3600_000).toISOString().slice(11, 16)
  return !!l.gioKT && l.gioKT <= gioVN
}

export type TrangThai = 'huy' | 'sap_toi' | 'cho_tien' | 'thieu_thu_lao' | 'xong'

export function trangThai(l: LopGiang, bayGio = new Date()): TrangThai {
  if (l.huy) return 'huy'
  if (l.thanhToan === 'da') return 'xong'
  if (!daGiang(l, bayGio)) return 'sap_toi'
  if (l.chiPhi === null) return 'thieu_thu_lao'
  return 'cho_tien'
}

export const TEN_TRANG_THAI: Record<TrangThai, string> = {
  huy: 'Đã hủy',
  sap_toi: 'Sắp giảng',
  cho_tien: 'Chờ thanh toán',
  thieu_thu_lao: 'Thiếu thù lao',
  xong: 'Đã thanh toán',
}

// ---------------- Tiền ----------------

export function dinhDangTien(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('vi-VN')
}

/** '1tr5' / '1.5tr' / '1,500,000' / '1500k' / '2 triệu' -> số đồng; không hiểu -> null */
export function docTien(s: string | number | null | undefined): number | null {
  if (s === null || s === undefined) return null
  if (typeof s === 'number') return Number.isFinite(s) ? Math.round(s) : null
  const t = s.toLowerCase().replace(/\s+/g, '').replace(/đ|vnd|vnđ|đồng/g, '')
  if (!t) return null
  let m = /^(\d+)(?:tr|triệu|trieu|m)(\d{1,3})?$/.exec(t)
  if (m) return Number(m[1]) * 1_000_000 + (m[2] ? Number(m[2].padEnd(3, '0')) * 1000 : 0)
  m = /^(\d+(?:[.,]\d+)?)(?:tr|triệu|trieu|m)$/.exec(t)
  if (m) return Math.round(Number(m[1].replace(',', '.')) * 1_000_000)
  m = /^(\d+(?:[.,]\d+)?)(?:k|nghìn|nghin|ngàn)$/.exec(t)
  if (m) return Math.round(Number(m[1].replace(',', '.')) * 1000)
  if (/^\d{1,3}([.,]\d{3})+$/.test(t)) return Number(t.replace(/[.,]/g, ''))
  if (/^\d+$/.test(t)) return Number(t)
  return null
}

// ---------------- Chuẩn hóa tên ----------------

/** Bỏ dấu tiếng Việt để so khớp mềm */
export function boDau(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function chuanDoiTac(ten: string, cd: CaiDat): string {
  const t = ten.normalize('NFC').replace(/\s+/g, ' ').trim()
  return cd.biDanhDoiTac[boDau(t)] ?? t
}

/** Địa điểm: "online"/"Online" -> "Online", "Hà nội" -> "Hà Nội" */
export function chuanDiaDiem(s: string): string {
  const t = s.normalize('NFC').replace(/\s+/g, ' ').trim()
  if (/^online$/i.test(t)) return 'Online'
  return t.replace(/(^|\s)(\p{Ll})/gu, (_m, a: string, b: string) => a + b.toUpperCase())
}

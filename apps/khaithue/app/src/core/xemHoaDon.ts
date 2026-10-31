// XEM HOÁ ĐƠN ĐIỆN TỬ (file XML <HDon> chuẩn TT78/NĐ123) như bản in + kiểm SỐ HỌC (cộng dòng, thuế, tổng).
// Chuyển từ trình xem độc lập F:\AI\6.chrome-ex\xem-hoa-don-xml (đã thử 22 hoá đơn thật), bỏ DOMParser của trình duyệt
// để chạy được cả trên máy chủ MCP (Node) và trong test: dùng bộ đọc XML nhỏ docCayXml ở dưới.
//
// KHÔNG kiểm chữ ký số (đúng/sai về mật mã) — chỉ đọc ai ký, ký lúc nào. Muốn biết thật/giả: tra hoadondientu.gdt.gov.vn.
// Phần lưu vào sổ (dòng hàng, phân loại, so với Excel cổng thuế) vẫn ở hoaDonGoc.ts (docXmlGoc) — file này chỉ để xem + kiểm.

// ───────────── Bộ đọc XML tối giản ─────────────

export interface NutXml {
  /** Tên thẻ đã bỏ tiền tố namespace ("ds:Signature" -> "Signature") */
  ten: string
  thuocTinh: Record<string, string>
  con: NutXml[]
  /** Chữ nằm trực tiếp trong thẻ (không gồm thẻ con) */
  chu: string
}

const giaiMa = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (m, e: string) => {
    const t = e.toLowerCase()
    if (t === 'lt') return '<'
    if (t === 'gt') return '>'
    if (t === 'amp') return '&'
    if (t === 'quot') return '"'
    if (t === 'apos') return "'"
    const n = t.startsWith('#x') ? parseInt(t.slice(2), 16) : Number(t.slice(1))
    return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m
  })

const HONG = 'File XML bị hỏng, không đọc được.'

/** Đọc chuỗi XML thành cây. File hỏng (thẻ không đóng, đóng sai thẻ, không có thẻ gốc) -> ném lỗi */
export function docCayXml(xml: string): NutXml {
  const s = xml.replace(/^\uFEFF/, '')
  const ngan: NutXml[] = []
  let goc: NutXml | null = null
  let i = 0
  while (i < s.length) {
    const lt = s.indexOf('<', i)
    const chu = s.slice(i, lt < 0 ? s.length : lt)
    if (ngan.length) ngan[ngan.length - 1].chu += giaiMa(chu)
    else if (chu.trim()) throw new Error(HONG)
    if (lt < 0) break
    if (s.startsWith('<!--', lt)) {
      const h = s.indexOf('-->', lt + 4)
      if (h < 0) throw new Error(HONG)
      i = h + 3
    } else if (s.startsWith('<![CDATA[', lt)) {
      const h = s.indexOf(']]>', lt + 9)
      if (h < 0 || !ngan.length) throw new Error(HONG)
      ngan[ngan.length - 1].chu += s.slice(lt + 9, h)
      i = h + 3
    } else if (s.startsWith('<?', lt)) {
      const h = s.indexOf('?>', lt + 2)
      if (h < 0) throw new Error(HONG)
      i = h + 2
    } else if (s.startsWith('<!', lt)) {
      const h = s.indexOf('>', lt + 2)
      if (h < 0) throw new Error(HONG)
      i = h + 1
    } else if (s[lt + 1] === '/') {
      const h = s.indexOf('>', lt)
      if (h < 0) throw new Error(HONG)
      const ten = s.slice(lt + 2, h).trim().replace(/^[\w.-]+:/, '')
      const mo = ngan.pop()
      if (!mo || mo.ten !== ten) throw new Error(HONG)
      i = h + 1
    } else {
      // thẻ mở: tìm dấu ">" không nằm trong giá trị thuộc tính
      let h = lt + 1
      let nhay = ''
      while (h < s.length && (nhay || s[h] !== '>')) {
        if (nhay) {
          if (s[h] === nhay) nhay = ''
        } else if (s[h] === '"' || s[h] === "'") nhay = s[h]
        h++
      }
      if (h >= s.length) throw new Error(HONG)
      const trong = s.slice(lt + 1, h)
      const tuDong = trong.endsWith('/')
      const m = /^([A-Za-z_][\w.:-]*)([\s\S]*?)\/?$/.exec(trong)
      if (!m) throw new Error(HONG)
      const thuocTinh: Record<string, string> = {}
      for (const a of m[2].matchAll(/([\w.:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) thuocTinh[a[1].replace(/^[\w.-]+:/, '')] = giaiMa(a[3] ?? a[4] ?? '')
      const nut: NutXml = { ten: m[1].replace(/^[\w.-]+:/, ''), thuocTinh, con: [], chu: '' }
      if (ngan.length) ngan[ngan.length - 1].con.push(nut)
      else if (goc) throw new Error(HONG) // hai thẻ gốc
      else goc = nut
      if (!tuDong) ngan.push(nut)
      i = h + 1
    }
  }
  if (!goc || ngan.length) throw new Error(HONG)
  return goc
}

const cacCon = (n: NutXml | null | undefined, ten: string) => (n ? n.con.filter((c) => c.ten === ten) : [])
const con = (n: NutXml | null | undefined, ten: string) => cacCon(n, ten)[0] ?? null
const theoDuong = (n: NutXml | null, ...ten: string[]) => ten.reduce<NutXml | null>((x, t) => con(x, t), n)
/** Toàn bộ chữ trong thẻ (kể cả thẻ con), như textContent */
const chuDayDu = (n: NutXml): string => n.chu + n.con.map(chuDayDu).join('')
const chu = (n: NutXml | null, ...ten: string[]) => {
  const x = ten.length ? theoDuong(n, ...ten) : n
  return x ? chuDayDu(x).trim() : ''
}
/** Mọi thẻ con cháu có tên này */
function sau(n: NutXml | null, ten: string, kq: NutXml[] = []): NutXml[] {
  for (const c of n?.con ?? []) {
    if (c.ten === ten) kq.push(c)
    sau(c, ten, kq)
  }
  return kq
}
const so = (s: string): number | null => {
  if (s === '') return null
  const v = Number(s.replace(/,/g, ''))
  return Number.isFinite(v) ? v : null
}

// ───────────── Hoá đơn ─────────────

export interface CapKhoa {
  k: string
  v: string
}

export interface BenHoaDon {
  /** Các thẻ lá của NBan / NMua: Ten, MST, DChi, SDThoai, DCTDTu, STKNHang, TNHang, HVTNMHang, MKHang... */
  o: Record<string, string>
  khac: CapKhoa[]
}

export interface DongHD {
  stt: string
  /** TChat: 1 hàng hoá, 2 khuyến mại, 3 chiết khấu thương mại (trừ đi), 4 ghi chú */
  tchat: string
  ma: string
  ten: string
  dvt: string
  sl: number | null
  dg: number | null
  tlck: number | null
  stck: number | null
  tien: number | null
  ts: string
  thue: number | null
  trung: CapKhoa[]
  khac: CapKhoa[]
}

export interface ChuKy {
  ten: string // CN trong chứng thư
  chuThe: string
  luc: string // SigningTime như trong file
}

export interface GhiChuKiem {
  muc: 'dat' | 'canhBao' | 'thongTin'
  noiDung: string
}

export interface HoaDonXem {
  tenFile: string
  loai: string
  mau: string
  kyHieu: string
  so: string
  ngay: string // yyyy-mm-dd như trong file
  pban: string
  tienTe: string
  tyGia: string
  httt: string
  mstTcgp: string
  lienQuan: { tc: string; lhd: string; mau: string; kh: string; so: string; ngay: string; gc: string } | null
  khacChung: CapKhoa[]
  ban: BenHoaDon | null
  mua: BenHoaDon | null
  dong: DongHD[]
  thueSuat: { ts: string; tien: number | null; thue: number | null }[]
  phi: { ten: string; tien: number | null }[]
  tongTruocThue: number | null
  tongThue: number | null
  ckTM: number | null
  tong: number | null
  bangChu: string
  khacToan: CapKhoa[]
  mccqt: string
  qr: string
  kyBan: ChuKy | null
  kyCqt: ChuKy | null
  kyMua: ChuKy | null
  kiem: GhiChuKiem[]
}

const docKhac = (n: NutXml | null): CapKhoa[] => cacCon(con(n, 'TTKhac'), 'TTin').map((t) => ({ k: chu(t, 'TTruong'), v: chu(t, 'DLieu') })).filter((x) => x.k && x.v)

function docBen(n: NutXml | null): BenHoaDon | null {
  if (!n) return null
  const o: Record<string, string> = {}
  for (const c of n.con) if (c.ten !== 'TTKhac' && !c.con.length) o[c.ten] = c.chu.trim()
  return { o, khac: docKhac(n) }
}

function docChuKy(n: NutXml | null): ChuKy | null {
  if (!n || !sau(n, 'SignatureValue').length) return null
  const chuThe = chu(sau(n, 'X509SubjectName')[0] ?? null)
  return { ten: (/(?:^|,)\s*CN=([^,]+)/.exec(chuThe)?.[1] ?? '').trim(), chuThe, luc: chu(sau(n, 'SigningTime')[0] ?? null) }
}

/**
 * Đọc file XML hoá đơn điện tử. Ném lỗi (thông điệp tiếng Việt, đưa thẳng cho người dùng) khi:
 * file hỏng, hoặc không phải hoá đơn (thẻ gốc không phải <HDon>, ví dụ tờ khai, thông báo).
 */
export function parseInvoice(xml: string, tenFile = ''): HoaDonXem {
  const goc = docCayXml(xml)
  if (goc.ten !== 'HDon') {
    throw new Error(`Không phải hoá đơn điện tử (thẻ gốc là <${goc.ten}>, cần <HDon>). Có thể là tờ khai / thông báo / chứng từ — nạp ở ô "Nạp toàn bộ hồ sơ thuế".`)
  }
  const dl = con(goc, 'DLHDon')
  const tt = con(dl, 'TTChung')
  const nd = con(dl, 'NDHDon')
  if (!tt || !nd) throw new Error('File có thẻ <HDon> nhưng thiếu phần thông tin chung / nội dung hoá đơn — không đọc được.')
  const toan = con(nd, 'TToan')
  const lq = con(tt, 'TTHDLQuan')
  const dscks = con(goc, 'DSCKS')
  const dong: DongHD[] = cacCon(con(nd, 'DSHHDVu'), 'HHDVu').map((h) => ({
    stt: chu(h, 'STT'), tchat: chu(h, 'TChat'), ma: chu(h, 'MHHDVu'), ten: chu(h, 'THHDVu'),
    dvt: chu(h, 'DVTinh'), sl: so(chu(h, 'SLuong')), dg: so(chu(h, 'DGia')),
    tlck: so(chu(h, 'TLCKhau')), stck: so(chu(h, 'STCKhau')), tien: so(chu(h, 'ThTien')),
    ts: chu(h, 'TSuat'), thue: so(chu(h, 'TThue')),
    trung: cacCon(con(h, 'TTHHDTrung'), 'TTin').map((t) => ({ k: chu(t, 'TTruong'), v: chu(t, 'DLieu') })).filter((x) => x.v),
    khac: docKhac(h),
  }))
  const inv: HoaDonXem = {
    tenFile,
    loai: chu(tt, 'THDon') || 'Hoá đơn',
    mau: chu(tt, 'KHMSHDon'), kyHieu: chu(tt, 'KHHDon'), so: chu(tt, 'SHDon'), ngay: chu(tt, 'NLap'),
    pban: chu(tt, 'PBan'), tienTe: chu(tt, 'DVTTe') || 'VND', tyGia: chu(tt, 'TGia'), httt: chu(tt, 'HTTToan'),
    mstTcgp: chu(tt, 'MSTTCGP'),
    lienQuan: lq ? { tc: chu(lq, 'TCHDon'), lhd: chu(lq, 'LHDCLQuan'), mau: chu(lq, 'KHMSHDCLQuan'), kh: chu(lq, 'KHHDCLQuan'), so: chu(lq, 'SHDCLQuan'), ngay: chu(lq, 'NLHDCLQuan'), gc: chu(lq, 'GChu') } : null,
    khacChung: docKhac(tt),
    ban: docBen(con(nd, 'NBan')), mua: docBen(con(nd, 'NMua')),
    dong,
    thueSuat: cacCon(con(toan, 'THTTLTSuat'), 'LTSuat').map((l) => ({ ts: chu(l, 'TSuat'), tien: so(chu(l, 'ThTien')), thue: so(chu(l, 'TThue')) })),
    phi: cacCon(con(toan, 'DSLPhi'), 'LPhi').map((p) => ({ ten: chu(p, 'TLPhi'), tien: so(chu(p, 'TPhi')) })).filter((p) => p.ten || p.tien),
    tongTruocThue: so(chu(toan, 'TgTCThue')), tongThue: so(chu(toan, 'TgTThue')),
    ckTM: so(chu(toan, 'TTCKTMai')), tong: so(chu(toan, 'TgTTTBSo')), bangChu: chu(toan, 'TgTTTBChu'),
    khacToan: docKhac(toan),
    mccqt: chu(goc, 'MCCQT'), qr: chu(goc, 'DLQRCode'),
    kyBan: docChuKy(con(dscks, 'NBan')), kyCqt: docChuKy(con(dscks, 'CQT')), kyMua: docChuKy(con(dscks, 'NMua')),
    kiem: [],
  }
  if (!inv.kyHieu || !inv.so) throw new Error('Hoá đơn thiếu ký hiệu hoặc số hoá đơn — không lưu được.')
  inv.kiem = checkInvoice(inv)
  return inv
}

const nf = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 4 })
export const tienXem = (v: number | null | undefined) => (v == null ? '' : nf.format(v))
export const TINH_CHAT_LQ: Record<string, string> = { '1': 'thay thế', '2': 'điều chỉnh' }

/** Kiểm SỐ HỌC như cộng lại bằng máy tính bỏ túi. Lệch 1 đồng do làm tròn thì bỏ qua. */
export function checkInvoice(inv: HoaDonXem): GhiChuKiem[] {
  const kq: GhiChuKiem[] = []
  const gan = (a: number, b: number) => Math.abs(a - b) <= 1
  if (inv.tienTe !== 'VND') kq.push({ muc: 'thongTin', noiDung: `Hoá đơn bằng ${inv.tienTe}, tỷ giá ${inv.tyGia || '?'} — các phép cộng chỉ kiểm theo nguyên tệ.` })
  let cong = 0
  let dem = 0
  for (const d of inv.dong) {
    if (d.tien == null || d.tchat === '4') continue
    cong += d.tchat === '3' ? -Math.abs(d.tien) : d.tien
    dem++
  }
  if (dem && inv.tongTruocThue != null && !gan(cong, inv.tongTruocThue)) {
    kq.push({ muc: 'canhBao', noiDung: `Cộng các dòng hàng = ${tienXem(cong)} nhưng "Cộng tiền hàng" in trên hoá đơn = ${tienXem(inv.tongTruocThue)} (lệch ${tienXem(inv.tongTruocThue - cong)}).` })
  }
  if (inv.thueSuat.length && inv.tongThue != null) {
    const s = inv.thueSuat.reduce((a, t) => a + (t.thue ?? 0), 0)
    if (!gan(s, inv.tongThue)) kq.push({ muc: 'canhBao', noiDung: `Cộng thuế theo từng thuế suất = ${tienXem(s)} nhưng tổng tiền thuế = ${tienXem(inv.tongThue)}.` })
  }
  if (inv.tong != null && inv.tongTruocThue != null) {
    const phi = inv.phi.reduce((a, p) => a + (p.tien ?? 0), 0)
    const can = inv.tongTruocThue + (inv.tongThue ?? 0) + phi
    if (!gan(can, inv.tong) && !gan(can - (inv.ckTM ?? 0), inv.tong)) {
      kq.push({ muc: 'canhBao', noiDung: `Tiền hàng + thuế${phi ? ' + phí' : ''} = ${tienXem(can)} nhưng "Tổng tiền thanh toán" = ${tienXem(inv.tong)} (lệch ${tienXem(inv.tong - can)}). Có thể do phí / chiết khấu ghi ở phần thông tin khác — cần xem lại.` })
    }
  }
  // Ký hiệu bắt đầu bằng C = hoá đơn có mã của cơ quan thuế
  if (/^C/i.test(inv.kyHieu) && !inv.mccqt) kq.push({ muc: 'canhBao', noiDung: 'Ký hiệu loại "có mã" (chữ C) nhưng file không có mã của cơ quan thuế (MCCQT).' })
  if (!inv.kyBan) kq.push({ muc: 'thongTin', noiDung: 'File không có chữ ký số của người bán (hoá đơn máy tính tiền thường không ký số).' })
  if (inv.lienQuan) kq.push({ muc: 'thongTin', noiDung: `Hoá đơn này ${TINH_CHAT_LQ[inv.lienQuan.tc] ?? 'liên quan tới'} hoá đơn khác — xem mục "Hoá đơn liên quan".` })
  if (!kq.some((x) => x.muc === 'canhBao')) kq.unshift({ muc: 'dat', noiDung: 'Các phép cộng tiền hàng, thuế, tổng thanh toán khớp nhau.' })
  return kq
}

/** Khoá CHỐNG TRÙNG: MST người bán + mẫu số + ký hiệu + số (số bỏ số 0 đầu: "00000017" = "17") */
export const khoaHoaDon = (h: { mstBan: string; mau: string; kyHieu: string; so: string }) =>
  `${h.mstBan}|${h.mau}|${h.kyHieu.toUpperCase()}|${Number(h.so) || h.so}`

/** Khoá chống trùng từ phần đọc của sổ (HoaDonGoc trong hoaDonGoc.ts) */
export const khoaCuaGoc = (g: { mstBan: string; kyHieuMau: string; kyHieu: string; so: string }) => khoaHoaDon({ mstBan: g.mstBan, mau: g.kyHieuMau, kyHieu: g.kyHieu, so: g.so })

export const khoaCuaXem = (inv: HoaDonXem) => khoaHoaDon({ mstBan: inv.ban?.o.MST ?? '', mau: inv.mau, kyHieu: inv.kyHieu, so: inv.so })

/** Hoá đơn là bán ra hay mua vào so với MST doanh nghiệp; không dính tới doanh nghiệp này -> null */
export function chieuHoaDon(h: { mstBan: string; mstMua: string }, mstCty: string): 'ban' | 'mua' | null {
  if (h.mstBan === mstCty) return 'ban'
  if (h.mstMua === mstCty) return 'mua'
  return null
}

export interface KetQuaPhanLoai<T> {
  moi: T[]
  /** Đã có trong kho (hoặc lặp ngay trong lô vừa tải) — không lưu, không ghi đè */
  daCo: T[]
}

/** Tách hoá đơn mới / đã có theo khoá chống trùng. Trùng ngay trong lô thì chỉ lấy bản đầu. */
export function tachTrung<T>(ds: T[], khoa: (x: T) => string, daCo: Set<string>): KetQuaPhanLoai<T> {
  const thay = new Set(daCo)
  const kq: KetQuaPhanLoai<T> = { moi: [], daCo: [] }
  for (const x of ds) {
    const k = khoa(x)
    if (thay.has(k)) kq.daCo.push(x)
    else {
      thay.add(k)
      kq.moi.push(x)
    }
  }
  return kq
}

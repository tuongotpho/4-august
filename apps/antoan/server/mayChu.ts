// Máy chủ MCP "lich-giang": cho Claude (Claude Code, Claude Desktop, claude.ai, điện thoại) tra cứu và sửa lịch giảng
// bằng ĐÚNG phần tính toán của web app (src/lib). Dữ liệu là dữ liệu thật trên Firebase của chính người dùng.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  chuanDiaDiem, chuanDoiTac, congNgay, doanBuoi, docTien, GIO_MAC_DINH, homNay, lopMoi, ngayCuoi, TEN_BUOI, TEN_HINH_THUC, TEN_TRANG_THAI, thu, trangThai,
  type Buoi, type CaiDat, type LopGiang, type TrangThai,
} from '../src/lib/model.js'
import { congNo, sapXepTheoNgay, theoDoiTac, theoNam, theoThang, timLopChoTien, timTrung, trungGio } from '../src/lib/tinh.js'

const HUONG_DAN = `Lịch giảng an toàn lao động (ATLĐ) của một giảng viên. Mỗi LỚP = một buổi / đợt giảng do một ĐỐI TÁC (công ty đào tạo: TIEC, ESC, KTQT…) mời,
qua một NGƯỜI LIÊN HỆ, giảng cho một KHÁCH HÀNG (đơn vị được đào tạo), giảng viên nhận THÙ LAO.
- Tiền: đồng (VND), số nguyên. Ngày: yyyy-mm-dd. Giờ: HH:mm (giờ Việt Nam).
- Trạng thái tự suy ra: sap_toi (chưa giảng), cho_tien (đã giảng, chưa nhận tiền), thieu_thu_lao (đã giảng nhưng chưa ghi thù lao), xong (đã nhận tiền), huy.
- Bắt đầu bằng tong_quan. Số liệu chỉ lấy từ dữ liệu — thiếu thì nói thiếu, KHÔNG đoán.
- Công cụ ghi (tao_lop, sua_lop, danh_dau_thanh_toan, xoa_lop) thay đổi dữ liệu THẬT và tự cập nhật Google Calendar — chỉ gọi khi người dùng yêu cầu rõ.
  tao_lop báo lại nếu nghi trùng lớp đã có (cùng ngày, tên khách hàng gần giống): hỏi người dùng trước khi gửi lại với bo_qua_trung=true.
- xoa_lop không hoàn tác được: phải hỏi người dùng, được đồng ý mới gửi xac_nhan = đúng tên khách hàng.
- Mọi lần ghi được ghi nhật ký; người dùng thu hồi quyền máy này ở web app (Cài đặt).`

const json = (x: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(x, null, 1) }] })
type KetQua = { content: { type: 'text'; text: string }[]; isError?: boolean }

export interface DuLieu {
  lop: LopGiang[]
  caiDat: CaiDat
}

/** Nguồn dữ liệu cắm vào máy chủ: đọc (tải 1 lần mỗi yêu cầu) và chỗ ghi */
export interface NguonMcp {
  lay(): Promise<DuLieu>
  luu(l: LopGiang): Promise<string> // trả câu báo trạng thái Google Calendar
  xoa(l: LopGiang): Promise<void>
  nhatKy(congCu: string, moTa: string): Promise<void>
}

class LoiNguoiDung extends Error {}

/** Dòng gọn cho AI đọc */
function gon(l: LopGiang) {
  return {
    id: l.id, ngay: l.ngay, thu: thu(l.ngay), ...(l.soNgay > 1 ? { soNgay: l.soNgay, denNgay: ngayCuoi(l) } : {}),
    gio: l.gioBD ? `${l.gioBD}–${l.gioKT}` : TEN_BUOI[l.buoi], hinhThuc: TEN_HINH_THUC[l.hinhThuc],
    khachHang: l.khachHang, doiTac: l.doiTac, lienHe: l.lienHe, diaDiem: l.diaDiem, thuLao: l.chiPhi,
    trangThai: TEN_TRANG_THAI[trangThai(l)], ...(l.ngayTT ? { ngayNhanTien: l.ngayTT } : {}),
    ...(l.noiDung ? { noiDung: l.noiDung } : {}), ...(l.ghiChu ? { ghiChu: l.ghiChu } : {}),
  }
}

const tim = (ds: LopGiang[], id: string) => {
  const l = ds.find((x) => x.id === id)
  if (!l) throw new LoiNguoiDung(`Không có lớp id "${id}" — dùng danh_sach_lop để lấy id`)
  return l
}

const ngay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('yyyy-mm-dd')
const gio = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).describe('HH:mm 24h')
const oLop = {
  ngay: ngay.optional(),
  so_ngay: z.number().int().min(1).max(30).optional().describe('Lớp nhiều ngày liên tiếp'),
  gio_bat_dau: gio.or(z.literal('')).optional(),
  gio_ket_thuc: gio.or(z.literal('')).optional(),
  buoi: z.enum(['sang', 'chieu', 'toi', 'ca_ngay', 'nhieu_ngay']).optional().describe('Chỉ biết buổi thì app tự điền giờ chuẩn'),
  hinh_thuc: z.enum(['online', 'truc_tiep']).optional(),
  khach_hang: z.string().optional().describe('Đơn vị được đào tạo'),
  doi_tac: z.string().optional().describe('Công ty đối tác mời giảng'),
  lien_he: z.string().optional().describe('Người liên hệ bên đối tác'),
  dia_diem: z.string().optional(),
  noi_dung: z.string().optional(),
  thu_lao: z.union([z.number(), z.string()]).nullable().optional().describe('Số đồng, hoặc "1tr5"; null = chưa rõ'),
  ghi_chu: z.string().optional(),
  huy: z.boolean().optional().describe('true = lớp bị hủy (giữ để tra cứu, xoá khỏi Google Calendar)'),
}
type OLop = { [K in keyof typeof oLop]?: z.infer<(typeof oLop)[K]> }

/** Áp các ô AI gửi lên vào lớp (chuẩn hóa như web app) */
function apDung(l: LopGiang, a: OLop, cd: CaiDat): LopGiang {
  const n = { ...l }
  if (a.ngay !== undefined) n.ngay = a.ngay
  if (a.so_ngay !== undefined) n.soNgay = a.so_ngay
  if (a.buoi !== undefined) {
    n.buoi = a.buoi as Buoi
    if (a.gio_bat_dau === undefined) [n.gioBD, n.gioKT] = GIO_MAC_DINH[n.buoi]
    if (n.buoi === 'nhieu_ngay' && n.soNgay < 2) n.soNgay = 2
  }
  if (a.gio_bat_dau !== undefined) n.gioBD = a.gio_bat_dau
  if (a.gio_ket_thuc !== undefined) n.gioKT = a.gio_ket_thuc
  if (a.buoi === undefined && (a.gio_bat_dau !== undefined || a.gio_ket_thuc !== undefined || a.so_ngay !== undefined)) n.buoi = doanBuoi(n.gioBD, n.gioKT, n.soNgay)
  if (a.hinh_thuc !== undefined) n.hinhThuc = a.hinh_thuc
  if (a.khach_hang !== undefined) n.khachHang = a.khach_hang.trim()
  if (a.doi_tac !== undefined) n.doiTac = chuanDoiTac(a.doi_tac, cd)
  if (a.lien_he !== undefined) n.lienHe = a.lien_he.trim()
  if (a.dia_diem !== undefined) n.diaDiem = chuanDiaDiem(a.dia_diem)
  if (a.noi_dung !== undefined) n.noiDung = a.noi_dung.trim()
  if (a.ghi_chu !== undefined) n.ghiChu = a.ghi_chu.trim()
  if (a.huy !== undefined) n.huy = a.huy
  if (a.thu_lao !== undefined) {
    n.chiPhi = a.thu_lao === null ? null : docTien(a.thu_lao)
    if (a.thu_lao !== null && n.chiPhi === null) throw new LoiNguoiDung(`Thù lao "${a.thu_lao}" không hiểu được`)
  }
  if (n.hinhThuc === 'online' && !n.diaDiem) n.diaDiem = 'Online'
  return { ...n, suaLuc: Date.now(), canDongBo: true }
}

export function taoMayChu(nguon: NguonMcp) {
  const server = new McpServer({ name: 'lich-giang', version: '1.0.0' }, { instructions: HUONG_DAN })

  // Lỗi do người dùng / dữ liệu thì trả lời rõ ràng (isError) thay vì làm sập máy chủ
  const boc = <A,>(fn: (d: DuLieu, a: A) => unknown) => async (a: A): Promise<KetQua> => {
    try {
      return json(await fn(await nguon.lay(), a))
    } catch (e) {
      return { ...json({ loi: (e as Error).message }), isError: true }
    }
  }
  const chiDoc = { readOnlyHint: true, openWorldHint: false } as const
  const ghiDuoc = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const

  server.registerTool('tong_quan', {
    title: 'Tổng quan lịch giảng',
    description: 'Hôm nay, lớp 14 ngày tới, công nợ (đã giảng chưa nhận tiền), thu nhập năm nay so với năm trước, danh sách đối tác. Gọi đầu tiên.',
    inputSchema: {},
    annotations: chiDoc,
  }, boc((d) => {
    const hn = homNay()
    const nam = theoNam(d.lop)
    const no = congNo(d.lop)
    return {
      homNay: `${thu(hn)} ${hn}`,
      sapToi14Ngay: d.lop.filter((l) => !l.huy && ngayCuoi(l) >= hn && l.ngay <= congNgay(hn, 14)).sort(sapXepTheoNgay).map(gon),
      congNo: { tong: no.reduce((s, n) => s + n.tong, 0), soLop: no.reduce((s, n) => s + n.lop.length, 0), theoDoiTac: no.map((n) => ({ doiTac: n.doiTac, soLop: n.lop.length, tong: n.tong, choNgay: n.soNgayCho })) },
      theoNam: nam,
      doiTac: [...new Set(d.lop.map((l) => l.doiTac).filter(Boolean))],
      dongBoGoogleCalendar: d.caiDat.lich.bat,
    }
  }))

  server.registerTool('danh_sach_lop', {
    title: 'Danh sách lớp',
    description: 'Lọc lớp theo khoảng ngày / năm / tháng, đối tác, trạng thái, từ khoá (khách hàng, liên hệ, địa điểm, nội dung). Trả tổng thù lao của toàn bộ kết quả và tối đa gioi_han dòng (có id để xem / sửa).',
    inputSchema: {
      tu_ngay: ngay.optional(), den_ngay: ngay.optional(),
      nam: z.number().int().min(2000).max(2100).optional(), thang: z.number().int().min(1).max(12).optional(),
      doi_tac: z.string().optional(),
      trang_thai: z.enum(['sap_toi', 'cho_tien', 'thieu_thu_lao', 'xong', 'huy']).optional(),
      tim: z.string().optional(),
      gioi_han: z.number().int().min(1).max(500).optional().describe('Mặc định 50'),
    },
    annotations: chiDoc,
  }, boc((d, a: { tu_ngay?: string; den_ngay?: string; nam?: number; thang?: number; doi_tac?: string; trang_thai?: TrangThai; tim?: string; gioi_han?: number }) => {
    const k = (a.tim ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()
    const bd = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()
    const tienTo = a.nam ? `${a.nam}${a.thang ? `-${String(a.thang).padStart(2, '0')}` : ''}` : ''
    const kq = d.lop
      .filter((l) => (!a.tu_ngay || ngayCuoi(l) >= a.tu_ngay) && (!a.den_ngay || l.ngay <= a.den_ngay) && l.ngay.startsWith(tienTo))
      .filter((l) => !a.doi_tac || bd(l.doiTac) === bd(a.doi_tac))
      .filter((l) => !a.trang_thai || trangThai(l) === a.trang_thai)
      .filter((l) => !k || bd([l.khachHang, l.lienHe, l.doiTac, l.diaDiem, l.noiDung, l.ghiChu].join(' ')).includes(k))
      .sort(sapXepTheoNgay)
    return { soLop: kq.length, tongThuLao: kq.filter((l) => !l.huy).reduce((s, l) => s + (l.chiPhi ?? 0), 0), lop: kq.slice(-(a.gioi_han ?? 50)).map(gon) }
  }))

  server.registerTool('xem_lop', {
    title: 'Xem một lớp',
    description: 'Toàn bộ thông tin một lớp, kể cả tin nhắn gốc (nếu tạo từ tin nhắn) và các lớp trùng giờ.',
    inputSchema: { id: z.string() },
    annotations: chiDoc,
  }, boc((d, a: { id: string }) => {
    const l = tim(d.lop, a.id)
    return { ...gon(l), tinGoc: l.tinGoc || undefined, nguon: l.nguon, coTrenGoogleCalendar: !!l.eventId, trungGio: trungGio(d.lop, l).map(gon) }
  }))

  server.registerTool('cong_no', {
    title: 'Công nợ',
    description: 'Lớp đã giảng mà chưa nhận tiền, gom theo đối tác, nợ lâu nhất lên đầu (kể cả lớp chưa ghi thù lao).',
    inputSchema: {},
    annotations: chiDoc,
  }, boc((d) => congNo(d.lop).map((n) => ({ doiTac: n.doiTac, tong: n.tong, choNgay: n.soNgayCho, lop: n.lop.map(gon) }))))

  server.registerTool('tong_hop', {
    title: 'Tổng hợp thu nhập',
    description: 'Thu nhập theo tháng và theo đối tác của một năm (mặc định năm nay), kèm so sánh các năm. Bỏ lớp hủy.',
    inputSchema: { nam: z.number().int().min(2000).max(2100).optional() },
    annotations: chiDoc,
  }, boc((d, a: { nam?: number }) => {
    const nam = String(a.nam ?? homNay().slice(0, 4))
    return { nam, theoThang: theoThang(d.lop, nam), theoDoiTac: theoDoiTac(d.lop, nam), cacNam: theoNam(d.lop) }
  }))

  server.registerTool('tao_lop', {
    title: 'Tạo lớp mới',
    description: 'Thêm một lớp giảng (cần ít nhất ngay + khach_hang). Đối tác tự điền theo người liên hệ nếu để trống. Nghi trùng lớp đã có thì KHÔNG tạo mà trả về lớp nghi trùng — hỏi người dùng rồi gửi lại với bo_qua_trung=true.',
    inputSchema: { ...oLop, ngay, khach_hang: z.string().min(1), bo_qua_trung: z.boolean().optional() },
    annotations: ghiDuoc,
  }, boc(async (d, a: OLop & { ngay: string; khach_hang: string; bo_qua_trung?: boolean }) => {
    let l = apDung(lopMoi({ ngay: a.ngay, nguon: 'web', gioBD: '', gioKT: '' }), a, d.caiDat)
    if (!l.gioBD) [l.gioBD, l.gioKT] = GIO_MAC_DINH[l.buoi]
    if (!l.doiTac && l.lienHe) {
      const truoc = d.lop.filter((x) => x.lienHe === l.lienHe && x.doiTac).sort((x, y) => y.ngay.localeCompare(x.ngay))[0]
      if (truoc) l = { ...l, doiTac: truoc.doiTac }
    }
    const trung = timTrung(d.lop, l)
    if (trung && !a.bo_qua_trung) return { daTao: false, nghiTrung: gon(trung), loiNhan: 'Có vẻ trùng lớp đã có — hỏi người dùng; muốn vẫn tạo thì gửi lại với bo_qua_trung=true' }
    const lich = await nguon.luu(l)
    await nguon.nhatKy('tao_lop', `${l.ngay} · ${l.khachHang}`)
    return { daTao: true, lop: gon(l), googleCalendar: lich || undefined, trungGio: trungGio(d.lop, l).map(gon) }
  }))

  server.registerTool('sua_lop', {
    title: 'Sửa lớp',
    description: 'Sửa các ô của một lớp (chỉ gửi ô cần đổi). Đổi ngày / giờ / tên… thì sự kiện Google Calendar cập nhật theo; huy=true thì xoá khỏi lịch.',
    inputSchema: { id: z.string(), ...oLop },
    annotations: ghiDuoc,
  }, boc(async (d, a: OLop & { id: string }) => {
    const l = apDung(tim(d.lop, a.id), a, d.caiDat)
    const lich = await nguon.luu(l)
    await nguon.nhatKy('sua_lop', `${l.ngay} · ${l.khachHang}: ${Object.keys(a).filter((k) => k !== 'id').join(', ')}`)
    return { daLuu: true, lop: gon(l), googleCalendar: lich || undefined }
  }))

  server.registerTool('danh_dau_thanh_toan', {
    title: 'Đánh dấu đã nhận tiền',
    description: 'Đánh dấu đã nhận thù lao: theo danh sách id, hoặc theo từ khoá (khách hàng / đối tác / liên hệ) — với từ khoá chỉ đánh dấu khi khớp đúng 1 lớp hoặc so_tien khớp tổng / một lớp; nhiều lớp thì trả danh sách để hỏi lại. da_nhan=false để bỏ đánh dấu.',
    inputSchema: {
      ids: z.array(z.string()).optional(),
      tim: z.string().optional(),
      so_tien: z.number().optional(),
      ngay_nhan: ngay.optional().describe('Mặc định hôm nay'),
      da_nhan: z.boolean().optional().describe('Mặc định true'),
    },
    annotations: ghiDuoc,
  }, boc(async (d, a: { ids?: string[]; tim?: string; so_tien?: number; ngay_nhan?: string; da_nhan?: boolean }) => {
    let chon: LopGiang[]
    if (a.ids?.length) chon = a.ids.map((id) => tim(d.lop, id))
    else if (a.tim) {
      const ung = timLopChoTien(d.lop, a.tim)
      const tong = ung.reduce((s, l) => s + (l.chiPhi ?? 0), 0)
      const dung = ung.filter((l) => l.chiPhi === a.so_tien)
      chon = ung.length === 1 ? ung : a.so_tien !== undefined && a.so_tien === tong ? ung : dung.length === 1 ? dung : []
      if (!chon.length) return { daLuu: false, loiNhan: ung.length ? 'Khớp nhiều lớp — hỏi người dùng lớp nào rồi gửi ids' : 'Không có lớp chưa thanh toán nào khớp', ungVien: ung.map(gon) }
    } else throw new LoiNguoiDung('Cần ids hoặc tim')
    const daNhan = a.da_nhan ?? true
    for (const l of chon) await nguon.luu({ ...l, thanhToan: daNhan ? 'da' : 'chua', ngayTT: daNhan ? a.ngay_nhan ?? homNay() : '', suaLuc: Date.now() })
    await nguon.nhatKy('danh_dau_thanh_toan', chon.map((l) => `${l.ngay} ${l.khachHang}`).join('; '))
    return { daLuu: true, soLop: chon.length, tong: chon.reduce((s, l) => s + (l.chiPhi ?? 0), 0), lop: chon.map((l) => l.id) }
  }))

  server.registerTool('xoa_lop', {
    title: 'Xoá lớp',
    description: 'Xoá HẲN một lớp (và sự kiện Google Calendar). Không hoàn tác được — hỏi người dùng trước; xac_nhan phải đúng tên khách hàng của lớp. Muốn giữ lại để tra cứu thì dùng sua_lop với huy=true.',
    inputSchema: { id: z.string(), xac_nhan: z.string() },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  }, boc(async (d, a: { id: string; xac_nhan: string }) => {
    const l = tim(d.lop, a.id)
    if (a.xac_nhan.trim() !== l.khachHang.trim()) return { daXoa: false, canXacNhan: l.khachHang }
    await nguon.xoa(l)
    await nguon.nhatKy('xoa_lop', `${l.ngay} · ${l.khachHang}`)
    return { daXoa: true }
  }))

  return server
}

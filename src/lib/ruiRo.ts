import type { Invoice } from './types.js'

/**
 * Danh sách doanh nghiệp RỦI RO về hóa đơn do cơ quan thuế gửi hằng tháng (file Excel "PHỤ LỤC QR HDRR THANG …xlsx"):
 *   - Phụ lục 1: NNT không hoạt động tại địa chỉ đã đăng ký / có dấu hiệu rủi ro về thuế, hóa đơn
 *   - PL 3: DN đã bị chuyển hồ sơ sang cơ quan công an
 * Đọc file Excel: lib/ruiRoExcel.ts. File này không phụ thuộc thư viện nào — máy chủ MCP dùng chung.
 * Người bán trên hóa đơn có MST nằm trong danh sách -> cảnh báo đỏ.
 */

export interface DnRuiRo {
  mst: string
  ten: string
  nhom: number // chỉ số trong DsRuiRo.nhom (sheet nào)
  soCv: string
  ngayCv: string // yyyy-mm-dd
  bienPhap: string
  trangThai: string
  ngayChuyen: string // ngày chuyển trạng thái, yyyy-mm-dd
}

export interface NhomRuiRo {
  sheet: string // tên sheet
  moTa: string // dòng "DANH SÁCH …" ở đầu sheet
}

export interface FileRuiRo {
  ten: string
  napLuc: number
  soDong: number
}

export interface DsRuiRo {
  cacFile: FileRuiRo[] // các file đã nạp (danh sách mỗi tháng gộp dần vào)
  nhom: NhomRuiRo[]
  dong: DnRuiRo[]
}

export type BangRuiRo = Map<string, DnRuiRo[]>

/** Chuẩn hóa MST: bỏ khoảng trắng / dấu chấm, gạch dài -> gạch ngắn. */
export function chuanMst(s: string): string {
  return (s ?? '').normalize('NFC').replace(/[\s.]/g, '').replace(/[–—]/g, '-')
}

// ───────────── Cất / đọc (nén gzip: JSON 4 MB còn ~350 KB) ─────────────

/** DsRuiRo -> bytes gzip (CompressionStream có sẵn ở trình duyệt lẫn Node 18+) */
export async function nenDs(ds: DsRuiRo): Promise<Uint8Array> {
  const s = new Response(JSON.stringify(ds)).body!.pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(s).arrayBuffer())
}

/** bytes -> DsRuiRo; đọc được cả gzip lẫn JSON thường (bản cất cũ) */
export async function giaiNenDs(b: Uint8Array): Promise<DsRuiRo> {
  const gzip = b[0] === 0x1f && b[1] === 0x8b
  const text = gzip
    ? await new Response(new Response(b as Uint8Array<ArrayBuffer>).body!.pipeThrough(new DecompressionStream('gzip'))).text()
    : new TextDecoder().decode(b)
  return JSON.parse(text) as DsRuiRo
}

const khoaDong = (d: DnRuiRo, n: NhomRuiRo) => [d.mst, n.sheet, n.moTa, d.soCv].join('|')

/**
 * Gộp danh sách tháng mới vào danh sách đang có: DN tháng trước vẫn giữ (vẫn rủi ro),
 * dòng trùng (cùng MST + phụ lục + số CV) thì lấy bản mới.
 */
export function gopDsRuiRo(cu: DsRuiRo | null | undefined, moi: DsRuiRo): DsRuiRo {
  if (!cu) return moi
  const nhom = [...cu.nhom]
  const chiSo = (n: NhomRuiRo) => {
    const k = nhom.findIndex((x) => x.sheet === n.sheet && x.moTa === n.moTa)
    return k >= 0 ? k : nhom.push(n) - 1
  }
  const m = new Map<string, DnRuiRo>()
  for (const d of cu.dong) m.set(khoaDong(d, cu.nhom[d.nhom]), d)
  for (const d of moi.dong) {
    const x = { ...d, nhom: chiSo(moi.nhom[d.nhom]) }
    m.set(khoaDong(x, nhom[x.nhom]), x)
  }
  const cacFile = [...cu.cacFile.filter((f) => !moi.cacFile.some((g) => g.ten === f.ten)), ...moi.cacFile]
  return { cacFile, nhom, dong: [...m.values()] }
}

// ───────────── Tra cứu ─────────────

/** Lập bảng tra theo MST (1 MST có thể nằm ở nhiều dòng / nhiều phụ lục). */
export function bangRuiRo(ds: DsRuiRo | null | undefined): BangRuiRo {
  const m: BangRuiRo = new Map()
  for (const d of ds?.dong ?? []) {
    const ds2 = m.get(d.mst)
    if (!ds2) m.set(d.mst, [d])
    else if (!ds2.some((x) => x.nhom === d.nhom && x.soCv === d.soCv)) ds2.push(d) // PL3 lặp 1 DN theo từng hóa đơn
  }
  return m
}

export interface KetQuaRuiRo {
  mst: string // MST khớp trong danh sách
  quaDonViChuQuan: boolean // người bán là chi nhánh (MST-xxx), đơn vị chủ quản nằm trong danh sách
  dong: DnRuiRo[]
}

/** MST này có trong danh sách rủi ro không. Chi nhánh "0101234567-001" khớp cả MST công ty mẹ. */
export function traMst(mst: string, bang?: BangRuiRo): KetQuaRuiRo | undefined {
  if (!bang?.size) return undefined
  const m = chuanMst(mst)
  if (!m) return undefined
  const hit = bang.get(m)
  if (hit) return { mst: m, quaDonViChuQuan: false, dong: hit }
  const me = m.split('-')[0]
  const hitMe = me !== m ? bang.get(me) : undefined
  return hitMe ? { mst: me, quaDonViChuQuan: true, dong: hitMe } : undefined
}

export const traHoaDon = (inv: Pick<Invoice, 'mstNguoiBan'>, bang?: BangRuiRo) => traMst(inv.mstNguoiBan, bang)

const dmy = (s: string) => (s ? s.split('-').reverse().join('/') : '')

/** Hóa đơn lập từ ngày DN chuyển sang "không hoạt động" trở đi — dấu hiệu nặng hơn. */
export function lapSauKhiNgung(inv: Pick<Invoice, 'ngayHd'>, d: DnRuiRo): boolean {
  return !!(inv.ngayHd && d.ngayChuyen && /không hoạt động/i.test(d.trangThai) && inv.ngayHd >= d.ngayChuyen)
}

/** DN đã bị chuyển hồ sơ sang công an: theo cột "Biện pháp" ("Đã chuyển hồ sơ CA") hoặc tiêu đề phụ lục */
export function daChuyenCongAn(d: DnRuiRo, nhom?: NhomRuiRo[]): boolean {
  return /công an|cảnh sát|\bCA\b/i.test(d.bienPhap) || /công an|cảnh sát/i.test(nhom?.[d.nhom]?.moTa ?? '')
}

export function moTaDong(d: DnRuiRo, nhom?: NhomRuiRo[]): string {
  const n = nhom?.[d.nhom]
  return [
    n ? n.sheet : '',
    d.bienPhap,
    d.soCv ? `CV ${d.soCv}${d.ngayCv ? ` ngày ${dmy(d.ngayCv)}` : ''}` : '',
    d.trangThai ? `${d.trangThai}${d.ngayChuyen ? ` từ ${dmy(d.ngayChuyen)}` : ''}` : '',
  ].filter(Boolean).join('; ')
}

/** Câu cảnh báo cho 1 hóa đơn (dùng trong danh sách cảnh báo của hồ sơ). */
export function moTaRuiRo(inv: Pick<Invoice, 'soHd' | 'ngayHd' | 'tenNguoiBan'>, kq: KetQuaRuiRo): string {
  const d = kq.dong[0]
  const ten = d.ten || inv.tenNguoiBan
  const congAn = kq.dong.some((x) => daChuyenCongAn(x))
  return [
    `HĐ ${inv.soHd || '?'}: người bán ${ten} (MST ${kq.mst})`,
    kq.quaDonViChuQuan ? ' — là chi nhánh của DN' : '',
    ` nằm trong DANH SÁCH DN RỦI RO về hóa đơn`,
    congAn ? ' (ĐÃ CHUYỂN HỒ SƠ SANG CÔNG AN)' : '',
    kq.dong.some((x) => lapSauKhiNgung(inv, x)) ? ' — hóa đơn lập SAU ngày DN chuyển trạng thái không hoạt động' : '',
    ' — kiểm tra kỹ trước khi thanh toán',
  ].join('')
}

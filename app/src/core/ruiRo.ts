// Soi đối tác theo DANH SÁCH DOANH NGHIỆP RỦI RO VỀ HOÁ ĐƠN của cơ quan thuế (file "PHỤ LỤC QR HDRR" hằng tháng).
//
// Danh sách do app hoá đơn đỏ (repo tuongotpho/hoadon) nạp và cất ở Storage gs://hoadon-npsc/users/{uid}/ruiRo/ds.json.gz
// (cùng dự án Firebase app-from-ai, cùng tài khoản Google) -> app này ĐỌC dùng chung, không nạp lại.
// Kiểu dữ liệu + cách tra MST giữ ĐÚNG như src/lib/ruiRo.ts bên đó để đọc được file đã cất.
//
// MST đối tác lấy từ danh sách hoá đơn (Excel tải ở cổng thuế) — không cần XML từng hoá đơn.
// File này không phụ thuộc thư viện nào: web app, máy chủ MCP và test dùng chung.

import { conHieuLuc } from './excel.js'
import { tinhTrangKy, type Kho } from './kho.js'
import { chuanTen, tinhDoiTac } from './tongQuan.js'
import type { CanhBao, HoaDon, LoaiHD } from './types.js'
import { tien } from './nhan.js'

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
  sheet: string
  moTa: string // dòng "DANH SÁCH …" ở đầu sheet
}

export interface FileRuiRo {
  ten: string
  napLuc: number
  soDong: number
}

export interface DsRuiRo {
  cacFile: FileRuiRo[]
  nhom: NhomRuiRo[]
  dong: DnRuiRo[]
}

export type BangRuiRo = Map<string, DnRuiRo[]>

/** Chuẩn hoá MST: bỏ khoảng trắng / dấu chấm, gạch dài -> gạch ngắn */
export function chuanMst(s: string): string {
  return (s ?? '').normalize('NFC').replace(/[\s.]/g, '').replace(/[–—]/g, '-')
}

/** bytes (gzip hoặc JSON thường) -> DsRuiRo. DecompressionStream có sẵn ở trình duyệt lẫn Node 18+ */
export async function giaiNenDs(b: Uint8Array): Promise<DsRuiRo> {
  const gzip = b[0] === 0x1f && b[1] === 0x8b
  const text = gzip
    ? await new Response(new Response(b as Uint8Array<ArrayBuffer>).body!.pipeThrough(new DecompressionStream('gzip'))).text()
    : new TextDecoder().decode(b)
  return JSON.parse(text) as DsRuiRo
}

/** Gộp nhiều danh sách (nhiều tháng): dòng trùng (MST + phụ lục + số CV) lấy bản sau */
export function gopDsRuiRo(cu: DsRuiRo | null | undefined, moi: DsRuiRo): DsRuiRo {
  if (!cu) return moi
  const nhom = [...cu.nhom]
  const chiSo = (n: NhomRuiRo) => {
    const k = nhom.findIndex((x) => x.sheet === n.sheet && x.moTa === n.moTa)
    return k >= 0 ? k : nhom.push(n) - 1
  }
  const khoa = (d: DnRuiRo) => [d.mst, nhom[d.nhom]?.sheet, nhom[d.nhom]?.moTa, d.soCv].join('|')
  const m = new Map<string, DnRuiRo>()
  for (const d of cu.dong) m.set(khoa(d), d)
  for (const d of moi.dong) {
    const x = { ...d, nhom: chiSo(moi.nhom[d.nhom]) }
    m.set(khoa(x), x)
  }
  const cacFile = [...cu.cacFile.filter((f) => !moi.cacFile.some((g) => g.ten === f.ten)), ...moi.cacFile]
  return { cacFile, nhom, dong: [...m.values()] }
}

/** Bảng tra theo MST (1 MST có thể nằm ở nhiều dòng / nhiều phụ lục) */
export function bangRuiRo(ds: DsRuiRo | null | undefined): BangRuiRo {
  const m: BangRuiRo = new Map()
  for (const d of ds?.dong ?? []) {
    const cu = m.get(d.mst)
    if (!cu) m.set(d.mst, [d])
    else if (!cu.some((x) => x.nhom === d.nhom && x.soCv === d.soCv)) cu.push(d)
  }
  return m
}

export interface KetQuaTra {
  mst: string // MST khớp trong danh sách
  quaDonViChuQuan: boolean // đối tác là chi nhánh (MST-xxx), công ty mẹ nằm trong danh sách
  dong: DnRuiRo[]
}

/** MST này có trong danh sách không. Chi nhánh "0101234567-001" khớp cả MST công ty mẹ */
export function traMst(mst: string, bang?: BangRuiRo): KetQuaTra | undefined {
  if (!bang?.size) return undefined
  const m = chuanMst(mst)
  if (!m) return undefined
  const hit = bang.get(m)
  if (hit) return { mst: m, quaDonViChuQuan: false, dong: hit }
  const me = m.split('-')[0]
  const hitMe = me !== m ? bang.get(me) : undefined
  return hitMe ? { mst: me, quaDonViChuQuan: true, dong: hitMe } : undefined
}

/** DN đã bị chuyển hồ sơ sang công an */
export function daChuyenCongAn(d: DnRuiRo, nhom?: NhomRuiRo[]): boolean {
  return /công an|cảnh sát|\bCA\b/i.test(d.bienPhap) || /công an|cảnh sát/i.test(nhom?.[d.nhom]?.moTa ?? '')
}

const dmy = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '')
/** dd/MM/yyyy -> yyyy-mm-dd để so ngày */
const iso = (dmY: string) => {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(dmY)
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''
}

/** Hoá đơn lập từ ngày DN chuyển sang "không hoạt động" trở đi — dấu hiệu nặng hơn */
export function lapSauKhiNgung(ngay: string, d: DnRuiRo): boolean {
  const n = iso(ngay)
  return !!(n && d.ngayChuyen && /không hoạt động/i.test(d.trangThai) && n >= d.ngayChuyen)
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

// ───────────── Soi toàn bộ hoá đơn của một công ty ─────────────

export interface HoaDonRuiRo {
  kh: string
  so: string
  ng: string // dd/MM/yyyy
  ky: string // "2025-Q2"
  v: number
  t: number
  sauNgung: boolean // lập SAU ngày DN chuyển trạng thái không hoạt động
}

/** Dòng phụ lục giảm thuế trên tờ khai (quý chưa có đủ danh sách hoá đơn) */
export interface PhuLucRuiRo {
  ky: string
  ten: string
  v: number
  t: number
}

export interface DoiTacRuiRo {
  l: LoaiHD // mua = nhà cung cấp, ban = khách hàng
  mst: string // MST trên hoá đơn (hoặc MST trong danh sách nếu chỉ khớp theo tên)
  ten: string
  khop: KetQuaTra
  /** Chỉ khớp theo TÊN (phụ lục tờ khai không ghi MST, chưa thấy hoá đơn nào của đối tác này) — cần kiểm lại MST */
  theoTen?: boolean
  phuLuc: PhuLucRuiRo[]
  congAn: boolean
  moTa: string[] // từng dòng trong danh sách: phụ lục; biện pháp; CV; trạng thái
  hoaDon: HoaDonRuiRo[]
  tongV: number
  tongT: number
  cacKy: string[]
}

export interface KetQuaSoi {
  /** Danh sách đã nạp: bao nhiêu MST, gồm những file nào */
  soMstDanhSach: number
  cacFile: FileRuiRo[]
  /** Đã soi bao nhiêu đối tác (theo hoá đơn còn hiệu lực) */
  soNhaCungCap: number
  soKhachHang: number
  /** Quý chưa có đủ danh sách hoá đơn: soi thêm theo phụ lục giảm thuế trên tờ khai */
  quyTheoPhuLuc: string[]
  /** Năm có hoá đơn / tờ khai mà danh sách rủi ro chưa có công văn năm đó */
  namThieuDanhSach: number[]
  doiTac: DoiTacRuiRo[]
  canhBao: CanhBao[]
}

const kyCua = (ng: string) => {
  const m = /^\d{1,2}\/(\d{1,2})\/(\d{4})/.exec(ng)
  return m ? `${m[2]}-Q${Math.ceil(Number(m[1]) / 3)}` : ''
}

/**
 * So MST mọi nhà cung cấp (mua vào) và khách hàng (bán ra) trên hoá đơn còn hiệu lực với danh sách rủi ro.
 * Nhà cung cấp dính danh sách = thuế đầu vào đã khấu trừ có nguy cơ bị loại -> mức LỖI; khách hàng -> mức chú ý.
 */
export function soiRuiRo(kho: Kho, mst: string, ds: DsRuiRo | null | undefined): KetQuaSoi {
  const bang = bangRuiRo(ds)
  const doiTac = new Map<string, DoiTacRuiRo>()
  const daSoi = { mua: new Set<string>(), ban: new Set<string>() }
  for (const g of Object.values(kho.hoaDon?.[mst] ?? {})) {
    if (!conHieuLuc({ trangThai: g.tt ?? '' } as HoaDon)) continue
    const m = chuanMst(g.l === 'mua' ? g.mb : g.mm ?? '')
    if (!m) continue
    daSoi[g.l].add(m)
    const khop = traMst(m, bang)
    if (!khop) continue
    const k = `${g.l}|${m}`
    let d = doiTac.get(k)
    if (!d) {
      d = {
        l: g.l, mst: m, ten: g.ten || khop.dong[0].ten, khop,
        congAn: khop.dong.some((x) => daChuyenCongAn(x, ds?.nhom)),
        moTa: khop.dong.map((x) => moTaDong(x, ds?.nhom)),
        hoaDon: [], phuLuc: [], tongV: 0, tongT: 0, cacKy: [],
      }
      doiTac.set(k, d)
    }
    d.hoaDon.push({ kh: g.kh, so: g.so, ng: g.ng, ky: kyCua(g.ng), v: g.v, t: g.t, sauNgung: khop.dong.some((x) => lapSauKhiNgung(g.ng, x)) })
    d.tongV += g.v
    d.tongT += g.t
  }
  // Quý chưa có đủ danh sách hoá đơn: lấy đối tác từ phụ lục giảm thuế trên tờ khai (đúng cách bảng đối tác làm).
  // Phụ lục chỉ ghi TÊN -> dò MST theo tên đã học từ hoá đơn các quý khác; không ra MST thì so tên với danh sách.
  const mstTheoTen = new Map<string, string>()
  for (const g of Object.values(kho.hoaDon?.[mst] ?? {})) {
    const m = chuanMst(g.l === 'mua' ? g.mb : g.mm ?? '')
    if (m && g.ten) mstTheoTen.set(chuanTen(g.ten), m)
  }
  const theoTenDs = new Map<string, DnRuiRo[]>()
  for (const d of ds?.dong ?? []) if (d.ten) theoTenDs.set(chuanTen(d.ten), [...(theoTenDs.get(chuanTen(d.ten)) ?? []), d])
  const quyTheoPhuLuc = new Set<string>()
  for (const nq of tinhDoiTac(kho, mst, null).nguonQuy) {
    for (const l of ['mua', 'ban'] as const) {
      if (nq[l] !== 'toKhai' && nq[l] !== 'toKhaiThieuHD') continue
      quyTheoPhuLuc.add(nq.khoa)
      const tt = tinhTrangKy(kho, mst, nq.khoa)
      const pb = tt.boSungMoiNhat ?? tt.lanDau
      const pl = l === 'mua' ? (pb?.plMua ?? []).map((x) => ({ ten: x.ten, v: x.giaTri, t: x.thue })) : (pb?.plBan ?? []).map((x) => ({ ten: x.ten, v: x.giaTri, t: x.thueGiam * 4 }))
      for (const x of pl) {
        if (!x.ten) continue
        const m = mstTheoTen.get(chuanTen(x.ten))
        if (m) daSoi[l].add(m)
        let khop = m ? traMst(m, bang) : undefined
        let theoTen = false
        if (!m) {
          const hit = theoTenDs.get(chuanTen(x.ten))
          if (hit) {
            khop = { mst: hit[0].mst, quaDonViChuQuan: false, dong: hit }
            theoTen = true
          }
        }
        if (!khop) continue
        const mstDT = m ?? khop.mst
        const k = `${l}|${mstDT}`
        let d = doiTac.get(k)
        if (!d) {
          d = {
            l, mst: mstDT, ten: x.ten, khop, ...(theoTen ? { theoTen } : {}),
            congAn: khop.dong.some((y) => daChuyenCongAn(y, ds?.nhom)),
            moTa: khop.dong.map((y) => moTaDong(y, ds?.nhom)),
            hoaDon: [], phuLuc: [], tongV: 0, tongT: 0, cacKy: [],
          }
          doiTac.set(k, d)
        }
        if (d.hoaDon.some((h) => h.ky === nq.khoa)) continue // quý thiếu tháng: đã tính theo hoá đơn của đối tác này
        d.phuLuc.push({ ky: nq.khoa, ten: x.ten, v: x.v, t: x.t })
        d.tongV += x.v
        d.tongT += x.t
      }
    }
  }

  const kq = [...doiTac.values()]
  for (const d of kq) {
    d.hoaDon.sort((a, b) => iso(a.ng).localeCompare(iso(b.ng)) || a.so.localeCompare(b.so))
    d.cacKy = [...new Set([...d.hoaDon.map((h) => h.ky), ...d.phuLuc.map((p) => p.ky)])].sort()
  }
  // Nhà cung cấp trước, rồi tiền thuế lớn trước
  kq.sort((a, b) => (a.l === b.l ? b.tongT - a.tongT : a.l === 'mua' ? -1 : 1))

  const canhBao: CanhBao[] = kq.map((d) => {
    const sau = d.hoaDon.filter((h) => h.sauNgung).length
    const vai = d.l === 'mua' ? 'Nhà cung cấp' : 'Khách hàng'
    return {
      muc: d.l === 'mua' && !d.theoTen ? 'loi' : 'chu_y',
      noiDung: [
        d.theoTen ? `${vai} ${d.ten} (phụ lục tờ khai, không ghi MST) TRÙNG TÊN với DN MST ${d.mst}, DN này` : `${vai} ${d.ten} (MST ${d.mst})`,
        d.khop.quaDonViChuQuan ? ` là chi nhánh của DN MST ${d.khop.mst}, DN này` : '',
        ' nằm trong DANH SÁCH DN RỦI RO về hoá đơn của cơ quan thuế',
        d.congAn ? ' — ĐÃ CHUYỂN HỒ SƠ SANG CÔNG AN' : '',
        ` (${d.moTa.join(' | ')}).`,
        ` ${[d.hoaDon.length ? `${d.hoaDon.length} hoá đơn ${d.l === 'mua' ? 'mua vào' : 'bán ra'}` : '', d.phuLuc.length ? `${d.phuLuc.length} dòng phụ lục tờ khai` : ''].filter(Boolean).join(' + ')} quý ${d.cacKy.join(', ')}: ${tien(d.tongV)} đ chưa thuế, thuế ${tien(d.tongT)} đ`,
        d.l === 'mua' ? ' (thuế đầu vào này có thể bị loại khỏi khấu trừ)' : '',
        sau ? `. ${sau} hoá đơn lập SAU ngày DN chuyển trạng thái không hoạt động` : '',
        d.theoTen ? '. Chỉ trùng tên — kiểm MST trên hoá đơn gốc' : '',
        '.',
      ].join(''),
    }
  })
  // Nhắc nạp danh sách các năm còn thiếu: năm có hoá đơn / tờ khai mà danh sách chưa có công văn năm đó
  const namThieuDanhSach: number[] = []
  if (ds) {
    const namDs = new Set(ds.dong.map((x) => Number(x.ngayCv.slice(0, 4))).filter((n) => n > 2000))
    if (!namDs.size) for (const f of ds.cacFile) for (const m of f.ten.matchAll(/(20\d\d)/g)) namDs.add(Number(m[1]))
    const namDuLieu = new Set([
      ...Object.values(kho.hoaDon?.[mst] ?? {}).map((g) => Number(/(\d{4})$/.exec(g.ng)?.[1])),
      ...Object.keys(kho.gtgt[mst] ?? {}).map((k) => Number(k.slice(0, 4))),
    ].filter((n) => n > 2000))
    const dauDs = Math.min(...namDs)
    namThieuDanhSach.push(...[...namDuLieu].filter((n) => namDs.size && n < dauDs).sort())
    if (namThieuDanhSach.length) {
      canhBao.push({
        muc: 'chu_y',
        noiDung: `Danh sách DN rủi ro đang có chỉ gồm công văn từ năm ${dauDs}, nhưng hồ sơ có hoá đơn / tờ khai năm ${namThieuDanhSach.join(', ')}. DN bị công bố trong các năm đó mà không còn trong danh sách mới sẽ không bị phát hiện — nạp thêm file "PHỤ LỤC QR HDRR" của năm ${namThieuDanhSach.join(', ')} ở app hoá đơn đỏ.`,
      })
    }
  }
  return {
    soMstDanhSach: bang.size,
    cacFile: ds?.cacFile ?? [],
    soNhaCungCap: daSoi.mua.size,
    soKhachHang: daSoi.ban.size,
    quyTheoPhuLuc: [...quyTheoPhuLuc].sort(),
    namThieuDanhSach,
    doiTac: kq,
    canhBao,
  }
}

// ───────────── Đọc file Excel danh sách rủi ro (dạng mảng dòng, như sheet_to_json header:1 raw:true) ─────────────

type O = string | number | boolean | null | undefined

const nfc = (s: O) => String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim()
const thuong = (s: O) => nfc(s).toLowerCase()

/** Ngày: số seri Excel hoặc chữ "06.08.2026" / "06/08/2026" -> yyyy-mm-dd */
function ngayO(o: O): string {
  if (o === null || o === undefined || o === '') return ''
  if (typeof o === 'number' && o > 1000 && o < 100000) return new Date(Date.UTC(1899, 11, 30) + Math.round(o) * 86400000).toISOString().slice(0, 10)
  const s = nfc(o)
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  const i = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return i ? i[0] : s
}

function mstO(o: O): string {
  if (o === null || o === undefined) return ''
  let s = chuanMst(String(o))
  // ô kiểu số làm mất số 0 đầu: 9 chữ số -> 10, 11 chữ số -> 12
  if (typeof o === 'number' && /^\d+$/.test(s) && (s.length === 9 || s.length === 11)) s = '0' + s
  return /^\d{9,13}(-\d{3})?$/.test(s) ? s : ''
}

/** Đọc các sheet của một file danh sách DN rủi ro. Sheet không có dòng tiêu đề chứa ô "MST" thì bỏ qua. */
export function docDsRuiRo(sheets: { ten: string; rows: O[][] }[], tenFile: string, napLuc = Date.now()): DsRuiRo {
  const nhom: NhomRuiRo[] = []
  const dong: DnRuiRo[] = []
  for (const sh of sheets) {
    const rows = sh.rows
    const hdr = rows.findIndex((r, k) => k < 30 && !!r?.some((o) => thuong(o) === 'mst'))
    if (hdr < 0) continue
    const ten = rows[hdr].map(thuong)
    const tim = (f: (t: string) => boolean) => ten.findIndex((t) => !!t && f(t))
    const kTen = tim((t) => /^tên (doanh nghiệp|người nộp thuế|nnt|đơn vị|công ty)/.test(t))
    const c = {
      mst: tim((t) => t === 'mst'),
      ten: kTen >= 0 ? kTen : tim((t) => t.startsWith('tên')),
      soCv: tim((t) => /^số (cv|công văn|thông báo|tb)\b/.test(t)),
      ngayCv: tim((t) => /^ngày (cv|công văn|thông báo|tb)\b/.test(t)),
      bienPhap: tim((t) => t.startsWith('biện pháp')),
      trangThai: tim((t) => t.startsWith('trạng thái')),
      ngayChuyen: tim((t) => t.startsWith('ngày chuyển trạng thái')),
    }
    const moTa = rows.slice(0, hdr).flat().map(nfc).find((v) => /^danh sách/i.test(v)) ?? ''
    const ni = nhom.push({ sheet: nfc(sh.ten), moTa }) - 1
    const lay = (r: O[], k: number) => (k >= 0 ? nfc(r[k]) : '')
    for (const r of rows.slice(hdr + 1)) {
      const mst = r ? mstO(r[c.mst]) : ''
      if (!mst) continue
      dong.push({
        mst, ten: lay(r, c.ten), nhom: ni, soCv: lay(r, c.soCv),
        ngayCv: c.ngayCv >= 0 ? ngayO(r[c.ngayCv]) : '',
        bienPhap: lay(r, c.bienPhap), trangThai: lay(r, c.trangThai),
        ngayChuyen: c.ngayChuyen >= 0 ? ngayO(r[c.ngayChuyen]) : '',
      })
    }
  }
  if (!nhom.length) throw new Error(`${tenFile}: không thấy sheet nào có cột "MST" — có đúng file danh sách DN rủi ro không?`)
  return { cacFile: [{ ten: tenFile, napLuc, soDong: dong.length }], nhom, dong }
}

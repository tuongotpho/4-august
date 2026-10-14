// Nhập file Excel cũ (xuất từ AppSheet / Google Sheets: AT_2023, AT_2024, AT_2025, AT_2026…) thành danh sách lớp giảng.
// Tự dò cột theo tên tiêu đề, nên các sheet khác nhau về cột vẫn đọc được. Mọi tên được chuẩn hóa,
// dòng không phải lịch giảng (việc NPSC, gia đình) và dòng trùng được bỏ ra, kèm lý do để người dùng xem lại.
import { docXlsx, gioExcel, ngayExcel, type O, type Sheet } from './excel.js'
import {
  boDau, chuanDiaDiem, doanBuoi, lopMoi, type Buoi, type CaiDat, type LopGiang,
} from './model.js'
import { timTrung } from './tinh.js'

/** Bí danh đối tác mặc định, rút từ file của anh: tên khác (bỏ dấu) -> tên chuẩn */
export const BI_DANH_MAC_DINH: Record<string, string> = {
  'at mien nam': 'AT miền Nam',
  'an toan mien nam': 'AT miền Nam',
  atmn: 'AT miền Nam',
  'at green': 'Green',
  'at vnb': 'VNB',
  'sao mai': 'Sao Mai',
  saomai: 'Sao Mai',
  vnedu: 'VNEdu',
  tiec: 'TIEC',
  crs: 'CRS Vina',
  'crs vina': 'CRS Vina',
  'vien ktqt': 'KTQT',
  ktqt: 'KTQT',
  'esc online': 'ESC',
  'vien an toan': 'ESC',
  esc: 'ESC',
  hd: 'Sở LĐ HD',
  'ch hang_hd': 'Sở LĐ HD',
}

/** Đối tác / trạng thái của việc KHÔNG phải lịch giảng (2026 có lẫn việc cơ quan, gia đình) */
const DOI_TAC_KHONG_GIANG = new Set(['scl', 'khcn', 'family', 'kinh phi', 'dtxd', 'npsc'])

export interface DongBoQua {
  sheet: string
  dong: number
  lyDo: string
  moTa: string
}

export interface KetQuaNhap {
  lop: LopGiang[]
  boQua: DongBoQua[]
  /** Dòng nhập được nhưng nên xem lại (thiếu thù lao, ngày TT trước ngày giảng…) */
  canXem: { lop: LopGiang; lyDo: string }[]
  biDanh: Record<string, string>
}

type Cot =
  | 'id' | 'ngay' | 'doiTac' | 'lienHe' | 'doiTacLienHe' | 'khachHang' | 'gioBD' | 'gioKT' | 'tinhTrang'
  | 'ngayTT' | 'buoi' | 'chiPhi' | 'hinhThuc' | 'diaDiem' | 'noiDung'

/** Tìm cột theo tiêu đề. "Thời gian giảng" là NGÀY ở sheet 2024 nhưng là BUỔI ở sheet có cột "Ngày giảng". */
function timCot(tieuDe: O[]): Partial<Record<Cot, number>> {
  const t = tieuDe.map((x) => boDau(String(x ?? '')))
  const o = (...ten: string[]) => {
    const i = t.findIndex((x) => ten.includes(x))
    return i < 0 ? undefined : i
  }
  const coNgayGiang = o('ngay giang')
  return {
    id: o('id'),
    ngay: coNgayGiang ?? o('thoi gian giang'),
    buoi: coNgayGiang !== undefined ? o('thoi gian giang') : undefined,
    doiTac: o('ct doi tac', 'doi tac'),
    doiTacLienHe: o('doi tac dao tao'),
    lienHe: o('nguoi lien he'),
    khachHang: o('khach hang'),
    gioBD: o('gio bat dau'),
    gioKT: o('gio ket thuc'),
    tinhTrang: o('tinh trang tt', 'tinh trang thanh toan'),
    ngayTT: o('ngay thanh toan'),
    chiPhi: o('chi phi', 'kinh phi'),
    hinhThuc: o('hinh thuc hoc', 'hinh thuc'),
    diaDiem: o('dia diem'),
    noiDung: o('cv_chitiet', 'noi dung'),
  }
}

const THANG: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }
const p2 = (n: number) => String(n).padStart(2, '0')

/** Ngày: số Excel, '3-Jan', '22-23/2' (2 ngày), '3/23/2024' (tháng/ngày/năm), '2026-01-09' */
export function docNgay(v: O, namMacDinh: number): { ngay: string; soNgay: number } | null {
  if (typeof v === 'number') return v > 20000 ? { ngay: ngayExcel(v), soNgay: 1 } : null
  if (!v) return null
  const s = v.trim()
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) return { ngay: `${m[1]}-${m[2]}-${m[3]}`, soNgay: 1 }
  m = /^(\d{1,2})-([A-Za-z]{3})/.exec(s)
  if (m && THANG[m[2].toLowerCase()]) return { ngay: `${namMacDinh}-${p2(THANG[m[2].toLowerCase()])}-${p2(Number(m[1]))}`, soNgay: 1 }
  m = /^(\d{1,2})-(\d{1,2})\/(\d{1,2})$/.exec(s)
  if (m) return { ngay: `${namMacDinh}-${p2(Number(m[3]))}-${p2(Number(m[1]))}`, soNgay: Number(m[2]) - Number(m[1]) + 1 }
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
  if (m) return { ngay: `${m[3]}-${p2(Number(m[1]))}-${p2(Number(m[2]))}`, soNgay: 1 }
  return null
}

function docGio(v: O): string {
  if (typeof v === 'number') return gioExcel(v)
  const m = /^(\d{1,2})[:h](\d{2})?/.exec(String(v ?? ''))
  return m ? `${p2(Number(m[1]))}:${m[2] ?? '00'}` : ''
}

function docTienO(v: O): number | null {
  if (typeof v === 'number') return Math.round(v)
  if (!v) return null
  const s = v.replace(/[.,\s]/g, '')
  return /^\d+$/.test(s) ? Number(s) : null
}

/** "Thời gian giảng" -> buổi */
function docBuoi(v: O, gioBD: string, gioKT: string): { buoi: Buoi; soNgay?: number } {
  const s = boDau(String(v ?? ''))
  const m = /(\d+) ngay/.exec(s)
  if (m && Number(m[1]) > 1) return { buoi: 'nhieu_ngay', soNgay: Number(m[1]) }
  if (/1 ngay|^day$|ca ngay/.test(s)) return { buoi: 'ca_ngay' }
  if (/sang/.test(s)) return { buoi: 'sang' }
  if (/chieu/.test(s)) return { buoi: 'chieu' }
  if (/toi/.test(s)) return { buoi: 'toi' }
  return { buoi: doanBuoi(gioBD, gioKT) }
}

/** Mã đối tác viết tắt ở đuôi tên liên hệ ("E Ngọc Anh_Tiec") -> tên đối tác chuẩn */
const DUOI_DOI_TAC: Record<string, string> = { shs: 'SHS', atvn: 'ATVN', at: 'AT', qn: 'Sở LĐ QN' }

/** "E Ngọc Anh_TIEC" -> { ten: 'Ngọc Anh', doiTac: 'TIEC' };  "ESC online" -> { ten: '', doiTac: 'ESC' } */
export function tachLienHe(s: string): { ten: string; doiTac: string } {
  const t = s.replace(/\s+/g, ' ').trim()
  if (/^esc( online)?$/i.test(t)) return { ten: '', doiTac: 'ESC' }
  const i = t.lastIndexOf('_')
  let ten = i >= 0 ? t.slice(0, i) : t
  let doiTac = i >= 0 ? t.slice(i + 1).replace(/\s*\(.*\)$/, '') : ''
  ten = ten.replace(/^[Ee]\s+/, '').trim()
  if (/^vi[eệ]n an to[aà]n$/i.test(ten)) return { ten: '', doiTac: 'ESC' }
  // Không có dấu _ nhưng đuôi là tên đối tác: "Huyền VNEDU", "Hiền AT Miền Nam"
  if (i < 0) {
    const k = boDau(ten)
    const duoi = Object.keys(BI_DANH_MAC_DINH).find((b) => k.endsWith(' ' + b))
    if (duoi) return { ten: ten.slice(0, ten.length - duoi.length).trim(), doiTac: BI_DANH_MAC_DINH[duoi] }
  }
  // Viết ngược "CRS_Xuân": phần trước dấu _ mới là đối tác
  if (BI_DANH_MAC_DINH[boDau(ten)] && !BI_DANH_MAC_DINH[boDau(doiTac)]) [ten, doiTac] = [doiTac, ten]
  const k = boDau(doiTac)
  doiTac = BI_DANH_MAC_DINH[k] ?? DUOI_DOI_TAC[k] ?? doiTac
  return { ten, doiTac }
}

const coDau = (s: string) => s.replace(/[\u0000-\u007f]/g, '').length

export function nhapTuSheets(sheets: Sheet[], cd: CaiDat, daCo: LopGiang[] = [], bayGio = new Date()): KetQuaNhap {
  const biDanh = { ...BI_DANH_MAC_DINH, ...cd.biDanhDoiTac }
  const chuanDT = (s: string) => {
    const t = s.normalize('NFC').replace(/\s+/g, ' ').trim()
    return biDanh[boDau(t)] ?? t
  }
  const boQua: DongBoQua[] = []
  const canXem: KetQuaNhap['canXem'] = []
  const theoId = new Map<string, { lop: LopGiang; sheetNam: number }>()
  const hn = new Date(bayGio.getTime() + 7 * 3600_000).toISOString().slice(0, 10)

  // Sheet năm mới trước: dòng nằm ở cả 2 sheet (AT_2025 lẫn AT_2026) giữ bản ở sheet đúng năm
  const coNam = sheets
    .map((s) => ({ s, nam: Number(/(20\d{2})/.exec(s.ten)?.[1] ?? 0) }))
    .filter((x) => x.nam > 0)
    .sort((a, b) => b.nam - a.nam)

  for (const { s, nam } of coNam) {
    const iTieuDe = s.dong.findIndex((d) => d.some((o) => typeof o === 'string' && /kh[aá]ch h[aà]ng/i.test(o)))
    if (iTieuDe < 0) continue
    const c = timCot(s.dong[iTieuDe])
    const lay = (d: O[], k: Cot): O => (c[k] === undefined ? null : d[c[k]!] ?? null)
    const chuoi = (d: O[], k: Cot) => {
      const v = lay(d, k)
      return v === null ? '' : String(v).trim()
    }

    for (let i = iTieuDe + 1; i < s.dong.length; i++) {
      const d = s.dong[i] ?? []
      const khachHang = chuoi(d, 'khachHang')
      const vNgay = lay(d, 'ngay')
      if (!khachHang && vNgay === null) continue // dòng trống
      const soDong = i + 1
      const moTa = `${khachHang || '(không tên)'} · ${typeof vNgay === 'number' ? ngayExcel(vNgay) : vNgay ?? ''}`
      const ngay = docNgay(vNgay, nam)
      if (!ngay) {
        boQua.push({ sheet: s.ten, dong: soDong, lyDo: 'Không đọc được ngày giảng', moTa })
        continue
      }

      // Đối tác + liên hệ
      let doiTac = chuoi(d, 'doiTac')
      let lienHe = chuoi(d, 'lienHe')
      const dtlh = chuoi(d, 'doiTacLienHe')
      if (dtlh) {
        const t = tachLienHe(dtlh)
        doiTac = doiTac || t.doiTac
        lienHe = lienHe || t.ten
      } else if (lienHe.includes('_') || /^e\s/i.test(lienHe) || /^esc online$/i.test(lienHe)) {
        const t = tachLienHe(lienHe)
        lienHe = t.ten
        doiTac = doiTac || t.doiTac
      }
      doiTac = chuanDT(doiTac)

      const tinhTrang = chuoi(d, 'tinhTrang')
      if (DOI_TAC_KHONG_GIANG.has(boDau(doiTac)) || /^(npsc|family)/i.test(tinhTrang)) {
        boQua.push({ sheet: s.ten, dong: soDong, lyDo: 'Không phải lịch giảng (việc cơ quan / gia đình)', moTa })
        continue
      }

      const gioBD = docGio(lay(d, 'gioBD'))
      const gioKT = docGio(lay(d, 'gioKT'))
      const b = c.buoi !== undefined ? docBuoi(lay(d, 'buoi'), gioBD, gioKT) : { buoi: doanBuoi(gioBD, gioKT, ngay.soNgay) }
      const soNgay = b.soNgay ?? ngay.soNgay
      const diaDiem = chuanDiaDiem(chuoi(d, 'diaDiem'))
      const chuOnline = [chuoi(d, 'hinhThuc'), chuoi(d, 'buoi'), diaDiem, khachHang].join(' ')
      // Sheet không có cột thanh toán (AT_2024) là sổ ghi lại thu nhập đã nhận -> coi lớp đã qua là đã thanh toán
      const daTT = c.tinhTrang === undefined ? ngay.ngay < hn : /đã thanh toán/i.test(tinhTrang)
      const vTT = lay(d, 'ngayTT')
      const ngayTT = daTT && typeof vTT === 'number' ? ngayExcel(vTT) : ''
      const idCu = chuoi(d, 'id')
      const id = /^[0-9a-f]{6,}$/i.test(idCu) ? idCu : `${s.ten}-${soDong}`.replace(/\s+/g, '_')

      const lop = lopMoi({
        id,
        ngay: ngay.ngay,
        soNgay,
        gioBD,
        gioKT,
        buoi: soNgay > 1 ? 'nhieu_ngay' : b.buoi,
        hinhThuc: /online/i.test(chuOnline) ? 'online' : 'truc_tiep',
        doiTac,
        lienHe,
        khachHang,
        diaDiem,
        noiDung: chuoi(d, 'noiDung'),
        chiPhi: docTienO(lay(d, 'chiPhi')),
        thanhToan: daTT ? 'da' : 'chua',
        ngayTT,
        nguon: 'excel',
        // Lớp sắp tới: đẩy lên Google Calendar (Apps Script nhận lại sự kiện AppSheet đã tạo nếu trùng ngày + tên)
        canDongBo: ngay.ngay >= hn,
      })

      const cu = theoId.get(id)
      if (cu) {
        // Trùng id giữa 2 sheet: giữ bản ở sheet đúng năm giảng (đã nạp trước vì sheet mới xếp trước)
        boQua.push({ sheet: s.ten, dong: soDong, lyDo: `Trùng mã ${id} với sheet năm ${cu.sheetNam}`, moTa })
        continue
      }
      const trung = timTrung([...theoId.values()].map((x) => x.lop), lop)
      if (trung && Number(ngay.ngay.slice(0, 4)) !== nam) {
        boQua.push({ sheet: s.ten, dong: soDong, lyDo: `Trùng lớp ${trung.khachHang} ngày ${trung.ngay} ở sheet khác`, moTa })
        continue
      }
      theoId.set(id, { lop, sheetNam: nam })

      if (lop.chiPhi === null && lop.ngay < hn) canXem.push({ lop, lyDo: 'Đã giảng nhưng chưa ghi thù lao' })
      if (lop.ngayTT && lop.ngayTT < lop.ngay) canXem.push({ lop, lyDo: `Ngày thanh toán ${lop.ngayTT} trước ngày giảng` })
    }
  }

  // Cùng một tên chỉ khác hoa/thường ("Vinesh"/"VINESH") -> lấy cách viết hay dùng nhất.
  // Tên gõ KHÔNG dấu ("Phuong Anh") -> gộp vào bản có dấu nếu chỉ có đúng một bản ("Phương Anh").
  // Không gộp hai bản có dấu khác nhau: "Phương" và "Phượng" là hai người.
  const tatCa = [...theoId.values()].map((x) => x.lop)
  for (const o of ['doiTac', 'lienHe', 'diaDiem'] as const) {
    const dem = new Map<string, Map<string, number>>()
    for (const l of tatCa) {
      if (!l[o]) continue
      const k = l[o].toLowerCase()
      const m = dem.get(k) ?? new Map<string, number>()
      m.set(l[o], (m.get(l[o]) ?? 0) + 1)
      dem.set(k, m)
    }
    const chon = new Map([...dem.entries()].map(([k, m]) => [k, [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]]))
    const coDauTheoKhoa = new Map<string, string[]>()
    for (const [k, ten] of chon) if (coDau(k)) coDauTheoKhoa.set(boDau(k), [...(coDauTheoKhoa.get(boDau(k)) ?? []), ten])
    for (const [k, ten] of chon) {
      const ung = coDau(k) ? undefined : coDauTheoKhoa.get(boDau(k))
      if (ung?.length === 1) chon.set(k, ung[0])
      else chon.set(k, ten)
    }
    for (const l of tatCa) if (l[o]) l[o] = chon.get(l[o].toLowerCase())!
  }

  // Dòng thiếu đối tác mà người liên hệ chỉ làm cho MỘT đối tác ở các dòng khác -> điền đối tác đó
  const dtCuaLH = new Map<string, Set<string>>()
  for (const l of tatCa) if (l.lienHe && l.doiTac) dtCuaLH.set(l.lienHe, (dtCuaLH.get(l.lienHe) ?? new Set()).add(l.doiTac))
  for (const l of tatCa) {
    const dt = dtCuaLH.get(l.lienHe)
    if (!l.doiTac && dt?.size === 1) l.doiTac = [...dt][0]
  }

  // Đã có trong app (nhập lần trước / tạo tay): không ghi đè
  const idCo = new Set(daCo.map((l) => l.id))
  const lop: LopGiang[] = []
  for (const { lop: l } of theoId.values()) {
    if (idCo.has(l.id)) {
      boQua.push({ sheet: '(app)', dong: 0, lyDo: 'Đã có trong app (nhập lần trước)', moTa: `${l.khachHang} · ${l.ngay}` })
      continue
    }
    lop.push(l)
  }
  lop.sort((a, b) => a.ngay.localeCompare(b.ngay))
  return { lop, boQua, canXem: canXem.filter((x) => !idCo.has(x.lop.id)), biDanh }
}

export function nhapExcel(buf: ArrayBuffer | Uint8Array, cd: CaiDat, daCo: LopGiang[] = [], bayGio = new Date()): KetQuaNhap {
  return nhapTuSheets(docXlsx(buf), cd, daCo, bayGio)
}

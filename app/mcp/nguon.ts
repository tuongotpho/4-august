// Nguồn dữ liệu cho máy chủ MCP: đọc THẲNG các thư mục hồ sơ thuế trên máy (chỉ đọc, không sửa file nào),
// rồi dựng "sổ" (Kho) y hệt app làm khi người dùng kéo file vào — dùng lại nguyên các hàm trong src/core.
//
// Cấu hình (file RIÊNG, không đưa lên git): du-lieu-rieng/mcp.json
//   {
//     "thuMuc": [
//       "F:/.../2024",                                     <- quét cả XML lẫn Excel
//       { "duongDan": "F:/.../2026", "chi": "xml" },        <- chỉ lấy XML (tờ khai, chứng từ, hoá đơn XML)
//       { "duongDan": "F:/.../Du-lieu-chuan", "chi": "excel" }
//     ],
//     "traVe": ["ten-file-to-khai-bi-CQT-tra-ve.xml"],      <- như tích "CQT trả về" trên app
//     "thuMucXuat": "F:/.../xml-ra",                         <- nơi ghi file XML tờ khai lập ra (mặc định app/.xml-ra)
//     "ruiRo": ["F:/.../DN-rui-ro"]                          <- file/thư mục danh sách DN rủi ro về hoá đơn (Excel
//   }                                                           "PHỤ LỤC QR HDRR", hoặc ds.json(.gz) xuất từ app hoá đơn)
// Hoặc nhanh: biến môi trường KHAITHUE_THU_MUC="thư mục 1;thư mục 2" (quét cả XML lẫn Excel).

import * as fs from 'node:fs'
import * as path from 'node:path'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'
import { docTep, phanLoai, phuSongCuaTep, type TepHoaDon } from '../src/core/excel.js'
import { datKhongChapNhan, ghiPhuSong, khoTrong, napGoc, napHoaDon, napTaiLieu } from '../src/core/kho.js'
import { docPdfGoc, docXmlGoc } from '../src/core/hoaDonGoc.js'
import { pdfThanhDong } from './pdfChu.js'
import { docTaiLieu } from '../src/core/taiLieu.js'
import type { HoaDon } from '../src/core/types.js'
import { docDsRuiRo, gopDsRuiRo, type DsRuiRo } from '../src/core/ruiRo.js'
import { xuatXmlGTGT, type DuLieu } from './congCu.js'
import type { NguonMcp } from './mayChu.js'

XLSX.set_fs(fs)

const GOC_REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export interface ThuMuc {
  duongDan: string
  chi?: 'xml' | 'excel'
}

export interface CauHinh {
  thuMuc: ThuMuc[]
  traVe: string[]
  thuMucXuat: string
  /** File / thư mục danh sách DN rủi ro về hoá đơn */
  ruiRo?: string[]
  /** File cấu hình đã đọc (để báo cho người dùng biết sửa ở đâu) */
  nguon: string
}

export function docCauHinh(env: NodeJS.ProcessEnv = process.env): CauHinh {
  const macDinhXuat = path.join(GOC_REPO, 'app', '.xml-ra')
  if (env.KHAITHUE_THU_MUC) {
    return {
      thuMuc: env.KHAITHUE_THU_MUC.split(';').map((s) => s.trim()).filter(Boolean).map((duongDan) => ({ duongDan })),
      traVe: [],
      thuMucXuat: env.KHAITHUE_THU_MUC_XUAT || macDinhXuat,
      ruiRo: (env.KHAITHUE_RUI_RO ?? '').split(';').map((s) => s.trim()).filter(Boolean),
      nguon: 'biến môi trường KHAITHUE_THU_MUC',
    }
  }
  const file = env.KHAITHUE_CAU_HINH || path.join(GOC_REPO, 'du-lieu-rieng', 'mcp.json')
  if (!fs.existsSync(file)) {
    throw new Error(`Chưa có cấu hình nguồn dữ liệu. Tạo file ${file} (xem mẫu ở app/mcp/mcp.mau.json) hoặc đặt biến KHAITHUE_THU_MUC.`)
  }
  const j = JSON.parse(fs.readFileSync(file, 'utf8')) as { thuMuc?: (string | ThuMuc)[]; traVe?: string[]; thuMucXuat?: string; ruiRo?: string | string[] }
  return {
    thuMuc: (j.thuMuc ?? []).map((t) => (typeof t === 'string' ? { duongDan: t } : t)),
    traVe: j.traVe ?? [],
    thuMucXuat: j.thuMucXuat || macDinhXuat,
    ruiRo: typeof j.ruiRo === 'string' ? [j.ruiRo] : (j.ruiRo ?? []),
    nguon: file,
  }
}

/** Mọi file trong thư mục (đệ quy), bỏ file tạm của Excel (~$...) */
function quet(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return quet(p)
    return e.name.startsWith('~$') ? [] : [p]
  })
}

function docExcel(f: string): TepHoaDon[] {
  const wb = XLSX.readFile(f)
  return wb.SheetNames.flatMap((s) => {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[s], { header: 1, raw: true, defval: null })
    const t = docTep(rows as never, `${path.basename(f)}#${s}`)
    return t ? [t] : []
  })
}

export function napDuLieu(ch: CauHinh): DuLieu {
  const baoCao = { napLuc: new Date().toISOString(), soXml: 0, soExcel: 0, soSheetHoaDon: 0, loi: [] as string[], canhBaoHoaDon: [] as string[], thuMuc: [] as { duongDan: string; chi: string; coKhong: boolean }[] }
  const xml: string[] = []
  const excel: string[] = []
  for (const t of ch.thuMuc) {
    const coKhong = fs.existsSync(t.duongDan)
    baoCao.thuMuc.push({ duongDan: t.duongDan, chi: t.chi ?? 'tất cả', coKhong })
    if (!coKhong) {
      baoCao.loi.push(`Không thấy thư mục: ${t.duongDan}`)
      continue
    }
    for (const f of quet(t.duongDan)) {
      if (/\.xml$/i.test(f) && t.chi !== 'excel') xml.push(f)
      else if (/\.xlsx?$/i.test(f) && t.chi !== 'xml') excel.push(f)
    }
  }

  // 1) XML trước (tờ khai cho biết công ty là ai), xếp theo tên để kết quả ổn định giữa các lần nạp
  let kho = khoTrong()
  // Hoá đơn XML để sau tờ khai (cần biết công ty là ai); hoá đơn đọc cả dòng hàng (hoá đơn gốc)
  const hdXml: { f: string; text: string }[] = []
  for (const f of [...new Set(xml)].sort()) {
    try {
      const text = fs.readFileSync(f, 'utf8')
      const tl = docTaiLieu(text)
      if (tl.loai === 'hoaDon') {
        hdXml.push({ f, text })
        continue
      }
      const r = napTaiLieu(kho, tl, path.basename(f))
      kho = r.kho
      if (r.loi) baoCao.loi.push(`${path.basename(f)}: ${r.moTa}`)
    } catch (e) {
      baoCao.loi.push(`${path.basename(f)}: không đọc được (${(e as Error).message})`)
    }
  }
  for (const { f, text } of hdXml) {
    const goc = docXmlGoc(text, path.basename(f))
    const r = goc ? napGoc(kho, goc) : napTaiLieu(kho, docTaiLieu(text), path.basename(f))
    kho = r.kho
    if (r.loi) baoCao.loi.push(`${path.basename(f)}: ${r.moTa}`)
  }
  baoCao.soXml = xml.length

  // 2) Excel "Danh sách hoá đơn" — cùng cách app chọn công ty và ghi nhận tháng phủ
  const teps: TepHoaDon[] = []
  for (const f of [...new Set(excel)].sort()) {
    try {
      teps.push(...docExcel(f))
    } catch (e) {
      baoCao.loi.push(`${path.basename(f)}: không đọc được (${(e as Error).message})`)
    }
  }
  baoCao.soExcel = excel.length
  baoCao.soSheetHoaDon = teps.length
  const hoaDon: Record<string, HoaDon[]> = {}
  if (teps.length) {
    const mst = kho.chon && phanLoai(teps, kho.chon).hoaDon.length ? kho.chon : phanLoai(teps, null).mst
    if (mst) {
      const pl = phanLoai(teps, mst)
      baoCao.canhBaoHoaDon = pl.canhBao.map((c) => `${c.muc === 'loi' ? '⛔' : '⚠️'} ${c.noiDung}`)
      kho = napHoaDon(kho, mst, pl.hoaDon)
      for (const t of teps) kho = ghiPhuSong(kho, mst, phuSongCuaTep(t, phanLoai([t], mst).hoaDon))
      hoaDon[mst] = pl.hoaDon
      if (!kho.chon) kho.chon = mst
    } else baoCao.loi.push('Có file Excel hoá đơn nhưng không xác định được công ty — thêm thư mục chứa tờ khai XML đã nộp')
  }

  // 3) Tờ khai bị cơ quan thuế trả về (theo tên file trong cấu hình)
  const traVe = new Set(ch.traVe)
  for (const [mst, theoKy] of Object.entries(kho.gtgt)) {
    for (const [khoa, ds] of Object.entries(theoKy)) {
      ds.forEach((pb, i) => {
        if (traVe.has(pb.tenFile)) kho = datKhongChapNhan(kho, mst, khoa, i, true)
      })
    }
  }
  return { kho, hoaDon, baoCao, ruiRo: napRuiRo(ch.ruiRo ?? [], baoCao.loi) }
}

/** Đọc các file danh sách DN rủi ro (Excel, hoặc ds.json / ds.json.gz cất từ app hoá đơn), gộp lại */
export function napRuiRo(duongDan: string[], loi: string[]): NonNullable<DuLieu['ruiRo']> {
  if (!duongDan.length) return { ds: null, nguon: 'chưa khai mục "ruiRo" (file/thư mục danh sách DN rủi ro) trong cấu hình MCP' }
  let ds: DsRuiRo | null = null
  for (const p of duongDan) {
    if (!fs.existsSync(p)) {
      loi.push(`Không thấy file/thư mục danh sách DN rủi ro: ${p}`)
      continue
    }
    const files = fs.statSync(p).isDirectory() ? quet(p) : [p]
    for (const f of files.sort()) {
      try {
        if (/\.xls[xm]?$/i.test(f)) {
          const wb = XLSX.readFile(f)
          const sheets = wb.SheetNames.map((ten) => ({ ten, rows: XLSX.utils.sheet_to_json<(string | number | null)[]>(wb.Sheets[ten], { header: 1, raw: true, defval: null }) }))
          ds = gopDsRuiRo(ds, docDsRuiRo(sheets, path.basename(f), fs.statSync(f).mtimeMs))
        } else if (/\.json(\.gz)?$/i.test(f)) {
          const b = fs.readFileSync(f)
          const moi = JSON.parse((b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b).toString('utf8')) as DsRuiRo
          ds = gopDsRuiRo(ds, moi)
        }
      } catch (e) {
        loi.push(`${path.basename(f)}: không đọc được danh sách DN rủi ro (${(e as Error).message})`)
      }
    }
  }
  return { ds, nguon: `thư mục trên máy: ${duongDan.join('; ')}` }
}

/** Nguồn "thư mục trên máy" cho máy chủ MCP: nạp một lần, gọi nap_ho_so để đọc lại */
export function nguonThuMuc(layCauHinh: () => CauHinh = () => docCauHinh()): NguonMcp {
  let duLieu: DuLieu | null = null
  let ch: CauHinh | null = null
  const napLai = async () => {
    ch = layCauHinh()
    return (duLieu = await napPdfThuMuc(napDuLieu(ch), ch))
  }
  return {
    lay: async () => duLieu ?? napLai(),
    napLai,
    xuatXml: (d, a) => xuatXmlGTGT(d, a, (ch ?? layCauHinh()).thuMucXuat),
  }
}

/** Hoá đơn PDF trong các thư mục (trừ thư mục chỉ lấy Excel): đọc chữ, dò hoá đơn gốc. Không phải hoá đơn (báo cáo...) thì bỏ qua */
export async function napPdfThuMuc(d: DuLieu, ch: CauHinh): Promise<DuLieu> {
  const pdf = ch.thuMuc.filter((t) => t.chi !== 'excel' && fs.existsSync(t.duongDan)).flatMap((t) => quet(t.duongDan)).filter((f) => /\.pdf$/i.test(f))
  let kho = d.kho
  let soPdf = 0
  let khongPhaiHoaDon = 0
  for (const f of [...new Set(pdf)].sort()) {
    try {
      const goc = docPdfGoc(await pdfThanhDong(new Uint8Array(fs.readFileSync(f))), path.basename(f))
      const r = goc ? napGoc(kho, goc) : null
      if (!r || r.loi) {
        khongPhaiHoaDon++
        continue
      }
      kho = r.kho
      soPdf++
    } catch {
      khongPhaiHoaDon++
    }
  }
  return { ...d, kho, baoCao: { ...d.baoCao, soPdfHoaDon: soPdf, soPdfKhac: khongPhaiHoaDon } }
}

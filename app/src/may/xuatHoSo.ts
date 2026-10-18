// Đóng gói toàn bộ hồ sơ của một công ty thành 1 file ZIP ngay trên trình duyệt:
// file gốc trên mây (tải lần lượt) + Excel tổng hợp + bản sao dữ liệu app (JSON) + ghi chú.
import * as XLSX from 'xlsx'
import { zipSync, strToU8, type Zippable } from 'fflate'
import type { Kho } from '../core/kho'
import { bangTongHop, danhSachTepXuat, docTruocZip, tenAnToanZip, type NguonXuat } from '../core/xuatHoSo'
import { taiTep } from './dongBo'

/** Phần dữ liệu app của MỘT công ty (để lưu trữ / nạp lại) */
export function duLieuCongTy(kho: Kho, mst: string) {
  return {
    phienBan: kho.phienBan, mst, xuatLuc: new Date().toISOString(),
    congTy: kho.congTy[mst], gtgt: kho.gtgt[mst] ?? {}, tncn: kho.tncn[mst] ?? {}, toKhaiKhac: kho.toKhaiKhac?.[mst] ?? {},
    chungTu: kho.chungTu?.[mst] ?? {}, hoaDon: kho.hoaDon?.[mst] ?? {}, phuSong: kho.phuSong?.[mst] ?? null, goc: kho.goc?.[mst] ?? {},
    loHang: kho.loHang?.[mst] ?? {}, saoKe: kho.saoKe?.[mst] ?? {}, soQuy: kho.soQuy?.[mst] ?? null,
  }
}

const DA_NEN = /\.(pdf|zip|xlsx|xls|jpg|jpeg|png|docx|rar|7z)$/i

export async function xuatHoSo(
  kho: Kho, mst: string, nguon: NguonXuat | null,
  tienDo: (xong: number, tong: number, dang: string) => void,
): Promise<{ blob: Blob; ten: string; soTep: number; soLoi: number }> {
  const tepGoc = nguon ? danhSachTepXuat(nguon, mst) : []
  const goi: Zippable = {}
  const loi: string[] = []
  let xong = 0
  // tải 4 file một lúc
  const hang = [...tepGoc]
  const chay = async () => {
    while (hang.length) {
      const t = hang.shift()!
      tienDo(xong, tepGoc.length, t.trongZip)
      try {
        const du = new Uint8Array(await taiTep(t.duongDan))
        goi[t.trongZip] = [du, { level: DA_NEN.test(t.trongZip) ? 0 : 6 }]
      } catch (e) {
        loi.push(`${t.trongZip}: ${(e as Error).message}`)
      }
      tienDo(++xong, tepGoc.length, t.trongZip)
    }
  }
  await Promise.all([chay(), chay(), chay(), chay()])

  // Excel tổng hợp
  const wb = XLSX.utils.book_new()
  for (const [ten, rows] of Object.entries(bangTongHop(kho, mst))) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), ten.slice(0, 31))
  goi['0-Tong-hop.xlsx'] = [new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer), { level: 0 }]
  goi['0-Du-lieu-app.json'] = strToU8(JSON.stringify(duLieuCongTy(kho, mst), null, 1))
  if (loi.length) goi['0-Loi-tai.txt'] = strToU8(loi.join('\r\n'))
  const ten = kho.congTy[mst]?.hoSo.tenNNT || mst
  goi['0-DOC-TRUOC.txt'] = strToU8(docTruocZip(ten, mst, tepGoc.length, loi.length) + (nguon ? '' : '\r\n\r\n(Chưa đăng nhập: gói chỉ có dữ liệu trên máy này, không kèm file gốc trên mây.)'))

  const zip = zipSync(goi)
  // ngày theo giờ máy (Việt Nam), không theo giờ quốc tế UTC
  const d = new Date()
  const ngay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { blob: new Blob([zip as Uint8Array<ArrayBuffer>], { type: 'application/zip' }), ten: `Ho-so-thue_${mst}_${tenAnToanZip(ten).replace(/\s+/g, '-')}_${ngay}.zip`, soTep: tepGoc.length - loi.length, soLoi: loi.length }
}

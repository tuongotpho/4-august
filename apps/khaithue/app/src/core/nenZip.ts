// Mở file ZIP (gói hoá đơn tải về / tự nén) ngay trên trình duyệt hoặc máy chủ: lấy các file app đọc được,
// kể cả ZIP lồng trong ZIP. RAR/7Z không mở được trên trình duyệt -> báo người dùng nén lại thành ZIP.
import { unzipSync } from 'fflate'

export const DUOI_DOC_DUOC = /\.(xml|xlsx|xls|csv|pdf)$/i

export interface TepTrongZip {
  ten: string // đường dẫn trong gói, vd "Hoa don mua vao/0001.pdf"
  du: Uint8Array
}

export function moZip(du: Uint8Array, lop = 0): TepTrongZip[] {
  const kq: TepTrongZip[] = []
  for (const [ten, noiDung] of Object.entries(unzipSync(du))) {
    if (ten.endsWith('/') || /(^|\/)(__MACOSX|\.)/.test(ten)) continue
    if (/\.zip$/i.test(ten) && lop < 3) kq.push(...moZip(noiDung, lop + 1).map((t) => ({ ...t, ten: `${ten}/${t.ten}` })))
    else if (DUOI_DOC_DUOC.test(ten)) kq.push({ ten, du: noiDung })
  }
  return kq
}

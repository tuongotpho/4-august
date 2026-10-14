// "Vé" kết nối bot Telegram — KHÔNG cần cơ sở dữ liệu riêng (chạy được trên Vercel). Cùng cách làm với app hoadon.
// Vé là gói JSON mã hoá AES-256-GCM bằng khoá bí mật ATLD_KHOA (chỉ nằm trên Vercel): dán vé vào biến môi trường
// ATLD_TELE_VE; không ai đọc / sửa được bên trong; đổi khoá = mọi vé cũ mất hiệu lực ngay.
//
// Vé chứa mã làm mới Firebase của anh -> máy chủ đổi ra mã truy cập Firebase rồi làm việc BẰNG QUYỀN của chính anh.
// Thu hồi: xoá phiên ở trang Cài đặt (máy chủ kiểm mỗi lần nhận tin).

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

export type LoaiVe = 'tele'

export interface Ve {
  /** Loại vé: không cho dùng vé loại này thay loại khác */
  l: LoaiVe
  /** Hết hạn (ms). Không có = không hết hạn */
  exp?: number
  [k: string]: unknown
}

export function khoaTuChuoi(bimat: string | undefined): Buffer {
  if (!bimat || bimat.length < 32) throw new Error('Máy chủ thiếu khoá bí mật ATLD_KHOA (ít nhất 32 ký tự)')
  return createHash('sha256').update(bimat).digest()
}

const b64u = (b: Buffer) => b.toString('base64url')

export function niemPhong(khoa: Buffer, ve: Ve): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', khoa, iv)
  const than = Buffer.concat([c.update(JSON.stringify(ve), 'utf8'), c.final()])
  return b64u(Buffer.concat([iv, c.getAuthTag(), than]))
}

/** Mở vé: sai khoá / bị sửa / sai loại / hết hạn -> null */
export function moVe<T extends Ve = Ve>(khoa: Buffer, chuoi: string | null | undefined, loai: LoaiVe, bayGio = Date.now()): T | null {
  if (!chuoi) return null
  try {
    const b = Buffer.from(chuoi, 'base64url')
    if (b.length < 29) return null
    const d = createDecipheriv('aes-256-gcm', khoa, b.subarray(0, 12))
    d.setAuthTag(b.subarray(12, 28))
    const ve = JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8')) as T
    if (ve.l !== loai) return null
    if (ve.exp !== undefined && ve.exp < bayGio) return null
    return ve
  } catch {
    return null
  }
}

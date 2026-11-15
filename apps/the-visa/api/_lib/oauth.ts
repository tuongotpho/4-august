// "Vé" OAuth cho AI — gói JSON mã hoá AES-256-GCM bằng khoá bí mật VISA_MCP_KHOA (chỉ nằm trên Vercel).
// AI cầm vé nhưng không đọc / sửa được bên trong; đổi khoá = mọi vé cũ mất hiệu lực ngay.
// Vé KHÔNG chứa mã đăng nhập Google: máy chủ tự có chìa khoá kho Blob, vé chỉ ghi email + phiên.
// Thu hồi một máy = xoá phiên (máy chủ kiểm phiên ở mỗi lần gọi). (Chép cách làm của app quyphong.)
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export type LoaiVe = 'khach' | 'yeuCau' | 'ma' | 'truyCap' | 'lamMoi'

export interface Ve {
  l: LoaiVe
  exp?: number
  [k: string]: unknown
}

export function khoaTuChuoi(bimat: string | undefined): Buffer {
  if (!bimat || bimat.length < 32) throw new Error('Máy chủ thiếu khoá bí mật VISA_MCP_KHOA (ít nhất 32 ký tự)')
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

/** PKCE S256: base64url(sha256(code_verifier)) phải bằng code_challenge */
export function khopPKCE(verifier: string | null | undefined, challenge: string): boolean {
  if (!verifier) return false
  const a = Buffer.from(b64u(createHash('sha256').update(verifier).digest()))
  const b = Buffer.from(challenge)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Nơi được nhận mã (redirect_uri): chỉ máy của chính người dùng (localhost) và claude.ai / claude.com */
export function noiNhanHopLe(uri: string): boolean {
  let u: URL
  try { u = new URL(uri) } catch { return false }
  if (u.hash) return false
  if (u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)) return true
  return u.protocol === 'https:' && ['claude.ai', 'claude.com'].includes(u.hostname)
}

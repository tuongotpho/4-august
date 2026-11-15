// Kiểm vé đăng nhập Google (Firebase ID token, project app-from-ai) + danh sách email được phép (ALLOWED_EMAILS).
import { createRemoteJWKSet, jwtVerify } from 'jose'

const PROJECT = 'app-from-ai'
const KHOA = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'))

export class LoiQuyen extends Error {
  constructor(public ma: number, msg: string) { super(msg) }
}

export function emailDuocPhep(email: string | undefined, ds = process.env.ALLOWED_EMAILS ?? '') {
  const cho = ds.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)
  return !!email && cho.includes(email.toLowerCase())
}

export async function xacThuc(req: Request): Promise<string> {
  const ve = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!ve) throw new LoiQuyen(401, 'Chưa đăng nhập')
  let email: string | undefined
  try {
    const { payload } = await jwtVerify(ve, KHOA, { issuer: `https://securetoken.google.com/${PROJECT}`, audience: PROJECT })
    if (payload.email_verified !== true) throw new Error('email chưa xác minh')
    email = payload.email as string | undefined
  } catch {
    throw new LoiQuyen(401, 'Phiên đăng nhập hết hạn, đăng nhập lại')
  }
  if (!emailDuocPhep(email)) throw new LoiQuyen(403, `Tài khoản ${email} không được phép dùng app này`)
  return email!
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

/** Bọc hàm xử lý: tự kiểm đăng nhập và đổi lỗi thành JSON */
export const coBaoVe = (fn: (req: Request, email: string) => Promise<Response>) => async (req: Request) => {
  try {
    return await fn(req, await xacThuc(req))
  } catch (e) {
    if (e instanceof LoiQuyen) return json({ loi: e.message }, e.ma)
    console.error(e)
    return json({ loi: 'Máy chủ lỗi: ' + (e as Error).message }, 500)
  }
}

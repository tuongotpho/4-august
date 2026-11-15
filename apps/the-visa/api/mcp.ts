// "Cửa vào" Kết nối AI (MCP). vercel.json chuyển các đường dẫn dưới đây vào file này kèm ?duong=<đường dẫn gốc>:
//
//   /.well-known/oauth-protected-resource      AI hỏi: muốn vào /mcp thì xin phép ở đâu
//   /.well-known/oauth-authorization-server    AI hỏi: các địa chỉ đăng ký / đăng nhập / lấy vé
//   POST /oauth/dang-ky                        AI tự đăng ký (mỗi ứng dụng AI một mã khách)
//   GET  /oauth/dang-nhap                      chuyển sang trang cho phép NGAY TRONG web app (qua cổng app-by-lethanh,
//                                              nơi người dùng đã đăng nhập Google sẵn)
//   GET  /oauth/yeu-cau?yc=…                   trang cho phép hỏi: ứng dụng nào đang xin quyền
//   POST /oauth/cho-phep                       trang cho phép gửi vé đăng nhập Firebase -> tạo phiên AI, trả mã
//   POST /oauth/token                          AI đổi mã lấy vé truy cập (1 giờ) + vé làm mới
//   POST /mcp                                  AI gọi công cụ (kèm vé truy cập)
//
// Biến môi trường: VISA_MCP_KHOA (bắt buộc, bí mật) · VISA_GOC_URL · VISA_WEB_URL (tuỳ chọn) · ALLOWED_EMAILS · BLOB_READ_WRITE_TOKEN
import { randomBytes } from 'node:crypto'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { emailDuocPhep, LoiQuyen, xacThuc } from './_lib/xacThuc.js'
import { khoaTuChuoi, khopPKCE, moVe, niemPhong, noiNhanHopLe, type Ve } from './_lib/oauth.js'
import * as kho from './_lib/kho.js'
import { taoMayChu, type NguonMcp } from './_lib/mayChuMcp.js'

process.env.TZ = 'Asia/Ho_Chi_Minh'
const GIO = 3600 * 1000
const WEB_MAC_DINH = 'https://app-by-lethanh.web.app/the-visa/'

type Env = Record<string, string | undefined>
interface VeTruyCap extends Ve { e: string; p: string; tm: string }

const jsonRes = (x: unknown, status = 200, them: Record<string, string> = {}) =>
  new Response(JSON.stringify(x), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...them } })
const loiOAuth = (error: string, moTa: string, status = 400) => {
  console.log('[oauth] tu-choi', error, moTa)
  return jsonRes({ error, error_description: moTa }, status)
}

/** Nguồn dữ liệu thật: kho Blob. Tách ra để test thay bằng kho giả. */
export interface KhoMcp {
  dsKy: typeof kho.dsKy
  luuKy: typeof kho.luuKy
  taoPhien: typeof kho.taoPhien
  docPhien: typeof kho.docPhien
  ghiNhatKy: typeof kho.ghiNhatKy
}

export function taoXuLy(env: Env = process.env, k: KhoMcp = kho, kiemDangNhap: (r: Request) => Promise<string> = xacThuc) {
  return async function xuLy(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const goc = (env.VISA_GOC_URL || `${req.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')}://${req.headers.get('x-forwarded-host') ?? url.host}`).replace(/\/$/, '')
    const web = env.VISA_WEB_URL || WEB_MAC_DINH
    const duong = url.searchParams.get('duong') ?? url.pathname
    let khoa: Buffer
    try { khoa = khoaTuChuoi(env.VISA_MCP_KHOA) } catch (e) { return jsonRes({ loi: (e as Error).message }, 500) }

    try {
      if (duong.startsWith('/.well-known/oauth-protected-resource'))
        return jsonRes({ resource: `${goc}/mcp`, authorization_servers: [goc], bearer_methods_supported: ['header'], resource_name: 'Chi tiêu thẻ (the-visa)' }, 200, { 'Access-Control-Allow-Origin': '*' })
      if (duong.startsWith('/.well-known/oauth-authorization-server') || duong.startsWith('/.well-known/openid-configuration'))
        return jsonRes({
          issuer: goc,
          authorization_endpoint: `${goc}/oauth/dang-nhap`,
          token_endpoint: `${goc}/oauth/token`,
          registration_endpoint: `${goc}/oauth/dang-ky`,
          response_types_supported: ['code'],
          grant_types_supported: ['authorization_code', 'refresh_token'],
          code_challenge_methods_supported: ['S256'],
          token_endpoint_auth_methods_supported: ['none'],
        }, 200, { 'Access-Control-Allow-Origin': '*' })
      if (duong === '/oauth/dang-ky' && req.method === 'POST') return dangKy(await req.json().catch(() => ({})))
      if (duong === '/oauth/dang-nhap' && req.method === 'GET') return dangNhap(url.searchParams)
      if (duong === '/oauth/yeu-cau' && req.method === 'GET') return yeuCau(url.searchParams.get('yc'))
      if (duong === '/oauth/cho-phep' && req.method === 'POST') return await choPhep(req)
      if (duong === '/oauth/token' && req.method === 'POST') return await capVe(req)
      if (duong === '/mcp' || duong === '/api/mcp') return await mcp(req)
      return jsonRes({ loi: 'Không có đường dẫn này' }, 404)
    } catch (e) {
      console.error(e)
      return jsonRes({ loi: 'Lỗi máy chủ' }, 500)
    }

    // ---------- Đăng ký ứng dụng AI (RFC 7591) ----------
    function dangKy(y: { redirect_uris?: unknown; client_name?: unknown }) {
      const uris = Array.isArray(y.redirect_uris) ? y.redirect_uris.filter((x): x is string => typeof x === 'string') : []
      if (!uris.length || !uris.every(noiNhanHopLe)) return loiOAuth('invalid_redirect_uri', 'Chỉ nhận địa chỉ trả về trên máy (localhost / 127.0.0.1) hoặc claude.ai / claude.com')
      const ten = (typeof y.client_name === 'string' ? y.client_name : 'Ứng dụng AI').slice(0, 80)
      return jsonRes({
        client_id: niemPhong(khoa, { l: 'khach', r: uris, n: ten }),
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_name: ten, redirect_uris: uris, token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'],
      }, 201)
    }

    // ---------- Chuyển sang trang cho phép trên web app ----------
    function dangNhap(q: URLSearchParams) {
      const khach = moVe<Ve & { r: string[]; n: string }>(khoa, q.get('client_id'), 'khach')
      const redirect = q.get('redirect_uri') ?? ''
      // Sai mã khách / địa chỉ trả về: KHÔNG chuyển hướng (tránh bị lợi dụng), chỉ báo lỗi
      if (!khach || !khach.r.includes(redirect)) return jsonRes({ loi: 'Yêu cầu kết nối không hợp lệ (ứng dụng chưa đăng ký hoặc địa chỉ trả về lạ).' }, 400)
      const quayVe = (loi: string) => Response.redirect(`${redirect}${redirect.includes('?') ? '&' : '?'}${new URLSearchParams({ error: loi, ...(q.get('state') ? { state: q.get('state')! } : {}) })}`, 302)
      if (q.get('response_type') !== 'code') return quayVe('unsupported_response_type')
      const cc = q.get('code_challenge')
      if (!cc || q.get('code_challenge_method') !== 'S256') return quayVe('invalid_request')
      const yc = niemPhong(khoa, { l: 'yeuCau', c: q.get('client_id'), r: redirect, s: q.get('state') ?? '', cc, n: khach.n, exp: Date.now() + 15 * 60 * 1000 })
      return Response.redirect(`${web}?ket-noi-ai=${encodeURIComponent(yc)}`, 302)
    }

    function yeuCau(yc: string | null) {
      const v = moVe<Ve & { r: string; n: string }>(khoa, yc, 'yeuCau')
      if (!v) return jsonRes({ loi: 'Yêu cầu đã hết hạn — quay lại ứng dụng AI và kết nối lại.' }, 400)
      return jsonRes({ ungDung: v.n, noiNhan: new URL(v.r).host })
    }

    async function choPhep(r: Request) {
      let email: string
      try { email = await kiemDangNhap(r) } catch (e) {
        return jsonRes({ loi: (e as Error).message }, e instanceof LoiQuyen ? e.ma : 401)
      }
      const y = (await r.json().catch(() => ({}))) as { yeuCau?: string; tenMay?: string }
      const yc = moVe<Ve & { c: string; r: string; s: string; cc: string; n: string }>(khoa, y.yeuCau, 'yeuCau')
      if (!yc) return jsonRes({ loi: 'Yêu cầu đã hết hạn — quay lại ứng dụng AI và kết nối lại.' }, 400)
      const tenMay = (y.tenMay?.trim() || yc.n).slice(0, 60)
      const p: kho.PhienMcp = { id: randomBytes(12).toString('hex'), email, tenMay, ungDung: yc.n, noiNhan: new URL(yc.r).host, taoLuc: new Date().toISOString() }
      await k.taoPhien(p)
      const code = niemPhong(khoa, { l: 'ma', e: email, p: p.id, tm: tenMay, cc: yc.cc, r: yc.r, c: yc.c, exp: Date.now() + 5 * 60 * 1000 })
      console.log('[oauth] cho-phep', p.id, p.ungDung)
      return jsonRes({ chuyenToi: `${yc.r}${yc.r.includes('?') ? '&' : '?'}${new URLSearchParams({ code, ...(yc.s ? { state: yc.s } : {}) })}` })
    }

    // ---------- Đổi mã lấy vé ----------
    async function capVe(r: Request) {
      const f = (r.headers.get('content-type') ?? '').includes('json')
        ? new URLSearchParams(Object.entries((await r.json()) as Record<string, string>))
        : new URLSearchParams(await r.text())
      const phatVe = (v: { e: string; p: string; tm: string }, veLamMoi?: string) => jsonRes({
        access_token: niemPhong(khoa, { l: 'truyCap', ...v, exp: Date.now() + GIO }),
        token_type: 'Bearer', expires_in: 3600,
        refresh_token: veLamMoi ?? niemPhong(khoa, { l: 'lamMoi', ...v }),
      })
      if (f.get('grant_type') === 'authorization_code') {
        const m = moVe<Ve & { e: string; p: string; tm: string; cc: string; r: string; c: string }>(khoa, f.get('code'), 'ma')
        if (!m) return loiOAuth('invalid_grant', 'Mã không hợp lệ hoặc đã hết hạn')
        if (f.get('redirect_uri') && f.get('redirect_uri') !== m.r) return loiOAuth('invalid_grant', 'Sai địa chỉ trả về')
        if (f.get('client_id') && f.get('client_id') !== m.c) return loiOAuth('invalid_grant', 'Sai mã khách')
        if (!khopPKCE(f.get('code_verifier'), m.cc)) return loiOAuth('invalid_grant', 'Sai code_verifier')
        return phatVe({ e: m.e, p: m.p, tm: m.tm })
      }
      if (f.get('grant_type') === 'refresh_token') {
        const lm = moVe<Ve & { e: string; p: string; tm: string }>(khoa, f.get('refresh_token'), 'lamMoi')
        if (!lm) return loiOAuth('invalid_grant', 'Vé làm mới không hợp lệ')
        if (!(await conHieuLuc(lm))) return loiOAuth('invalid_grant', 'Quyền của máy này đã bị thu hồi — kết nối lại')
        return phatVe({ e: lm.e, p: lm.p, tm: lm.tm }, f.get('refresh_token')!)
      }
      return loiOAuth('unsupported_grant_type', 'Chỉ hỗ trợ authorization_code và refresh_token')
    }

    /** Phiên còn (chưa bị thu hồi) và email vẫn trong danh sách được phép */
    async function conHieuLuc(v: { e: string; p: string }) {
      if (!emailDuocPhep(v.e, env.ALLOWED_EMAILS)) return false
      const ph = await k.docPhien(v.p)
      return !!ph && ph.email === v.e
    }

    // ---------- Gọi công cụ ----------
    async function mcp(r: Request) {
      // Không mở luồng chờ tin (GET → SSE): nó giữ hàm chạy tới hết giờ, mỗi máy AI đang mở là một hàm chạy suốt
      // (làm cạn hạn mức bộ nhớ Vercel 10/2026). Máy chủ này không gửi tin chủ động nên trả 405 — đúng chuẩn MCP.
      if (r.method === 'GET') return new Response(null, { status: 405, headers: { Allow: 'POST, DELETE' } })
      const chuaVao = (moTa: string) => jsonRes({ error: 'invalid_token', error_description: moTa }, 401, {
        'WWW-Authenticate': `Bearer error="invalid_token", resource_metadata="${goc}/.well-known/oauth-protected-resource"`,
      })
      const ve = moVe<VeTruyCap>(khoa, /^Bearer\s+(.+)$/i.exec(r.headers.get('authorization') ?? '')?.[1], 'truyCap')
      if (!ve) return chuaVao('Chưa đăng nhập hoặc vé đã hết hạn')
      if (!(await conHieuLuc(ve))) return chuaVao('Quyền của máy này đã bị thu hồi — kết nối lại')
      const nguon: NguonMcp = {
        dsKy: () => k.dsKy(),
        luuKy: (ky) => k.luuKy({ ...ky, luuLuc: new Date().toISOString() }),
        nhatKy: (congCu, moTa) => k.ghiNhatKy({ luc: new Date().toISOString(), phien: ve.p, tenMay: ve.tm, congCu, moTa }),
      }
      const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
      await taoMayChu(nguon).connect(transport)
      return transport.handleRequest(r)
    }
  }
}

const xuLy = taoXuLy()
export const GET = xuLy
export const POST = xuLy
export const DELETE = xuLy
export const OPTIONS = xuLy

// "Cửa vào" của máy chủ MCP trên Vercel (mcp/vercel.ts gọi vào đây). Một hàm nhận Request trả Response:
//
//   /.well-known/oauth-protected-resource      AI hỏi: muốn vào /mcp thì xin phép ở đâu
//   /.well-known/oauth-authorization-server    AI hỏi: các địa chỉ đăng ký / đăng nhập / lấy vé
//   POST /oauth/dang-ky                        AI tự đăng ký (mỗi ứng dụng AI một mã khách)
//   GET  /oauth/dang-nhap                      kiểm yêu cầu rồi chuyển chủ shop sang trang /ket-noi-ai của web app
//   GET  /oauth/yeu-cau?yc=                    trang đó hỏi: ứng dụng nào đang xin quyền
//   POST /oauth/cho-phep                       trang đó gửi mã làm mới Firebase -> tạo phiên AI, trả mã
//   POST /oauth/token                          AI đổi mã lấy vé truy cập (1 giờ) + vé làm mới
//   POST /mcp                                  AI gọi công cụ (kèm vé truy cập)
//
// Web app và máy chủ chạy CHUNG một project Vercel (tuongot-si.vercel.app): web ở thư mục tĩnh,
// mấy đường dẫn trên vào hàm này (scripts/build-vercel.mjs). Chép từ máy chủ MCP Sáng kiến NPSC.
//
// Không lưu gì ngoài Firestore của app (phiên AI, nhật ký). Biến môi trường trên Vercel:
//   TUONGOT_MCP_KHOA (bắt buộc, bí mật ≥ 32 ký tự)
//   TUONGOT_WEB_URL (tuỳ chọn, mặc định = chính máy chủ) · TUONGOT_WEB_THEM (gốc web khác được gọi cho-phep)
//   TUONGOT_GOC_URL (tuỳ chọn, gốc của chính máy chủ) · TUONGOT_MCP_NOI_NHAN_THEM (tuỳ chọn)

import { createHash } from 'node:crypto'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { taoMayChu } from './mayChu.ts'
import { taoKho } from './nguon.ts'
import { cauHinhFirebase, doiMa, FirebaseNguoiDung, LoiFirebase, type CauHinhFirebase, type MaTruyCap } from './firebaseRest.ts'
import { conPhien, ghiDungLuc, taoPhien } from './khoPhien.ts'
import { khoaTuChuoi, khopPKCE, moVe, niemPhong, noiNhanHopLe, type Ve } from './oauth.ts'

const GIO = 3600 * 1000

type Env = Record<string, string | undefined>

interface ThongTinPhien { u: string; rt: string; p: string; tm: string }
interface YeuCau extends Ve { c: string; r: string; s: string; cc: string; n: string }

const jsonRes = (x: unknown, status = 200, them: Record<string, string> = {}) =>
  new Response(JSON.stringify(x), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...them } })
const loiOAuth = (error: string, moTa: string, status = 400) => {
  console.log('[oauth] tu-choi', error, moTa)
  return jsonRes({ error, error_description: moTa }, status)
}
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** Mã truy cập Firebase dùng lại trong lúc máy chủ còn "ấm" (khỏi đổi mã mỗi lần gọi) */
const boNhoMa = new Map<string, MaTruyCap>()
async function maFirebase(cfg: CauHinhFirebase, rt: string) {
  const k = createHash('sha256').update(rt).digest('hex')
  const co = boNhoMa.get(k)
  if (co && co.hetHan > Date.now()) return co
  const moi = await doiMa(cfg, rt)
  boNhoMa.set(k, moi)
  return moi
}

export function taoXuLy(env: Env = process.env) {
  const noiNhanThem = (env.TUONGOT_MCP_NOI_NHAN_THEM ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const webCoDinh = env.TUONGOT_WEB_URL?.replace(/\/$/, '')
  const webThem = (env.TUONGOT_WEB_THEM ?? '').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean)
  const cfg = cauHinhFirebase(env)

  return async function xuLy(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const goc = (env.TUONGOT_GOC_URL || `${req.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')}://${req.headers.get('x-forwarded-host') ?? url.host}`).replace(/\/$/, '')
    // Vercel chuyển mọi đường dẫn vào một hàm, kèm ?duong=<đường dẫn gốc> (scripts/build-vercel.mjs)
    const duong = (url.searchParams.get('duong') ?? url.pathname).replace(/\/$/, '') || '/'
    // CORS chỉ cho trang "Kết nối AI" trên web app (gọi yeu-cau, cho-phep)
    // Web app nằm cùng máy chủ (trừ khi đặt TUONGOT_WEB_URL)
    const web = webCoDinh || goc
    const gocWebDuocGoi = new Set([web, ...webThem])
    const nguon = req.headers.get('origin') ?? ''
    const cors: Record<string, string> = gocWebDuocGoi.has(nguon) ? { 'Access-Control-Allow-Origin': nguon, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, POST', Vary: 'Origin' } : {}

    let khoa: Buffer
    try {
      khoa = khoaTuChuoi(env.TUONGOT_MCP_KHOA)
    } catch (e) {
      return jsonRes({ loi: (e as Error).message }, 500)
    }

    try {
      if (req.method === 'OPTIONS' && duong.startsWith('/oauth/')) return new Response(null, { status: 204, headers: cors })
      if (duong === '/' || duong === '/gioi-thieu-mcp') return trangGioiThieu(goc)
      if (duong.startsWith('/.well-known/oauth-protected-resource')) {
        return jsonRes({ resource: `${goc}/mcp`, authorization_servers: [goc], bearer_methods_supported: ['header'], resource_name: 'Sổ bán buôn tương ớt' }, 200, { 'Access-Control-Allow-Origin': '*' })
      }
      if (duong.startsWith('/.well-known/oauth-authorization-server') || duong.startsWith('/.well-known/openid-configuration')) {
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
      }
      if (duong === '/oauth/dang-ky' && req.method === 'POST') return dangKy(await req.json().catch(() => ({})))
      if (duong === '/oauth/dang-nhap' && req.method === 'GET') return dangNhap(url.searchParams)
      if (duong === '/oauth/yeu-cau' && req.method === 'GET') return xemYeuCau(url.searchParams.get('yc'))
      if (duong === '/oauth/cho-phep' && req.method === 'POST') return await choPhep(await req.json().catch(() => ({})))
      if (duong === '/oauth/token' && req.method === 'POST') return await capVe(req)
      if (duong === '/mcp') return await mcp(req)
      return jsonRes({ loi: 'Không có đường dẫn này' }, 404)
    } catch (e) {
      const thongDiep = e instanceof LoiFirebase ? e.message : 'Lỗi máy chủ'
      if (!(e instanceof LoiFirebase)) console.error(e)
      return jsonRes({ loi: thongDiep }, 500, cors)
    }

    // ---------- Đăng ký ứng dụng AI (RFC 7591) ----------
    function dangKy(y: { redirect_uris?: unknown; client_name?: unknown }) {
      const uris = Array.isArray(y.redirect_uris) ? y.redirect_uris.filter((x): x is string => typeof x === 'string') : []
      if (!uris.length || !uris.every((u) => noiNhanHopLe(u, noiNhanThem))) {
        return loiOAuth('invalid_redirect_uri', 'Chỉ nhận địa chỉ trả về trên máy (localhost / 127.0.0.1) hoặc claude.ai / claude.com')
      }
      const ten = (typeof y.client_name === 'string' ? y.client_name : 'Ứng dụng AI').slice(0, 80)
      const client_id = niemPhong(khoa, { l: 'khach', r: uris, n: ten })
      return jsonRes({
        client_id, client_id_issued_at: Math.floor(Date.now() / 1000), client_name: ten, redirect_uris: uris,
        token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'],
      }, 201)
    }

    // ---------- Kiểm yêu cầu, chuyển sang trang Kết nối AI trên web app ----------
    function dangNhap(q: URLSearchParams) {
      const khach = moVe<Ve & { r: string[]; n: string }>(khoa, q.get('client_id'), 'khach')
      const redirect = q.get('redirect_uri') ?? ''
      // Sai mã khách / địa chỉ trả về: KHÔNG chuyển hướng (tránh bị lợi dụng), chỉ báo lỗi
      if (!khach || !khach.r.includes(redirect)) return trangLoi('Yêu cầu kết nối không hợp lệ (ứng dụng chưa đăng ký hoặc địa chỉ trả về lạ).')
      const quayVe = (loi: string) => Response.redirect(`${redirect}${redirect.includes('?') ? '&' : '?'}${new URLSearchParams({ error: loi, ...(q.get('state') ? { state: q.get('state')! } : {}) })}`, 302)
      if (q.get('response_type') !== 'code') return quayVe('unsupported_response_type')
      const cc = q.get('code_challenge')
      if (!cc || q.get('code_challenge_method') !== 'S256') return quayVe('invalid_request')
      const yc = niemPhong(khoa, { l: 'yeuCau', c: q.get('client_id')!, r: redirect, s: q.get('state') ?? '', cc, n: khach.n, exp: Date.now() + 15 * 60 * 1000 } satisfies YeuCau)
      return Response.redirect(`${web}/ket-noi-ai?${new URLSearchParams({ yc, may: goc })}`, 302)
    }

    function xemYeuCau(chuoi: string | null) {
      const yc = moVe<YeuCau>(khoa, chuoi, 'yeuCau')
      if (!yc) return jsonRes({ loi: 'Yêu cầu đã hết hạn (15 phút) — quay lại ứng dụng AI và kết nối lại.' }, 400, cors)
      return jsonRes({ ungDung: yc.n, noiNhan: new URL(yc.r).host, hetHan: yc.exp }, 200, cors)
    }

    async function choPhep(y: { yeuCau?: string; maLamMoi?: string; tenMay?: string }) {
      const yc = moVe<YeuCau>(khoa, y.yeuCau, 'yeuCau')
      if (!yc) return jsonRes({ loi: 'Yêu cầu đã hết hạn — quay lại ứng dụng AI và kết nối lại.' }, 400, cors)
      if (!y.maLamMoi) return jsonRes({ loi: 'Chưa đăng nhập' }, 400, cors)
      // Tự kiểm mã với Firebase, không tin trình duyệt gửi gì lên
      const m = await doiMa(cfg, y.maLamMoi)
      const fb = new FirebaseNguoiDung(cfg, m.uid, m.idToken, m.email)
      const tenMay = (y.tenMay?.trim() || yc.n).slice(0, 60)
      const maPhien = await taoPhien(fb, { tenMay, ungDung: yc.n, noiNhan: new URL(yc.r).host })
      const code = niemPhong(khoa, { l: 'ma', u: m.uid, rt: y.maLamMoi, p: maPhien, tm: tenMay, cc: yc.cc, r: yc.r, c: yc.c, exp: Date.now() + 5 * 60 * 1000 })
      const q = new URLSearchParams({ code, ...(yc.s ? { state: yc.s } : {}) })
      console.log('[oauth] cho-phep', JSON.stringify({ ungDung: yc.n, noiNhan: new URL(yc.r).host }))
      return jsonRes({ chuyenToi: `${yc.r}${yc.r.includes('?') ? '&' : '?'}${q}` }, 200, cors)
    }

    // ---------- Đổi mã lấy vé ----------
    async function capVe(r: Request) {
      const loai = r.headers.get('content-type') ?? ''
      const f = loai.includes('json') ? new URLSearchParams(Object.entries(await r.json() as Record<string, string>)) : new URLSearchParams(await r.text())
      const phatVe = (v: ThongTinPhien, veLamMoi?: string) => jsonRes({
        access_token: niemPhong(khoa, { l: 'truyCap', ...v, exp: Date.now() + GIO }),
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: veLamMoi ?? niemPhong(khoa, { l: 'lamMoi', ...v }),
      })
      if (f.get('grant_type') === 'authorization_code') {
        const m = moVe<Ve & ThongTinPhien & { cc: string; r: string; c: string }>(khoa, f.get('code'), 'ma')
        if (!m) return loiOAuth('invalid_grant', 'Mã không hợp lệ hoặc đã hết hạn')
        if (f.get('redirect_uri') && f.get('redirect_uri') !== m.r) return loiOAuth('invalid_grant', 'Sai địa chỉ trả về')
        if (f.get('client_id') && f.get('client_id') !== m.c) return loiOAuth('invalid_grant', 'Sai mã khách')
        if (!khopPKCE(f.get('code_verifier'), m.cc)) return loiOAuth('invalid_grant', 'Sai code_verifier')
        return phatVe({ u: m.u, rt: m.rt, p: m.p, tm: m.tm })
      }
      if (f.get('grant_type') === 'refresh_token') {
        const lm = moVe<Ve & ThongTinPhien>(khoa, f.get('refresh_token'), 'lamMoi')
        if (!lm) return loiOAuth('invalid_grant', 'Vé làm mới không hợp lệ')
        // Phiên đã bị thu hồi trên web app -> không cấp tiếp
        const ok = await kiemPhien(lm).catch(() => null)
        if (!ok) return loiOAuth('invalid_grant', 'Quyền của máy này đã bị thu hồi — kết nối lại')
        await ghiDungLuc(ok.fb, lm.p)
        return phatVe({ u: lm.u, rt: lm.rt, p: lm.p, tm: lm.tm }, f.get('refresh_token')!)
      }
      return loiOAuth('unsupported_grant_type', 'Chỉ hỗ trợ authorization_code và refresh_token')
    }

    async function kiemPhien(v: ThongTinPhien) {
      const m = await maFirebase(cfg, v.rt)
      if (m.uid !== v.u) return null
      const fb = new FirebaseNguoiDung(cfg, m.uid, m.idToken, m.email)
      const phien = await conPhien(fb, v.p)
      return phien ? { fb, phien } : null
    }

    // ---------- Gọi công cụ ----------
    async function mcp(r: Request) {
      // Không mở luồng chờ tin (GET → SSE): trên Vercel nó giữ hàm chạy tới hết giờ, mỗi máy AI đang mở là một hàm chạy suốt
      // (đã ngốn hết hạn mức bộ nhớ miễn phí 10/2026). Máy chủ này không gửi tin chủ động nên trả 405 — đúng chuẩn MCP, máy AI tự bỏ qua.
      if (r.method === 'GET') return new Response(null, { status: 405, headers: { Allow: 'POST, DELETE' } })
      // Header HTTP chỉ chứa được chữ không dấu -> lời giải thích tiếng Việt để ở phần thân
      const chuaVao = (moTa: string) => jsonRes({ error: 'invalid_token', error_description: moTa }, 401, {
        'WWW-Authenticate': `Bearer error="invalid_token", resource_metadata="${goc}/.well-known/oauth-protected-resource"`,
      })
      const ve = moVe<Ve & ThongTinPhien>(khoa, /^Bearer\s+(.+)$/i.exec(r.headers.get('authorization') ?? '')?.[1], 'truyCap')
      if (!ve) return chuaVao('Chưa đăng nhập hoặc vé đã hết hạn')
      const ok = await kiemPhien(ve).catch((e) => (e instanceof LoiFirebase && e.trangThai === 400 ? null : Promise.reject(e)))
      if (!ok) return chuaVao('Quyền của máy này đã bị thu hồi hoặc tài khoản đã đổi — kết nối lại')
      const { fb } = ok

      // Mỗi lần gọi tải mới từ Firestore (dữ liệu luôn khớp web app), chỉ tải một lần trong cùng yêu cầu
      const server = taoMayChu(taoKho(fb, { ma: ve.p, tenMay: ve.tm }))
      const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
      await server.connect(transport)
      return transport.handleRequest(r)
    }
  }
}

function trangHtml(html: string, status = 200) {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  })
}

const trangLoi = (moTa: string) => trangHtml(`<!doctype html><meta charset="utf-8"><title>Kết nối AI</title><p style="font:16px system-ui;margin:2rem">⛔ ${esc(moTa)}</p>`, 400)

const trangGioiThieu = (goc: string) => trangHtml(`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Máy chủ MCP — Sổ bán buôn tương ớt</title>
<body style="font:16px/1.6 system-ui,sans-serif;max-width:640px;margin:2rem auto;padding:0 16px;color:#0f172a">
<h1 style="font-size:20px">Máy chủ MCP — Sổ bán buôn tương ớt</h1>
<p>Cổng cho trợ lý AI (Claude, Codex…) tra cứu khách, công nợ, tồn kho, thống kê và lên đơn bằng quyền của chính tài khoản chủ shop.</p>
<p>Địa chỉ kết nối: <code>${esc(goc)}/mcp</code></p>
<p>(C) August87 - 0982722036</p>
</body></html>`)

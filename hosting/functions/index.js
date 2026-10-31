// Máy chủ của các app trên Firebase (site app-by-lethanh.web.app) — thay cho thư mục api/ trên Vercel.
// Mỗi app một hàm; mã xử lý giữ nguyên của từng app (apps/<app>/mcp/web.ts…), build.mjs gói sẵn vào lib/<app>.mjs.
// firebase.json chuyển /<đường dẫn app>/mcp, /oauth/*, /telegram/*, /.well-known/* về hàm của app đó.
//
// Mã bí mật nằm ở Secret Manager (đặt bằng: firebase functions:secrets:set TEN_BIEN).
// Hàm chỉ chạy khi có yêu cầu, tối đa 60 giây — máy chủ MCP đã chặn luồng chờ tin GET /mcp (xem báo cáo 16).
import { onRequest } from 'firebase-functions/v2/https'
import { setGlobalOptions } from 'firebase-functions/v2'

const GOC = 'https://app-by-lethanh.web.app'

setGlobalOptions({ region: 'asia-southeast1', memory: '256MiB', timeoutSeconds: 60, maxInstances: 3, concurrency: 1 })

const BO_HEADER = new Set(['host', 'connection', 'content-length', 'transfer-encoding', 'keep-alive', 'upgrade'])

/** Đổi yêu cầu kiểu Express (Firebase) sang Request chuẩn web mà mã của app dùng, bỏ tiền tố đường dẫn app (/hoa-don) */
async function chuyen(req, res, xuLy, tienTo) {
  let duong = req.path
  if (duong === tienTo || duong.startsWith(tienTo + '/')) duong = duong.slice(tienTo.length) || '/'
  const i = req.originalUrl.indexOf('?')
  const url = GOC + duong + (i >= 0 ? req.originalUrl.slice(i) : '')
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) {
    if (v == null || BO_HEADER.has(k)) continue
    headers.set(k, Array.isArray(v) ? v.join(', ') : String(v))
  }
  const coThan = req.method !== 'GET' && req.method !== 'HEAD'
  const r = await xuLy(new Request(url, { method: req.method, headers, body: coThan ? req.rawBody : undefined }))
  res.status(r.status)
  r.headers.forEach((v, k) => {
    if (k !== 'content-length' && k !== 'transfer-encoding') res.setHeader(k, v)
  })
  res.end(Buffer.from(await r.arrayBuffer()))
}

// ---------- Hoá đơn NPSC (/hoa-don/) ----------
let xuLyHoaDon
export const hoadon = onRequest({ secrets: ['HOADON_MCP_KHOA'] }, async (req, res) => {
  xuLyHoaDon ??= (await import('./lib/hoadon.mjs')).taoXuLy({
    ...process.env,
    HOADON_GOC_URL: `${GOC}/hoa-don`,
    HOADON_APP_URL: `${GOC}/hoa-don/`,
  })
  await chuyen(req, res, xuLyHoaDon, '/hoa-don')
})

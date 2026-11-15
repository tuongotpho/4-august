// Một cửa cho mọi đường dẫn máy chủ — dùng khi chạy trên Firebase Functions (một hàm cho cả app, xem hosting/ của 4.August).
// Trên Vercel mỗi file trong api/ là một hàm riêng nên không cần file này.
import * as ky from '../ky.js'
import * as pdf from '../pdf.js'
import * as phien from '../mcp-phien.js'
import { taoXuLy } from '../mcp.js'

type XuLy = (r: Request) => Promise<Response>
const API: Record<string, Record<string, unknown>> = { '/api/ky': ky, '/api/pdf': pdf, '/api/mcp-phien': phien }

export function taoXuLyTatCa(env: Record<string, string | undefined> = process.env): XuLy {
  const mcp = taoXuLy(env)
  return async (req) => {
    const m = API[new URL(req.url).pathname.replace(/\/$/, '')]
    if (!m) return mcp(req) // /mcp, /oauth/*, /.well-known/*
    const f = m[req.method] as XuLy | undefined
    return f ? f(req) : new Response(null, { status: 405 })
  }
}

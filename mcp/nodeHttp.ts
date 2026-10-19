// Chuyển yêu cầu kiểu Node (req, res) sang Request/Response chuẩn web cho web.ts — dùng cho Vercel và chạy thử.

import type { IncomingMessage, ServerResponse } from 'node:http'

export function boChuyenNode(xuLy: (r: Request) => Promise<Response>, goc: () => string) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const than = req.method === 'GET' || req.method === 'HEAD' ? undefined : await new Promise<Buffer>((ok, loi) => {
      const c: Buffer[] = []
      req.on('data', (x: Buffer) => c.push(x)).on('end', () => ok(Buffer.concat(c))).on('error', loi)
    })
    const headers = new Headers()
    for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v)
    const r = await xuLy(new Request(`${goc()}${req.url ?? '/'}`, { method: req.method, headers, body: than && new Uint8Array(than) }))
    res.writeHead(r.status, Object.fromEntries(r.headers))
    res.end(Buffer.from(await r.arrayBuffer()))
  }
}

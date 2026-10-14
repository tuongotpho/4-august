// Chạy thử máy chủ ngay trên máy: npm run server (cổng 8790). `npm run dev` (vite) chuyển /ai, /telegram sang đây.
// Mặc định dùng DỮ LIỆU THẬT (Firebase app-from-ai). Máy giả lập: đặt ATLD_GIA_LAP=1 và bật emulator trước.
// Khoá AI: đặt ATLD_ANTHROPIC_KEY trong môi trường trước khi chạy.
import { randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import { taoXuLy } from './web.js'

const cong = Number(process.env.PORT ?? 8790)
const khoa = process.env.ATLD_KHOA ?? randomBytes(32).toString('hex') // chỉ để chạy thử: mỗi lần chạy một khoá
const xuLy = taoXuLy({ ...process.env, ATLD_KHOA: khoa, ATLD_GOC_URL: process.env.ATLD_GOC_URL ?? `http://localhost:${cong}` })

createServer(async (req, res) => {
  const than = req.method === 'GET' || req.method === 'HEAD' ? undefined : await new Promise<Buffer>((ok) => {
    const c: Buffer[] = []
    req.on('data', (x) => c.push(x)).on('end', () => ok(Buffer.concat(c)))
  })
  const r = await xuLy(new Request(`http://localhost:${cong}${req.url}`, { method: req.method, headers: req.headers as Record<string, string>, body: than && new Uint8Array(than) }))
  res.writeHead(r.status, Object.fromEntries(r.headers))
  res.end(Buffer.from(await r.arrayBuffer()))
}).listen(cong, () => console.error(`Máy chủ lịch giảng chạy thử: http://localhost:${cong}${process.env.ATLD_GIA_LAP === '1' ? ' — máy giả lập Firebase' : ' — ⚠️ DỮ LIỆU THẬT'}`))

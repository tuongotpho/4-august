// Chạy thử máy chủ MCP "trên mạng" ngay trên máy: npm run mcp:web (mặc định cổng 8789).
// Mặc định đọc DỮ LIỆU THẬT (database quyphong). Với máy giả lập: đặt QUY_GIA_LAP=1 và bật emulator trước.
// Rồi trong Claude Code: claude mcp add --transport http quyphong-thu http://localhost:8789/mcp

import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { taoXuLy } from './web.js';

const cong = Number(process.env.PORT ?? 8789);
const khoa = process.env.QUY_MCP_KHOA ?? randomBytes(32).toString('hex'); // chỉ để chạy thử: mỗi lần chạy một khoá
const xuLy = taoXuLy({ ...process.env, QUY_MCP_KHOA: khoa, QUY_GOC_URL: process.env.QUY_GOC_URL ?? `http://localhost:${cong}` });

createServer(async (req, res) => {
  const than =
    req.method === 'GET' || req.method === 'HEAD'
      ? undefined
      : await new Promise<Buffer>((ok) => {
          const c: Buffer[] = [];
          req.on('data', (x) => c.push(x)).on('end', () => ok(Buffer.concat(c)));
        });
  const r = await xuLy(
    new Request(`http://localhost:${cong}${req.url}`, { method: req.method, headers: req.headers as Record<string, string>, body: than && new Uint8Array(than) }),
  );
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(cong, () =>
  console.error(`quyphong MCP (web) chạy thử: http://localhost:${cong}/mcp${process.env.QUY_GIA_LAP === '1' ? ' — máy giả lập Firebase' : ' — ⚠️ DỮ LIỆU THẬT'}`),
);

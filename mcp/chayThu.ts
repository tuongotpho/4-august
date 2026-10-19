// Chạy thử máy chủ MCP ngay trên máy: npm run mcp:thu (cổng 8788).
// ⚠️ Nối vào DỮ LIỆU THẬT (database tuongot-sale) bằng tài khoản đăng nhập lúc cho phép.
// Trang "Kết nối AI" lấy từ web chạy ở máy (npm run dev, cổng 3001).

import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { boChuyenNode } from './nodeHttp.ts'
import { taoXuLy } from './web.ts'

const cong = Number(process.env.PORT ?? 8788)
const goc = `http://localhost:${cong}`
const xuLy = taoXuLy({
  ...process.env,
  // mỗi lần chạy một khoá -> tắt máy chủ là mọi vé cũ hết hiệu lực
  TUONGOT_MCP_KHOA: process.env.TUONGOT_MCP_KHOA ?? randomBytes(32).toString('hex'),
  TUONGOT_GOC_URL: goc,
  TUONGOT_WEB_URL: process.env.TUONGOT_WEB_URL ?? 'http://localhost:3001',
})
createServer(boChuyenNode(xuLy, () => goc)).listen(cong, () => console.log(`Máy chủ MCP chạy thử: ${goc}/mcp`))

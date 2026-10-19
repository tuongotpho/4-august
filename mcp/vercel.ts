// Hàm Vercel: máy chủ MCP + cổng đăng nhập cho AI. Toàn bộ phần xử lý nằm ở web.ts.
// scripts/build-vercel.mjs đóng gói file này thành một hàm duy nhất và chuyển mọi đường dẫn vào đây.

import { boChuyenNode } from './nodeHttp.ts'
import { taoXuLy } from './web.ts'

const xuLy = taoXuLy()

export default boChuyenNode(xuLy, () => 'https://localhost')

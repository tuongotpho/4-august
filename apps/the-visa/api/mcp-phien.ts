// /api/mcp-phien — mục "Kết nối AI" trên web app (cần đăng nhập)
//   GET              -> các máy AI đang được phép + nhật ký ghi gần đây
//   DELETE ?id=<id>  -> thu hồi quyền một máy (xoá phiên; máy chủ MCP kiểm phiên ở mỗi lần gọi)
import { coBaoVe, json } from './_lib/xacThuc.js'
import { dsNhatKy, dsPhien, xoaPhien } from './_lib/kho.js'

export const GET = coBaoVe(async () => {
  const [phien, nhatKy] = await Promise.all([dsPhien(), dsNhatKy()])
  return json({ phien: phien.sort((a, b) => b.taoLuc.localeCompare(a.taoLuc)), nhatKy })
})

export const DELETE = coBaoVe(async (req) => {
  await xoaPhien(new URL(req.url).searchParams.get('id') ?? '')
  return json({ ok: true })
})

// /api/pdf?id=<id> -> tải lại file sao kê gốc đã cất
import { coBaoVe, json } from './_lib/xacThuc.js'
import { docPdf, idHopLe } from './_lib/kho.js'

export const GET = coBaoVe(async (req) => {
  const id = new URL(req.url).searchParams.get('id') ?? ''
  if (!idHopLe(id)) return json({ loi: 'id kỳ không hợp lệ' }, 400)
  const s = await docPdf(id)
  if (!s) return json({ loi: 'Chưa có file gốc của kỳ này' }, 404)
  return new Response(s, {
    headers: { 'content-type': 'application/pdf', 'content-disposition': `inline; filename="sao-ke-${id}.pdf"`, 'cache-control': 'no-store' },
  })
})

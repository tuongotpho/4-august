// /api/ky
//   GET                 -> mọi kỳ đã lưu
//   PUT  (JSON Ky)      -> lưu / ghi đè một kỳ (sửa nhóm cũng gửi lại cả kỳ)
//   POST ?id=<id>  (PDF)-> cất file sao kê gốc
//   DELETE ?id=<id>     -> xoá kỳ + file gốc
import { coBaoVe, json } from './_lib/xacThuc.js'
import { dsKy, idHopLe, luuKy, luuPdf, xoaKy } from './_lib/kho.js'
import { kiemKy } from '../shared/kiemKy.js'

const layId = (req: Request) => {
  const id = new URL(req.url).searchParams.get('id') ?? ''
  if (!idHopLe(id)) throw Object.assign(new Error('id kỳ không hợp lệ'), { ma: 400 })
  return id
}
const loi400 = (e: unknown) => json({ loi: (e as Error).message }, 400)

export const GET = coBaoVe(async () => json({ ky: await dsKy() }))

export const PUT = coBaoVe(async (req) => {
  let ky
  try { ky = kiemKy(await req.json()) } catch (e) { return loi400(e) }
  ky.luuLuc = new Date().toISOString()
  await luuKy(ky)
  return json({ ok: true, ky })
})

export const POST = coBaoVe(async (req) => {
  let id
  try { id = layId(req) } catch (e) { return loi400(e) }
  const pdf = await req.arrayBuffer()
  if (pdf.byteLength > 4_400_000) return json({ loi: 'File quá lớn (giới hạn ~4,4 MB)' }, 413)
  if (new TextDecoder().decode(pdf.slice(0, 5)) !== '%PDF-') return loi400(new Error('Không phải file PDF'))
  await luuPdf(id, pdf)
  return json({ ok: true })
})

export const DELETE = coBaoVe(async (req) => {
  let id
  try { id = layId(req) } catch (e) { return loi400(e) }
  await xoaKy(id)
  return json({ ok: true })
})

// "Cửa vào" của máy chủ (Vercel, api/index.ts gọi vào đây). Một hàm nhận Request trả Response:
//
//   /telegram/*        bot Telegram (server/telegram.ts)
//   POST /ai/trich     web app gửi tin nhắn dán vào -> AI đọc ra lớp (chưa lưu, web cho anh xem lại)
//   GET  /cron/nhac    Vercel Cron 20h hằng ngày: nhắc lịch ngày mai qua Telegram + đẩy lớp còn chờ lên Google Calendar
//   /mcp, /oauth/*, /.well-known/*   kết nối AI (Claude) qua MCP (server/mcpWeb.ts)
//
// Biến môi trường: ATLD_KHOA (bắt buộc, bí mật, ≥ 32 ký tự) · ATLD_GEMINI_KEY · ATLD_TELE_TOKEN · ATLD_TELE_VE
//                  CRON_SECRET (Vercel tự gửi kèm khi gọi cron) · ATLD_GOC_URL (tuỳ chọn)

import { createHash } from 'node:crypto'
import { dongBoLop } from '../src/lib/lichGoogle.js'
import { congNgay, homNay, ngayCuoi, ngayVN, thu } from '../src/lib/model.js'
import { lopTuAI } from '../src/lib/trichTin.js'
import { goiY, sapXepTheoNgay } from '../src/lib/tinh.js'
import { suaTheoLoi, trichTin } from './ai.js'
import { cauHinhFirebase, doiMa, FirebaseNguoiDung, LoiFirebase, type CauHinhFirebase } from './firebaseRest.js'
import * as kho from './kho.js'
import { dongNgan, moiVe, moTaLop, xuLyTelegram } from './telegram.js'
import { xuLyMcp } from './mcpWeb.js'
import { khoaTuChuoi } from './oauth.js'

process.env.TZ = 'Asia/Ho_Chi_Minh'

type Env = Record<string, string | undefined>

const json = (x: unknown, status = 200) =>
  new Response(JSON.stringify(x), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })

/** Mã truy cập Firebase dùng lại trong lúc máy chủ còn "ấm" */
const boNhoMa = new Map<string, { idToken: string; uid: string; hetHan: number }>()
async function maFirebase(cfg: CauHinhFirebase, rt: string) {
  const k = createHash('sha256').update(rt).digest('hex')
  const co = boNhoMa.get(k)
  if (co && co.hetHan > Date.now()) return co
  const moi = await doiMa(cfg, rt)
  boNhoMa.set(k, moi)
  return moi
}

/** tuyChon.ai: test thay AI thật bằng hàm giả */
export function taoXuLy(env: Env = process.env, tuyChon: { ai?: { trich: typeof trichTin; sua: typeof suaTheoLoi } } = {}) {
  const ai = tuyChon.ai ?? { trich: trichTin, sua: suaTheoLoi }
  return async function xuLy(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const goc = (env.ATLD_GOC_URL || `${req.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')}://${req.headers.get('x-forwarded-host') ?? url.host}`).replace(/\/$/, '')
    // Vercel chuyển mọi đường dẫn vào api/index, kèm ?duong=<đường dẫn gốc>
    const duong = url.searchParams.get('duong') ?? url.pathname
    let khoa: Buffer
    try {
      khoa = khoaTuChuoi(env.ATLD_KHOA)
    } catch (e) {
      return json({ loi: (e as Error).message }, 500)
    }
    const cfg = cauHinhFirebase(env, `${goc}/`)

    try {
      const mcp = await xuLyMcp(req, duong, { env, khoa, cfg, goc, maFirebase })
      if (mcp) return mcp
      if (duong.startsWith('/telegram/')) return await xuLyTelegram(req, duong, { env, khoa, cfg, goc, maFirebase, ai })
      if (duong === '/ai/trich' && req.method === 'POST') return await trich(await req.json().catch(() => ({})))
      if (duong === '/cron/nhac') return await nhac(req)
      return json({ loi: 'Không có đường dẫn này' }, 404)
    } catch (e) {
      const thongDiep = e instanceof LoiFirebase ? e.message : (e as Error).message || 'Lỗi máy chủ'
      console.error(e)
      return json({ loi: thongDiep }, 500)
    }

    async function trich(y: { maLamMoi?: string; tin?: string }) {
      if (!y.maLamMoi) return json({ loi: 'Chưa đăng nhập' }, 401)
      const tin = String(y.tin ?? '').trim()
      if (tin.length < 4) return json({ loi: 'Tin nhắn trống' }, 400)
      if (!env.ATLD_GEMINI_KEY) return json({ loi: 'Máy chủ chưa có khoá AI (biến ATLD_GEMINI_KEY trên Vercel)' }, 500)
      const { idToken, uid } = await maFirebase(cfg, y.maLamMoi)
      const fb = new FirebaseNguoiDung(cfg, uid, idToken)
      const [ds, cd] = await Promise.all([kho.taiLop(fb), kho.taiCaiDat(fb)])
      const gy = goiY(ds)
      const kq = await ai.trich(tin, gy, env.ATLD_GEMINI_KEY)
      const lop = kq.hanhDong === 'tao_lop' ? kq.lop : []
      return json({ lop: lop.map((a) => lopTuAI(a, cd, gy, tin, 'web')), luuY: lop.map((a) => a.luuY), traLoi: kq.traLoi })
    }

    async function nhac(r: Request) {
      // Vercel Cron gửi "Authorization: Bearer <CRON_SECRET>"
      if (!env.CRON_SECRET || r.headers.get('authorization') !== `Bearer ${env.CRON_SECRET}`) return json({ loi: 'Không có quyền' }, 401)
      const token = env.ATLD_TELE_TOKEN?.trim()
      const apiGoc = (env.ATLD_TELE_API || 'https://api.telegram.org').replace(/\/$/, '')
      const appUrl = (env.ATLD_APP_URL || goc).replace(/\/$/, '')
      const mai = congNgay(homNay(), 1)
      const kq: string[] = []
      for (const ve of moiVe(env, khoa)) {
        try {
          const ma = await maFirebase(cfg, ve.rt)
          const fb = new FirebaseNguoiDung(cfg, ma.uid, ma.idToken)
          if (!(await kho.conPhien(fb, ve.p))) continue
          const [ds, cd] = await Promise.all([kho.taiLop(fb), kho.taiCaiDat(fb)])

          // lớp còn chờ lên Google Calendar (bot / web lỗi mạng lần trước)
          if (cd.lich.bat && cd.lich.url) {
            for (const l of ds.filter((x) => x.canDongBo)) {
              try {
                await kho.luuLop(fb, await dongBoLop(cd, l, appUrl))
              } catch (e) {
                console.error('[cron] lich', l.id, e)
                break
              }
            }
          }

          const lop = ds.filter((l) => !l.huy && l.ngay <= mai && ngayCuoi(l) >= mai).sort(sapXepTheoNgay)
          if (lop.length && token) {
            const chu = [`🔔 Lịch giảng ngày mai — ${thu(mai)} ${ngayVN(mai)}:`, ...lop.map((l) => `\n${moTaLop(l)}`)].join('\n')
            await fetch(`${apiGoc}/bot${token}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: Number(ve.chat), text: chu.slice(0, 4000), link_preview_options: { is_disabled: true } }),
            })
          }
          kq.push(`${ve.chat}: ${lop.length} lớp (${lop.map(dongNgan).join('; ')})`)
        } catch (e) {
          console.error('[cron]', e)
          kq.push(`${ve.chat}: lỗi ${(e as Error).message}`)
        }
      }
      return json({ ok: true, kq })
    }
  }
}

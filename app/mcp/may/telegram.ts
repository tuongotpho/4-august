// Bot Telegram NHẮC HẠN NỘP THUẾ. Chạy chung hàm Vercel với máy chủ MCP (web.ts chuyển /telegram/* sang đây).
// Cùng cách làm với bot của app hoá đơn đỏ: máy chủ làm việc BẰNG QUYỀN của chính người dùng (mã làm mới Firebase
// nằm trong "vé" mã hoá), có phiên — thu hồi được ở web app như mọi máy AI khác. Máy chủ không lưu gì riêng.
//
//   POST /telegram/nhan   Telegram gọi vào mỗi khi có tin nhắn (webhook), kèm mật khẩu riêng ở header.
//                         Người lạ: bot trả mã Telegram của họ. Người có vé: bot trả tình hình hạn nộp ngay.
//   POST /telegram/bat    web app (đã đăng nhập) bảo máy chủ đăng ký webhook; trả tên bot
//   POST /telegram/ghep   web app gửi mã Telegram -> tạo phiên + trả VÉ để dán vào Vercel
//   GET  /telegram/nhac   Vercel Cron gọi mỗi sáng (kèm CRON_SECRET): gửi nhắc cho từng vé khi tới mốc
//
// Biến môi trường trên Vercel:
//   KHAITHUE_TELE_TOKEN (bí mật) mã bot từ @BotFather — CHỈ ở máy chủ, không bao giờ vào mã trang web
//   KHAITHUE_TELE_VE    vé kết nối (web app tạo ở Kho hồ sơ → Nhắc hạn qua Telegram); nhiều vé cách nhau dấu phẩy
//   CRON_SECRET         (bí mật) Vercel tự gửi kèm khi chạy lịch — thiếu thì /telegram/nhac từ chối

import { createHash } from 'node:crypto'
import * as cc from '../congCu.js'
import { tenKy } from '../../src/core/kho.js'
import { tien } from '../../src/core/nhan.js'
import { doiMa, FirebaseNguoiDung, LoiFirebase, type CauHinhFirebase } from './firebaseRest.js'
import { conPhien, dungDuLieu, taiDuLieuMay, taoPhien } from './khoMay.js'
import { moVe, niemPhong, type Ve } from './oauth.js'
import type { DuLieu } from '../congCu.js'

type Env = Record<string, string | undefined>

export interface BoiCanhTele {
  env: Env
  khoa: Buffer
  cfg: CauHinhFirebase
  goc: string
  maFirebase(cfg: CauHinhFirebase, rt: string): Promise<{ idToken: string; uid: string }>
  /** Giả định "hôm nay" (test) */
  homNay?: Date
}

export interface VeTele extends Ve { u: string; rt: string; p: string; tm: string; chat: string }

interface TinNhan {
  message_id: number
  chat: { id: number; type: string }
  text?: string
}

/** Mật khẩu webhook: suy ra từ khoá bí mật, khỏi thêm biến môi trường. Telegram gửi kèm mỗi lần gọi. */
export const matKhauWebhook = (khoa: Buffer) => createHash('sha256').update(khoa).update('khaithue-telegram').digest('hex')

const NGUON_WEB = ['https://khaithue.vercel.app', 'http://localhost:5179', 'http://localhost:5181', 'http://localhost:5182', 'http://localhost:5183']

const json = (x: unknown, status = 200, them: Record<string, string> = {}) =>
  new Response(JSON.stringify(x), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...them } })

/** Các mốc nhắc trước hạn (số ngày còn lại) khi CHƯA có tờ khai của quý tới hạn */
export const MOC_NHAC = [10, 5, 3, 1, 0]

/**
 * Tin nhắc cho MỘT công ty. gui = có nên gửi trong lần chạy lịch hôm nay không:
 *  - chưa có tờ khai quý tới hạn và hôm nay đúng mốc 10 / 5 / 3 / 1 / 0 ngày trước hạn
 *  - hoặc thứ Hai hằng tuần nếu còn quý QUÁ HẠN chưa có tờ khai / còn LỖI cần xử lý
 */
export function tinNhacHan(d: DuLieu, mst: string, homNay: Date): { gui: boolean; chu: string } {
  const tq = cc.tongQuan(d, { mst, ngay_hom_nay: homNay.toISOString().slice(0, 10) })
  const ten = d.kho.congTy[mst]?.hoSo.tenNNT || mst
  const dong: string[] = [`📅 ${ten} (MST ${mst})`]
  let gui = false
  const h = tq.hanToi
  if (h) {
    if (h.daCoToKhai) dong.push(`✅ Quý ${tenKy(h.khoa)}: đã có tờ khai (hạn ${h.han}).`)
    else if (h.conNgay >= 0) {
      dong.push(`⏰ Quý ${tenKy(h.khoa)}: hạn nộp ${h.han} — còn ${h.conNgay} ngày, CHƯA có tờ khai.${h.daXuat ? ' (App đã xuất XML, chưa thấy bản đã nộp.)' : ''}`)
      if (MOC_NHAC.includes(h.conNgay)) gui = true
    } else {
      dong.push(`🚨 Quý ${tenKy(h.khoa)}: ĐÃ QUÁ HẠN ${-h.conNgay} ngày (hạn ${h.han}), chưa có tờ khai — nộp ngay để giảm tiền phạt, chậm nộp.`)
      gui = true
    }
  }
  const quaHan = tq.quy.filter((q) => q.quaHan && !q.coToKhai)
  const noThieu = tq.quy.filter((q) => q.coToKhai && (q.phaiNop_ct40 ?? 0) > (q.daNop ?? 0))
  if (quaHan.length) dong.push(`• Quý quá hạn chưa có tờ khai: ${quaHan.map((q) => tenKy(q.quy)).join(', ')}`)
  if (noThieu.length) dong.push(`• Quý có thuế phải nộp nhưng chưa thấy chứng từ nộp đủ: ${noThieu.slice(0, 6).map((q) => `${tenKy(q.quy)} (${tien((q.phaiNop_ct40 ?? 0) - (q.daNop ?? 0))} đ)`).join(', ')}`)
  const loi = tq.canhBao.filter((c) => c.startsWith('⛔'))
  if (loi.length) {
    dong.push(`⛔ ${loi.length} lỗi cần xử lý, ví dụ:`)
    for (const c of loi.slice(0, 3)) dong.push(`  ${c.replace(/^⛔ LỖI: /, '').slice(0, 220)}`)
  }
  const thuHai = homNay.getUTCDay() === 1
  if (thuHai && (quaHan.length || loi.length)) gui = true
  dong.push('', 'Mở app: https://khaithue.vercel.app — app không tự nộp; anh ký số và nộp trên thuedientu.gdt.gov.vn.')
  return { gui, chu: dong.join('\n') }
}

export async function xuLyTelegram(req: Request, duong: string, bc: BoiCanhTele): Promise<Response> {
  const { env, khoa, cfg, goc } = bc
  const token = env.KHAITHUE_TELE_TOKEN?.trim()
  const apiGoc = (env.KHAITHUE_TELE_API || 'https://api.telegram.org').replace(/\/$/, '')
  const nguon = req.headers.get('origin') ?? ''
  const cors: Record<string, string> = NGUON_WEB.includes(nguon) || env.KHAITHUE_GIA_LAP === '1'
    ? { 'Access-Control-Allow-Origin': nguon || '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' }
    : {}
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

  async function tg<T = unknown>(phuongThuc: string, than: Record<string, unknown>): Promise<T> {
    const r = await fetch(`${apiGoc}/bot${token}/${phuongThuc}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(than) })
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string }
    if (!j.ok) throw new Error(`Telegram từ chối ${phuongThuc}: ${j.description ?? r.status}`)
    return j.result as T
  }
  const gui = (chat: number | string, chu: string) => tg('sendMessage', { chat_id: chat, text: chu, link_preview_options: { is_disabled: true } })

  const dsVe = () => (env.KHAITHUE_TELE_VE ?? '').split(/[\s,;]+/).filter(Boolean).map((s) => moVe<VeTele>(khoa, s, 'tele')).filter((v): v is VeTele => !!v)

  /** Dữ liệu của người có vé — bằng quyền của chính họ; phiên bị thu hồi thì null */
  async function duLieuCuaVe(v: VeTele): Promise<DuLieu | null> {
    const { idToken, uid } = await bc.maFirebase(cfg, v.rt)
    if (uid !== v.u) return null
    const fb = new FirebaseNguoiDung(cfg, uid, idToken)
    if (!(await conPhien(fb, v.p))) return null
    return dungDuLieu(await taiDuLieuMay(fb))
  }
  const tinCuaVe = async (v: VeTele, homNay: Date) => {
    const d = await duLieuCuaVe(v)
    if (!d) return null
    return Object.keys(d.kho.congTy).map((mst) => tinNhacHan(d, mst, homNay))
  }

  if (duong === '/telegram/nhan' && req.method === 'POST') {
    if (req.headers.get('x-telegram-bot-api-secret-token') !== matKhauWebhook(khoa)) return json({ loi: 'Sai mật khẩu webhook' }, 401)
    if (!token) return json({ ok: true })
    const m = ((await req.json().catch(() => ({}))) as { message?: TinNhan }).message
    if (m && m.chat?.type === 'private') {
      const chat = String(m.chat.id)
      try {
        const v = dsVe().find((x) => x.chat === chat)
        if (!v) await gui(chat, `Mã Telegram của anh: ${chat}\nDán mã này vào app khai thuế (Kho hồ sơ → Nhắc hạn qua Telegram) để nhận nhắc hạn nộp thuế.`)
        else {
          const ds = await tinCuaVe(v, bc.homNay ?? new Date())
          if (!ds) await gui(chat, '⚠️ Quyền của bot đã bị thu hồi trong app — tạo vé mới ở app (Kho hồ sơ → Nhắc hạn qua Telegram).')
          else for (const t of ds.length ? ds : [{ chu: 'Tài khoản chưa có công ty nào trong app.' }]) await gui(chat, t.chu)
        }
      } catch (e) {
        console.error('[tele] loi', e)
        await gui(chat, `⚠️ Máy chủ gặp lỗi: ${e instanceof LoiFirebase ? e.message : (e as Error).message}`).catch(() => undefined)
      }
    }
    return json({ ok: true }) // luôn 200: trả lỗi thì Telegram gửi lại tin cũ nhiều lần
  }

  if (duong === '/telegram/nhac' && (req.method === 'GET' || req.method === 'POST')) {
    const bimat = env.CRON_SECRET?.trim()
    if (!bimat || req.headers.get('authorization') !== `Bearer ${bimat}`) return json({ loi: 'Chỉ lịch chạy của Vercel (CRON_SECRET) mới gọi được' }, 401)
    if (!token) return json({ loi: 'Chưa có KHAITHUE_TELE_TOKEN' }, 400)
    const homNay = bc.homNay ?? new Date()
    const kq: { chat: string; daGui: number; loi?: string }[] = []
    for (const v of dsVe()) {
      try {
        const ds = await tinCuaVe(v, homNay)
        if (!ds) {
          kq.push({ chat: v.chat, daGui: 0, loi: 'phiên đã bị thu hồi' })
          continue
        }
        let daGui = 0
        for (const t of ds.filter((x) => x.gui)) {
          await gui(v.chat, t.chu)
          daGui++
        }
        kq.push({ chat: v.chat, daGui })
      } catch (e) {
        kq.push({ chat: v.chat, daGui: 0, loi: (e as Error).message.slice(0, 200) })
      }
    }
    console.log('[tele] nhac', JSON.stringify(kq))
    return json({ ngay: homNay.toISOString().slice(0, 10), ve: kq.length, ketQua: kq })
  }

  if (duong === '/telegram/bat' && req.method === 'POST') {
    if (!token) return json({ loi: 'Máy chủ chưa có mã bot — thêm biến KHAITHUE_TELE_TOKEN trên Vercel rồi triển khai lại.' }, 400, cors)
    const y = (await req.json().catch(() => ({}))) as { maLamMoi?: string }
    if (!y.maLamMoi) return json({ loi: 'Chưa đăng nhập' }, 401, cors)
    await doiMa(cfg, y.maLamMoi) // chỉ người đã đăng nhập app mới bấm được
    await tg('setWebhook', { url: `${goc}/telegram/nhan`, secret_token: matKhauWebhook(khoa), allowed_updates: ['message'] })
    const bot = await tg<{ username: string }>('getMe', {})
    return json({ bot: bot.username }, 200, cors)
  }

  if (duong === '/telegram/ghep' && req.method === 'POST') {
    const y = (await req.json().catch(() => ({}))) as { maLamMoi?: string; chat?: string }
    if (!y.maLamMoi) return json({ loi: 'Chưa đăng nhập' }, 401, cors)
    const chat = String(y.chat ?? '').trim()
    if (!/^\d{4,15}$/.test(chat)) return json({ loi: 'Mã Telegram là một dãy số (bot gửi cho anh khi bấm Start)' }, 400, cors)
    const { idToken, uid } = await doiMa(cfg, y.maLamMoi)
    const fb = new FirebaseNguoiDung(cfg, uid, idToken)
    const p = await taoPhien(fb, { tenMay: 'Bot Telegram nhắc hạn', ungDung: 'Telegram', noiNhan: `telegram · ${chat}` })
    const ve = niemPhong(khoa, { l: 'tele', u: uid, rt: y.maLamMoi, p, tm: 'Bot Telegram nhắc hạn', chat })
    return json({ ve, bien: 'KHAITHUE_TELE_VE', coToken: !!token }, 200, cors)
  }

  return json({ loi: 'Không có đường dẫn này' }, 404, cors)
}

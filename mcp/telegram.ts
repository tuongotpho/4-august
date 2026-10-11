// Bot Telegram: anh gửi file PDF / XML hóa đơn cho bot -> máy chủ tự đọc, cất file gốc, tạo HỒ SƠ MỚI trên app.
// Chạy chung hàm Vercel với máy chủ MCP (mcp/web.ts chuyển /telegram/* sang đây), dùng lại y nguyên cách ghi của AI:
// làm việc BẰNG QUYỀN của chính người dùng (mã làm mới Firebase nằm trong "vé" mã hoá), có phiên + nhật ký,
// thu hồi được ở Cài đặt như mọi máy AI khác.
//
//   POST /telegram/nhan     Telegram gọi vào mỗi khi có tin nhắn (webhook) — kèm mật khẩu riêng ở header
//   POST /telegram/bat      web app (đã đăng nhập) bảo máy chủ đăng ký webhook với Telegram; trả tên bot
//   POST /telegram/ghep     web app gửi mã Telegram của anh -> tạo phiên + trả VÉ để dán vào Vercel
//
// Biến môi trường trên Vercel:
//   HOADON_TELE_TOKEN  (bí mật) mã bot lấy từ @BotFather — CHỈ nằm ở máy chủ, không bao giờ vào mã web
//   HOADON_TELE_VE     vé kết nối (web app tạo ra ở Cài đặt → Telegram); nhiều vé cách nhau dấu phẩy
// Chỉ người có vé hợp lệ ĐÚNG mã Telegram mới gửi được hóa đơn; người lạ nhắn vào chỉ nhận lại mã Telegram của họ.

import { createHash } from 'node:crypto'
import { formatMoney } from '../src/lib/numberToWords.js'
import * as cc from './congCu.js'
import { docHoaDonPdf } from './docPdf.js'
import { doiMa, FirebaseNguoiDung, LoiFirebase, type CauHinhFirebase } from './firebaseRest.js'
import * as kho from './kho.js'
import { moVe, niemPhong, type Ve } from './oauth.js'

type Env = Record<string, string | undefined>

export interface BoiCanhTele {
  env: Env
  khoa: Buffer
  cfg: CauHinhFirebase
  goc: string
  maFirebase(cfg: CauHinhFirebase, rt: string): Promise<{ idToken: string; uid: string }>
}

interface VeTele extends Ve { u: string; rt: string; p: string; tm: string; chat: string }

interface TinNhan {
  message_id: number
  chat: { id: number; type: string }
  from?: { id: number }
  text?: string
  caption?: string
  document?: { file_id: string; file_name?: string; mime_type?: string; file_size?: number }
  photo?: unknown[]
}

/** Telegram chỉ cho bot tải file tới 20 MB */
const TOI_DA = 20 * 1024 * 1024

/** Mật khẩu webhook: suy ra từ khoá bí mật, khỏi thêm biến môi trường. Telegram gửi kèm mỗi lần gọi. */
export const matKhauWebhook = (khoa: Buffer) => createHash('sha256').update(khoa).update('telegram-webhook').digest('hex')

const NGUON_WEB = ['https://hoadon-npsc.web.app', 'https://hoadon-npsc.firebaseapp.com', 'https://hoadon-npsc.vercel.app', 'http://localhost:5180']

const json = (x: unknown, status = 200, them: Record<string, string> = {}) =>
  new Response(JSON.stringify(x), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...them } })

const ngayVN = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split('-').reverse().join('/') : s || '?')

export async function xuLyTelegram(req: Request, duong: string, bc: BoiCanhTele): Promise<Response> {
  const { env, khoa, cfg, goc } = bc
  const token = env.HOADON_TELE_TOKEN?.trim()
  const apiGoc = (env.HOADON_TELE_API || 'https://api.telegram.org').replace(/\/$/, '')
  const appUrl = (env.HOADON_APP_URL || 'https://hoadon-npsc.web.app').replace(/\/$/, '')

  // Web app (tên miền khác) gọi /bat, /ghep -> cho phép đúng các tên miền của app
  const nguon = req.headers.get('origin') ?? ''
  const cors: Record<string, string> = NGUON_WEB.includes(nguon) || env.HOADON_GIA_LAP === '1'
    ? { 'Access-Control-Allow-Origin': nguon || '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' }
    : {}
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

  async function tg<T = unknown>(phuongThuc: string, than: Record<string, unknown>): Promise<T> {
    const r = await fetch(`${apiGoc}/bot${token}/${phuongThuc}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(than) })
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string }
    if (!j.ok) throw new Error(`Telegram từ chối ${phuongThuc}: ${j.description ?? r.status}`)
    return j.result as T
  }
  const gui = (chat: number, chu: string) => tg('sendMessage', { chat_id: chat, text: chu, link_preview_options: { is_disabled: true } }).catch((e) => console.error('[tele] gui', e))

  if (duong === '/telegram/nhan' && req.method === 'POST') {
    if (req.headers.get('x-telegram-bot-api-secret-token') !== matKhauWebhook(khoa)) return json({ loi: 'Sai mật khẩu webhook' }, 401)
    if (!token) return json({ ok: true })
    const capNhat = (await req.json().catch(() => ({}))) as { message?: TinNhan }
    const m = capNhat.message
    // Chỉ nhận chat riêng 1-1 với bot; nhóm / kênh bỏ qua
    if (m && m.chat?.type === 'private') {
      try {
        await xuLyTin(m)
      } catch (e) {
        console.error('[tele] loi', e)
        await gui(m.chat.id, `⚠️ Máy chủ gặp lỗi: ${e instanceof LoiFirebase ? e.message : (e as Error).message}\nMở app kiểm tra xem hồ sơ đã được tạo chưa rồi hãy gửi lại.`)
      }
    }
    // Luôn trả 200: trả lỗi thì Telegram gửi lại tin cũ nhiều lần
    return json({ ok: true })
  }

  if (duong === '/telegram/bat' && req.method === 'POST') {
    if (!token) return json({ loi: 'Máy chủ chưa có mã bot — thêm biến HOADON_TELE_TOKEN trên Vercel rồi triển khai lại.' }, 400, cors)
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
    const p = await kho.taoPhien(fb, { tenMay: 'Bot Telegram', ungDung: 'Telegram', noiNhan: `telegram · ${chat}` })
    const ve = niemPhong(khoa, { l: 'tele', u: uid, rt: y.maLamMoi, p, tm: 'Bot Telegram', chat })
    return json({ ve, bien: 'HOADON_TELE_VE', coToken: !!token }, 200, cors)
  }

  return json({ loi: 'Không có đường dẫn này' }, 404, cors)

  // ---------------- Xử lý một tin nhắn ----------------

  async function xuLyTin(m: TinNhan) {
    const chat = m.chat.id
    const ve = timVe(String(chat))
    if (!ve) {
      await gui(chat, `Bot này chưa kết nối với tài khoản nào của anh.\n\nMã Telegram của anh: ${chat}\n\nMở app ${appUrl} → Cài đặt → Telegram, dán mã này vào để kết nối.`)
      return
    }
    const doc = m.document
    if (!doc) {
      await gui(chat, m.photo
        ? '📷 Ảnh chụp chưa đọc được. Gửi file PDF hóa đơn điện tử (bấm 📎 → File), hoặc file XML.'
        : '👋 Gửi file PDF (hoặc XML) hóa đơn vào đây, bot tự tạo hồ sơ mới trên app.\nGhi chú kèm file (caption) sẽ thành "nội dung công việc" của hồ sơ.')
      return
    }
    const ten = doc.file_name || 'hoa-don'
    const laPdf = doc.mime_type === 'application/pdf' || /\.pdf$/i.test(ten)
    const laXml = /xml/i.test(doc.mime_type ?? '') || /\.xml$/i.test(ten)
    if (!laPdf && !laXml) return void (await gui(chat, `"${ten}" không phải PDF / XML — bot chỉ nhận hóa đơn PDF hoặc XML.`))
    if ((doc.file_size ?? 0) > TOI_DA) return void (await gui(chat, `"${ten}" lớn quá 20 MB, Telegram không cho bot tải. Thêm trực tiếp trên app.`))

    // Quyền: mã làm mới còn dùng được, đúng tài khoản, phiên chưa bị thu hồi ở Cài đặt
    let fb: FirebaseNguoiDung
    try {
      const ma = await bc.maFirebase(cfg, ve.rt)
      if (ma.uid !== ve.u) throw new LoiFirebase(400, 'đổi tài khoản')
      fb = new FirebaseNguoiDung(cfg, ma.uid, ma.idToken)
    } catch (e) {
      if (e instanceof LoiFirebase && e.trangThai === 400) return void (await gui(chat, '⛔ Vé kết nối đã hết hiệu lực (tài khoản Google bị đăng xuất khỏi mọi nơi?). Vào app → Cài đặt → Telegram, tạo vé mới.'))
      throw e
    }
    if (!(await kho.conPhien(fb, ve.p))) return void (await gui(chat, '⛔ Quyền của bot đã bị thu hồi ở trang Cài đặt. Muốn dùng lại: Cài đặt → Telegram → tạo vé mới.'))

    void tg('sendChatAction', { chat_id: chat, action: 'typing' }).catch(() => undefined)
    const f = await tg<{ file_path: string }>('getFile', { file_id: doc.file_id })
    const tai = await fetch(`${apiGoc}/file/bot${token}/${f.file_path}`)
    if (!tai.ok) throw new Error(`Không tải được file từ Telegram (${tai.status})`)
    const du = new Uint8Array(await tai.arrayBuffer())

    const noiDung = (m.caption ?? '').trim().slice(0, 300) || undefined
    const ghi: cc.NoiGhi = {
      luuHoSo: (d) => kho.luuHoSo(fb, d),
      luuFile: (x) => kho.luuFile(fb, x),
      xoaHoSo: () => Promise.reject(new Error('Bot không xoá')),
      nhatKy: (congCu, moTa) => kho.ghiNhatKy(fb, ve.p, ve.tm, congCu, moTa),
    }

    let thamSo: cc.ThamSoTaoHoSo
    let chuaDoc = false
    if (laXml) {
      thamSo = { xml: [{ ten_file: ten, noi_dung: new TextDecoder().decode(du) }], noiDung }
    } else {
      const r = await docHoaDonPdf(du)
      if (r.loai === 'banNhap') return void (await gui(chat, `⛔ "${ten}" là BẢN NHÁP — hóa đơn chưa cấp số, không phải hóa đơn chính thức. Không tạo hồ sơ.`))
      const tep = { ten, type: 'application/pdf', data: du }
      chuaDoc = r.loai === 'khongDoc'
      thamSo = { hoa_don_nhap_tay: [{ ...(r.loai === 'ok' ? (r.hoaDon as cc.SuaHoaDon) : {}), tep }], noiDung }
    }

    let kq: Awaited<ReturnType<typeof cc.taoHoSo>>
    try {
      kq = await cc.taoHoSo(await kho.taiDuLieu(fb), ghi, thamSo)
    } catch (e) {
      if (e instanceof cc.LoiNguoiDung) return void (await gui(chat, `⛔ ${e.message.replace(/ ở hồ sơ \S+ /g, ' ở hồ sơ ')}`))
      throw e
    }

    const h = kq.hoaDonMoi[0]
    const dong = [
      '✅ Đã tạo hồ sơ mới',
      chuaDoc
        ? `⚠️ Không đọc được chữ trong "${ten}" (có thể là bản scan) — đã cất file, anh mở app nhập số liệu tay.`
        : `HĐ ${h?.soHd || '?'} · ngày ${ngayVN(h?.ngayHd ?? '')}\n${h?.nguoiBan || '(chưa rõ người bán)'}\nTổng tiền: ${formatMoney(kq.tongTien)} đ`,
      ...(h?.lienQuan ? [`ℹ️ ${h.lienQuan}`] : []),
      ...(noiDung ? [`Nội dung: ${noiDung}`] : []),
      ...kq.canhBao.map((c) => (/^(⚠️|⛔)/u.test(c) ? c : `⚠️ ${c}`)),
      chuaDoc ? '' : 'Số liệu đọc tự động từ PDF — anh soát lại số tiền, MST.',
      `Mở để bổ sung, làm tờ trình:\n${appUrl}/?hs=${kq.id}`,
    ].filter(Boolean)
    await gui(chat, dong.join('\n'))
  }

  function timVe(chat: string): VeTele | null {
    let thay: VeTele | null = null
    for (const s of (env.HOADON_TELE_VE ?? '').split(/[\s,;]+/).filter(Boolean)) {
      const v = moVe<VeTele>(khoa, s, 'tele')
      if (v && v.chat === chat) thay = v
    }
    return thay
  }
}

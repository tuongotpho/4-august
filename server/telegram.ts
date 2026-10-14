// Bot Telegram: anh dán tin nhắn Zalo của đối tác vào bot -> AI đọc -> tạo lớp giảng trên app (+ Google Calendar).
// Làm việc BẰNG QUYỀN của chính anh (mã làm mới Firebase nằm trong "vé" mã hoá), thu hồi được ở Cài đặt.
//
//   POST /telegram/nhan   Telegram gọi vào mỗi khi có tin / bấm nút (webhook) — kèm mật khẩu riêng ở header
//   POST /telegram/bat    web app (đã đăng nhập) bảo máy chủ đăng ký webhook; trả tên bot
//   POST /telegram/ghep   web app gửi mã Telegram của anh -> tạo phiên + trả VÉ để dán vào Vercel
//
// Biến môi trường trên Vercel:
//   ATLD_TELE_TOKEN (bí mật) mã bot từ @BotFather · ATLD_TELE_VE vé kết nối (nhiều vé cách nhau dấu phẩy)
//   ATLD_ANTHROPIC_KEY (bí mật) khoá Claude API để đọc tin nhắn

import { createHash } from 'node:crypto'
import { dongBoLop, xoaSuKien } from '../src/lib/lichGoogle.js'
import {
  congNgay, dinhDangTien, homNay, ngayCuoi, ngayVN, TEN_BUOI, thu, type CaiDat, type LopGiang,
} from '../src/lib/model.js'
import { lopTuAI, type KetQuaAI } from '../src/lib/trichTin.js'
import { congNo, goiY, sapXepTheoNgay, timLopChoTien, timTrung, trungGio } from '../src/lib/tinh.js'
import { suaTheoLoi, trichTin } from './ai.js'
import { doiMa, FirebaseNguoiDung, LoiFirebase, type CauHinhFirebase } from './firebaseRest.js'
import * as kho from './kho.js'
import { moVe, niemPhong, type Ve } from './ve.js'

type Env = Record<string, string | undefined>

export interface BoiCanh {
  env: Env
  khoa: Buffer
  cfg: CauHinhFirebase
  goc: string
  maFirebase(cfg: CauHinhFirebase, rt: string): Promise<{ idToken: string; uid: string }>
  /** để test thay AI thật */
  ai?: { trich: typeof trichTin; sua: typeof suaTheoLoi }
}

interface VeTele extends Ve { u: string; rt: string; p: string; chat: string }

interface TinNhan {
  message_id: number
  chat: { id: number; type: string }
  from?: { id: number; first_name?: string }
  text?: string
  caption?: string
  forward_origin?: { type: string; sender_user?: { first_name?: string; last_name?: string }; sender_user_name?: string; chat?: { title?: string } }
  reply_to_message?: { text?: string; from?: { is_bot?: boolean } }
}

interface NutBam {
  id: string
  from: { id: number }
  data?: string
  message?: { message_id: number; chat: { id: number }; text?: string }
}

type Nut = { text: string; callback_data?: string; url?: string }

export const matKhauWebhook = (khoa: Buffer) => createHash('sha256').update(khoa).update('telegram-webhook').digest('hex')

const json = (x: unknown, status = 200) =>
  new Response(JSON.stringify(x), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })

/** Mã lớp in cuối tin của bot -> anh trả lời (reply) tin đó để sửa lớp */
const THE_MA = (id: string) => `Mã lớp: ${id}`
const docMa = (s?: string) => /Mã lớp: ([\w-]+)/.exec(s ?? '')?.[1]

export function moTaLop(l: LopGiang): string {
  return [
    `📅 ${thu(l.ngay)} ${ngayVN(l.ngay)}${l.soNgay > 1 ? ` → ${ngayVN(ngayCuoi(l))} (${l.soNgay} ngày)` : ''}${l.gioBD ? `, ${l.gioBD}–${l.gioKT || '?'}` : `, ${TEN_BUOI[l.buoi]}`}`,
    `🏢 ${l.khachHang || '(chưa rõ khách hàng)'}`,
    l.doiTac || l.lienHe ? `🤝 ${[l.doiTac, l.lienHe].filter(Boolean).join(' · ')}` : '',
    `📍 ${l.hinhThuc === 'online' ? 'Online' : l.diaDiem || '(chưa rõ địa điểm)'}`,
    `💰 ${l.chiPhi === null ? 'chưa rõ thù lao' : `${dinhDangTien(l.chiPhi)} đ`}`,
    l.noiDung ? `📝 ${l.noiDung}` : '',
  ].filter(Boolean).join('\n')
}

export async function xuLyTelegram(req: Request, duong: string, bc: BoiCanh): Promise<Response> {
  const { env, khoa, cfg, goc } = bc
  const token = env.ATLD_TELE_TOKEN?.trim()
  const apiGoc = (env.ATLD_TELE_API || 'https://api.telegram.org').replace(/\/$/, '')
  const appUrl = (env.ATLD_APP_URL || goc).replace(/\/$/, '')
  const ai = bc.ai ?? { trich: trichTin, sua: suaTheoLoi }

  async function tg<T = unknown>(phuongThuc: string, than: Record<string, unknown>): Promise<T> {
    const r = await fetch(`${apiGoc}/bot${token}/${phuongThuc}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(than) })
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string }
    if (!j.ok) throw new Error(`Telegram từ chối ${phuongThuc}: ${j.description ?? r.status}`)
    return j.result as T
  }
  const gui = (chat: number, chu: string, nut?: Nut[][]) =>
    tg('sendMessage', { chat_id: chat, text: chu.slice(0, 4000), link_preview_options: { is_disabled: true }, ...(nut ? { reply_markup: { inline_keyboard: nut } } : {}) })
      .catch((e) => console.error('[tele] gui', e))
  const sua = (chat: number, msg: number, chu: string, nut: Nut[][] = []) =>
    tg('editMessageText', { chat_id: chat, message_id: msg, text: chu.slice(0, 4000), reply_markup: { inline_keyboard: nut } }).catch((e) => console.error('[tele] sua', e))
  /** Nút mở app: Telegram chỉ nhận https */
  const nutWeb = (id: string): Nut[] => (appUrl.startsWith('https://') ? [{ text: '✏️ Sửa trên app', url: `${appUrl}/?lop=${id}` }] : [])

  if (duong === '/telegram/nhan' && req.method === 'POST') {
    if (req.headers.get('x-telegram-bot-api-secret-token') !== matKhauWebhook(khoa)) return json({ loi: 'Sai mật khẩu webhook' }, 401)
    if (!token) return json({ ok: true })
    const cn = (await req.json().catch(() => ({}))) as { message?: TinNhan; callback_query?: NutBam }
    const chat = cn.message?.chat.id ?? cn.callback_query?.message?.chat.id
    try {
      if (cn.message && cn.message.chat.type === 'private') await xuLyTin(cn.message)
      else if (cn.callback_query) await xuLyNut(cn.callback_query)
    } catch (e) {
      console.error('[tele] loi', e)
      if (chat) await gui(chat, `⚠️ Máy chủ gặp lỗi: ${(e as Error).message}\nMở app kiểm tra rồi gửi lại.`)
    }
    // Luôn trả 200: trả lỗi thì Telegram gửi lại tin cũ nhiều lần
    return json({ ok: true })
  }

  if (duong === '/telegram/bat' && req.method === 'POST') {
    if (!token) return json({ loi: 'Máy chủ chưa có mã bot — thêm biến ATLD_TELE_TOKEN trên Vercel rồi triển khai lại.' }, 400)
    const y = (await req.json().catch(() => ({}))) as { maLamMoi?: string }
    if (!y.maLamMoi) return json({ loi: 'Chưa đăng nhập' }, 401)
    await doiMa(cfg, y.maLamMoi) // chỉ người đã đăng nhập app mới bấm được
    await tg('setWebhook', { url: `${goc}/telegram/nhan`, secret_token: matKhauWebhook(khoa), allowed_updates: ['message', 'callback_query'] })
    await tg('setMyCommands', {
      commands: [
        { command: 'tuan', description: 'Lịch giảng 7 ngày tới' },
        { command: 'thang', description: 'Lịch giảng tháng này' },
        { command: 'congno', description: 'Lớp đã giảng chưa nhận tiền' },
        { command: 'help', description: 'Cách dùng bot' },
      ],
    }).catch(() => undefined)
    const bot = await tg<{ username: string }>('getMe', {})
    return json({ bot: bot.username })
  }

  if (duong === '/telegram/ghep' && req.method === 'POST') {
    const y = (await req.json().catch(() => ({}))) as { maLamMoi?: string; chat?: string }
    if (!y.maLamMoi) return json({ loi: 'Chưa đăng nhập' }, 401)
    const chat = String(y.chat ?? '').trim()
    if (!/^\d{4,15}$/.test(chat)) return json({ loi: 'Mã Telegram là một dãy số (bot gửi cho anh khi bấm Start)' }, 400)
    const { idToken, uid } = await doiMa(cfg, y.maLamMoi)
    const fb = new FirebaseNguoiDung(cfg, uid, idToken)
    const p = await kho.taoPhien(fb, { tenMay: 'Bot Telegram', noiNhan: `telegram · ${chat}` })
    const ve = niemPhong(khoa, { l: 'tele', u: uid, rt: y.maLamMoi, p, chat })
    return json({ ve, bien: 'ATLD_TELE_VE', coToken: !!token })
  }

  return json({ loi: 'Không có đường dẫn này' }, 404)

  // ---------------- Quyền ----------------

  /** Vé đúng mã Telegram -> phiên Firebase của anh; không có quyền thì nhắn lý do, trả null */
  async function moQuyen(chat: number): Promise<{ fb: FirebaseNguoiDung; cd: CaiDat } | null> {
    const ve = timVe(env, khoa, String(chat))
    if (!ve) {
      await gui(chat, `Bot này chưa kết nối với tài khoản nào.\n\nMã Telegram của anh: ${chat}\n\nMở app ${appUrl} → Cài đặt → Bot Telegram, dán mã này vào để kết nối.`)
      return null
    }
    let fb: FirebaseNguoiDung
    try {
      const ma = await bc.maFirebase(cfg, ve.rt)
      if (ma.uid !== ve.u) throw new LoiFirebase(400, 'đổi tài khoản')
      fb = new FirebaseNguoiDung(cfg, ma.uid, ma.idToken)
    } catch (e) {
      if (e instanceof LoiFirebase && e.trangThai === 400) {
        await gui(chat, '⛔ Vé kết nối đã hết hiệu lực (tài khoản Google bị đăng xuất khỏi mọi nơi?). Vào app → Cài đặt → Bot Telegram, tạo vé mới.')
        return null
      }
      throw e
    }
    if (!(await kho.conPhien(fb, ve.p))) {
      await gui(chat, '⛔ Quyền của bot đã bị thu hồi ở trang Cài đặt. Muốn dùng lại: Cài đặt → Bot Telegram → tạo vé mới.')
      return null
    }
    return { fb, cd: await kho.taiCaiDat(fb) }
  }

  /** Lưu lớp + đẩy lên Google Calendar (lỗi lịch không làm hỏng việc lưu) -> dòng báo trạng thái lịch */
  async function luuVaDongBo(fb: FirebaseNguoiDung, cd: CaiDat, l: LopGiang): Promise<string> {
    await kho.luuLop(fb, l)
    if (!cd.lich.bat || !cd.lich.url) return ''
    try {
      const moi = await dongBoLop(cd, l, appUrl)
      await kho.luuLop(fb, moi)
      return '📆 Đã lên Google Calendar.'
    } catch (e) {
      return `⚠️ Chưa lên được Google Calendar: ${(e as Error).message} (app sẽ thử lại khi mở).`
    }
  }

  // ---------------- Tin nhắn ----------------

  async function xuLyTin(m: TinNhan) {
    const chat = m.chat.id
    const chu = (m.text ?? m.caption ?? '').trim()
    const lenh = /^\/(\w+)/.exec(chu)?.[1]?.toLowerCase()

    if (lenh === 'start' || lenh === 'help') {
      const ve = timVe(env, khoa, String(chat))
      if (!ve) return void (await moQuyen(chat))
      return void (await gui(chat, [
        '👋 Dán (hoặc chuyển tiếp) tin nhắn mời giảng của đối tác vào đây — bot tự đọc ngày, giờ, khách hàng, địa điểm, thù lao và tạo lớp trên app.',
        '',
        '• Sửa: TRẢ LỜI (reply) tin của bot, vd "đổi sang 14h", "thù lao 2tr".',
        '• Thanh toán: "đã nhận tiền Cty Thử" / "ESC trả 3tr rồi".',
        '• /tuan — lịch 7 ngày tới · /thang — tháng này · /congno — chưa nhận tiền.',
      ].join('\n')))
    }

    const q = await moQuyen(chat)
    if (!q) return
    const { fb, cd } = q
    const ds = await kho.taiLop(fb)

    if (lenh === 'tuan' || lenh === 'thang') {
      const hn = homNay()
      const den = lenh === 'tuan' ? congNgay(hn, 7) : `${hn.slice(0, 7)}-31`
      const tu = lenh === 'tuan' ? hn : `${hn.slice(0, 7)}-01`
      const lop = ds.filter((l) => !l.huy && ngayCuoi(l) >= tu && l.ngay <= den).sort(sapXepTheoNgay)
      const tieuDe = lenh === 'tuan' ? `🗓 Lịch 7 ngày tới (${ngayVN(hn, false)}–${ngayVN(den, false)})` : `🗓 Lịch tháng ${hn.slice(5, 7)}/${hn.slice(0, 4)}`
      return void (await gui(chat, [tieuDe, '', ...(lop.length ? lop.map(dongNgan) : ['Không có lớp nào.']),
        lenh === 'thang' && lop.length ? `\nTổng: ${lop.length} lớp · ${dinhDangTien(lop.reduce((s, l) => s + (l.chiPhi ?? 0), 0))} đ` : ''].join('\n')))
    }

    if (lenh === 'congno') {
      const nhom = congNo(ds)
      if (!nhom.length) return void (await gui(chat, '🎉 Không còn lớp nào chờ thanh toán.'))
      const tong = nhom.reduce((s, n) => s + n.tong, 0)
      return void (await gui(chat, [
        `💰 Chờ thanh toán: ${dinhDangTien(tong)} đ`,
        ...nhom.map((n) => `\n${n.doiTac} — ${dinhDangTien(n.tong)} đ (chờ ${n.soNgayCho} ngày)\n${n.lop.map((l) => `  · ${dongNgan(l)}`).join('\n')}`),
      ].join('\n')))
    }

    if (lenh) return void (await gui(chat, 'Không có lệnh này. Gõ /help để xem cách dùng.'))
    if (chu.length < 4) return void (await gui(chat, 'Dán tin nhắn mời giảng vào đây, bot tự tạo lớp. Gõ /help để xem cách dùng.'))

    const apiKey = env.ATLD_ANTHROPIC_KEY
    if (!apiKey) return void (await gui(chat, '⚠️ Máy chủ chưa có khoá AI — thêm biến ATLD_ANTHROPIC_KEY trên Vercel rồi triển khai lại.'))
    void tg('sendChatAction', { chat_id: chat, action: 'typing' }).catch(() => undefined)
    const gy = goiY(ds)

    // Trả lời tin của bot = sửa lớp đó
    const maSua = m.reply_to_message?.from?.is_bot ? docMa(m.reply_to_message.text) : undefined
    if (maSua) {
      const cu = ds.find((l) => l.id === maSua)
      if (!cu) return void (await gui(chat, 'Lớp này không còn trên app (đã bị xoá?).'))
      const kq = await ai.sua(cu, chu, gy, apiKey)
      const a = kq.lop[0]
      if (!a) return void (await gui(chat, 'Chưa hiểu cần sửa gì. Ví dụ: "đổi sang 14h–17h", "thù lao 2tr", "chuyển sang ngày 20/11".'))
      const moi = lopTuAI(a, cd, gy, cu.tinGoc, cu.nguon)
      const l: LopGiang = { ...cu, ...pick(moi), id: cu.id, suaLuc: Date.now(), canDongBo: true }
      const lich = await luuVaDongBo(fb, cd, l)
      return void (await gui(chat, ['✅ Đã sửa lớp:', moTaLop(l), lich, '', THE_MA(l.id)].filter(Boolean).join('\n'), [[...nutWeb(l.id), { text: '❌ Xoá lớp', callback_data: `xoa:${l.id}` }]]))
    }

    // Tin chuyển tiếp: tên người gửi gốc thường là người liên hệ
    const nguoiGui = m.forward_origin?.sender_user
      ? [m.forward_origin.sender_user.first_name, m.forward_origin.sender_user.last_name].filter(Boolean).join(' ')
      : m.forward_origin?.sender_user_name
    const kq: KetQuaAI = await ai.trich(nguoiGui ? `Người gửi: ${nguoiGui}\n${chu}` : chu, gy, apiKey)

    if (kq.hanhDong === 'thanh_toan' && kq.thanhToan) return void (await thanhToan(chat, fb, ds, kq.thanhToan))
    if (kq.hanhDong !== 'tao_lop' || !kq.lop.length) {
      return void (await gui(chat, kq.traLoi || 'Không thấy lịch giảng nào trong tin này. Dán nguyên tin mời giảng (có ngày, giờ, đơn vị) nhé.'))
    }

    for (const a of kq.lop) {
      const l = lopTuAI(a, cd, gy, chu, 'telegram')
      const ghiChuAI = a.luuY ? `⚠️ ${a.luuY}` : ''
      const trung = timTrung(ds, l)
      if (trung) {
        // Có vẻ đã có: không tạo ngay, giữ bản nháp chờ anh quyết
        await fb.ghi(`users/${fb.uid}/nhap/${l.id}`, JSON.parse(JSON.stringify(l)))
        await gui(chat, [`🤔 Có vẻ TRÙNG lớp đã có:`, dongNgan(trung), '', 'Tin mới đọc được:', moTaLop(l), ghiChuAI].filter(Boolean).join('\n'), [
          [{ text: '➕ Vẫn tạo lớp mới', callback_data: `tao:${l.id}` }, { text: '🚫 Bỏ', callback_data: `bo:${l.id}` }],
        ])
        continue
      }
      const lich = await luuVaDongBo(fb, cd, l)
      ds.push(l)
      const canhBao = [
        ...trungGio(ds, l).map((x) => `⚠️ Trùng giờ với: ${dongNgan(x)}`),
        l.chiPhi === null ? '💡 Chưa có thù lao — trả lời tin này "thù lao 1tr5" để thêm.' : '',
      ]
      await gui(chat, ['✅ Đã tạo lớp:', moTaLop(l), ghiChuAI, ...canhBao, lich, '', THE_MA(l.id)].filter(Boolean).join('\n'), [
        [...nutWeb(l.id), { text: '❌ Hủy, không tạo', callback_data: `xoa:${l.id}` }],
      ])
    }
  }

  async function thanhToan(chat: number, fb: FirebaseNguoiDung, ds: LopGiang[], t: NonNullable<KetQuaAI['thanhToan']>) {
    const ung = timLopChoTien(ds, t.tim)
    const ngay = /^\d{4}-\d{2}-\d{2}$/.test(t.ngay) ? t.ngay : homNay()
    if (!ung.length) {
      return void (await gui(chat, `Không thấy lớp nào chưa thanh toán khớp "${t.tim}". Gõ /congno để xem danh sách.`))
    }
    // Đúng 1 lớp, hoặc số tiền khớp đúng tổng các lớp -> đánh dấu luôn
    const tong = ung.reduce((s, l) => s + (l.chiPhi ?? 0), 0)
    const dungTien = ung.filter((l) => l.chiPhi === t.soTien)
    const chon = ung.length === 1 ? ung : t.soTien !== null && t.soTien === tong ? ung : dungTien.length === 1 ? dungTien : []
    if (chon.length) {
      for (const l of chon) await kho.luuLop(fb, { ...l, thanhToan: 'da', ngayTT: ngay, suaLuc: Date.now() })
      return void (await gui(chat, [`✅ Đã đánh dấu nhận tiền (${ngayVN(ngay)}):`, ...chon.map((l) => `· ${dongNgan(l)}`)].join('\n')))
    }
    await gui(chat, `Có ${ung.length} lớp chưa thanh toán khớp "${t.tim}" — bấm lớp đã nhận tiền:`, [
      ...ung.slice(0, 8).map((l) => [{ text: `${ngayVN(l.ngay, false)} ${l.khachHang} · ${dinhDangTien(l.chiPhi)}`.slice(0, 60), callback_data: `tt:${l.id}` }]),
      ...(ung.length > 1 ? [[{ text: `Tất cả ${ung.length} lớp · ${dinhDangTien(tong)} đ`, callback_data: catByte(`ttall:${t.tim}`, 64) }]] : []),
    ])
  }

  // ---------------- Nút bấm ----------------

  async function xuLyNut(n: NutBam) {
    const chat = n.message?.chat.id
    const msg = n.message?.message_id
    void tg('answerCallbackQuery', { callback_query_id: n.id }).catch(() => undefined)
    if (!chat || !msg || !n.data) return
    const q = await moQuyen(chat)
    if (!q) return
    const { fb, cd } = q
    const [loai, ...phan] = n.data.split(':')
    const thamSo = phan.join(':')
    const chuCu = n.message?.text ?? ''

    if (loai === 'xoa') {
      const l = await kho.docLop(fb, thamSo)
      if (!l) return void (await sua(chat, msg, `${chuCu}\n\n(lớp đã không còn)`))
      try {
        await xoaSuKien(cd, l.eventId)
      } catch (e) {
        console.error('[tele] xoa lich', e)
      }
      await kho.xoaLop(fb, l.id)
      return void (await sua(chat, msg, `🗑 Đã xoá lớp:\n${dongNgan(l)}`))
    }
    if (loai === 'tao' || loai === 'bo') {
      const p = `users/${fb.uid}/nhap/${thamSo}`
      const nhap = await fb.docTaiLieu<LopGiang>(p)
      if (!nhap) return void (await sua(chat, msg, `${chuCu}\n\n(bản nháp đã hết hạn)`))
      await fb.xoa(p)
      if (loai === 'bo') return void (await sua(chat, msg, `🚫 Đã bỏ, không tạo lớp mới.\n${dongNgan(nhap)}`))
      const l = { ...nhap, id: thamSo }
      const lich = await luuVaDongBo(fb, cd, l)
      return void (await sua(chat, msg, ['✅ Đã tạo lớp:', moTaLop(l), lich, '', THE_MA(l.id)].filter(Boolean).join('\n'), [[...nutWeb(l.id), { text: '❌ Xoá lớp', callback_data: `xoa:${l.id}` }]]))
    }
    if (loai === 'tt' || loai === 'ttall') {
      const ds = await kho.taiLop(fb)
      const chon = loai === 'tt' ? ds.filter((l) => l.id === thamSo && l.thanhToan === 'chua') : timLopChoTien(ds, thamSo)
      for (const l of chon) await kho.luuLop(fb, { ...l, thanhToan: 'da', ngayTT: homNay(), suaLuc: Date.now() })
      return void (await sua(chat, msg, chon.length ? [`✅ Đã đánh dấu nhận tiền:`, ...chon.map((l) => `· ${dongNgan(l)}`)].join('\n') : 'Lớp này đã được đánh dấu trước đó.'))
    }
  }
}

/** Telegram giới hạn callback_data 64 byte (chữ có dấu chiếm 2–3 byte) */
function catByte(s: string, n: number): string {
  const enc = new TextEncoder()
  let kq = ''
  for (const c of s) {
    if (enc.encode(kq + c).length > n) break
    kq += c
  }
  return kq
}

/** Các ô AI được phép sửa khi anh trả lời tin của bot */
function pick(l: LopGiang) {
  const { ngay, soNgay, gioBD, gioKT, buoi, hinhThuc, doiTac, lienHe, khachHang, diaDiem, noiDung, chiPhi, ghiChu } = l
  return { ngay, soNgay, gioBD, gioKT, buoi, hinhThuc, doiTac, lienHe, khachHang, diaDiem, noiDung, chiPhi, ghiChu }
}

export function dongNgan(l: LopGiang): string {
  return `${thu(l.ngay)} ${ngayVN(l.ngay, false)}${l.gioBD ? ` ${l.gioBD}` : ''} · ${l.khachHang}${l.doiTac ? ` (${l.doiTac})` : ''}${l.chiPhi !== null ? ` · ${dinhDangTien(l.chiPhi)}` : ''}`
}

export function timVe(env: Env, khoa: Buffer, chat: string): VeTele | null {
  let thay: VeTele | null = null
  for (const s of (env.ATLD_TELE_VE ?? '').split(/[\s,;]+/).filter(Boolean)) {
    const v = moVe<VeTele>(khoa, s, 'tele')
    if (v && v.chat === chat) thay = v
  }
  return thay
}

/** Mọi vé hợp lệ (cho việc nhắc lịch hằng ngày) */
export function moiVe(env: Env, khoa: Buffer): VeTele[] {
  return (env.ATLD_TELE_VE ?? '').split(/[\s,;]+/).filter(Boolean).map((s) => moVe<VeTele>(khoa, s, 'tele')).filter((v): v is VeTele => !!v)
}

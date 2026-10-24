// Chạy trên Firebase giả lập: npm run test:firebase (cần Java). Kiểm:
//  - quy tắc bảo mật: chỉ chủ tài khoản đọc/ghi users/{uid}
//  - trọn vòng bot Telegram: ghép vé -> dán tin -> AI (giả) -> lớp được lưu + lên Google Calendar (giả) -> nút xoá,
//    trả lời để sửa, báo đã nhận tiền, lệnh /congno, cron nhắc lịch
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { lopMoi, type LopGiang } from '../src/lib/model'
import type { KetQuaAI, LopAI } from '../src/lib/trichTin'
import { matKhauWebhook } from '../server/telegram'
import { khoaTuChuoi } from '../server/oauth'
import { taoXuLy } from '../server/web'

const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9198'
const FS = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8188'
const DB = `http://${FS}/v1/projects/demo-atld/databases/antoan/documents`
const coGiaLap = !!process.env.FIRESTORE_EMULATOR_HOST

async function taoNguoiDung(email: string) {
  const r = await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=gia`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'matkhau123', returnSecureToken: true }),
  })
  const j = (await r.json()) as { idToken: string; refreshToken: string; localId: string }
  return { idToken: j.idToken, rt: j.refreshToken, uid: j.localId }
}

describe.skipIf(!coGiaLap)('Firebase giả lập', () => {
  const thatFetch = globalThis.fetch
  const tele: { phuongThuc: string; than: Record<string, unknown> }[] = []
  const lich: Record<string, unknown>[] = []
  let a: Awaited<ReturnType<typeof taoNguoiDung>>
  let b: Awaited<ReturnType<typeof taoNguoiDung>>

  beforeAll(async () => {
    a = await taoNguoiDung(`a${Date.now()}@x.vn`)
    b = await taoNguoiDung(`b${Date.now()}@x.vn`)
    // Telegram + Apps Script giả; Firebase giả lập đi đường thật
    vi.stubGlobal('fetch', async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url instanceof Request ? url.url : url)
      if (u.startsWith('http://tele.gia/')) {
        const phuongThuc = u.split('/').pop()!
        const than = JSON.parse(String(init?.body ?? '{}'))
        tele.push({ phuongThuc, than })
        const result = phuongThuc === 'getMe' ? { username: 'lich_giang_bot' } : { message_id: 99 }
        return new Response(JSON.stringify({ ok: true, result }))
      }
      if (u.startsWith('http://lich.gia/')) {
        const y = JSON.parse(String(init?.body ?? '{}'))
        lich.push(y)
        if (y.khoa !== 'khoa-lich') return new Response(JSON.stringify({ ok: false, loi: 'Sai khóa' }))
        return new Response(JSON.stringify({ ok: true, eventId: y.eventId || `ev-${lich.length}` }))
      }
      return thatFetch(url, init)
    })
  })
  afterAll(() => vi.unstubAllGlobals())

  it('quy tắc: chỉ chủ tài khoản đọc/ghi được', async () => {
    const ghi = (tk: { idToken: string }, uid: string) =>
      thatFetch(`${DB}/users/${uid}/lop/x1`, { method: 'PATCH', headers: { Authorization: `Bearer ${tk.idToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { khachHang: { stringValue: 'A' } } }) })
    expect((await ghi(a, a.uid)).status).toBe(200)
    expect((await ghi(b, a.uid)).status).toBe(403)
    expect((await thatFetch(`${DB}/users/${a.uid}/lop/x1`, { headers: { Authorization: `Bearer ${b.idToken}` } })).status).toBe(403)
    expect((await thatFetch(`${DB}/users/${a.uid}/lop/x1`)).status).toBe(403)
    await thatFetch(`${DB}/users/${a.uid}/lop/x1`, { method: 'DELETE', headers: { Authorization: `Bearer ${a.idToken}` } })
  })

  it('trọn vòng bot Telegram', async () => {
    const env: Record<string, string | undefined> = {
      ATLD_GIA_LAP: '1', ATLD_KHOA: 'k'.repeat(40), ATLD_TELE_TOKEN: 'T', ATLD_TELE_API: 'http://tele.gia', ATLD_GEMINI_KEY: 'gia',
      ATLD_GOC_URL: 'https://lich.example', CRON_SECRET: 'cron', FIREBASE_AUTH_EMULATOR_HOST: AUTH, FIRESTORE_EMULATOR_HOST: FS,
    }
    const lopAI = (p: Partial<LopAI>): LopAI => ({
      ngay: '2026-11-12', soNgay: 1, gioBD: '08:00', gioKT: '11:00', buoi: '', hinhThuc: '', doiTac: 'TIEC', lienHe: 'Ngọc Anh', khachHang: 'Cty Thử Hải Dương',
      diaDiem: 'Hải Dương', noiDung: '', chiPhi: 1_500_000, ghiChu: '', luuY: '', ...p,
    })
    let traVe: KetQuaAI = { hanhDong: 'tao_lop', lop: [lopAI({})], thanhToan: null, traLoi: '' }
    const xuLy = taoXuLy(env, {
      ai: {
        trich: async () => traVe,
        sua: async (l: LopGiang) => ({ hanhDong: 'tao_lop', lop: [lopAI({ ngay: l.ngay, khachHang: l.khachHang, gioBD: '14:00', gioKT: '17:00' })], thanhToan: null, traLoi: '' }),
      },
    })
    const goi = (duong: string, than: unknown, headers: Record<string, string> = {}) =>
      xuLy(new Request(`http://localhost${duong}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(than) }))
    const tin = (than: unknown) => goi('/telegram/nhan', than, { 'x-telegram-bot-api-secret-token': matKhauWebhook(khoaTuChuoi(env.ATLD_KHOA)) })
    const docLop = async () => {
      const r = await thatFetch(`${DB}/users/${a.uid}/lop`, { headers: { Authorization: `Bearer ${a.idToken}` } })
      const j = (await r.json()) as { documents?: { name: string; fields: Record<string, Record<string, unknown>> }[] }
      return (j.documents ?? []).map((d) => ({ id: d.name.split('/').pop()!, ...Object.fromEntries(Object.entries(d.fields).map(([k, v]) => [k, Object.values(v)[0]])) })) as unknown as (Record<string, string> & { id: string })[]
    }
    const tinCuoi = () => String([...tele].reverse().find((t) => t.phuongThuc === 'sendMessage' || t.phuongThuc === 'editMessageText')?.than.text ?? '')

    // người lạ nhắn -> chỉ nhận lại mã Telegram
    await tin({ message: { message_id: 1, chat: { id: 5551234, type: 'private' }, text: 'chào' } })
    expect(tinCuoi()).toContain('Mã Telegram của anh: 5551234')

    // bật bot + ghép vé
    expect(await (await goi('/telegram/bat', { maLamMoi: a.rt })).json()).toEqual({ bot: 'lich_giang_bot' })
    expect(tele.find((t) => t.phuongThuc === 'setWebhook')!.than.url).toBe('https://lich.example/telegram/nhan')
    const rGhep = (await (await goi("/telegram/ghep", { maLamMoi: a.rt, chat: "5551234" })).json()) as { ve: string }
    const { ve } = rGhep
    env.ATLD_TELE_VE = ve

    // bật Google Calendar (giả)
    await thatFetch(`${DB}/users/${a.uid}/meta/caiDat`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${a.idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { lich: { mapValue: { fields: { url: { stringValue: 'http://lich.gia/exec' }, khoa: { stringValue: 'khoa-lich' }, bat: { booleanValue: true } } } } } }),
    })

    // dán tin -> tạo lớp + lên lịch
    await tin({ message: { message_id: 2, chat: { id: 5551234, type: 'private' }, text: 'Thứ 5 12/11 nhờ anh giảng Cty Thử HD 8h-11h 1tr5' } })
    let ds = await docLop()
    if (ds.length !== 1) console.log(JSON.stringify(tele.map((t) => [t.phuongThuc, t.than.text])))
    expect(ds).toHaveLength(1)
    const id = ds[0].id
    expect(ds[0]).toMatchObject({ khachHang: 'Cty Thử Hải Dương', nguon: 'telegram', eventId: 'ev-1', canDongBo: false, doiTac: 'TIEC' })
    expect(tinCuoi()).toContain('✅ Đã tạo lớp')
    expect(tinCuoi()).toContain('📆 Đã lên Google Calendar')
    expect(tinCuoi()).toContain(`Mã lớp: ${id}`)

    // dán lại đúng tin đó -> báo trùng, không tạo
    await tin({ message: { message_id: 3, chat: { id: 5551234, type: 'private' }, text: 'nhắc lại: 12/11 Cty Thử' } })
    expect(tinCuoi()).toContain('TRÙNG')
    expect(await docLop()).toHaveLength(1)
    const nutBo = (tele.at(-1)!.than.reply_markup as { inline_keyboard: { callback_data: string }[][] }).inline_keyboard[0][1].callback_data
    await tin({ callback_query: { id: 'c1', from: { id: 5551234 }, data: nutBo, message: { message_id: 99, chat: { id: 5551234 }, text: '...' } } })
    expect(tinCuoi()).toContain('Đã bỏ')

    // trả lời tin của bot để sửa giờ -> lịch được cập nhật cùng sự kiện
    await tin({ message: { message_id: 4, chat: { id: 5551234, type: 'private' }, text: 'đổi sang chiều 14h', reply_to_message: { text: `✅ Đã tạo lớp:\n...\nMã lớp: ${id}`, from: { is_bot: true } } } })
    ds = await docLop()
    expect(ds[0]).toMatchObject({ gioBD: '14:00', buoi: 'chieu', eventId: 'ev-1' })
    expect(lich.at(-1)).toMatchObject({ hanhDong: 'luu', eventId: 'ev-1' })

    // báo đã nhận tiền (lớp đã giảng)
    traVe = { hanhDong: 'tao_lop', lop: [lopAI({ ngay: '2026-01-05', khachHang: 'Cty Mẫu', gioBD: '08:00', gioKT: '11:00' })], thanhToan: null, traLoi: '' }
    await tin({ message: { message_id: 5, chat: { id: 5551234, type: 'private' }, text: 'lớp Cty Mẫu 5/1' } })
    await tin({ message: { message_id: 6, chat: { id: 5551234, type: 'private' }, text: '/congno' } })
    expect(tinCuoi()).toContain('Cty Mẫu')
    traVe = { hanhDong: 'thanh_toan', lop: [], thanhToan: { tim: 'Cty Mẫu', soTien: null, ngay: '' }, traLoi: '' }
    await tin({ message: { message_id: 7, chat: { id: 5551234, type: 'private' }, text: 'đã nhận tiền Cty Mẫu' } })
    expect(tinCuoi()).toContain('Đã đánh dấu nhận tiền')
    expect((await docLop()).find((l) => l.khachHang === 'Cty Mẫu')!.thanhToan).toBe('da')

    // nút xoá -> xoá lớp + xoá sự kiện
    await tin({ callback_query: { id: 'c2', from: { id: 5551234 }, data: `xoa:${id}`, message: { message_id: 99, chat: { id: 5551234 }, text: '...' } } })
    expect((await docLop()).some((l) => l.id === id)).toBe(false)
    expect(lich.at(-1)).toMatchObject({ hanhDong: 'xoa', eventId: 'ev-1' })

    // cron nhắc lịch: có lớp ngày mai thì gửi tin
    const mai = new Date(Date.now() + 7 * 3600_000 + 86400_000).toISOString().slice(0, 10)
    await thatFetch(`${DB}/users/${a.uid}/lop/mai1`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${a.idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: Object.fromEntries(Object.entries(lopMoi({ id: 'mai1', ngay: mai, khachHang: 'Lớp ngày mai', gioBD: '08:00', gioKT: '11:00' })).map(([k, v]) => [k, typeof v === 'number' ? { integerValue: String(v) } : typeof v === 'boolean' ? { booleanValue: v } : v === null ? { nullValue: null } : { stringValue: v }])) }),
    })
    expect((await xuLy(new Request('http://localhost/cron/nhac'))).status).toBe(401)
    const r = await xuLy(new Request('http://localhost/cron/nhac', { headers: { authorization: 'Bearer cron' } }))
    expect(r.status).toBe(200)
    expect(tinCuoi()).toContain('🔔 Lịch giảng ngày mai')
    expect(tinCuoi()).toContain('Lớp ngày mai')
    // lớp "mai1" chưa có trên lịch (canDongBo) -> cron đẩy lên
    expect((await docLop()).find((l) => l.id === 'mai1')!.eventId).toMatch(/^ev-/)
  })

  it('/ai/trich cho web: trả bản nháp, không lưu', async () => {
    const env = { ATLD_GIA_LAP: '1', ATLD_KHOA: 'k'.repeat(40), ATLD_GEMINI_KEY: 'gia', FIREBASE_AUTH_EMULATOR_HOST: AUTH, FIRESTORE_EMULATOR_HOST: FS }
    const xuLy = taoXuLy(env, {
      ai: {
        trich: async () => ({ hanhDong: 'tao_lop', lop: [{ ngay: '2026-12-01', soNgay: 1, gioBD: '', gioKT: '', buoi: 'chieu', hinhThuc: 'online', doiTac: '', lienHe: '', khachHang: 'ABC', diaDiem: '', noiDung: '', chiPhi: 1000000, ghiChu: '', luuY: 'không ghi năm' }], thanhToan: null, traLoi: '' }),
        sua: async () => { throw new Error('không dùng') },
      },
    })
    const r = await xuLy(new Request('http://localhost/ai/trich', { method: 'POST', body: JSON.stringify({ maLamMoi: b.rt, tin: 'chiều 1/12 online ABC 1tr' }) }))
    const j = (await r.json()) as { lop: LopGiang[]; luuY: string[] }
    expect(j.lop[0]).toMatchObject({ khachHang: 'ABC', gioBD: '13:30', hinhThuc: 'online', diaDiem: 'Online', nguon: 'web' })
    expect(j.luuY).toEqual(['không ghi năm'])
  })
})

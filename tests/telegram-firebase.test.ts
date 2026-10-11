// @vitest-environment node
/**
 * Bot Telegram đi một vòng THẬT trên Firebase GIẢ LẬP (Auth + Firestore + Storage + luật phân quyền), Telegram GIẢ:
 *   web app tạo vé -> người lạ nhắn chỉ nhận lại mã Telegram -> anh gửi XML / PDF -> web app thấy hồ sơ mới + file gốc
 *   -> gửi trùng bị chặn -> thu hồi ở Cài đặt -> bot hết quyền.
 *   npm run test:firebase      (không có giả lập thì bỏ qua)
 */
import { randomBytes } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { deleteApp, initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth'
import { connectFirestoreEmulator, initializeFirestore, memoryLocalCache } from 'firebase/firestore'
import { connectStorageEmulator, getStorage } from 'firebase/storage'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { docHoaDonPdf } from '../mcp/docPdf'
import { matKhauWebhook } from '../mcp/telegram'
import { khoaTuChuoi } from '../mcp/oauth'
import { taoXuLy } from '../mcp/web'
import { FirebaseStore } from '../src/lib/store/FirebaseStore'

const ON = !!process.env.FIRESTORE_EMULATOR_HOST
const XML = readFileSync(new URL('./fixtures/hoa-don-tt78.xml', import.meta.url), 'utf8')
const GOC = 'http://localhost:8789'
const TELE = 'http://tele.gia'
const CHAT = 111222333
const KHOA = randomBytes(32).toString('hex')
// Hóa đơn PDF thật chỉ có trên máy anh (thư mục không đưa lên GitHub) — không có thì bỏ qua phần đó
const THU_MUC_THAT = 'HD-Hung Yen'
const PDF_THAT = existsSync(THU_MUC_THAT) ? readdirSync(THU_MUC_THAT).find((f) => /\.pdf$/i.test(f)) : undefined

/** PDF hợp lệ nhưng không có chữ (giống bản scan) */
function pdfKhongChu(): Uint8Array {
  const obj = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>']
  let s = '%PDF-1.4\n'
  const viTri: number[] = []
  obj.forEach((o, i) => {
    viTri.push(s.length)
    s += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = s.length
  s += `xref\n0 ${obj.length + 1}\n0000000000 65535 f \n${viTri.map((v) => `${String(v).padStart(10, '0')} 00000 n \n`).join('')}`
  s += `trailer\n<< /Size ${obj.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(s)
}

// ---------- Telegram giả: ghi lại tin bot gửi, phát file theo file_id ----------
const daGui: { chat: number; text: string }[] = []
const tep = new Map<string, Uint8Array>()
let webhook: Record<string, unknown> | null = null
const fetchThat = globalThis.fetch
globalThis.fetch = (async (u: RequestInfo | URL, init?: RequestInit) => {
  const url = String(u instanceof Request ? u.url : u)
  if (!url.startsWith(TELE)) return fetchThat(u, init)
  const ok = (result: unknown) => new Response(JSON.stringify({ ok: true, result }), { headers: { 'Content-Type': 'application/json' } })
  const m = /^http:\/\/tele\.gia\/(file\/)?bot([^/]+)\/(.+)$/.exec(url)!
  expect(m[2]).toBe('ma-bot-thu')
  if (m[1]) return new Response(tep.get(m[3]) as BodyInit)
  const than = JSON.parse(String(init?.body ?? '{}'))
  switch (m[3]) {
    case 'sendMessage': daGui.push({ chat: than.chat_id, text: than.text }); return ok({})
    case 'sendChatAction': return ok(true)
    case 'getFile': return ok({ file_path: than.file_id })
    case 'setWebhook': webhook = than; return ok(true)
    case 'getMe': return ok({ username: 'hoadon_thu_bot' })
  }
  return new Response(JSON.stringify({ ok: false, description: 'không biết' }))
}) as typeof fetch

const env: Record<string, string | undefined> = { ...process.env, HOADON_GIA_LAP: '1', HOADON_MCP_KHOA: KHOA, HOADON_GOC_URL: GOC, HOADON_TELE_TOKEN: 'ma-bot-thu', HOADON_TELE_API: TELE }
const xuLy = taoXuLy(env)
const goi = (duong: string, than: unknown, header: Record<string, string> = {}) =>
  xuLy(new Request(`${GOC}${duong}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...header }, body: JSON.stringify(than) }))

let soTin = 0
/** Telegram gọi webhook: một tin nhắn từ chat riêng */
async function nhan(chat: number, tin: Record<string, unknown>, matKhau = matKhauWebhook(khoaTuChuoi(KHOA))) {
  const truoc = daGui.length
  const r = await goi('/telegram/nhan', { update_id: ++soTin, message: { message_id: soTin, chat: { id: chat, type: 'private' }, from: { id: chat }, ...tin } }, { 'X-Telegram-Bot-Api-Secret-Token': matKhau })
  return { status: r.status, tra: daGui.slice(truoc).map((x) => x.text).join('\n') }
}
function guiFile(ten: string, du: Uint8Array, mime: string, caption?: string) {
  const id = `f${tep.size + 1}`
  tep.set(id, du)
  return nhan(CHAT, { document: { file_id: id, file_name: ten, mime_type: mime, file_size: du.byteLength }, ...(caption ? { caption } : {}) })
}

const app = initializeApp({ projectId: 'demo-hoadon', apiKey: 'gia-lap' }, 'tele-firebase')
let store: FirebaseStore
let maLamMoi = ''

beforeAll(async () => {
  if (!ON) return
  const auth = getAuth(app)
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true })
  const { user } = await signInAnonymously(auth)
  maLamMoi = user.refreshToken
  const db = initializeFirestore(app, { localCache: memoryLocalCache() }, 'hoadon')
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':')
  connectFirestoreEmulator(db, host, Number(port))
  const st = getStorage(app, 'gs://hoadon-npsc')
  const [sh, sp] = process.env.FIREBASE_STORAGE_EMULATOR_HOST!.split(':')
  connectStorageEmulator(st, sh, Number(sp))
  store = new FirebaseStore(db, st, user.uid)
})
afterAll(() => {
  globalThis.fetch = fetchThat
  return deleteApp(app)
})

describe.skipIf(!ON)('Bot Telegram -> tạo hồ sơ (Firebase giả lập)', () => {
  it('bật bot: đăng ký webhook đúng địa chỉ + mật khẩu; chưa đăng nhập thì không cho', async () => {
    expect((await goi('/telegram/bat', {})).status).toBe(401)
    const r = await goi('/telegram/bat', { maLamMoi })
    expect(await r.json()).toEqual({ bot: 'hoadon_thu_bot' })
    expect(webhook).toMatchObject({ url: `${GOC}/telegram/nhan`, secret_token: matKhauWebhook(khoaTuChuoi(KHOA)), allowed_updates: ['message'] })
  })

  it('webhook sai mật khẩu -> 401, không làm gì', async () => {
    const r = await nhan(CHAT, { text: '/start' }, 'sai')
    expect(r).toEqual({ status: 401, tra: '' })
  })

  it('chưa có vé: ai nhắn cũng chỉ nhận lại mã Telegram của mình, không ghi gì', async () => {
    const r = await nhan(CHAT, { text: '/start' })
    expect(r.status).toBe(200)
    expect(r.tra).toContain(`Mã Telegram của anh: ${CHAT}`)
  })

  it('web app tạo vé -> có phiên "Bot Telegram" ở Cài đặt', async () => {
    expect((await goi('/telegram/ghep', { maLamMoi, chat: 'abc' })).status).toBe(400)
    const r = await goi('/telegram/ghep', { maLamMoi, chat: String(CHAT) })
    const j = (await r.json()) as { ve: string; bien: string }
    expect(j.bien).toBe('HOADON_TELE_VE')
    env.HOADON_TELE_VE = `ve-rac, ${j.ve}` // như dán vào Vercel (lẫn một vé hỏng cũng không sao)
    expect((await store.listPhienAI()).map((p) => p.tenMay)).toEqual(['Bot Telegram'])
  })

  it('người lạ (chat khác) gửi file -> không tạo hồ sơ', async () => {
    tep.set('la', new TextEncoder().encode(XML))
    const r = await nhan(999, { document: { file_id: 'la', file_name: 'HD.xml', mime_type: 'text/xml' } })
    expect(r.tra).toContain('Mã Telegram của anh: 999')
    expect(await store.listDossiers()).toHaveLength(0)
  })

  it('anh gửi XML kèm ghi chú -> hồ sơ mới, nội dung = ghi chú, file gốc mở được, có nhật ký', async () => {
    const r = await guiFile('HD123.xml', new TextEncoder().encode(XML), 'text/xml', 'Mua vật tư thử qua Telegram')
    expect(r.tra).toContain('✅ Đã tạo hồ sơ mới')
    expect(r.tra).toContain('1.188.000 đ')
    const ds = await store.listDossiers()
    expect(ds).toHaveLength(1)
    expect(r.tra).toContain(`/?hs=${ds[0].id}`)
    expect(ds[0]).toMatchObject({ noiDung: 'Mua vật tư thử qua Telegram' })
    expect(ds[0].invoices[0]).toMatchObject({ soHd: '123', tongTien: 1_188_000 })
    expect(await (await store.getFile(ds[0].invoices[0].fileIds[0]))!.data.text()).toBe(XML)
    expect((await store.listNhatKyAI(5)).map((d) => `${d.tenMay}|${d.congCu}`)).toEqual(['Bot Telegram|tao_ho_so'])
  })

  it('gửi lại đúng hóa đơn đó -> báo TRÙNG, không tạo thêm', async () => {
    const r = await guiFile('HD123-lan2.xml', new TextEncoder().encode(XML), 'text/xml')
    expect(r.tra).toContain('TRÙNG')
    expect(await store.listDossiers()).toHaveLength(1)
  })

  it('PDF không có chữ (bản scan) -> vẫn tạo hồ sơ + cất PDF, nhắc nhập tay', async () => {
    const pdf = pdfKhongChu()
    const r = await guiFile('scan.pdf', pdf, 'application/pdf')
    expect(r.tra).toContain('Không đọc được chữ')
    const ds = await store.listDossiers()
    expect(ds).toHaveLength(2)
    const moi = ds.find((d) => d.invoices[0]?.fileIds.length && !d.invoices[0].soHd)!
    const f = (await store.getFile(moi.invoices[0].fileIds[0]))!
    expect(f).toMatchObject({ name: 'scan.pdf', type: 'application/pdf' })
    expect(new Uint8Array(await f.data.arrayBuffer())).toEqual(pdf)
  })

  it('file khác PDF/XML, hoặc ảnh chụp -> từ chối nhẹ nhàng', async () => {
    tep.set('doc', new Uint8Array([1, 2, 3]))
    expect((await nhan(CHAT, { document: { file_id: 'doc', file_name: 'a.docx', mime_type: 'application/msword' } })).tra).toContain('không phải PDF / XML')
    expect((await nhan(CHAT, { photo: [{}] })).tra).toContain('Ảnh chụp chưa đọc được')
    expect(await store.listDossiers()).toHaveLength(2)
  })

  it.skipIf(!PDF_THAT)('PDF hóa đơn thật -> số liệu khớp đúng cách web app đọc', async () => {
    const du = new Uint8Array(readFileSync(`${THU_MUC_THAT}/${PDF_THAT}`))
    const doc = await docHoaDonPdf(du)
    expect(doc.loai).toBe('ok')
    const r = await guiFile('hoa-don.pdf', du, 'application/pdf')
    expect(r.tra).toContain('✅ Đã tạo hồ sơ mới')
    const hd = doc.loai === 'ok' ? doc.hoaDon : {}
    const d = (await store.listDossiers()).find((x) => x.invoices[0]?.soHd === hd.soHd)!
    expect(d.invoices[0]).toMatchObject({ soHd: hd.soHd, ngayHd: hd.ngayHd, mstNguoiBan: hd.mstNguoiBan, tongTien: hd.tongTien })
    expect(hd.tongTien).toBeGreaterThan(0)
  })

  it('thu hồi "Bot Telegram" ở Cài đặt -> bot hết quyền, không ghi gì nữa', async () => {
    const truoc = (await store.listDossiers()).length
    const p = (await store.listPhienAI()).find((x) => x.tenMay === 'Bot Telegram')!
    await store.thuHoiPhienAI(p.id)
    const r = await guiFile('HD999.xml', new TextEncoder().encode(XML.replace(/<SHDon>123<\/SHDon>/, '<SHDon>999</SHDon>')), 'text/xml')
    expect(r.tra).toContain('đã bị thu hồi')
    expect(await store.listDossiers()).toHaveLength(truoc)
  })
})

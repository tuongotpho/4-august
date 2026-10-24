// @vitest-environment node
/**
 * Máy chủ MCP đi một vòng THẬT trên Firebase GIẢ LẬP (Auth + Firestore + luật phân quyền):
 *   web app ghi -> AI đọc được; AI ghi -> web app thấy (+ Google Calendar giả); xoá phải xác nhận; thu hồi trên web app -> AI bị chặn.
 * Đi đủ các bước OAuth như Claude: đăng ký -> trang đăng nhập -> cho phép -> đổi mã.   npm run test:firebase
 */
import { createHash, randomBytes } from 'node:crypto'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { deleteApp, initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth'
import { connectFirestoreEmulator, initializeFirestore, memoryLocalCache } from 'firebase/firestore'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { CAI_DAT_MAC_DINH, lopMoi } from '../src/lib/model'
import { FirebaseStore } from '../src/lib/store/FirebaseStore'
import { taoXuLy } from '../server/web'

const ON = !!process.env.FIRESTORE_EMULATOR_HOST
const GOC = 'http://localhost:8790'
const REDIRECT = 'http://localhost:5555/callback'
const xuLy = taoXuLy({ ...process.env, ATLD_GIA_LAP: '1', ATLD_KHOA: randomBytes(32).toString('hex'), ATLD_GOC_URL: GOC })
const goi = (duong: string, init: RequestInit = {}) => xuLy(new Request(`${GOC}${duong}`, init))

const app = initializeApp({ projectId: 'demo-atld', apiKey: 'gia-lap' }, 'mcp-test')
let store: FirebaseStore
let maLamMoi = ''
const lich: Record<string, unknown>[] = []

async function ketNoi(tenMay: string) {
  const { client_id } = await (await goi('/oauth/dang-ky', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ redirect_uris: [REDIRECT], client_name: 'Claude' }) })).json()
  const verifier = randomBytes(32).toString('base64url')
  const q = new URLSearchParams({ response_type: 'code', client_id, redirect_uri: REDIRECT, state: 'st', code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' })
  const html = await (await goi(`/oauth/dang-nhap?${q}`)).text()
  const yeuCau = JSON.parse(/const yeuCau = ("[^"]+");/.exec(html)![1])
  const cp = await (await goi('/oauth/cho-phep', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ yeuCau, maLamMoi, tenMay }) })).json()
  const ve = new URL(cp.chuyenToi)
  expect(ve.searchParams.get('state')).toBe('st')
  const doi = (ver: string) => goi('/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code: ve.searchParams.get('code')!, code_verifier: ver, redirect_uri: REDIRECT, client_id }).toString() })
  expect((await doi('sai-verifier')).status).toBe(400)
  const r = await doi(verifier)
  expect(r.status).toBe(200)
  return (await r.json()) as { access_token: string; refresh_token: string }
}

async function moClient(ve: string) {
  const c = new Client({ name: 'test', version: '1' })
  await c.connect(new StreamableHTTPClientTransport(new URL(`${GOC}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${ve}` } },
    fetch: (u, init) => xuLy(new Request(u, init)),
  }))
  return c
}
async function cc(c: Client, ten: string, args: Record<string, unknown> = {}) {
  const r = await c.callTool({ name: ten, arguments: args })
  return { loi: !!r.isError, kq: JSON.parse((r.content as { text: string }[])[0].text) }
}

beforeAll(async () => {
  if (!ON) return
  const auth = getAuth(app)
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true })
  const { user } = await signInAnonymously(auth)
  maLamMoi = user.refreshToken
  const db = initializeFirestore(app, { localCache: memoryLocalCache() }, 'antoan')
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':')
  connectFirestoreEmulator(db, host, Number(port))
  store = new FirebaseStore(db, user.uid)
  // Google Calendar giả (Apps Script)
  const thatFetch = globalThis.fetch
  vi.stubGlobal('fetch', async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).startsWith('http://lich.gia/')) {
      const y = JSON.parse(String(init?.body))
      lich.push(y)
      return new Response(JSON.stringify({ ok: true, eventId: y.eventId || `ev-${lich.length}` }))
    }
    return thatFetch(url, init)
  })
  // WEB APP lưu dữ liệu như bình thường
  await store.luuCaiDat({ ...CAI_DAT_MAC_DINH, lich: { url: 'http://lich.gia/exec', khoa: 'k', bat: true } })
  await store.luuNhieuLop([
    lopMoi({ id: 'cu1', ngay: '2026-09-10', khachHang: 'Cty Mẫu', doiTac: 'TIEC', lienHe: 'Linh', chiPhi: 1_500_000, canDongBo: false }),
    lopMoi({ id: 'cu2', ngay: '2026-09-20', khachHang: 'Cty Khác', doiTac: 'ESC', lienHe: 'A Hiếu', chiPhi: 1_000_000, thanhToan: 'da', ngayTT: '2026-09-21', canDongBo: false }),
  ])
})
afterAll(async () => {
  vi.unstubAllGlobals()
  await deleteApp(app)
})

describe.skipIf(!ON)('MCP ↔ web app (Firebase giả lập)', () => {
  let c: Client
  let ve: { access_token: string; refresh_token: string }

  it('kết nối qua OAuth; web app thấy máy mới', async () => {
    ve = await ketNoi('Điện thoại')
    c = await moClient(ve.access_token)
    expect((await c.listTools()).tools.map((t) => t.name).sort()).toEqual(['cong_no', 'danh_dau_thanh_toan', 'danh_sach_lop', 'sua_lop', 'tao_lop', 'tong_hop', 'tong_quan', 'xem_lop', 'xoa_lop'])
    expect((await store.listPhien()).map((p) => p.tenMay)).toEqual(['Điện thoại'])
  })

  it('AI đọc dữ liệu web app', async () => {
    expect((await cc(c, 'cong_no')).kq).toMatchObject([{ doiTac: 'TIEC', tong: 1_500_000 }])
    const ds = (await cc(c, 'danh_sach_lop', { nam: 2026, thang: 9 })).kq
    expect(ds).toMatchObject({ soLop: 2, tongThuLao: 2_500_000 })
    expect((await cc(c, 'tong_hop', { nam: 2026 })).kq.theoDoiTac[0]).toMatchObject({ khoa: 'TIEC', tien: 1_500_000 })
  })

  it('AI tạo lớp -> web app thấy, lên Google Calendar, đối tác tự điền theo liên hệ; nghi trùng thì hỏi lại', async () => {
    const r = await cc(c, 'tao_lop', { ngay: '2026-11-20', khach_hang: 'Cty Mới', lien_he: 'Linh', buoi: 'chieu', thu_lao: '1tr8' })
    expect(r).toMatchObject({ loi: false, kq: { daTao: true, googleCalendar: '📆 Đã lên Google Calendar.' } })
    const l = (await store.listLop()).find((x) => x.khachHang === 'Cty Mới')!
    expect(l).toMatchObject({ doiTac: 'TIEC', gioBD: '13:30', gioKT: '17:00', chiPhi: 1_800_000, eventId: 'ev-1', canDongBo: false })
    expect((await cc(c, 'tao_lop', { ngay: '2026-11-20', khach_hang: 'cty moi' })).kq).toMatchObject({ daTao: false, nghiTrung: { id: l.id } })
    // sửa giờ -> cùng sự kiện lịch được cập nhật
    expect((await cc(c, 'sua_lop', { id: l.id, gio_bat_dau: '14:00' })).kq).toMatchObject({ daLuu: true })
    expect(lich.at(-1)).toMatchObject({ hanhDong: 'luu', eventId: 'ev-1' })
    expect((await store.listNhatKy(10)).map((d) => d.congCu)).toEqual(['sua_lop', 'tao_lop'])
  })

  it('đánh dấu thanh toán theo từ khoá', async () => {
    expect((await cc(c, 'danh_dau_thanh_toan', { tim: 'Cty Mẫu', ngay_nhan: '2026-10-01' })).kq).toMatchObject({ daLuu: true, soLop: 1 })
    expect((await store.listLop()).find((x) => x.id === 'cu1')).toMatchObject({ thanhToan: 'da', ngayTT: '2026-10-01' })
  })

  it('xoá phải đúng tên khách hàng', async () => {
    const l = (await store.listLop()).find((x) => x.khachHang === 'Cty Mới')!
    expect((await cc(c, 'xoa_lop', { id: l.id, xac_nhan: 'xoá' })).kq).toMatchObject({ daXoa: false, canXacNhan: 'Cty Mới' })
    expect((await cc(c, 'xoa_lop', { id: l.id, xac_nhan: 'Cty Mới' })).kq).toMatchObject({ daXoa: true })
    expect((await store.listLop()).some((x) => x.id === l.id)).toBe(false)
    expect(lich.at(-1)).toMatchObject({ hanhDong: 'xoa', eventId: 'ev-1' })
  })

  it('thu hồi trên web app -> AI bị chặn, vé làm mới hết dùng', async () => {
    const [p] = await store.listPhien()
    await store.thuHoiPhien(p.id)
    const r = await goi('/mcp', { method: 'POST', headers: { Authorization: `Bearer ${ve.access_token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) })
    expect(r.status).toBe(401)
    const lm = await goi('/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: ve.refresh_token }).toString() })
    expect(lm.status).toBe(400)
  })
})

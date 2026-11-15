// Trọn luồng Kết nối AI với kho GIẢ: đăng ký -> xin phép -> cho phép -> đổi vé -> gọi công cụ -> ghi -> thu hồi.
import { createHash, randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { taoXuLy, type KhoMcp } from '../api/mcp'
import { LoiQuyen } from '../api/_lib/xacThuc'
import type { DongNhatKy, PhienMcp } from '../api/_lib/kho'
import type { Ky } from '../shared/kieu'

const GOC = 'https://visa.thu'
const WEB = 'https://cong.thu/the-visa/'
const REDIRECT = 'http://127.0.0.1:33418/callback'
const env = { VISA_MCP_KHOA: 'k'.repeat(40), VISA_GOC_URL: GOC, VISA_WEB_URL: WEB, ALLOWED_EMAILS: 'chu@thu.vn' }

function khoGia() {
  const ky: Ky[] = [{
    id: '2026-09-21_2026-10-20', tu: '2026-09-21', den: '2026-10-20', hanTra: '2026-11-04', toiThieu: 50_000,
    dauKy: 0, phatSinh: 1_100_000, daTra: 0, cuoiKy: 1_100_000,
    giaoDich: [
      { id: 'g1', ngay: '2026-09-26', ngayHT: '2026-09-29', moTa: 'Retail VNM HAI PHONG PLX_HAI DUONG_CH 123', soTien: -1_000_000 },
      { id: 'g2', ngay: '2026-10-01', ngayHT: '2026-10-03', moTa: 'Retail VNM HA NOI VNPAY YDLD01', soTien: -100_000 },
    ],
  }]
  const phien = new Map<string, PhienMcp>()
  const nhatKy: DongNhatKy[] = []
  const k: KhoMcp = {
    dsKy: async () => structuredClone(ky),
    luuKy: async (x) => { ky[ky.findIndex((y) => y.id === x.id)] = x },
    taoPhien: async (p) => { phien.set(p.id, p) },
    docPhien: async (id) => phien.get(id) ?? null,
    ghiNhatKy: async (d) => { nhatKy.push(d) },
  }
  return { k, ky, phien, nhatKy }
}

const goi = (xl: (r: Request) => Promise<Response>, duong: string, init: RequestInit = {}) => {
  const [p, q] = duong.split('?')
  return xl(new Request(`${GOC}/api/mcp?duong=${p}${q ? `&${q}` : ''}`, init))
}
const rpc = (xl: (r: Request) => Promise<Response>, ve: string, method: string, params: unknown = {}) =>
  goi(xl, '/mcp', {
    method: 'POST',
    headers: { authorization: `Bearer ${ve}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
const ketQua = async (r: Response) => JSON.parse(((await r.json()) as { result: { content: { text: string }[] } }).result.content[0].text)

async function ketNoi(email = 'chu@thu.vn') {
  const g = khoGia()
  const xl = taoXuLy(env, g.k, async (r) => {
    if (r.headers.get('authorization') !== 'Bearer ve-firebase-that') throw new LoiQuyen(401, 'Chưa đăng nhập')
    return email
  })
  const dk = await goi(xl, '/oauth/dang-ky', { method: 'POST', body: JSON.stringify({ redirect_uris: [REDIRECT], client_name: 'Claude Code' }) })
  expect(dk.status).toBe(201)
  const { client_id } = (await dk.json()) as { client_id: string }
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  const dn = await goi(xl, `/oauth/dang-nhap?${new URLSearchParams({ client_id, redirect_uri: REDIRECT, response_type: 'code', code_challenge: challenge, code_challenge_method: 'S256', state: 'st1' })}`)
  expect(dn.status).toBe(302)
  const toi = new URL(dn.headers.get('location')!)
  expect(toi.origin + toi.pathname).toBe(WEB)
  const yc = toi.searchParams.get('ket-noi-ai')!
  expect(await (await goi(xl, `/oauth/yeu-cau?yc=${encodeURIComponent(yc)}`)).json()).toEqual({ ungDung: 'Claude Code', noiNhan: '127.0.0.1:33418' })
  return { g, xl, client_id, verifier, yc }
}

async function layVe(c: Awaited<ReturnType<typeof ketNoi>>) {
  const cp = await goi(c.xl, '/oauth/cho-phep', { method: 'POST', headers: { authorization: 'Bearer ve-firebase-that' }, body: JSON.stringify({ yeuCau: c.yc, tenMay: 'Máy cơ quan' }) })
  expect(cp.status).toBe(200)
  const quay = new URL(((await cp.json()) as { chuyenToi: string }).chuyenToi)
  expect(quay.searchParams.get('state')).toBe('st1')
  const tk = await goi(c.xl, '/oauth/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: quay.searchParams.get('code')!, code_verifier: c.verifier, redirect_uri: REDIRECT, client_id: c.client_id }),
  })
  expect(tk.status).toBe(200)
  return (await tk.json()) as { access_token: string; refresh_token: string }
}

describe('Kết nối AI (MCP)', () => {
  it('trọn luồng: cho phép -> đọc -> đổi nhóm (ghi nhật ký) -> thu hồi thì bị chặn', async () => {
    const c = await ketNoi()
    const ve = await layVe(c)
    expect(c.g.phien.size).toBe(1)

    const ds = (await (await rpc(c.xl, ve.access_token, 'tools/list')).json()) as { result: { tools: { name: string }[] } }
    expect(ds.result.tools.map((t) => t.name).sort()).toEqual(['danh_sach_ky', 'doi_nhom', 'giao_dich', 'nhan_xet', 'thong_ke_nam', 'tong_quan'])

    const tq = await ketQua(await rpc(c.xl, ve.access_token, 'tools/call', { name: 'tong_quan', arguments: {} }))
    expect(tq).toMatchObject({ soKy: 1, tongChi: 1_100_000, kyMoiNhat: { cuoiKy: 1_100_000, hanTra: '2026-11-04' } })

    const gd = await ketQua(await rpc(c.xl, ve.access_token, 'tools/call', { name: 'giao_dich', arguments: { nhom: 'Xăng xe' } }))
    expect(gd).toMatchObject({ soDong: 1, tong: 1_000_000 })

    const sai = (await (await rpc(c.xl, ve.access_token, 'tools/call', { name: 'doi_nhom', arguments: { ky_id: '2026-09-21_2026-10-20', gd_id: 'g2', nhom: 'Nhóm bịa' } })).json()) as { result: { isError: boolean } }
    expect(sai.result.isError).toBe(true)
    const doi = await ketQua(await rpc(c.xl, ve.access_token, 'tools/call', { name: 'doi_nhom', arguments: { ky_id: '2026-09-21_2026-10-20', gd_id: 'g2', nhom: 'Thuốc & y tế' } }))
    expect(doi).toMatchObject({ ok: true, tu: 'Khác (chưa rõ)', thanh: 'Thuốc & y tế' })
    expect(c.g.ky[0].giaoDich[1].nhomTay).toBe('Thuốc & y tế')
    expect(c.g.nhatKy).toHaveLength(1)
    expect(c.g.nhatKy[0]).toMatchObject({ tenMay: 'Máy cơ quan', congCu: 'doi_nhom' })

    // làm mới vé được khi phiên còn
    const lm = await goi(c.xl, '/oauth/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: ve.refresh_token }) })
    expect(lm.status).toBe(200)

    // thu hồi
    c.g.phien.clear()
    expect((await rpc(c.xl, ve.access_token, 'tools/list')).status).toBe(401)
    expect((await goi(c.xl, '/oauth/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: ve.refresh_token }) })).status).toBe(400)
  })

  it('chặn: không vé, vé giả, địa chỉ trả về lạ, chưa đăng nhập Google, sai PKCE', async () => {
    const c = await ketNoi()
    const r401 = await rpc(c.xl, '', 'tools/list')
    expect(r401.status).toBe(401)
    expect(r401.headers.get('www-authenticate')).toContain(`${GOC}/.well-known/oauth-protected-resource`)
    expect((await rpc(c.xl, 've-gia', 'tools/list')).status).toBe(401)
    expect((await goi(c.xl, '/oauth/dang-ky', { method: 'POST', body: JSON.stringify({ redirect_uris: ['https://trang-la.com/cb'] }) })).status).toBe(400)
    expect((await goi(c.xl, `/oauth/dang-nhap?client_id=${c.client_id}&redirect_uri=${encodeURIComponent('https://trang-la.com/cb')}`)).status).toBe(400)
    expect((await goi(c.xl, '/oauth/cho-phep', { method: 'POST', body: JSON.stringify({ yeuCau: c.yc }) })).status).toBe(401)
    const cp = await goi(c.xl, '/oauth/cho-phep', { method: 'POST', headers: { authorization: 'Bearer ve-firebase-that' }, body: JSON.stringify({ yeuCau: c.yc }) })
    const code = new URL(((await cp.json()) as { chuyenToi: string }).chuyenToi).searchParams.get('code')!
    expect((await goi(c.xl, '/oauth/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: 'sai' }) })).status).toBe(400)
  })

  it('email bị gỡ khỏi danh sách được phép thì vé cũ hết dùng được', async () => {
    const c = await ketNoi()
    const ve = await layVe(c)
    const xl2 = taoXuLy({ ...env, ALLOWED_EMAILS: 'nguoi-khac@thu.vn' }, c.g.k)
    expect((await rpc(xl2, ve.access_token, 'tools/list')).status).toBe(401)
  })
})

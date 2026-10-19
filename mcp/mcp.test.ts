// Bài kiểm máy chủ MCP: gọi công cụ thật qua giao thức MCP (dữ liệu giả trong bộ nhớ, không đụng Firebase)
// và luồng OAuth của cửa vào web.ts (dò, đăng ký, chặn nơi nhận lạ, chuyển sang trang cho phép, chặn /mcp khi chưa có vé).

import { createHash, randomBytes } from 'node:crypto'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type AppData } from '../src/types.ts'
import { taoMayChu, type Coll, type Kho } from './mayChu.ts'
import { taoXuLy } from './web.ts'

function khoGia() {
  const d: AppData = {
    customers: [
      { id: 'c1', name: 'Quán bún Bà Hoa', phone: '0912345678', createdAt: 1 },
      { id: 'c2', name: 'Tạp hoá Minh Anh', createdAt: 2 },
    ],
    products: [
      { id: 'p1000', name: 'Chai 1 lít', price: 55000, cost: 32000, lowStock: 20, order: 1 },
      { id: 'p500', name: 'Chai 500ml', price: 32000, cost: 19000, lowStock: 20, order: 2 },
    ],
    orders: [
      { id: 'o1', no: 1, customerId: 'c1', date: '2026-09-23', items: [{ productId: 'p1000', name: 'Chai 1 lít', qty: 10, price: 55000, cost: 32000 }], discount: 0, paid: 550000, createdAt: 1 },
      { id: 'o2', no: 2, customerId: 'c1', date: '2026-10-07', items: [{ productId: 'p1000', name: 'Chai 1 lít', qty: 10, price: 55000, cost: 32000 }], discount: 0, paid: 0, createdAt: 2 },
    ],
    receipts: [{ id: 'r1', customerId: 'c1', date: '2026-10-10', amount: 150000, createdAt: 3 }],
    stockIns: [{ id: 's1', productId: 'p1000', date: '2026-09-01', qty: 100, unitCost: 32000, createdAt: 0 }],
    settings: DEFAULT_SETTINGS,
  }
  const daGhi: { coll: Coll; id: string; du: Record<string, unknown> }[] = []
  const nhatKy: string[] = []
  const kho: Kho = {
    tai: async () => structuredClone(d),
    async ghi(coll, id, du) {
      daGhi.push({ coll, id, du })
      const ds = d[coll] as { id: string }[]
      const i = ds.findIndex((x) => x.id === id)
      const v = { ...du, id } as never
      if (i >= 0) ds[i] = v
      else ds.push(v)
    },
    async nhatKy(x) {
      nhatKy.push(`${x.congCu}: ${x.tenDoiTuong}`)
    },
  }
  return { d, kho, daGhi, nhatKy }
}

async function noiMay(kho: Kho) {
  const server = taoMayChu(kho, () => '2026-10-19')
  const [a, b] = InMemoryTransport.createLinkedPair()
  await server.connect(a)
  const client = new Client({ name: 'kiem', version: '1' })
  await client.connect(b)
  const goi = async (name: string, args: Record<string, unknown> = {}) => {
    const r = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean }
    return { loi: !!r.isError, text: r.content[0].text, j: r.isError ? null : JSON.parse(r.content[0].text) }
  }
  return { client, goi }
}

describe('công cụ đọc', () => {
  it('liệt kê đủ 13 công cụ, không có công cụ xoá', async () => {
    const { client } = await noiMay(khoGia().kho)
    const ten = (await client.listTools()).tools.map((t) => t.name)
    expect(ten).toHaveLength(13)
    expect(ten.some((t) => /xoa/.test(t))).toBe(false)
  })

  it('tong_quan: số khớp công thức web', async () => {
    const { goi } = await noiMay(khoGia().kho)
    const { j } = await goi('tong_quan')
    expect(j.thang_nay).toMatchObject({ thang: '2026-10', doanh_thu: 550000, lai: 230000, so_chai: 10, so_don: 1 })
    expect(j.thang_truoc).toMatchObject({ doanh_thu: 550000 })
    expect(j.tong_cong_no).toBe(400000) // 550k − 150k thu nợ
    expect(j.loai_hang[0]).toMatchObject({ ten: 'Chai 1 lít', ton: 80 })
    // mua 23/9, 7/10 → chu kỳ 14 → dự kiến 21/10, còn 2 ngày
    expect(j.khach_toi_luot[0]).toMatchObject({ khach: 'Quán bún Bà Hoa', du_kien_mua: '2026-10-21', con_ngay: 2, trang_thai: 'sắp mua' })
  })

  it('xem_khach tìm tên không dấu; cong_no', async () => {
    const { goi } = await noiMay(khoGia().kho)
    const { j } = await goi('xem_khach', { khach: 'ba hoa' })
    expect(j.khach.ten).toBe('Quán bún Bà Hoa')
    expect(j.dang_no).toBe(400000)
    expect(j.don_hang[0].so_hd).toBe('HĐ0002')
    const no = (await goi('cong_no')).j
    expect(no.dang_no).toEqual([expect.objectContaining({ khach: 'Quán bún Bà Hoa', so_tien: 400000, don_no_cu_nhat: '2026-10-07' })])
  })

  it('khách không có thì báo lỗi rõ, không đoán', async () => {
    const { goi } = await noiMay(khoGia().kho)
    const r = await goi('xem_khach', { khach: 'Cơm rang' })
    expect(r.loi).toBe(true)
    expect(r.text).toContain('Không có khách')
  })
})

describe('công cụ ghi', () => {
  it('len_don: đúng số HĐ, giá chung, nợ cũ, ghi nhật ký', async () => {
    const g = khoGia()
    const { goi } = await noiMay(g.kho)
    const { j } = await goi('len_don', { khach: 'ba hoa', hang: [{ loai: '1 lít', so_luong: 5 }, { loai: '500ml', so_luong: 2, don_gia: 30000 }], khach_tra: 100000 })
    expect(j).toMatchObject({ da_tao: 'HĐ0003', tong: 335000, tra_ngay: 100000, no_cu: 400000, no_sau_don: 635000 })
    const don = g.daGhi[0]
    expect(don.coll).toBe('orders')
    expect(don.du).toMatchObject({ no: 3, customerId: 'c1', date: '2026-10-19', paid: 100000 })
    expect(g.nhatKy).toEqual(['len_don: HĐ0003 · Quán bún Bà Hoa'])
  })

  it('thu_no và nhap_hang cập nhật giá vốn', async () => {
    const g = khoGia()
    const { goi } = await noiMay(g.kho)
    expect((await goi('thu_no', { khach: 'c1', so_tien: 400000 })).j).toMatchObject({ no_truoc: 400000, no_con_lai: 0 })
    expect((await goi('nhap_hang', { loai: 'Chai 1 lít', so_luong: 50, gia_von: 33000 })).j).toMatchObject({ ton_moi: 130, gia_von: 33000 })
    expect(g.daGhi.find((x) => x.coll === 'products')?.du).toMatchObject({ cost: 33000 })
  })

  it('them_khach chặn trùng tên', async () => {
    const { goi } = await noiMay(khoGia().kho)
    expect((await goi('them_khach', { ten: 'quan bun ba hoa' })).loi).toBe(true)
    expect((await goi('them_khach', { ten: 'Cơm rang Tuấn' })).j.da_them).toBe('Cơm rang Tuấn')
  })
})

describe('cửa vào OAuth (web.ts)', () => {
  const xuLy = taoXuLy({ TUONGOT_MCP_KHOA: randomBytes(32).toString('hex') })
  const G = 'https://tuongot-si.vercel.app'
  const goiWeb = (duong: string, init?: RequestInit) => xuLy(new Request(G + duong, init))

  it('dò máy chủ cấp phép', async () => {
    const r = await goiWeb('/.well-known/oauth-authorization-server')
    expect((await r.json()).token_endpoint).toBe(G + '/oauth/token')
  })

  it('/mcp chưa có vé → 401 kèm chỉ đường', async () => {
    const r = await goiWeb('/mcp', { method: 'POST', body: '{}' })
    expect(r.status).toBe(401)
    expect(r.headers.get('www-authenticate')).toContain('/.well-known/oauth-protected-resource')
  })

  it('đăng ký: nơi nhận lạ bị chặn, claude.ai được', async () => {
    const xau = await goiWeb('/oauth/dang-ky', { method: 'POST', body: JSON.stringify({ redirect_uris: ['https://evil.example/cb'] }) })
    expect(xau.status).toBe(400)
    const tot = await goiWeb('/oauth/dang-ky', { method: 'POST', body: JSON.stringify({ redirect_uris: ['https://claude.ai/api/mcp/auth_callback'], client_name: 'Claude' }) })
    expect(tot.status).toBe(201)
    const { client_id } = await tot.json()
    // đăng nhập → chuyển sang trang cho phép trên chính web app
    const cc = createHash('sha256').update('bi-mat').digest('base64url')
    const q = new URLSearchParams({ client_id, redirect_uri: 'https://claude.ai/api/mcp/auth_callback', response_type: 'code', code_challenge: cc, code_challenge_method: 'S256', state: 'x' })
    const r = await goiWeb('/oauth/dang-nhap?' + q)
    expect(r.status).toBe(302)
    const toi = new URL(r.headers.get('location')!)
    expect(toi.origin + toi.pathname).toBe(G + '/ket-noi-ai')
    // trang cho phép hỏi lại được tên ứng dụng
    const yc = await goiWeb('/oauth/yeu-cau?yc=' + encodeURIComponent(toi.searchParams.get('yc')!))
    expect(await yc.json()).toMatchObject({ ungDung: 'Claude', noiNhan: 'claude.ai' })
    // đổi mã giả → bị từ chối
    const t = await goiWeb('/oauth/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'grant_type=authorization_code&code=gia&code_verifier=bi-mat' })
    expect(t.status).toBe(400)
  })
})

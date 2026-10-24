// Bot nhắc hạn: nội dung + mốc gửi (không cần Firebase), và các cổng /telegram/* chặn đúng.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { khoTrong, napToKhai } from '../../src/core/kho.js'
import type { HoSoDN } from '../../src/core/types.js'
import type { DuLieu } from '../congCu.js'
import { khoaTuChuoi, niemPhong } from './oauth.js'
import { matKhauWebhook, tinNhacHan } from './telegram.js'
import { taoXuLy } from './web.js'

const MST = '0109999999'
const HS = { mst: MST, tenNNT: 'Cty Thử' } as HoSoDN
const tk = (quy: 1 | 2 | 3 | 4, nam: number, ct: Record<string, number>) =>
  ({ maTKhai: '842', loaiTKhai: 'C', soLan: 0, ngayLap: '', ky: { quy, nam }, hoSo: HS, ct, plMua: [], plBan: [], ct9: null })

function duLieu(): DuLieu {
  let kho = napToKhai(khoTrong(), tk(1, 2026, { ct40: 0, ct43: 0 }), 'q1.xml').kho
  kho = napToKhai(kho, tk(2, 2026, { ct40: 1_000_000, ct43: 0 }), 'q2.xml').kho // phải nộp 1tr, chưa có chứng từ
  return { kho, hoaDon: {}, baoCao: {} }
}
const ngay = (s: string) => new Date(`${s}T08:00:00+07:00`)

describe('Nội dung + mốc nhắc', () => {
  it('quý 3/2026 hạn 31/10: còn 10 ngày -> gửi; còn 9 ngày -> không; nêu quý nộp thiếu', () => {
    const t10 = tinNhacHan(duLieu(), MST, ngay('2026-10-21'))
    expect(t10.gui).toBe(true)
    expect(t10.chu).toContain('Quý 3/2026: hạn nộp 31/10/2026 — còn 10 ngày, CHƯA có tờ khai')
    expect(t10.chu).toContain('chưa thấy chứng từ nộp đủ: 2/2026 (1.000.000 đ)')
    expect(tinNhacHan(duLieu(), MST, ngay('2026-10-22')).gui).toBe(false)
  })
  it('đã có tờ khai quý tới hạn -> không gửi; quá hạn -> gửi', () => {
    const d = duLieu()
    d.kho = napToKhai(d.kho, tk(3, 2026, { ct40: 0, ct43: 0 }), 'q3.xml').kho
    const da = tinNhacHan(d, MST, ngay('2026-10-21'))
    expect(da.gui).toBe(false)
    expect(da.chu).toContain('✅ Quý 3/2026: đã có tờ khai')
    const tre = tinNhacHan(duLieu(), MST, ngay('2026-11-03'))
    expect(tre.gui).toBe(true)
    expect(tre.chu).toMatch(/ĐÃ QUÁ HẠN|Quý quá hạn chưa có tờ khai: 3\/2026/)
  })
})

describe('Cổng /telegram/* (không cần Firebase)', () => {
  const KHOA = 'k'.repeat(40)
  const khoa = khoaTuChuoi(KHOA)
  afterEach(() => vi.unstubAllGlobals())

  it('webhook sai mật khẩu -> 401; lịch nhắc thiếu / sai CRON_SECRET -> 401; mã Telegram sai -> 400', async () => {
    const xuLy = taoXuLy({ KHAITHUE_MCP_KHOA: KHOA, KHAITHUE_GOC_URL: 'https://thue.example', KHAITHUE_TELE_TOKEN: 't', CRON_SECRET: 'bimat' })
    const goi = (duong: string, init: RequestInit = {}) => xuLy(new Request(`https://thue.example/api/mcp?duong=${duong}`, init))
    expect((await goi('/telegram/nhan', { method: 'POST', body: '{}' })).status).toBe(401)
    expect((await goi('/telegram/nhac')).status).toBe(401)
    expect((await goi('/telegram/nhac', { headers: { authorization: 'Bearer sai' } })).status).toBe(401)
    expect((await goi('/telegram/ghep', { method: 'POST', body: JSON.stringify({ maLamMoi: 'x', chat: 'abc' }) })).status).toBe(400)
    expect((await goi('/telegram/ghep', { method: 'POST', body: JSON.stringify({ chat: '12345' }) })).status).toBe(401)
    // không có vé nào -> lịch chạy xong, không gửi gì
    expect(await (await goi('/telegram/nhac', { headers: { authorization: 'Bearer bimat' } })).json()).toMatchObject({ ve: 0, ketQua: [] })
  })

  it('người lạ nhắn bot -> chỉ nhận lại mã Telegram của họ (token bot không lộ ra ngoài)', async () => {
    const goiTg: { url: string; body: Record<string, unknown> }[] = []
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      goiTg.push({ url, body: JSON.parse(String(init.body)) })
      return new Response(JSON.stringify({ ok: true, result: {} }))
    })
    const xuLy = taoXuLy({ KHAITHUE_MCP_KHOA: KHOA, KHAITHUE_GOC_URL: 'https://thue.example', KHAITHUE_TELE_TOKEN: 'MA-BOT', KHAITHUE_TELE_VE: niemPhong(khoa, { l: 'tele', u: 'a', rt: 'r', p: 'p', tm: 't', chat: '999' }) })
    const r = await xuLy(new Request('https://thue.example/api/mcp?duong=/telegram/nhan', {
      method: 'POST', headers: { 'x-telegram-bot-api-secret-token': matKhauWebhook(khoa) },
      body: JSON.stringify({ message: { message_id: 1, chat: { id: 4242, type: 'private' }, text: '/start' } }),
    }))
    expect(r.status).toBe(200)
    expect(goiTg).toEqual([{ url: 'https://api.telegram.org/botMA-BOT/sendMessage', body: expect.objectContaining({ chat_id: '4242', text: expect.stringContaining('Mã Telegram của anh: 4242') }) }])
  })
})

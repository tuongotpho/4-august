import { describe, expect, it } from 'vitest'
import { KetQuaSchema, trichTin, yeuCauGemini } from '../server/ai'
import { MAU_TIN } from '../server/mauTin'
import { CAI_DAT_MAC_DINH } from '../src/lib/model'
import type { GoiY } from '../src/lib/tinh'
import { lopTuAI } from '../src/lib/trichTin'

const gy: GoiY = { doiTac: ['TIEC', 'VNB', 'ESC'], lienHe: [{ ten: 'Ngọc Anh', doiTac: 'TIEC' }], khachHang: [], diaDiem: [] }
const kqMau = MAU_TIN[0].ketQua

/** fetch giả: ghi lại yêu cầu, trả về `tra` */
function fetchGia(tra: unknown, status = 200) {
  const goi: { url: string; init: RequestInit }[] = []
  const f = (async (url: string, init: RequestInit) => {
    goi.push({ url, init })
    return new Response(JSON.stringify(tra), { status })
  }) as unknown as typeof fetch
  return { f, goi }
}

describe('tin mẫu dạy AI', () => {
  it('mọi kết quả mẫu đúng schema và đổi được thành lớp', () => {
    for (const m of MAU_TIN) {
      expect(KetQuaSchema.safeParse(m.ketQua).success).toBe(true)
      for (const a of m.ketQua.lop) expect(lopTuAI(a, CAI_DAT_MAC_DINH, gy, m.tin, 'web').khachHang).toBeTruthy()
    }
  })

  it('không để lộ số điện thoại thật (chỉ số giả 09000000xx)', () => {
    for (const m of MAU_TIN) for (const so of JSON.stringify(m).match(/0\d{9}/g) ?? []) expect(so).toMatch(/^09000000\d\d$/)
  })

  it('gửi mẫu như các lượt hỏi–đáp trước tin thật, ép JSON theo schema', () => {
    const y = yeuCauGemini('tin thật', gy, new Date('2026-10-14T03:00:00Z'))
    expect(y.contents).toHaveLength(MAU_TIN.length * 2 + 1)
    expect(y.contents.map((c) => c.role)).toEqual([...MAU_TIN.flatMap(() => ['user', 'model']), 'user'])
    expect(y.contents.at(-1)!.parts[0].text).toContain('T4 2026-10-14')
    expect(y.systemInstruction.parts[0].text).toContain('VNB')
    expect(y.generationConfig.responseMimeType).toBe('application/json')
    expect(y.generationConfig.responseJsonSchema).not.toHaveProperty('$schema')
  })
})

describe('trichTin gọi Gemini', () => {
  it('đọc JSON trong câu trả lời, bỏ phần "suy nghĩ"', async () => {
    const { f, goi } = fetchGia({ candidates: [{ content: { parts: [{ text: 'nghĩ…', thought: true }, { text: JSON.stringify(kqMau) }] } }] })
    expect(await trichTin('x', gy, 'KHOA', new Date(), f)).toEqual(kqMau)
    expect(goi[0].url).toMatch(/models\/gemini-[\w.-]+:generateContent$/)
    expect((goi[0].init.headers as Record<string, string>)['x-goog-api-key']).toBe('KHOA')
  })

  it('báo lỗi rõ khi khoá sai / Gemini lỗi', async () => {
    const { f } = fetchGia({ error: { message: 'API key not valid' } }, 400)
    await expect(trichTin('x', gy, 'sai', new Date(), f)).rejects.toThrow('Gemini báo lỗi (400): API key not valid')
  })

  it('trả lời không đúng JSON -> báo không đọc được', async () => {
    const { f } = fetchGia({ candidates: [{ content: { parts: [{ text: 'xin lỗi' }] } }] })
    await expect(trichTin('x', gy, 'k', new Date(), f)).rejects.toThrow('AI không đọc được')
  })
})

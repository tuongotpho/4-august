// Nơi cất dữ liệu nhìn từ giao diện.
//  - Bản thật: gọi /api (máy chủ Vercel, kho Blob riêng tư), kèm vé đăng nhập.
//  - Chế độ thử (chỉ `npm run dev` với VITE_THU=1): cất trong trình duyệt, không đăng nhập. Không bao giờ có trong bản build.
import type { Ky } from '../shared/kieu'

export interface Kho {
  tai(): Promise<Ky[]>
  luu(ky: Ky): Promise<Ky>
  luuPdf(id: string, file: Blob): Promise<void>
  moPdf(id: string): Promise<string | null> // trả về URL tạm để mở
  xoa(id: string): Promise<void>
}

export const CHE_DO_THU = import.meta.env.DEV && import.meta.env.VITE_THU === '1'

export function khoMayChu(layVe: () => Promise<string>): Kho {
  const goi = async (duong: string, init: RequestInit = {}) => {
    const r = await fetch(duong, { ...init, headers: { ...(init.headers ?? {}), authorization: `Bearer ${await layVe()}` } })
    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { loi?: string }
      throw new Error(d.loi ?? `Máy chủ báo lỗi ${r.status}`)
    }
    return r
  }
  return {
    tai: async () => ((await (await goi('api/ky')).json()) as { ky: Ky[] }).ky,
    luu: async (ky) => ((await (await goi('api/ky', { method: 'PUT', body: JSON.stringify(ky), headers: { 'content-type': 'application/json' } })).json()) as { ky: Ky }).ky,
    luuPdf: async (id, file) => { await goi(`api/ky?id=${id}`, { method: 'POST', body: file, headers: { 'content-type': 'application/pdf' } }) },
    moPdf: async (id) => {
      try { return URL.createObjectURL(await (await goi(`api/pdf?id=${id}`)).blob()) } catch { return null }
    },
    xoa: async (id) => { await goi(`api/ky?id=${id}`, { method: 'DELETE' }) },
  }
}

export function khoThu(): Kho {
  const K = 'visa-thu-ky'
  const doc = (): Ky[] => { try { return JSON.parse(localStorage.getItem(K) ?? '[]') } catch { return [] } }
  const ghi = (ds: Ky[]) => localStorage.setItem(K, JSON.stringify(ds))
  return {
    tai: async () => doc().sort((a, b) => a.tu.localeCompare(b.tu)),
    luu: async (ky) => { const k = { ...ky, luuLuc: new Date().toISOString() }; ghi([...doc().filter((x) => x.id !== ky.id), k]); return k },
    luuPdf: async () => {},
    moPdf: async () => null,
    xoa: async (id) => ghi(doc().filter((x) => x.id !== id)),
  }
}

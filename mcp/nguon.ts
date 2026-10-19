// Kho dữ liệu cho máy chủ MCP: đọc/ghi Firestore (database tuongot-sale) bằng quyền của chủ shop.
// Mỗi lời gọi công cụ tải mới toàn bộ sổ (sổ nhỏ, vài nghìn dòng) → số luôn khớp web app.

import type { FirebaseNguoiDung } from './firebaseRest.ts'
import { ghiNhatKy } from './khoPhien.ts'
import type { Coll, Kho } from './mayChu.ts'
import { DEFAULT_SETTINGS, type AppData, type Settings } from '../src/types.ts'

export function taoKho(fb: FirebaseNguoiDung, phien: { ma: string; tenMay: string }): Kho {
  let daTai: Promise<AppData> | null = null
  return {
    tai() {
      // chỉ tải một lần trong cùng một yêu cầu
      daTai ??= (async () => {
        const [customers, products, orders, receipts, stockIns, cfg] = await Promise.all([
          fb.docBoSuuTap('customers'),
          fb.docBoSuuTap('products'),
          fb.docBoSuuTap('orders'),
          fb.docBoSuuTap('receipts'),
          fb.docBoSuuTap('stockIns'),
          fb.docTaiLieu<Partial<Settings>>('config/settings'),
        ])
        const { id: _id, ...s } = cfg ?? { id: '' }
        return { customers, products, orders, receipts, stockIns, settings: { ...DEFAULT_SETTINGS, ...s } } as unknown as AppData
      })()
      return daTai
    },
    async ghi(coll: Coll, id: string, du: Record<string, unknown>) {
      const { id: _bo, ...than } = du
      await fb.ghi(`${coll}/${id}`, JSON.parse(JSON.stringify(than)))
      daTai = null
    },
    async nhatKy(d) {
      await ghiNhatKy(fb, { phien: phien.ma, tenMay: phien.tenMay, ...d })
    },
  }
}

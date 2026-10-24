// Ghi lớp từ máy chủ (bot Telegram, AI qua MCP): lưu Firestore rồi đẩy Google Calendar — giống web app (src/lib/hooks.ts).
// Lỗi lịch không làm hỏng việc lưu: lớp giữ canDongBo=true, web app / cron đẩy lại sau.
import { dongBoLop, xoaSuKien } from '../src/lib/lichGoogle.js'
import type { CaiDat, LopGiang } from '../src/lib/model.js'
import type { FirebaseNguoiDung } from './firebaseRest.js'
import * as kho from './kho.js'

/** Trả câu báo trạng thái lịch ('' = chưa bật đồng bộ) */
export async function luuVaDongBo(fb: FirebaseNguoiDung, cd: CaiDat, l: LopGiang, appUrl: string): Promise<string> {
  await kho.luuLop(fb, l)
  if (!l.canDongBo || !cd.lich.bat || !cd.lich.url) return ''
  try {
    await kho.luuLop(fb, await dongBoLop(cd, l, appUrl))
    return '📆 Đã lên Google Calendar.'
  } catch (e) {
    return `⚠️ Chưa lên được Google Calendar: ${(e as Error).message} (app sẽ thử lại khi mở).`
  }
}

export async function xoaVaLich(fb: FirebaseNguoiDung, cd: CaiDat, l: LopGiang) {
  try {
    await xoaSuKien(cd, l.eventId)
  } catch (e) {
    console.error('[ghi] xoa lich', e)
  }
  await kho.xoaLop(fb, l.id)
}

// Hàm Vercel: bot Telegram, AI đọc tin nhắn, cron nhắc lịch. Toàn bộ phần xử lý nằm ở server/web.ts.
// vercel.json chuyển /telegram/*, /ai/*, /cron/* về đây kèm ?duong=<đường dẫn gốc>.
import { taoXuLy } from '../server/web.js'

const xuLy = taoXuLy()
export const GET = xuLy
export const POST = xuLy

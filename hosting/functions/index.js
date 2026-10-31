// Máy chủ của các app trên Firebase (site app-by-lethanh.web.app) — thay cho thư mục api/ trên Vercel.
// Mỗi app một hàm; mã xử lý giữ nguyên của từng app (apps/<app>/mcp/web.ts…), build.mjs gói sẵn vào lib/<app>.mjs.
// firebase.json chuyển /<đường dẫn app>/mcp, /oauth/*, /telegram/*, /.well-known/*… về hàm của app đó.
//
// Mã bí mật nằm ở Secret Manager (đặt bằng: firebase functions:secrets:set TEN_BIEN). Thêm mã bot Telegram / Gemini sau:
// tạo bí mật rồi thêm tên vào "biMat" của app dưới đây, deploy lại.
// Hàm chỉ chạy khi có yêu cầu, tối đa 60 giây — máy chủ MCP đã chặn luồng chờ tin GET /mcp (báo cáo 16).
import { randomBytes } from 'node:crypto'
import { onRequest } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { setGlobalOptions } from 'firebase-functions/v2'

const GOC = 'https://app-by-lethanh.web.app'
// Lịch chạy gọi thẳng mã của app trong cùng hàm, kèm mã này — người ngoài gọi /telegram/nhac, /cron/nhac qua mạng không biết mã nên bị từ chối
const MA_LICH = randomBytes(24).toString('hex')

setGlobalOptions({ region: 'asia-southeast1', memory: '256MiB', timeoutSeconds: 60, maxInstances: 3, concurrency: 1 })

const APP = {
  hoadon: {
    tienTo: '/hoa-don', biMat: ['HOADON_MCP_KHOA'],
    env: { HOADON_GOC_URL: `${GOC}/hoa-don`, HOADON_APP_URL: `${GOC}/hoa-don/` },
  },
  khaithue: {
    tienTo: '/khai-thue', biMat: ['KHAITHUE_MCP_KHOA'],
    env: { KHAITHUE_GOC_URL: `${GOC}/khai-thue`, CRON_SECRET: MA_LICH },
  },
  quyphong: {
    tienTo: '/quy-phong', biMat: ['QUY_MCP_KHOA'],
    env: { QUY_GOC_URL: `${GOC}/quy-phong` },
  },
  antoan: {
    tienTo: '/lich-giang', biMat: ['ATLD_KHOA'],
    env: { ATLD_GOC_URL: `${GOC}/lich-giang`, ATLD_APP_URL: `${GOC}/lich-giang`, CRON_SECRET: MA_LICH },
  },
  tuongotsi: {
    tienTo: '/tuong-ot', biMat: ['TUONGOT_MCP_KHOA'],
    env: {
      TUONGOT_GOC_URL: `${GOC}/tuong-ot`,
      TUONGOT_FIREBASE_REFERER: `${GOC}/tuong-ot/`,
      // Khoá web Firebase (công khai, như trong mã các app) — máy chủ gọi Firestore REST bằng mã đăng nhập của chủ shop
      VITE_FIREBASE_API_KEY: 'AIzaSyCfCX-xKHVnvv2tEb_AVdxL_xvqnnSjgcQ',
    },
  },
  thevisa: {
    tienTo: '/the-visa', biMat: ['VISA_MCP_KHOA'], xuat: 'taoXuLyTatCa',
    // Mã app này đọc thẳng process.env (kho file, danh sách email) nên gán vào process.env trước khi nạp
    ganVaoProcess: true,
    env: {
      VISA_GOC_URL: `${GOC}/the-visa`,
      VISA_WEB_URL: `${GOC}/the-visa/`,
      VISA_KHO: 'firebase',
      // Bucket có luật Storage chỉ mở users/<uid>/ cho trình duyệt -> the-visa/ chỉ máy chủ đọc ghi được
      VISA_BUCKET: 'hoadon-npsc',
      ALLOWED_EMAILS: 'vietthanh228@gmail.com',
    },
  },
}

const daNap = {}
async function layXuLy(ma) {
  const a = APP[ma]
  daNap[ma] ??= (async () => {
    const env = { ...process.env, ...a.env }
    if (a.ganVaoProcess) Object.assign(process.env, a.env)
    const mod = await import(`./lib/${ma}.mjs`)
    return mod[a.xuat ?? 'taoXuLy'](env)
  })()
  return daNap[ma]
}

const BO_HEADER = new Set(['host', 'connection', 'content-length', 'transfer-encoding', 'keep-alive', 'upgrade'])

/** Đổi yêu cầu kiểu Express (Firebase) sang Request chuẩn web mà mã của app dùng, bỏ tiền tố đường dẫn app (/hoa-don…) */
async function chuyen(req, res, ma) {
  const { tienTo } = APP[ma]
  let duong = req.path
  if (duong === tienTo || duong.startsWith(tienTo + '/')) duong = duong.slice(tienTo.length) || '/'
  const i = req.originalUrl.indexOf('?')
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) {
    if (v == null || BO_HEADER.has(k)) continue
    headers.set(k, Array.isArray(v) ? v.join(', ') : String(v))
  }
  const coThan = req.method !== 'GET' && req.method !== 'HEAD'
  const xuLy = await layXuLy(ma)
  const r = await xuLy(new Request(GOC + duong + (i >= 0 ? req.originalUrl.slice(i) : ''), { method: req.method, headers, body: coThan ? req.rawBody : undefined }))
  res.status(r.status)
  r.headers.forEach((v, k) => {
    if (k !== 'content-length' && k !== 'transfer-encoding') res.setHeader(k, v)
  })
  res.end(Buffer.from(await r.arrayBuffer()))
}

const ham = (ma) => onRequest({ secrets: APP[ma].biMat }, (req, res) => chuyen(req, res, ma))

export const hoadon = ham('hoadon')
export const khaithue = ham('khaithue')
export const quyphong = ham('quyphong')
export const antoan = ham('antoan')
export const tuongotsi = ham('tuongotsi')
export const thevisa = ham('thevisa')

// ---------- Lịch chạy (thay Vercel Cron) ----------
async function chayLich(ma, duong) {
  const r = await (await layXuLy(ma))(new Request(GOC + duong, { headers: { authorization: `Bearer ${MA_LICH}` } }))
  console.log(`[lich] ${ma} ${duong} -> ${r.status} ${(await r.text()).slice(0, 300)}`)
}
// Khai thuế: 8h sáng nhắc hạn nộp qua Telegram
export const khaithueNhac = onSchedule({ schedule: '0 8 * * *', timeZone: 'Asia/Ho_Chi_Minh', secrets: APP.khaithue.biMat }, () => chayLich('khaithue', '/telegram/nhac'))
// Lịch giảng: 20h nhắc lịch ngày mai + đẩy lớp lên Google Calendar
export const antoanNhac = onSchedule({ schedule: '0 20 * * *', timeZone: 'Asia/Ho_Chi_Minh', secrets: APP.antoan.biMat }, () => chayLich('antoan', '/cron/nhac'))

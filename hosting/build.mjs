// Dựng bản đưa lên Firebase (site app-by-lethanh.web.app): trang cổng ở "/", mỗi app ở /<đường dẫn>/, máy chủ của app gói vào functions/lib.
// Chạy (ở F:\AI\4.August):  npm --prefix hosting ci   (lần đầu)  rồi  node hosting/build.mjs [mã app…]
//   không ghi mã app = dựng cả cổng + 6 app; ghi mã (vd: node hosting/build.mjs hoadon) = chỉ dựng app đó, giữ nguyên phần còn lại
// Rồi:  cd hosting && firebase deploy --only hosting:app-by-lethanh,functions:lethanh --project app-from-ai
// Mỗi app vẫn build bằng chính lệnh "npm run build" của nó (kèm kiểm kiểu) — không đổi cách build của app.
import { execSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const GOC = join(dirname(fileURLToPath(import.meta.url)), '..')
const RA = join(GOC, 'hosting', 'public')
const LIB = join(GOC, 'hosting', 'functions', 'lib')

// Cấu hình web Firebase (công khai — đằng nào cũng nằm trong mã trang) cho các app đọc từ biến VITE_*; trên Vercel cũ là biến môi trường
const FIREBASE_WEB = {
  VITE_FIREBASE_API_KEY: 'AIzaSyCfCX-xKHVnvv2tEb_AVdxL_xvqnnSjgcQ',
  VITE_FIREBASE_AUTH_DOMAIN: 'app-from-ai.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'app-from-ai',
  VITE_FIREBASE_STORAGE_BUCKET: 'app-from-ai.firebasestorage.app',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '895767442095',
}

/** Các app trên Firebase. ma = tên hàm trong functions/index.js; mayChu = file máy chủ (export taoXuLy…), gói thành functions/lib/<ma>.mjs */
const APP = [
  { ma: 'hoadon', thuMuc: 'apps/hoadon', duong: 'hoa-don', mayChu: 'mcp/web.ts', manifest: 'site.webmanifest' },
  { ma: 'khaithue', thuMuc: 'apps/khaithue/app', duong: 'khai-thue', mayChu: 'mcp/may/web.ts' },
  {
    ma: 'quyphong', thuMuc: 'apps/quyphong/webapp', duong: 'quy-phong', mayChu: 'mcp/web.ts', manifest: 'manifest.webmanifest',
    env: { ...FIREBASE_WEB, VITE_FIREBASE_APP_ID: '1:895767442095:web:6cd820bd280b8add259a5a', VITE_FIREBASE_DATABASE_ID: 'quyphong' },
  },
  { ma: 'antoan', thuMuc: 'apps/antoan', duong: 'lich-giang', mayChu: 'server/web.ts', manifest: 'manifest.webmanifest' },
  {
    ma: 'tuongotsi', thuMuc: 'apps/tuongot-si', duong: 'tuong-ot', mayChu: 'mcp/web.ts', manifest: 'manifest.webmanifest',
    env: {
      ...FIREBASE_WEB,
      VITE_FIREBASE_APP_ID: '1:895767442095:web:91d586a46ee5155b259a5a',
      VITE_FIREBASE_MEASUREMENT_ID: 'G-1S3ZGLSH9G',
      VITE_FIREBASE_DATABASE_ID: 'tuongot-sale',
      VITE_ADMIN_EMAILS: 'vietthanh228@gmail.com',
    },
  },
  // App chi tiêu thẻ: mã ở repo riêng tuongotpho/visa (máy: F:\AI\VISA\webapp), cạnh thư mục 4.August
  { ma: 'thevisa', thuMuc: '../VISA/webapp', duong: 'the-visa', mayChu: 'api/_lib/tatCa.ts' },
]

const chay = (lenh, cwd, env = {}) => {
  console.log(`\n> (${cwd}) ${lenh}`)
  execSync(lenh, { cwd: join(GOC, cwd), stdio: 'inherit', env: { ...process.env, ...env } })
}
const canCai = (cwd) => !existsSync(join(GOC, cwd, 'node_modules'))
/** Các file trong public/ của app mà git bỏ qua (đường dẫn tính từ public/) */
function tepBoQua(thuMuc) {
  const pub = join(GOC, thuMuc, 'public')
  if (!existsSync(pub)) return []
  const ds = readdirSync(pub, { recursive: true, withFileTypes: true }).filter((d) => d.isFile()).map((d) => relative(pub, join(d.parentPath, d.name)).split(sep).join('/'))
  if (!ds.length) return []
  let ra = ''
  try {
    ra = execSync('git check-ignore --stdin', { cwd: pub, input: ds.join('\n'), encoding: 'utf8' })
  } catch (e) {
    if (e.status !== 1) throw e // 1 = không file nào bị bỏ qua
  }
  return ra.split(/\r?\n/).filter(Boolean)
}

const chon = process.argv.slice(2)
const lam = chon.length ? APP.filter((a) => chon.includes(a.ma)) : APP
if (chon.length && lam.length !== chon.length) throw new Error(`Mã app lạ: ${chon.join(', ')} — có: ${APP.map((a) => a.ma).join(', ')}`)

if (!chon.length) {
  rmSync(RA, { recursive: true, force: true })
  rmSync(LIB, { recursive: true, force: true })
  // Trang cổng (đăng nhập chung, danh sách app) ở gốc
  if (canCai('apps/cong')) chay('npm ci', 'apps/cong')
  chay('npm run build', 'apps/cong')
  cpSync(join(GOC, 'apps/cong/dist'), RA, { recursive: true })
}
mkdirSync(LIB, { recursive: true })

for (const a of lam) {
  if (canCai(a.thuMuc)) chay('npm ci', a.thuMuc)
  chay('npm run build', a.thuMuc, a.env)
  rmSync(join(RA, a.duong), { recursive: true, force: true })
  cpSync(join(GOC, a.thuMuc, 'dist'), join(RA, a.duong), { recursive: true })
  // CHẶN LỘ DỮ LIỆU: file trong public/ mà git bỏ qua (vd sao kê thật ở public/thu/ của app visa) chỉ có trên máy này,
  // Vite vẫn chép vào dist -> xoá khỏi bản đưa lên. Trên Vercel (build từ git) chúng vốn không có.
  for (const f of tepBoQua(a.thuMuc)) rmSync(join(RA, a.duong, f), { force: true })
  // Cài từ trang nào cũng ra một app phạm vi "/": manifest của app thay bằng manifest chung của cổng (như vercel.json cổng cũ)
  if (a.manifest) cpSync(join(RA, 'manifest.webmanifest'), join(RA, a.duong, a.manifest))
  // Gói máy chủ của app (kèm thư viện, tìm trong node_modules của chính app) thành một file chạy trên Node 22 của Cloud Functions.
  // firebase-admin để ngoài: functions/ có sẵn.
  console.log(`\n> gói máy chủ ${a.ma}: ${a.thuMuc}/${a.mayChu}`)
  await build({
    entryPoints: [join(GOC, a.thuMuc, a.mayChu)],
    outfile: join(LIB, `${a.ma}.mjs`),
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    external: ['firebase-admin', 'firebase-admin/*'],
    banner: { js: "import { createRequire as __taoRequire } from 'node:module'; const require = __taoRequire(import.meta.url);" },
    logLevel: 'warning',
  })
}
console.log(`\nXong ${lam.map((a) => a.ma).join(', ')}: ${RA} và ${LIB}`)

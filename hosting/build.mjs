// Dựng bản đưa lên Firebase (site app-by-lethanh.web.app): trang cổng ở "/", mỗi app ở /<đường dẫn>/, máy chủ của app gói vào functions/lib.
// Chạy:  node hosting/build.mjs            (dựng cả cổng + các app đã chuyển)
// Rồi:   cd hosting && firebase deploy --only hosting:app-by-lethanh,functions:lethanh
// Mỗi app vẫn build bằng chính lệnh "npm run build" của nó (kèm kiểm kiểu) — không đổi cách build của app.
import { execSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const GOC = join(dirname(fileURLToPath(import.meta.url)), '..')
const RA = join(GOC, 'hosting', 'public')
const LIB = join(GOC, 'hosting', 'functions', 'lib')

/** Các app đã chuyển sang Firebase. mayChu = file máy chủ (export taoXuLy), gói thành functions/lib/<ma>.mjs */
const APP = [
  { ma: 'hoadon', thuMuc: 'apps/hoadon', duong: 'hoa-don', mayChu: 'mcp/web.ts', manifest: 'site.webmanifest' },
]

const chay = (lenh, cwd) => {
  console.log(`\n> (${cwd}) ${lenh}`)
  execSync(lenh, { cwd: join(GOC, cwd), stdio: 'inherit' })
}
const canCai = (cwd) => !existsSync(join(GOC, cwd, 'node_modules'))

rmSync(RA, { recursive: true, force: true })
rmSync(LIB, { recursive: true, force: true })
mkdirSync(LIB, { recursive: true })

// Trang cổng (đăng nhập chung, danh sách app) ở gốc
if (canCai('apps/cong')) chay('npm ci', 'apps/cong')
chay('npm run build', 'apps/cong')
cpSync(join(GOC, 'apps/cong/dist'), RA, { recursive: true })

for (const a of APP) {
  if (canCai(a.thuMuc)) chay('npm ci', a.thuMuc)
  chay('npm run build', a.thuMuc)
  cpSync(join(GOC, a.thuMuc, 'dist'), join(RA, a.duong), { recursive: true })
  // Cài từ trang nào cũng ra một app phạm vi "/": manifest của app thay bằng manifest chung của cổng (như vercel.json cổng cũ)
  if (a.manifest) cpSync(join(GOC, 'apps/cong/dist/manifest.webmanifest'), join(RA, a.duong, a.manifest))
  // Gói máy chủ của app (kèm thư viện) thành một file, chạy trên Node 22 của Cloud Functions
  chay(
    `npx esbuild ${a.mayChu} --bundle --platform=node --format=esm --target=node22 --outfile=${join(LIB, a.ma + '.mjs').replace(/\\/g, '/')}` +
      ` "--banner:js=import { createRequire } from 'module'; const require = createRequire(import.meta.url);"`,
    a.thuMuc,
  )
}
console.log(`\nXong: ${RA} và ${LIB}`)

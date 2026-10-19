// Đóng gói cho Vercel theo "Build Output API v3": tự dựng .vercel/output/ nên Vercel không phải đoán gì.
//   static/   = web app (vite build → dist/)
//   functions/index.func = máy chủ MCP (mcp/vercel.ts, gói sẵn mọi thư viện bằng esbuild)
// Đường dẫn /mcp, /oauth/*, /.well-known/* vào hàm; còn lại là web (trang lạ → index.html).
// Chạy: npm run build:vercel  (Vercel tự chạy khi deploy, xem vercel.json)

import { build } from 'esbuild'
import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const goc = join(dirname(fileURLToPath(import.meta.url)), '..')
const ra = join(goc, '.vercel', 'output')
const ham = join(ra, 'functions', 'index.func')

if (!existsSync(join(goc, 'dist', 'index.html'))) throw new Error('Chưa có dist/ — chạy npm run build trước')

await rm(ra, { recursive: true, force: true })
await mkdir(ham, { recursive: true })
await cp(join(goc, 'dist'), join(ra, 'static'), { recursive: true })

const kq = await build({
  entryPoints: [join(goc, 'mcp', 'vercel.ts')],
  outfile: join(ham, 'index.mjs'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: false,
  metafile: true,
  // Vài thư viện CommonJS bên trong vẫn gọi require(): cấp require cho gói ESM
  banner: { js: "import { createRequire as __taoRequire } from 'node:module'; const require = __taoRequire(import.meta.url);" },
  logLevel: 'warning',
})

// Chặn lỡ kéo thư viện Firebase bản trình duyệt (hay React) vào máy chủ
const thuVienLa = Object.keys(kq.metafile.inputs).filter((f) => /node_modules[\\/](firebase|@firebase|react|qrcode)[\\/]/.test(f))
if (thuVienLa.length) throw new Error('Gói máy chủ kéo nhầm thư viện trình duyệt: ' + thuVienLa.slice(0, 5).join(', '))

await writeFile(join(ham, '.vc-config.json'), JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: false, maxDuration: 60 }, null, 2))

const BAO_MAT = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}

await writeFile(
  join(ra, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '^/(mcp|oauth/.*|\\.well-known/.*|gioi-thieu-mcp)/?$', dest: '/index?duong=/$1' },
        { src: '^/assets/(.*)$', headers: { 'Cache-Control': 'public, max-age=31536000, immutable', ...BAO_MAT }, continue: true },
        { src: '^/(.*)$', headers: BAO_MAT, continue: true },
        { handle: 'filesystem' },
        { src: '^/(.*)$', dest: '/index.html', headers: { 'Cache-Control': 'no-cache' } },
      ],
    },
    null,
    2,
  ),
)

const kb = Math.round(Object.values(kq.metafile.outputs)[0].bytes / 1024)
console.log(`Đã đóng gói: web (dist/) + máy chủ MCP .vercel/output/functions/index.func/index.mjs (${kb} KB)`)

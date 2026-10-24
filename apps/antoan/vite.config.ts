import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Cổng cố định 5190 (đăng nhập Google được ở localhost). /ai, /telegram chuyển sang máy chủ chạy thử (npm run server).
const mayChu = { target: 'http://localhost:8790', changeOrigin: true }
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5190, strictPort: true, proxy: { '/ai': mayChu, '/telegram': mayChu } },
  preview: { port: 5190, strictPort: true },
  test: { environment: 'jsdom' },
})

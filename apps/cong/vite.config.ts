import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Trang chủ nằm ở gốc tên miền app-by-lethanh.vercel.app (5 app ở /quy-phong/, /lich-giang/… do vercel.json chuyển tiếp)
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5300, strictPort: true },
})

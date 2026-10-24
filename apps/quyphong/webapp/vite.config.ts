import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Đường dẫn tương đối: cùng một bản build chạy ở quyphong.vercel.app và dưới cổng app-by-lethanh.vercel.app/quy-phong/
  base: './',
  server: { port: 5180 },
});

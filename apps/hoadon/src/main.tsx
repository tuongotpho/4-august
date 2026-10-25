import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { coBanMoi } from './lib/capNhat'
import { DialogHost, hoi } from './lib/dialog'

// Nạp một phần code bị lỗi: CHỈ hỏi tải lại khi web thật sự có bản mới (tệp cũ không còn).
// Không phải bản mới (vd trình duyệt điện thoại cũ không chạy được phần đọc PDF) thì không hỏi — tải lại cũng không hết,
// lỗi sẽ báo đúng nguyên nhân khi dùng tới chức năng đó.
let daHoi = false
let dangKiem = false
window.addEventListener('vite:preloadError', () => {
  if (daHoi || dangKiem) return
  dangKiem = true
  void coBanMoi().then((moi) => {
    dangKiem = false
    if (!moi || daHoi) return
    daHoi = true
    void hoi('App vừa có bản cập nhật trên mạng. Tải lại trang để dùng bản mới?', { okLabel: 'Tải lại trang' }).then((ok) => ok && location.reload())
  })
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <DialogHost />
  </StrictMode>,
)

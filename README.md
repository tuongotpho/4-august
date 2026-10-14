# Lịch giảng ATLĐ

Web app quản lý lịch giảng an toàn lao động, thay cho AppSheet. Đăng nhập Google, dữ liệu cất trên Firebase
(dự án `app-from-ai`, database Firestore riêng `atld`). Mỗi tài khoản chỉ thấy dữ liệu của mình.

## Dùng
- **Lịch**: lịch tháng, lớp sắp tới 30 ngày. **Danh sách**: lọc theo năm / đối tác / trạng thái, đánh dấu đã nhận tiền hàng loạt, xuất CSV.
- **Công nợ**: lớp đã giảng chưa nhận tiền, gom theo đối tác, số ngày chờ. **Tổng hợp**: theo năm, tháng, đối tác.
- **Điện thoại**: thanh tab dưới đáy, nút **+** nổi. Ô nhập lớp ưu tiên chạm: ngày (Hôm nay / Mai / thứ…), buổi (tự điền giờ),
  người liên hệ hay dùng (điền sẵn đối tác, hình thức, thù lao như lần trước), mức thù lao hay gặp. Thêm vào màn hình chính để dùng như app.
- **Dán tin nhắn** (web) hoặc **bot Telegram**: dán tin Zalo của đối tác → AI (Claude) đọc ngày, giờ, khách hàng, địa điểm, thù lao → tạo lớp.
  Bot: trả lời (reply) tin của bot để sửa ("đổi sang 14h"), "đã nhận tiền …" để đánh dấu thanh toán, `/tuan`, `/thang`, `/congno`.
  20h hằng ngày bot nhắc lịch ngày mai.
- **Google Calendar**: mỗi lớp thêm / sửa / hủy tự cập nhật lên lịch Google qua một Apps Script chạy bằng tài khoản của anh
  (`apps-script/Lich.gs`, cài ở Cài đặt → Google Calendar). Sự kiện AppSheet tạo trước đây được nhận lại (cùng ngày + tên khách hàng), không bị trùng.
- **Nhập Excel cũ**: Cài đặt → chọn file xuất từ AppSheet. Đọc mọi sheet `AT_<năm>`, tự dò cột, chuẩn hóa tên đối tác / liên hệ,
  bỏ việc NPSC / gia đình và dòng trùng, liệt kê dòng nên xem lại. Nhập lại nhiều lần không ghi đè.

## Cấu trúc
```
src/lib/        logic dùng chung web + máy chủ (model, tinh, nhapExcel, trichTin, lichGoogle) — import có đuôi .js
src/lib/store/  lớp lưu trữ (DataStore) — giao diện chỉ gọi qua đây
src/components/ giao diện React
server/         máy chủ Vercel: bot Telegram, AI đọc tin, cron nhắc lịch; gọi Firebase bằng token của chính người dùng (REST)
api/index.ts    hàm Vercel duy nhất (vercel.json chuyển /telegram/*, /ai/*, /cron/* về đây)
apps-script/    cầu nối Google Calendar
```

## Biến môi trường trên Vercel
| Biến | |
|---|---|
| `ATLD_KHOA` | bí mật ≥ 32 ký tự, mã hoá vé kết nối bot (đổi = mọi vé mất hiệu lực) |
| `ATLD_ANTHROPIC_KEY` | khoá Claude API để AI đọc tin nhắn |
| `ATLD_TELE_TOKEN` | mã bot từ @BotFather |
| `ATLD_TELE_VE` | vé kết nối (app tạo ở Cài đặt → Bot Telegram) |
| `CRON_SECRET` | chuỗi bất kỳ — Vercel gửi kèm khi gọi cron nhắc lịch |

## Cho người sửa code
```
npm run dev            # http://localhost:5190 (dữ liệu THẬT); thêm --mode gialap + file .env.gialap (VITE_GIA_LAP=1) để chạy với emulator
npm run server         # máy chủ chạy thử cổng 8790 (vite chuyển /ai, /telegram sang)
npm test               # kiểm tra tự động
npm run test:firebase  # trên Firebase giả lập (cần Java): quy tắc bảo mật + trọn vòng bot Telegram, Calendar, cron
npm run deploy:rules   # đặt quy tắc cho database "atld" (CHỈ database này)
```
Đẩy lên `main` → Vercel tự build. File Excel và test đọc file thật (`tests/file-that.test.ts`) không đưa lên git (có tên khách hàng thật).

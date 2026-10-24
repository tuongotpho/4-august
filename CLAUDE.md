# 4.August — app chung gom 5 app cá nhân

> Đọc hết file này trước khi làm. Phương án đã CHỐT ngày 24/10/2026 (lý do và bằng chứng: `F:\AI\01-BAO-CAO-WEB-TONG-QUAN-LY.md`, `F:\AI\02-BAO-CAO-CHOT-GOM-5-APP.md`). Đừng bàn lại từ đầu, cứ làm tiếp theo mục "Tiến độ".

## Mục tiêu
Gom **dần dần** 5 app cá nhân thành **một app chung** (một giao diện, một lần đăng nhập Google). Không gấp: mỗi đợt chuyển một app. **Địa chỉ web cũ, kết nối AI (MCP) cũ, bot Telegram cũ vẫn phải chạy suốt quá trình.**

Không gom các app công việc / công cộng: Sáng kiến NPSC, QLDA, atld-connect (antoan.web.app), bóng đá, phmix, shop tương ớt bán lẻ.

## 5 app trong phạm vi

| App | Thư mục gốc (đóng băng sau khi chuyển) | Vercel project → địa chỉ | Database Firestore (project `app-from-ai`) | Telegram (ở máy chủ) | Quy mô (đo 24/10/2026) |
|---|---|---|---|---|---|
| Quỹ phòng KTAT | `F:\AI\3.Quyphong\webapp` | `quyphong` → quyphong.vercel.app | `quyphong` | không | 2.043 dòng giao diện, 1.180 máy chủ, 5 file test |
| Lịch giảng ATLĐ | `F:\AI\ATLD\antoan` | `antoan` → quanly-at.vercel.app (cron 20h `/cron/nhac`) | `antoan` | có (`server/telegram.ts`) | 3.087 / 1.538 / 5 |
| Bán buôn tương ớt (**có đơn thật**) | `F:\AI\2.Ban_ot` | `tuongot-si` → tuongot-si.vercel.app | `tuongot-sale` | không | 5.101 / 1.116 / 3 |
| Hoá đơn NPSC | `F:\AI\hoadon` | `hoadon` → hoadon-npsc.vercel.app | (db hoá đơn) + Storage `hoadon-npsc` | có (`mcp/telegram.ts`) | 5.486 / 1.587 / 17 |
| Khai thuế | `F:\AI\HTKK-thanh\app` | `khaithue` → khaithue.vercel.app | `khaithue` + Storage `khaithue` | có (`mcp/may/telegram.ts`) | 9.415 / 2.090 / 19 |

Chung: React + Vite + TypeScript, đăng nhập Google qua Firebase Auth `app-from-ai.firebaseapp.com`, mỗi app có máy chủ MCP "Kết nối AI" trên Vercel (`/mcp`, OAuth theo skill `mcp-ket-noi-app`). Đừng nhầm với project Vercel cũ `tuongot-buon` (không đụng).

## 4 quy tắc bắt buộc

1. **Một bản code gốc duy nhất.** Chuyển app nào vào đây thì thư mục cũ của app đó **đóng băng** (không sửa nữa). Địa chỉ cũ được triển khai từ chính thư mục trong `4.August` (đổi "Root Directory" của project Vercel cũ — **người dùng bấm trên Vercel**, hoặc Claude làm qua công cụ Vercel khi được đồng ý).
2. **Không đổi cấu trúc dữ liệu** khi bản cũ và bản mới cùng chạy trên một database. Bắt buộc đổi thì làm thành một đợt riêng, sửa cả hai phía.
3. **Bot Telegram và MCP giữ địa chỉ cũ** cho tới khi chuyển hẳn app đó; đổi webhook một lần, có kế hoạch quay lại.
4. **Khi chép vào đây không chép** `node_modules`, `.env*` (chuyển bí mật riêng, không đưa vào git), `.git` lồng nhau. Kiểm tên file hoa/thường (Windows không phân biệt, CI Linux có).

## Thứ tự chuyển và tiêu chí xong

Thứ tự: **Quỹ phòng → Lịch giảng → Tương ớt → Hoá đơn → Khai thuế.**

Một đợt chỉ được coi là xong khi có đủ bằng chứng đo được:
- toàn bộ test cũ của app đó chạy đạt trong thư mục mới,
- bản trên mạng (địa chỉ cũ + trong app chung) mở được, đăng nhập được,
- số liệu khớp app cũ (ví dụ so `tong_quan` của MCP trước/sau),
- MCP và Telegram (nếu có) vẫn trả lời.

Chỗ nào chưa kiểm được thì ghi rõ vào "Tiến độ", không tuyên bố xong.

## Còn mở, chưa quyết
- Cấu trúc thư mục bên trong (ví dụ `apps/<ten-app>` + `packages/chung`) — chốt ở đợt 0.
- App chung chạy chung một địa chỉ (đăng nhập một lần thật sự) — mỗi app sẽ phải build dưới đường dẫn con; chưa thử.
- Gói Firebase của `app-from-ai` (nhiều khả năng Blaze) và cảnh báo ngân sách — **người dùng kiểm trên Console**.

## Tiến độ (cập nhật cuối mỗi đợt, mới nhất ở trên)

- 24/10/2026 — Chốt phương án, tạo thư mục. **Chưa chép app nào.** Việc kế tiếp: **đợt 0** = dựng khung (git, cấu trúc thư mục, footer `(C) August87 - 0982722036`), rồi **đợt 1** = chuyển Quỹ phòng.

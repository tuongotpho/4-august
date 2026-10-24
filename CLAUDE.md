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
- ~~Cấu trúc thư mục bên trong~~ — đã chốt ở đợt 0: `apps/<ten-app>` + `packages/` (xem `README.md`).
- App chung chạy chung một địa chỉ (đăng nhập một lần thật sự) — mỗi app sẽ phải build dưới đường dẫn con; chưa thử.
- Gói Firebase của `app-from-ai` (nhiều khả năng Blaze) và cảnh báo ngân sách — **người dùng kiểm trên Console**.

## Tiến độ (cập nhật cuối mỗi đợt, mới nhất ở trên)

- 24/10/2026 — **Đợt 0 xong, đợt 1 (Quỹ phòng) xong nửa trên máy** (chi tiết: `F:\AI\03-BAO-CAO-DOT-0-1-QUY-PHONG.md`).
  - Khung: git `main`, `apps/<ten-app>/` + `packages/` (trống). Mỗi app giữ `package-lock.json` riêng, KHÔNG dùng npm workspaces (để Vercel cũ chỉ đổi Root Directory).
  - Quỹ phòng ở `apps/quyphong` (nhập bằng `git subtree` từ `F:\AI\3.Quyphong` main, giữ 8 commit cũ). 19/19 test đạt (17 thường + 2 emulator), build đạt, footer bản quyền đã thêm.
  - Số gốc để so (MCP `tong_quan`): 223 giao dịch, thu 652.840.812, chi 689.724.000, tồn −36.883.188, cần kiểm tra 73.
  - Repo GitHub: `tuongotpho/4-august` (riêng tư, tạo 24/10/2026, 12/12 commit khớp máy).
  - **Đã chuyển trên mạng** (24/10/2026): project Vercel `quyphong` nối repo `tuongotpho/4-august` (bằng `vercel git connect`), Root Directory `apps/quyphong/webapp`, bật "bỏ qua build khi thư mục app không đổi". Bản chính thức `dpl_F3vc5Ay6AdVtnrApT79yaGmYUNeV` gắn quyphong.vercel.app. Kiểm: trang mở, có footer, phiên đăng nhập Google cũ vẫn nhận; MCP `tong_quan` khớp từng số với mốc trên. Quay lại: Vercel → Instant Rollback về `dpl_FxH3A9c158m1aEFGH47mf8fU4G3j` (bản từ repo cũ).
  - `F:\AI\3.Quyphong` **đóng băng từ 24/10/2026** — sửa Quỹ phòng chỉ ở `apps/quyphong`.
  - Còn lại cần mắt người dùng: thử đăng nhập mới từ đầu (đăng xuất → đăng nhập) và giao diện điện thoại.
  - Bài học: curl gọi trang 5 giây/lần làm Vercel bật "Security Checkpoint" chặn máy này (người dùng thật không bị). Kiểm trang bằng trình duyệt hoặc `web_fetch_vercel_url`, đừng vòng lặp curl.
- 24/10/2026 — Chốt phương án, tạo thư mục. **Chưa chép app nào.** Việc kế tiếp: **đợt 0** = dựng khung (git, cấu trúc thư mục, footer `(C) August87 - 0982722036`), rồi **đợt 1** = chuyển Quỹ phòng.

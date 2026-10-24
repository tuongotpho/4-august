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

- 24/10/2026 — **Đợt 2 (Lịch giảng ATLĐ) đã chạy trên mạng từ 4.August** (chi tiết: `F:\AI\04-BAO-CAO-DOT-2-LICH-GIANG.md`).
  - `apps/antoan` (git subtree từ `F:\AI\ATLD\antoan` main, 10 commit cũ, 60/60 file). 28/28 test đạt (19 thường + 9 emulator), build đạt, footer đã thêm. Không có token Telegram trong mã trình duyệt / lịch sử.
  - Vercel `antoan`: nối `tuongotpho/4-august`, Root Directory `apps/antoan`. Bản `dpl_5vnVqJY7YKD8nUkADm9gm8TzEH9b` gắn quanly-at.vercel.app. Quay lại: Instant Rollback về `dpl_5VTFPawYC7BYkMg4EsMNr4kubbx1`.
  - Kiểm: MCP `tong_quan` khớp 100% (552 lớp 2020–2026, công nợ 9.100.000 / 5 lớp, 2026: 114 lớp / 209.200.000); `/telegram/nhan` trả 401 khi sai mật khẩu (đường sống, khoá không đổi); cron `/cron/nhac` `0 13 * * *` đã đăng ký; footer hiện ở màn đăng nhập.
  - `F:\AI\ATLD\antoan` **đóng băng từ 24/10/2026** (file `.mcp.json` chưa commit ở đó chỉ là cấu hình kết nối, không cần chép).
  - Chờ mắt người dùng: đăng nhập web, nhắn thử bot Telegram, tin nhắc 20h tối nay có tới không.
  - Hạ tầng chung: mọi project Vercel trong kho đặt *Ignored Build Step* = `git diff --quiet HEAD^ HEAD -- .` (thư mục app không đổi thì bỏ qua build). Tuỳ chọn "skip when no changes to root directory" KHÔNG có tác dụng với kho này (không có workspaces) — đã thử, quyphong vẫn build lại.
  - Cách nối một project Vercel: `cd apps/<app>` → `vercel link --yes --project <ten> --scope vietthanh228s-projects` → `vercel git connect https://github.com/tuongotpho/4-august --yes`. CLI tự tạo `.env.local` (token OIDC) và sửa `.gitignore` — xoá `.env.local`, `git checkout -- .gitignore`.

- 24/10/2026 — **Đợt 0 xong, đợt 1 (Quỹ phòng) xong nửa trên máy** (chi tiết: `F:\AI\03-BAO-CAO-DOT-0-1-QUY-PHONG.md`).
  - Khung: git `main`, `apps/<ten-app>/` + `packages/` (trống). Mỗi app giữ `package-lock.json` riêng, KHÔNG dùng npm workspaces (để Vercel cũ chỉ đổi Root Directory).
  - Quỹ phòng ở `apps/quyphong` (nhập bằng `git subtree` từ `F:\AI\3.Quyphong` main, giữ 8 commit cũ). 19/19 test đạt (17 thường + 2 emulator), build đạt, footer bản quyền đã thêm.
  - Số gốc để so (MCP `tong_quan`): 223 giao dịch, thu 652.840.812, chi 689.724.000, tồn −36.883.188, cần kiểm tra 73.
  - Repo GitHub: `tuongotpho/4-august` (riêng tư, tạo 24/10/2026, 12/12 commit khớp máy).
  - **Đã chuyển trên mạng** (24/10/2026): project Vercel `quyphong` nối repo `tuongotpho/4-august` (bằng `vercel git connect`), Root Directory `apps/quyphong/webapp`, bật "bỏ qua build khi thư mục app không đổi". Bản chính thức `dpl_F3vc5Ay6AdVtnrApT79yaGmYUNeV` gắn quyphong.vercel.app. Kiểm: trang mở, có footer, phiên đăng nhập Google cũ vẫn nhận; MCP `tong_quan` khớp từng số với mốc trên. Quay lại: Vercel → Instant Rollback về `dpl_FxH3A9c158m1aEFGH47mf8fU4G3j` (bản từ repo cũ).
  - `F:\AI\3.Quyphong` **đóng băng từ 24/10/2026** — sửa Quỹ phòng chỉ ở `apps/quyphong`.
  - Người dùng xác nhận đăng nhập được trên bản mới (24/10/2026). Đẩy lên `main` → Vercel tự build (nguồn `git`) — nối repo đã thông.
  - Còn lại cần mắt người dùng: giao diện điện thoại (footer không bị thanh tab dưới che).
  - Bài học: curl gọi trang 5 giây/lần làm Vercel bật "Security Checkpoint" chặn máy này (người dùng thật không bị). Kiểm trang bằng trình duyệt hoặc `web_fetch_vercel_url`, đừng vòng lặp curl.
- 24/10/2026 — Chốt phương án, tạo thư mục. **Chưa chép app nào.** Việc kế tiếp: **đợt 0** = dựng khung (git, cấu trúc thư mục, footer `(C) August87 - 0982722036`), rồi **đợt 1** = chuyển Quỹ phòng.

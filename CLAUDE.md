# 4.August — app chung gom 5 app cá nhân

> Đọc hết file này trước khi làm. Phương án đã CHỐT ngày 24/10/2026 (lý do và bằng chứng: `F:\AI\4.August\bao-cao\01-BAO-CAO-WEB-TONG-QUAN-LY.md`, `F:\AI\4.August\bao-cao\02-BAO-CAO-CHOT-GOM-5-APP.md`). Đừng bàn lại từ đầu, cứ làm tiếp theo mục "Tiến độ".
>
> **Báo cáo của dự án** nằm ở `F:\AI\4.August\bao-cao\` (đánh số `NN-BAO-CAO-…md`, mục lục `00-MUC-LUC-BAO-CAO.md`). Thư mục này bị `.gitignore` chặn — có số liệu thật (mã số thuế, doanh thu, tồn quỹ), không đưa lên GitHub.

## Mục tiêu
Gom **dần dần** 5 app cá nhân thành **một app chung** (một giao diện, một lần đăng nhập Google). Không gấp: mỗi đợt chuyển một app. **Địa chỉ web cũ, kết nối AI (MCP) cũ, bot Telegram cũ vẫn phải chạy suốt quá trình.**

Không gom các app công việc / công cộng: Sáng kiến NPSC, QLDA, atld-connect (antoan.web.app), bóng đá, phmix, shop tương ớt bán lẻ.

## 5 app trong phạm vi

**Cả 5 app đã chuyển xong (24/10/2026)** — code ở `apps/<app>` (bảng thư mục + Root Directory: `README.md`). Cột "thư mục gốc" dưới đây giờ là bản **ĐÓNG BĂNG**, không sửa ở đó nữa.

| App | Thư mục gốc (ĐÃ ĐÓNG BĂNG) | Vercel project → địa chỉ | Database Firestore (project `app-from-ai`) | Telegram (ở máy chủ) | Quy mô (đo 24/10/2026) |
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
- ~~App chung chạy chung một địa chỉ~~ — xong 24/10/2026: `app-by-lethanh.vercel.app` (trang cổng + chuyển tiếp, xem Tiến độ).
- Gói Firebase của `app-from-ai` (nhiều khả năng Blaze) và cảnh báo ngân sách — **người dùng kiểm trên Console**.

## Tiến độ (cập nhật cuối mỗi đợt, mới nhất ở trên)

- 24/10/2026 — **Chân trang thống nhất trang chủ + 5 app** (chi tiết `F:\AI\4.August\bao-cao\13-BAO-CAO-CHAN-TRANG-CHUNG.md`). Commit `6bd764d`.
  - Mẫu: `<footer>` cuối nội dung (không ghim), `mt-8 w-full border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-500`; dòng 1 luôn `(C) August87 - 0982722036`; dòng 2 tuỳ app (chỉ KT: "Công cụ hỗ trợ lập tờ khai — kiểm tra lại số liệu…"; bỏ "Bảo lưu mọi quyền."). Nền màu (màn đăng nhập TƠ): biến thể `keep-colors border-white/15 text-white/60`. QP: CSS `.ban-quyen` tương đương. TƠ: `ChanTrang` trong `src/ui.tsx` (KHÔNG gắn `keep-colors` cho bản thường để chế độ tối đổi màu), bỏ footer ghim chỉ-máy-tính, dùng cả ở trang `/ket-noi-ai`. Dòng giới thiệu trong hộp Cài đặt TƠ giữ nguyên (không phải chân trang).
  - Đo trên máy: 6/6 nơi ở 375px cùng `12px | đệm 16px | kẻ 1px | cách 32px | static`, không bị thanh tab che, 0 tràn ngang; 1280px: TƠ, HĐ đúng 1 chân trang cùng kiểu. Test 6 project đạt.
  - **VIỆC TREO — Vercel Hobby chặn 100 deploy/ngày (`api-deployments-free-per-day`), commit `6d4cdf0` (HĐ/KT/TƠ) và `6bd764d` (cả 6) bị từ chối.** Bản đang chạy: QP + LG ở `6d4cdf0`, còn lại ở `6b27162`. **Khi hết chặn (~trưa 25/10/2026): `create_deployment` target production, gitSource sha `6bd764d9960065e06a21ee6f493aa584c872abe5`, cho ĐỦ 6 project** `quyphong`, `antoan`, `tuongot-si`, `hoadon`, `khaithue`, `cong-4august` (commit này chạm cả 6 thư mục nên Ignored Build Step cho qua; đã gồm `6d4cdf0`). Rồi đo trên mạng khổ 375px + 1280px (nút nhà, thanh dưới HĐ/KT, chân trang). KHÔNG đẩy commit chỉ-ghi-chú trước đó cũng được — build theo sha cụ thể.

- 24/10/2026 — **Giao diện điện thoại thống nhất** (chi tiết `F:\AI\4.August\bao-cao\12-BAO-CAO-GIAO-DIEN-DIEN-THOAI.md`). Commit `6d4cdf0`.
  - **Mẫu nút về trang chủ chung 5 app** (component `NutTrangChu` chép trong từng app; QP dùng CSS `.nut-trang-chu`): chỉ hiện khi qua cổng, góc TRÁI đầu trang trước tên app, ô 40×40 bo 8px, ngôi nhà SVG (lucide "house", cùng path ở 5 app). Đầu trang trắng (QP, LG, HĐ): viền slate-200, chữ slate-700; đầu trang màu (TƠ đỏ, KT xanh): nền white/15, chữ trắng. TƠ máy tính: nút ở đầu thanh bên. Bỏ hết kiểu cũ ("← Trang chủ", "←", nhà bên phải).
  - Hoá đơn + Khai thuế: điện thoại (<640px) có **thanh tab dưới đáy** (emoji + tên ngắn, màu app khi chọn), tab đầu trang ẩn; máy tính giữ nguyên. HĐ đầu trang gọn (chỉ ảnh đại diện trên điện thoại).
  - Đo trên máy (người dùng đăng nhập localhost:5300, khổ 375px): 5/5 có nút nhà 40×40 góc trái, 0 tràn ngang; HĐ thanh dưới 3 mục, KT 5 mục; khổ 1280px HĐ/KT giữ tab cũ, thanh dưới ẩn. Test 6 project đạt.
  - **Đã lên mạng: Quỹ phòng, Lịch giảng** (đo trên mạng: nút nhà đúng, số liệu QP đúng). Hoá đơn, Khai thuế, Tương ớt chưa lên — xem dòng "VIỆC TREO" ở mục chân trang ngay trên.

- 24/10/2026 — **Gom báo cáo + app di động** (chi tiết `F:\AI\4.August\bao-cao\11-BAO-CAO-APP-DI-DONG.md`).
  - 11 báo cáo 00–10 chuyển từ `F:\AI\` vào `F:\AI\4.August\bao-cao\` (`.gitignore` `/bao-cao/` — có số liệu thật). Báo cáo các dự án khác (`1.REA`, `2.Ban_ot\bao-cao`, `SSI`, `vietanh`) để nguyên.
  - Trang chủ cài được như app: `apps/cong/public/manifest.webmanifest` (`id`/`scope`/`start_url` `/`, standalone, 5 lối tắt), biểu tượng LT (vẽ bằng PIL: 192, 512, maskable 512, apple 180, favicon 32). Qua cổng, manifest của 4 app (`/<app>/manifest.webmanifest`, HĐ `site.webmanifest`) được `vercel.json` trả về manifest chung → cài từ trang nào cũng ra một app phạm vi `/` (đi giữa 5 app không bật trình duyệt). Khai thuế không có manifest riêng — không cần.
  - Link gửi ra ngoài trỏ địa chỉ chung: Lịch giảng biến Vercel `ATLD_APP_URL` = `https://app-by-lethanh.vercel.app/lich-giang` (trước: `https://quanly-at.vercel.app`; `ATLD_GOC_URL` giữ nguyên) + `LINK_APP` ở web cho Google Calendar; Hoá đơn mặc định `HOADON_APP_URL` → `/hoa-don`; Khai thuế tin nhắc hạn → `/khai-thue/`. Hiển thị địa chỉ MCP vẫn là địa chỉ gốc.
  - Chưa đăng nhập: app gọi `veTrangChuDangNhap()` → `/?ve=<đường dẫn>`; trang chủ đăng nhập xong mở lại đúng chỗ (`duongVeHopLe` chỉ nhận đường dẫn của 5 app).
  - Đo: test cổng 4/4, 5 app đạt, emulator HĐ 28/28; khổ 375px: trang chủ + 5 app không tràn ngang, nút 44px; trên mạng 5 manifest (gốc + 4 app qua cổng) đều trả "App by Lê Thanh" scope `/`; link `/lich-giang/?lop=…` khi chưa đăng nhập → `/?ve=/lich-giang/?lop=…`.
  - **VƯỚNG: Vercel Hobby chặn deploy 24 giờ ("Deployment rate limited")** — hôm nay đẩy quá nhiều lần (mỗi lần đẩy = 6 project, kể cả lượt bỏ qua build). Bản đang chạy = commit `6b27162` (đã đo đạt). **Chưa lên mạng: commit `9ec45e7`** (nút "← Trang chủ" của Quỹ phòng luôn hiện trên điện thoại). **Việc phải làm khi hết chặn (sau ~12h 25/10/2026):** cho Quỹ phòng build lại bằng tay (`create_deployment` gitSource main, project quyphong, target production) — đẩy commit khác KHÔNG đủ vì Ignored Build Step sẽ bỏ qua Quỹ phòng. Bài học: gom thay đổi, đẩy ít lần; commit chỉ sửa ghi chú thì chưa cần đẩy ngay.

- 24/10/2026 — **Trang chủ là nơi vào duy nhất** (người dùng chốt; chi tiết `F:\AI\4.August\bao-cao\10-BAO-CAO-TRANG-CHU-DANG-NHAP-CAI-DAT.md`).
  - `apps/cong` giờ là app Vite + React + Tailwind + Firebase Auth (chỉ đăng nhập). Chưa đăng nhập: nút "Đăng nhập bằng Google", 5 ô app khoá. Đăng nhập: tab **Ứng dụng** / **Cài đặt** (`#cai-dat`). Cài đặt = Tài khoản + Đăng xuất (cả 5 app) + mỗi app một mục: địa chỉ Kết nối AI (chép) + nút "Mở cài đặt riêng →" = `/<app>/?cai-dat`. Danh sách app ở `apps/cong/src/dsApp.ts`; test `dsApp.test.ts` bắt buộc mỗi app có đủ redirect + 2 rewrite trong `vercel.json`.
  - Mỗi app có file `cong.ts` (`QUA_CONG` = đường dẫn bắt đầu bằng `/<app>/`, `MO_CAI_DAT`, `TRANG_CHU='../'`). Qua cổng: chưa đăng nhập → `location.replace('../')`; bỏ Đăng xuất + nút/tab Cài đặt, thêm "← Trang chủ"; `?cai-dat` mở thẳng phần cài đặt riêng (QP: hộp Kết nối AI; LG: tab Cài đặt, ẩn mục Tài khoản; TƠ: hộp Cài đặt; HĐ: tab Cài đặt & sao lưu; KT: hộp tài khoản mở sẵn, không nút Đăng xuất). Ở địa chỉ gốc: không đổi gì (đã đo tuongot-si).
  - Đo trên mạng (phiên người dùng): trang chủ 2 tab, 5 link; Cài đặt có tài khoản + 5 mục + 5 địa chỉ MCP đúng gốc; 5/5 app qua cổng đúng như trên ở cả mở thường lẫn `?cai-dat`. Trên máy (chưa đăng nhập): 5 ô khoá; `/lich-giang/` `/hoa-don/` `/khai-thue/` tự về trang chủ. Test: QP 17, LG 19, TƠ 38, HĐ 120, KT 119, cổng 2 — đạt.
  - **Chưa đo:** Quỹ phòng + Tương ớt tự về trang chủ khi chưa đăng nhập (bản build trên máy không có cấu hình Firebase nên chạy chế độ thử) — cần người dùng: Cài đặt → Đăng xuất → mở `/quy-phong/`, `/tuong-ot/`.

- 24/10/2026 — **Giai đoạn A xong: một địa chỉ chung `https://app-by-lethanh.vercel.app`, đăng nhập một lần** (chi tiết: `F:\AI\4.August\bao-cao\09-BAO-CAO-GIAI-DOAN-A-CONG-CHUNG.md`; phương án + đo giao diện: `F:\AI\4.August\bao-cao\08-…`).
  - **Đã chốt với người dùng:** tên miền `app-by-lethanh.vercel.app`; **mỗi app một màu nhận diện** (giữ màu đang dùng: QP `#1f4e78`, LG teal-700 `#0f766e`, TƠ red-700 `#b91c1c`, HĐ blue-600 `#2563eb`, KT emerald-700 `#047857`), mọi thứ khác giống nhau; **chế độ tối cho cả 5, làm sau cùng**.
  - Trang cổng `apps/cong` (HTML tĩnh + `vercel.json`), project Vercel **`cong-4august`** (`prj_IvxBxX3hztdxOHM5jVOOUeXDxypN`), domain `app-by-lethanh.vercel.app`. Chuyển tiếp ngầm: `/quy-phong/` `/lich-giang/` `/tuong-ot/` `/hoa-don/` `/khai-thue/` → địa chỉ gốc từng app. Phải có cả quy tắc `/<app>/` riêng — `:path*` không khớp đường dẫn trống.
  - 5 app build `base: './'` (đường dẫn tương đối) → cùng bản build chạy ở địa chỉ gốc lẫn dưới cổng. Manifest: `start_url`/`scope` `./`, icon tương đối (giữ `"id": "/"` của Quỹ phòng để app đã cài không bị coi là app khác). Gọi máy chủ Telegram/AI bằng đường dẫn tương đối. Hiển thị địa chỉ MCP + link Google Calendar (Lịch giảng): nếu `location.hostname === 'app-by-lethanh.vercel.app'` thì dùng địa chỉ gốc của app.
  - Đo: qua cổng 5/5 trang 200 + file JS 200, CSP Khai thuế giữ nguyên; người dùng đăng nhập 1 lần ở `/hoa-don/` → 4 app kia tự vào (có tài khoản, số liệu); ô Kết nối AI qua cổng hiện `https://quyphong.vercel.app/mcp`; địa chỉ cũ (quanly-at) vẫn chạy, 0 lỗi file; CI tuongot-si + khaithue xanh; đẩy nhánh `cong-chung` → 5 bản xem trước đạt rồi mới gộp `main`.
  - **Lỗi Claude gây ra rồi đã sửa:** `vercel link --project app-by-lethanh` gắn vào **project v0 cũ có sẵn** của người dùng (`prj_My3we…`, trang `v0-app-by-lethanh.vercel.app`, Next.js) và sửa 3 thiết lập. Đã trả về đúng gốc (framework `nextjs`, rootDirectory trống, không Ignored Build Step — tra từ bản deploy cũ), trang v0 vẫn 200, không deploy gì vào đó. **Bài học: trước `vercel link --project X` phải `vercel api /v9/projects/X` xem đã tồn tại chưa; tạo mới bằng `vercel project add`.**
  - Việc kế tiếp: **B0** — `packages/giao-dien` (token màu/bo góc/font Be Vietnam Pro đặt sẵn trong app, đầu trang chung có nút chuyển app, chân trang) + trang mẫu cho người dùng duyệt; rồi B1…B5 (Hoá đơn → Lịch giảng → Khai thuế → Tương ớt → Quỹ phòng), B6 chế độ tối.

- 24/10/2026 — **Đợt 5 (Khai thuế) đã chạy trên mạng từ 4.August → xong giai đoạn "một bản code gốc" cho cả 5 app** (chi tiết + tổng kết: `F:\AI\4.August\bao-cao\07-BAO-CAO-DOT-5-KHAI-THUE-TONG-KET.md`).
  - `apps/khaithue` (git subtree từ `F:\AI\HTKK-thanh` main = GitHub = bản đang chạy `66035f8`; 34 commit, 106/106 file). App ở `apps/khaithue/app`, `firebase.json` + `firebase/` ở `apps/khaithue`.
  - **156/156 test** (128 thường — gồm đối chiếu tờ khai thật nhờ junction tạm `apps/khaithue/du-lieu-rieng` → `F:\AI\HTKK-thanh\du-lieu-rieng`, đã gỡ — + 28 luật phân quyền emulator). Build đạt. Footer `©2026 August87-0982722036` → `(C) August87 - 0982722036`.
  - GitHub Actions cũ (test-build + luat-phan-quyen) → `.github/workflows/kiem-tra-khaithue.yml`, xanh.
  - Vercel `khaithue`: Root Directory `apps/khaithue/app`, Ignored Build Step, nối repo mới. Bản chính `dpl_E2xsXfFaeCFAA59sKqa7G8XZKjAH`. Quay lại: `dpl_3UVKWzgNcEinMAHZzya46CjYyteH`. Cron `/telegram/nhac` `0 1 * * *` (8h VN) còn.
  - Lưu ý: khoá `KHAITHUE_MCP_KHOA` chỉ cấp cho **production** → bản xem trước báo thiếu khoá ở `/mcp` là đúng thiết kế, không phải lỗi.
  - Số liệu: phiên này không có MCP khaithue → so bằng trình duyệt (người dùng đăng nhập): tab Tổng quan trước/sau **giống từng ký tự** (SHA-256 đầu `6d7d7ad28fbb7063`, 8.613 ký tự): 2026 doanh thu 2.697.078.650, mua vào 2.596.837.291, GTGT phải nộp = đã nộp 7.535.743, 11 quý, 17 chứng từ 84.891.716. `/mcp` metadata 200, `/telegram/nhan` sai mật khẩu 401.
  - `F:\AI\HTKK-thanh` **đóng băng từ 24/10/2026** (dữ liệu thật `du-lieu-rieng/`, `Ban-q1-25.xlsx` vẫn ở đó, chỉ trên máy).
  - Chờ mắt người dùng: thử Kết nối AI khaithue từ Claude, nhắn thử bot, tin nhắc 8h sáng mai.
- **Việc kế tiếp của cả dự án** (chưa làm): "app chung" thật — một địa chỉ, đăng nhập một lần (xem "Còn mở"). Có thể dọn dần: xoá repo GitHub cũ (người dùng quyết), gom phần dùng chung vào `packages/`.

- 24/10/2026 — **Đợt 4 (Hoá đơn NPSC) đã chạy trên mạng từ 4.August** (chi tiết: `F:\AI\4.August\bao-cao\06-BAO-CAO-DOT-4-HOA-DON.md`).
  - Repo máy `F:\AI\hoadon` **chậm 5 commit** so với GitHub (bản đang chạy = `2d26206` trên GitHub). Đã `git pull --ff-only` thư mục cũ cho bằng GitHub rồi mới subtree → `apps/hoadon` = đúng bản đang chạy. 29 commit cũ, 101/101 file.
  - Dữ liệu thật `HD-Hung Yen/` + test/script số liệu thật bị `.gitignore` chặn — không chép. Test PDF thật chạy được bằng cách tạm nối junction `apps/hoadon/HD-Hung Yen` → `F:\AI\hoadon\HD-Hung Yen`, chạy xong gỡ.
  - **149/149 test đạt** (120 thường + 29 emulator, gồm test PDF hoá đơn thật). Build đạt. Footer sửa `© 2026 - August87 - 0982722036` → `(C) August87 - 0982722036` (mẫu chung).
  - Vercel `hoadon`: Root Directory `apps/hoadon`, Ignored Build Step, nối `tuongotpho/4-august`. Bản xem trước kiểm trước (máy chủ AI, file mẫu `/mau/to-trinh.docx`), rồi bản chính `dpl_2RkxzfTQCbHcUTHJ16zdTxnyp6Eb` gắn hoadon-npsc.vercel.app. Quay lại: Instant Rollback về `dpl_DzwKfih8LR45nxBsgXX8rEarW5hH`.
  - Kiểm: MCP `tong_quan` trước = sau (60 hồ sơ, 652.521.060; choLamHs 5 / 50.460.070; choKt 11 / 88.581.820; daTt 44 / 513.479.170; cần chú ý 16). `/telegram/nhan` sai mật khẩu → 401. Màn đăng nhập có footer.
  - `F:\AI\hoadon` **đóng băng từ 24/10/2026** (thư mục `HD-Hung Yen` dữ liệu thật vẫn để ở đó — chỉ nằm trên máy).
  - Chờ mắt người dùng: đăng nhập web, nhắn thử bot Telegram hoá đơn, in thử một tờ trình Word.

- 24/10/2026 — **Đợt 3 (Bán buôn tương ớt, có đơn thật) đã chạy trên mạng từ 4.August** (chi tiết: `F:\AI\4.August\bao-cao\05-BAO-CAO-DOT-3-TUONG-OT-SI.md`).
  - `apps/tuongot-si` (git subtree từ `F:\AI\2.Ban_ot` main, 12 commit cũ, 64/64 file). lint + 38/38 test + build + build:vercel đạt. Footer có sẵn từ trước (`COPYRIGHT` trong `src/ui.tsx`) — không sửa code app. Footer chân trang chỉ hiện từ màn `lg` (thiết kế cũ).
  - GitHub Actions cũ (`.github/workflows/deploy.yml`, chỉ kiểm tra, không deploy) chuyển thành `.github/workflows/kiem-tra-tuongot-si.yml` ở gốc kho, chạy trong `apps/tuongot-si`, chỉ khi thư mục đó đổi.
  - App đóng gói kiểu Build Output API (`scripts/build-vercel.mjs` → `apps/tuongot-si/.vercel/output`) — chạy được với Root Directory con (đã thử bản xem trước trước khi lên bản chính).
  - Vercel `tuongot-si`: Root Directory `apps/tuongot-si`, Ignored Build Step như các app khác, nối `tuongotpho/4-august`. Bản chính `dpl_EJHGEqf7GkxmsvjkMQxpdHMA6ZCp` gắn tuongot-si.vercel.app. Quay lại: Instant Rollback về `dpl_CVaqjBAk2DF4ymtTnRcveahbLpVh`.
  - Kiểm (chỉ công cụ đọc, không ghi đơn): MCP tong_quan / ton_kho / cong_no trước = sau (3 khách, 22 đơn, T10 doanh thu 1.900.000 lãi 602.000 57 chai, tồn 13/23/70, nợ 0, Phở Hiền trả dư 300.000). Web đã đăng nhập hiện đúng số đó, 0 lỗi console.
  - `F:\AI\2.Ban_ot` **đóng băng từ 24/10/2026** (file chưa commit `bao-cao/01-BAO-CAO-WEB-TONG-QUAN-LY.md` ở đó là bản chép báo cáo chung, không cần chuyển).
  - Chờ mắt người dùng: lên một đơn thật lần tới xem bình thường không (Claude không tự ghi đơn thử vào dữ liệu thật).

- 24/10/2026 — **Đợt 2 (Lịch giảng ATLĐ) đã chạy trên mạng từ 4.August** (chi tiết: `F:\AI\4.August\bao-cao\04-BAO-CAO-DOT-2-LICH-GIANG.md`).
  - `apps/antoan` (git subtree từ `F:\AI\ATLD\antoan` main, 10 commit cũ, 60/60 file). 28/28 test đạt (19 thường + 9 emulator), build đạt, footer đã thêm. Không có token Telegram trong mã trình duyệt / lịch sử.
  - Vercel `antoan`: nối `tuongotpho/4-august`, Root Directory `apps/antoan`. Bản `dpl_5vnVqJY7YKD8nUkADm9gm8TzEH9b` gắn quanly-at.vercel.app. Quay lại: Instant Rollback về `dpl_5VTFPawYC7BYkMg4EsMNr4kubbx1`.
  - Kiểm: MCP `tong_quan` khớp 100% (552 lớp 2020–2026, công nợ 9.100.000 / 5 lớp, 2026: 114 lớp / 209.200.000); `/telegram/nhan` trả 401 khi sai mật khẩu (đường sống, khoá không đổi); cron `/cron/nhac` `0 13 * * *` đã đăng ký; footer hiện ở màn đăng nhập.
  - `F:\AI\ATLD\antoan` **đóng băng từ 24/10/2026** (file `.mcp.json` chưa commit ở đó chỉ là cấu hình kết nối, không cần chép).
  - Telegram ĐÃ thông qua máy chủ mới: người dùng nhắn thử, bot trả lời (24/10/2026). Nhưng tin trả lời là lỗi **Gemini 402 — hết tiền trả trước** ở AI Studio: lỗi tài khoản, không do chuyển app. Người dùng chọn **để sau** (không cần Gemini lúc này). Hệ quả: bot và nút "Dán tin" trên web không tự đọc tin nhắn thành lớp được (cả hai đi qua `server/ai.ts`); các việc khác (nhắc 20h, đánh dấu đã nhận tiền, MCP, web) không dùng Gemini.
  - Đăng nhập web trên bản mới: được (24/10/2026, tab "Công nợ (5)" khớp MCP, footer hiện).
  - Còn chờ: tin nhắc 20h tối 24/10/2026 có tới không.
  - Hạ tầng chung: mọi project Vercel trong kho đặt *Ignored Build Step* = `git diff --quiet HEAD^ HEAD -- .` (thư mục app không đổi thì bỏ qua build). Tuỳ chọn "skip when no changes to root directory" KHÔNG có tác dụng với kho này (không có workspaces) — đã thử, quyphong vẫn build lại.
  - Cách nối một project Vercel: `cd apps/<app>` → `vercel link --yes --project <ten> --scope vietthanh228s-projects` → `vercel git connect https://github.com/tuongotpho/4-august --yes`. CLI tự tạo `.env.local` (token OIDC) và sửa `.gitignore` — xoá `.env.local`, `git checkout -- .gitignore`.

- 24/10/2026 — **Đợt 0 xong, đợt 1 (Quỹ phòng) xong nửa trên máy** (chi tiết: `F:\AI\4.August\bao-cao\03-BAO-CAO-DOT-0-1-QUY-PHONG.md`).
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

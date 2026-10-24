# 🌶 Sổ bán buôn tương ớt

App điện thoại cho việc bán buôn tương ớt cho khách quen:

- **Lên đơn** trong vài chạm: chọn khách → bấm +/− số chai từng cỡ (1 lít, 500ml, 330ml) → khách trả bao nhiêu → lưu.
- **Ảnh hoá đơn** tự tạo ngay sau khi lưu, có **mã QR chuyển khoản MB 938118 – LE VIET THANH** đã điền sẵn số tiền và nội dung → bấm "Gửi khách" để chia sẻ thẳng sang Zalo/Messenger.
- **Công nợ**: mỗi đơn ghi khách trả bao nhiêu, app tự cộng nợ; hoá đơn in cả nợ cũ; tab Khách có nút **Thu nợ**.
- **Kho**: nhập hàng kèm giá vốn/chai → tồn = nhập − bán, báo sắp hết.
- **Phiếu nhập hàng** (PN0001…): ghi người bán, đã trả bao nhiêu; ảnh phiếu có **mã QR vào tài khoản người bán** (mặc định Kiều Thị Nga – MB 0977929466) để quét trả tiền; theo dõi mình còn nợ người bán.
- **Thống kê**: doanh thu, lãi, số chai theo tháng; khách lấy nhiều nhất; cơ cấu loại chai.
- **Dự đoán khách sắp mua**: từ nhịp mua thật của từng khách (cần ≥ 2 lần mua), báo "còn N ngày" / "quá N ngày".

Chỉ tài khoản Google `vietthanh228@gmail.com` mở được dữ liệu (khách, nợ, giá vốn là dữ liệu riêng).

## Đang chạy thật

- Link: **https://tuongot-si.vercel.app** (web + máy chủ AI chung một project Vercel `tuongot-si`)
- Dữ liệu: Firebase project `app-from-ai`, **database riêng `tuongot-sale`** (project còn chạy bongda, edutask… — đừng dùng `(default)`).
- Đẩy code lên `main` → Vercel tự chạy test, build, deploy. Test đỏ thì không lên.
- Đổi luật Firestore: `firebase deploy --only firestore:tuongot-sale`

## Kết nối AI (MCP)

Cho Claude / Codex hỏi sổ và lên đơn bằng tài khoản chủ shop. Địa chỉ: `https://tuongot-si.vercel.app/mcp`

- Claude Code (app desktop): repo đã có `.mcp.json` → mở phiên mới trong thư mục này, gõ `/mcp` → chọn `tuongot-si` → Authenticate.
- claude.ai / điện thoại: Settings → Connectors → thêm custom connector với địa chỉ trên.
- Công cụ đọc: `tong_quan`, `tim_khach`, `xem_khach`, `danh_sach_don`, `cong_no`, `ton_kho`, `thong_ke`, `du_doan_mua_lai`.
- Công cụ ghi: `len_don`, `thu_no`, `nhap_hang` (tạo phiếu nhập, có người bán), `them_khach`, `sua_gia`. **Không có công cụ xoá.** Mọi lần ghi vào nhật ký.
- Xem máy đã cho phép, thu hồi, nhật ký: web app → ⚙️ Cài đặt → Kết nối AI.
- Biến trên Vercel: `VITE_FIREBASE_*`, `VITE_ADMIN_EMAILS` (cấu hình web) và `TUONGOT_MCP_KHOA` (bí mật, đổi = mọi máy phải kết nối lại).

## Chạy thử trên máy (không đụng dữ liệu thật)

```powershell
npm install
npm run dev:demo
```

## Kiểm thử

```powershell
npm test
```

Có test cho: tiền đơn, công nợ, nợ cũ trước một đơn, tồn kho, thống kê tháng, dự đoán mua lại, mã QR VietQR (kiểm CRC).

---

(C) August87 - 0982722036

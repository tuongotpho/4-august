# Quỹ phòng KTAT

Sổ quỹ thu – chi của phòng: chuẩn hóa từ file Excel cũ và webapp để quản lý tiếp.

## 1. Chuẩn hóa file Excel

```
python -I -X utf8 scripts/chuan_hoa.py
```

Đọc `QP-KTAT.xlsx` (sheet Thu, Chi) → ghi ra:

- `data/giao_dich.json` — dữ liệu để nhập vào webapp.
- `QP-KTAT_chuan.xlsx` — bản Excel gọn: **Giao dịch** (thu + chi chung một bảng, có cột tồn quỹ lũy kế, nhóm), **Tổng hợp tháng**, **Cần kiểm tra**.

Chuẩn hóa gồm: gộp Thu/Chi thành một bảng theo ngày; số tiền thành số nguyên; gom cột "Lưu ý = đã hoàn" thành cờ *Đã hoàn*; TM/CK thành mã; gộp tên đơn vị viết khác nhau (`Npsc` → `NPSC`…); tự xếp nhóm theo từ khóa (sửa lại được trong app); bỏ cột trống (update time, DP2, DP3, J–Z).

Cả hai file đầu ra đều bị `.gitignore` chặn — số liệu thật không lên GitHub.

## 2. Webapp (`webapp/`)

React + Vite. Logic nghiệp vụ ở `webapp/src/lib`, giao diện chỉ gọi qua `DataStore` (`store.ts`):

- **Chưa cấu hình Firebase** → `LocalStore`, lưu trong trình duyệt (chỉ máy đó thấy).
- **Có `VITE_FIREBASE_*`** (xem `webapp/.env.example`; bản thật ở `webapp/.env.local`, không đưa lên git) → đăng nhập Google, lưu Firestore — project `app-from-ai`, database **`quyphong`** — tại `users/{uid}/giao_dich/{id}` (mẫu nhập: `users/{uid}/cai_dat/mau_nhap`), quy tắc `webapp/firestore.rules` chỉ cho chủ tài khoản đọc/ghi, đồng bộ realtime giữa các máy.

```
cd webapp
npm install
npm run dev      # http://localhost:5180
npm test
npm run test:emu # thử FirestoreStore + quy tắc trên Firebase emulator (cần Java)
npm run build
```

Lần đầu mở app: bấm **Nhập JSON** → chọn `data/giao_dich.json`.

Chức năng: tồn quỹ / tổng thu / tổng chi; sổ quỹ có tồn lũy kế từng dòng; lọc theo thu/chi, nhóm, năm, tháng, tìm không dấu, lọc dòng *cần kiểm tra*; thêm / sửa / xóa (gõ tiền kiểu `1,5tr`, `500k`); thống kê theo tháng và theo nhóm; xuất CSV mở bằng Excel.

### Nhập nhanh trên điện thoại

Nút **+** tròn góc dưới → bảng **mẫu nhập** (Sinh nhật, Hoa sinh nhật 600k, Liên hoan, Chúc tết, Công tác, HĐ, Đề tài/sáng kiến, Hoa quả, Quà tặng, Chi ứng, Hiếu hỉ; bên thu: Thưởng, Hoàn ứng, Được chúc tết, Thanh toán HĐ, Ứng tiền cho phòng). Chọn mẫu → form đã điền sẵn loại, nhóm, hình thức, đầu câu nội dung; con trỏ ở ô tiền (bàn phím số), có nút tiền nhanh 200k…10tr, nút Hôm nay / Hôm qua. **Lưu + tiếp** để nhập liền nhiều khoản cùng loại.

Thêm mẫu riêng: điền form rồi bấm **☆ Làm mẫu**. Sửa mẫu (đổi tên, xóa, sắp xếp, khôi phục mặc định) trong bảng mẫu → **✎ Sửa mẫu**. Mẫu lưu theo tài khoản nên dùng chung giữa máy tính và điện thoại.

Quy tắc Firestore: `cd webapp && npm run deploy:rules` (= `firebase deploy --only firestore:quyphong`, chỉ đụng database `quyphong`). **Không** dùng `--only firestore:rules`: với database có tên, lệnh đó báo xong nhưng không tải quy tắc lên.

Triển khai: Vercel (dự án `quyphong`, *Root Directory* = `webapp`), push `main` là tự triển khai. Biến môi trường: `VITE_FIREBASE_*` và khoá bí mật `QUY_MCP_KHOA` (≥ 32 ký tự, loại sensitive; đổi khoá = mọi máy AI phải kết nối lại).

## 3. Kết nối AI (MCP)

Cho Claude xem sổ quỹ và ghi thu / chi bằng lời ("chi sinh nhật sếp Nam 3 triệu tiền mặt"). Cùng cách làm với app hoadon: máy chủ chạy trên Vercel (`webapp/api/mcp.ts` → `webapp/mcp/web.ts`), dùng **quyền tài khoản Google của chính người dùng** (Firestore REST), không giữ chìa khoá tổng.

- Địa chỉ: `https://<tên miền Vercel>/mcp` — xem và chép trong web app, nút **Kết nối AI**.
- **claude.ai / app Claude điện thoại:** Cài đặt → Connectors → Add custom connector → dán địa chỉ.
- **Claude Code:** `claude mcp add --transport http quyphong https://<tên miền>/mcp`, rồi `/mcp` → quyphong → Authenticate.
- Công cụ: `tong_quan`, `danh_sach_giao_dich`, `tong_hop`, `danh_sach_mau`, `them_giao_dich` (theo mẫu, chặn nghi trùng), `sua_giao_dich`, `xoa_giao_dich` (phải xác nhận đúng nội dung).
- Mỗi máy được cho phép là một phiên ở `users/{uid}/phienAI` — thu hồi trong **Kết nối AI**; mỗi lần AI ghi / xoá có nhật ký ở `users/{uid}/nhatKyAI`.
- Code trong `webapp/mcp/` dùng chung `webapp/src/lib` → import phải có đuôi `.js` (Vercel chạy Node ESM).

```
npm run test:emu   # emulator: FirestoreStore + vòng đầy đủ AI ↔ web app (OAuth, công cụ, thu hồi)
npm run mcp:web    # chạy thử máy chủ trên máy: http://localhost:8789/mcp (⚠️ dữ liệu thật)
```

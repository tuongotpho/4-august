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
- **Có `VITE_FIREBASE_*`** (xem `webapp/.env.example`) → đăng nhập Google, lưu Firestore tại `users/{uid}/giao_dich/{id}`, quy tắc `webapp/firestore.rules` chỉ cho chủ tài khoản đọc/ghi, đồng bộ realtime giữa các máy.

```
cd webapp
npm install
npm run dev      # http://localhost:5180
npm test
npm run build
```

Lần đầu mở app: bấm **Nhập JSON** → chọn `data/giao_dich.json`.

Chức năng: tồn quỹ / tổng thu / tổng chi; sổ quỹ có tồn lũy kế từng dòng; lọc theo thu/chi, nhóm, năm, tháng, tìm không dấu, lọc dòng *cần kiểm tra*; thêm / sửa / xóa (gõ tiền kiểu `1,5tr`, `500k`); thống kê theo tháng và theo nhóm; xuất CSV mở bằng Excel.

Triển khai: Vercel, *Root Directory* = `webapp`, thêm các biến `VITE_FIREBASE_*`.

# Chi tiêu thẻ tín dụng

Tải sao kê thẻ tín dụng VPBank (PDF, kể cả bản scan) → app tự đọc từng giao dịch → **đối chiếu với 3 con số tổng ngân hàng in** → lưu → biểu đồ theo kỳ, theo năm và nhận xét xu hướng.

- **Đọc sao kê ngay trên trình duyệt** (pdf.js + Tesseract OCR), không gửi sao kê cho dịch vụ AI nào.
- **Đối chiếu bắt buộc**: nợ phát sinh, đã thanh toán, dư nợ cuối kỳ phải khớp; lệch thì hiện từng dòng để soát / sửa tay.
- **Dữ liệu** lưu ở Vercel Blob chế độ riêng tư (`ky/<kỳ>.json`, `pdf/<kỳ>.pdf`) — repo này **không** chứa sao kê hay số liệu thật.
- **Đăng nhập** Google (Firebase Auth project `app-from-ai`), máy chủ chỉ cho email trong `ALLOWED_EMAILS`.
- Chạy chung địa chỉ cổng **app-by-lethanh.vercel.app/the-visa/**.

## Kết nối AI (MCP)

Máy chủ: `https://the-visa-lethanh.vercel.app/mcp` (khai sẵn trong `.mcp.json`). Công cụ: `tong_quan`, `danh_sach_ky`, `giao_dich`, `thong_ke_nam`, `nhan_xet` (đọc) và `doi_nhom` (ghi, đổi lại được, có nhật ký). Không có công cụ tải sao kê hay xoá kỳ.
Đăng nhập OAuth: máy chủ chuyển sang trang cho phép ngay trong web app qua cổng (`?ket-noi-ai=…`), người dùng đã đăng nhập Google sẵn; vé mã hoá bằng `VISA_MCP_KHOA`, phiên + nhật ký cất trong Blob (`mcp/phien/`, `mcp/nhat-ky/`). Thu hồi ở tab **Kết nối AI**.

## Cấu trúc

```
shared/   đọc sao kê từ chữ OCR (docSaoKe), đối chiếu, phân loại, thống kê + nhận xét — dùng chung giao diện & máy chủ
api/      hàm Vercel: /api/ky (đọc/lưu/xoá kỳ), /api/pdf (file gốc), /api/mcp (Kết nối AI), /api/mcp-phien; _lib = đăng nhập, kho Blob, vé OAuth, công cụ MCP
src/      giao diện React (Theo kỳ, Theo năm, Tải sao kê, Các kỳ đã lưu)
scripts/  docThu.ts — đọc thử ảnh trang sao kê bằng OCR trên máy và so với bản kiểm tay
tests/    test bằng dữ liệu GIẢ
```

## Biến môi trường trên Vercel

| Biến | Ý nghĩa |
|---|---|
| `ALLOWED_EMAILS` | email Google được vào, cách nhau dấu phẩy (để trống = không ai vào được) |
| `BLOB_READ_WRITE_TOKEN` | Vercel tự thêm khi nối kho Blob vào project |
| `VISA_MCP_KHOA` | khoá bí mật ≥ 32 ký tự để niêm phong vé AI (đổi khoá = mọi máy phải kết nối lại) |

## Chạy trên máy

```bash
npm ci
npm test
VITE_THU=1 npm run dev   # chế độ thử: không đăng nhập, dữ liệu chỉ nằm trong trình duyệt
```

(C) August87 - 0982722036

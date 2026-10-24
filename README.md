# 4.August — app chung gom 5 app cá nhân

Phương án và tiến độ: xem `CLAUDE.md`.

## Cấu trúc

```
apps/<ten-app>/      mỗi app một thư mục, giữ nguyên cấu trúc của repo cũ (lịch sử commit nhập bằng git subtree)
packages/            code dùng chung — chỉ thêm khi đã có ≥ 2 app dùng
```

Mỗi app tự có `package.json` + `package-lock.json` riêng (không dùng npm workspaces) để
project Vercel cũ chỉ cần đổi *Root Directory*, lệnh `npm ci` / `npm run build` giữ nguyên.

**Địa chỉ chung: https://app-by-lethanh.vercel.app** — trang cổng `apps/cong` (project Vercel `cong-4august`), chuyển tiếp ngầm `/<duong-dan>/` sang địa chỉ gốc từng app → cùng tên miền nên đăng nhập một lần.

| App | Thư mục | Root Directory trên Vercel | Địa chỉ gốc | Qua cổng |
|---|---|---|---|---|
| Quỹ phòng KTAT | `apps/quyphong` | `apps/quyphong/webapp` | quyphong.vercel.app | `/quy-phong/` |
| Lịch giảng ATLĐ | `apps/antoan` | `apps/antoan` | quanly-at.vercel.app | `/lich-giang/` |
| Bán buôn tương ớt | `apps/tuongot-si` | `apps/tuongot-si` | tuongot-si.vercel.app | `/tuong-ot/` |
| Hoá đơn NPSC | `apps/hoadon` | `apps/hoadon` | hoadon-npsc.vercel.app | `/hoa-don/` |
| Khai thuế | `apps/khaithue` | `apps/khaithue/app` | khaithue.vercel.app | `/khai-thue/` |

Mọi project Vercel có *Ignored Build Step* `git diff --quiet HEAD^ HEAD -- .` → đẩy code app nào thì chỉ app đó build.
Kiểm tra GitHub Actions: `.github/workflows/kiem-tra-<app>.yml` (hiện có tuongot-si, khaithue — như repo cũ).

(C) August87 - 0982722036

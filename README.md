# 4.August — app chung gom 5 app cá nhân

Phương án và tiến độ: xem `CLAUDE.md`.

## Cấu trúc

```
apps/<ten-app>/      mỗi app một thư mục, giữ nguyên cấu trúc của repo cũ (lịch sử commit nhập bằng git subtree)
packages/            code dùng chung — chỉ thêm khi đã có ≥ 2 app dùng
```

Mỗi app tự có `package.json` + `package-lock.json` riêng (không dùng npm workspaces) để
project Vercel cũ chỉ cần đổi *Root Directory*, lệnh `npm ci` / `npm run build` giữ nguyên.

| App | Thư mục | Root Directory trên Vercel |
|---|---|---|
| Quỹ phòng KTAT | `apps/quyphong` | `apps/quyphong/webapp` |

(C) August87 - 0982722036

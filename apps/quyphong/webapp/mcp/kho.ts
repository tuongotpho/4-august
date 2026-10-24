// Đọc / ghi sổ quỹ trên mây cho máy chủ MCP — CÙNG đường dẫn, CÙNG tên ô với web app
// (src/lib/firestore_store.ts), nên thứ AI ghi thì web app thấy ngay và ngược lại.
//
//   users/{uid}/giao_dich/{id}       từng giao dịch (không có ô id, id là tên tài liệu)
//   users/{uid}/cai_dat/mau_nhap     { ds: MauNhap[] } — chưa có = dùng mẫu mặc định
// Thêm 2 nhánh riêng cho AI (vẫn nằm trong users/{uid}, luật phân quyền cũ đã bao):
//   users/{uid}/phienAI/{maPhien}    mỗi máy / ứng dụng AI đã được cho phép — xoá = thu hồi
//   users/{uid}/nhatKyAI/{ma}        mỗi lần AI ghi / xoá: lúc nào, máy nào, làm gì

import { randomUUID } from 'node:crypto';
import { MAU_MAC_DINH, type MauNhap } from '../src/lib/mau_nhap.js';
import type { GiaoDich } from '../src/lib/types.js';
import type { DuLieu } from './congCu.js';
import type { FirebaseNguoiDung } from './firebaseRest.js';

const goc = (fb: FirebaseNguoiDung) => `users/${fb.uid}`;

export async function taiDuLieu(fb: FirebaseNguoiDung): Promise<DuLieu> {
  const [gd, mau] = await Promise.all([
    fb.docBoSuuTap<GiaoDich>(`${goc(fb)}/giao_dich`),
    fb.docTaiLieu<{ ds?: MauNhap[] }>(`${goc(fb)}/cai_dat/mau_nhap`),
  ]);
  return {
    giaoDich: gd.map(({ _id, ...g }) => ({ ...(g as GiaoDich), id: _id })),
    mau: Array.isArray(mau?.ds) ? mau.ds : MAU_MAC_DINH,
  };
}

export async function luuGiaoDich(fb: FirebaseNguoiDung, g: GiaoDich) {
  const { id, ...con } = g;
  await fb.ghi(`${goc(fb)}/giao_dich/${id}`, { ...con, capNhat: Date.now() });
}

export async function xoaGiaoDich(fb: FirebaseNguoiDung, id: string) {
  await fb.xoa(`${goc(fb)}/giao_dich/${id}`);
}

// ---------------- Phiên AI + nhật ký ----------------

export interface PhienAI {
  tenMay: string;
  ungDung: string;
  noiNhan: string; // máy nhận mã (localhost = Claude Code trên máy; claude.ai ...)
  taoLuc: string;
}

export async function taoPhien(fb: FirebaseNguoiDung, p: Omit<PhienAI, 'taoLuc'>): Promise<string> {
  const ma = randomUUID();
  await fb.ghi(`${goc(fb)}/phienAI/${ma}`, { ...p, taoLuc: new Date() });
  return ma;
}

export async function conPhien(fb: FirebaseNguoiDung, ma: string): Promise<PhienAI | null> {
  return fb.docTaiLieu<PhienAI>(`${goc(fb)}/phienAI/${ma}`);
}

export async function ghiNhatKy(fb: FirebaseNguoiDung, maPhien: string, tenMay: string, congCu: string, moTa: string) {
  // mã theo thời gian để xếp được; thêm đuôi ngẫu nhiên để không trùng
  const ma = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  await fb.ghi(`${goc(fb)}/nhatKyAI/${ma}`, { luc: new Date(), maPhien, tenMay, congCu, moTa });
}

import type { MauNhap } from './mau_nhap.js';
import type { GiaoDich } from './types.js';

/** Lớp lưu trữ chung — giao diện chỉ gọi qua đây. */
export interface DataStore {
  /** Nhận toàn bộ danh sách mỗi khi thay đổi. Trả về hàm hủy theo dõi. */
  theoDoi(cb: (ds: GiaoDich[]) => void, loi?: (e: Error) => void): () => void;
  luu(g: GiaoDich): Promise<void>;
  xoa(id: string): Promise<void>;
  /** Ghi nhiều bản ghi (nhập file). thayThe = xóa hết dữ liệu cũ trước. */
  nhap(ds: GiaoDich[], thayThe: boolean): Promise<void>;
  /** Danh sách mẫu nhập nhanh; null = chưa tùy chỉnh (dùng mẫu mặc định). */
  theoDoiMau(cb: (ds: MauNhap[] | null) => void): () => void;
  luuMau(ds: MauNhap[] | null): Promise<void>;
}

export const taoId = () => `gd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

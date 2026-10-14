import type { CaiDat, LopGiang } from '../model.js'

/** Một máy được phép ghi thay anh (hiện chỉ có bot Telegram) — xoá = thu hồi ngay */
export interface PhienMay {
  id: string
  tenMay: string
  ungDung: string
  noiNhan: string
  taoLuc: number
}

/** Một lần AI / bot ghi hoặc xoá */
export interface DongNhatKy {
  id: string
  luc: number
  tenMay: string
  congCu: string
  moTa: string
}

/**
 * "Ổ cắm chuẩn" cho việc cất dữ liệu. Giao diện CHỈ gọi qua đây, không gọi thẳng Firebase.
 * Máy chủ (bot) dùng cùng đường dẫn, cùng tên ô qua REST (server/kho.ts).
 *
 *   users/{uid}/lop/{id}        lớp giảng
 *   users/{uid}/meta/caiDat     cài đặt (bí danh đối tác, Google Calendar)
 *   users/{uid}/phien/{id}      máy được phép ghi (bot Telegram, AI qua MCP)
 *   users/{uid}/nhatKy/{id}     nhật ký mỗi lần máy đó ghi / xoá
 */
export interface DataStore {
  listLop(): Promise<LopGiang[]>
  luuLop(l: LopGiang): Promise<void>
  /** Ghi nhiều lớp một lần (nhập Excel, đánh dấu đã thanh toán hàng loạt) */
  luuNhieuLop(ds: LopGiang[]): Promise<void>
  xoaLop(id: string): Promise<void>

  getCaiDat(): Promise<CaiDat>
  luuCaiDat(c: CaiDat): Promise<void>

  listPhien(): Promise<PhienMay[]>
  thuHoiPhien(id: string): Promise<void>
  /** Các lần AI / bot ghi gần nhất, mới nhất trước */
  listNhatKy(soDong: number): Promise<DongNhatKy[]>

  /** Báo khi dữ liệu thay đổi (máy khác, bot). Trả về hàm hủy đăng ký. */
  subscribe(cb: () => void): () => void
}

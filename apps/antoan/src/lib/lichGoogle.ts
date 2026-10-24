// Đồng bộ lớp giảng lên Google Calendar của anh qua một Apps Script nhỏ (apps-script/Lich.gs) chạy bằng tài khoản Google của anh.
// Không cần xin quyền OAuth riêng cho app: script đã có sẵn quyền với lịch của chính chủ, app chỉ gọi script kèm khóa bí mật.
// Dùng chung cho web app (trình duyệt gọi thẳng) và máy chủ bot Telegram.
import { dinhDangTien, GIO_MAC_DINH, ngayCuoi, TEN_HINH_THUC, type CaiDat, type LopGiang } from './model.js'

export interface SuKien {
  tieuDe: string
  moTa: string
  diaDiem: string
  caNgay: boolean
  /** caNgay: 'YYYY-MM-DD' ngày đầu / ngày SAU ngày cuối; ngược lại: ISO có múi giờ +07:00 */
  batDau: string
  ketThuc: string
  /** để script nhận lại sự kiện AppSheet đã tạo trước đây: cùng ngày, tiêu đề có tên khách hàng */
  ngay: string
  tim: string
}

export const THE_APP = (id: string) => `[atld:${id}]`

export function suKienTu(l: LopGiang, appUrl = ''): SuKien {
  const caNgay = l.soNgay > 1 || !l.gioBD
  const kt = l.gioKT || congGio(l.gioBD || GIO_MAC_DINH[l.buoi][0], 180)
  const dong = [
    l.doiTac && `Đối tác: ${l.doiTac}`,
    l.lienHe && `Liên hệ: ${l.lienHe}`,
    `Hình thức: ${TEN_HINH_THUC[l.hinhThuc]}`,
    l.chiPhi !== null && `Thù lao: ${dinhDangTien(l.chiPhi)} đ`,
    l.noiDung && `Nội dung: ${l.noiDung}`,
    l.ghiChu && `Ghi chú: ${l.ghiChu}`,
    appUrl && `Mở trong app: ${appUrl}/?lop=${l.id}`,
    THE_APP(l.id),
  ].filter(Boolean)
  return {
    tieuDe: `${l.hinhThuc === 'online' ? '💻 ' : ''}Giảng ATLĐ – ${l.khachHang || '(chưa rõ khách hàng)'}${l.doiTac ? ` (${l.doiTac})` : ''}`,
    moTa: dong.join('\n'),
    diaDiem: l.diaDiem,
    caNgay,
    batDau: caNgay ? l.ngay : `${l.ngay}T${l.gioBD}:00+07:00`,
    ketThuc: caNgay ? ngaySau(ngayCuoi(l)) : `${ngayCuoi(l)}T${kt}:00+07:00`,
    ngay: l.ngay,
    tim: l.khachHang,
  }
}

const ngaySau = (n: string) => {
  const d = new Date(n + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

function congGio(g: string, phut: number) {
  const [h, m] = g.split(':').map(Number)
  const t = Math.min(h * 60 + m + phut, 23 * 60 + 59)
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

type YeuCau =
  | { hanhDong: 'thu' }
  | { hanhDong: 'luu'; eventId: string; suKien: SuKien }
  | { hanhDong: 'xoa'; eventId: string }

async function goi(cd: CaiDat['lich'], y: YeuCau): Promise<{ eventId?: string; ten?: string }> {
  if (!cd.url) throw new Error('Chưa cài đồng bộ Google Calendar (Cài đặt → Google Calendar)')
  // text/plain: trình duyệt gửi thẳng, không hỏi trước (Apps Script không trả lời yêu cầu "preflight")
  const r = await fetch(cd.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...y, khoa: cd.khoa }), redirect: 'follow' })
  const chu = await r.text()
  let j: { ok?: boolean; loi?: string; eventId?: string; ten?: string }
  try {
    j = JSON.parse(chu)
  } catch {
    throw new Error(`Apps Script trả về không phải JSON (${r.status}) — kiểm tra lại địa chỉ /exec và quyền "Bất kỳ ai"`)
  }
  if (!j.ok) throw new Error(`Google Calendar: ${j.loi ?? 'lỗi không rõ'}`)
  return j
}

export const thuKetNoi = (cd: CaiDat['lich']) => goi(cd, { hanhDong: 'thu' })

/**
 * Đẩy một lớp lên lịch: tạo / sửa sự kiện, lớp bị hủy thì xoá sự kiện.
 * Trả về lớp đã cập nhật eventId + canDongBo=false (người gọi tự lưu lại).
 */
export async function dongBoLop(cd: CaiDat, l: LopGiang, appUrl = ''): Promise<LopGiang> {
  if (l.huy) {
    if (l.eventId) await goi(cd.lich, { hanhDong: 'xoa', eventId: l.eventId })
    return { ...l, eventId: '', canDongBo: false }
  }
  const kq = await goi(cd.lich, { hanhDong: 'luu', eventId: l.eventId, suKien: suKienTu(l, appUrl) })
  return { ...l, eventId: kq.eventId ?? l.eventId, canDongBo: false }
}

export async function xoaSuKien(cd: CaiDat, eventId: string) {
  if (eventId && cd.lich.bat && cd.lich.url) await goi(cd.lich, { hanhDong: 'xoa', eventId })
}

export function khoaNgauNhien(): string {
  const b = new Uint8Array(24)
  crypto.getRandomValues(b)
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
}

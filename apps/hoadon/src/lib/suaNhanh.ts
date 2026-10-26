import { today } from './dates.js'
import { statusOf, suggestDnttDate, suggestToTrinhDate, type StatusKey } from './status.js'
import type { Dossier, Settings } from './types.js'

const NHAN: Partial<Record<keyof Dossier, string>> = {
  ngayToTrinh: 'ngày tờ trình',
  ngayDntt: 'ngày ĐNTT',
  ngayNopKeToan: 'ngày nộp kế toán',
  ngayKeToanTt: 'ngày kế toán thanh toán',
}

/** Trạng thái chọn được ở ô sửa nhanh (hóa đơn cũ chỉ có chưa / đã thanh toán). */
export function trangThaiChonDuoc(d: Dossier): StatusKey[] {
  return d.hoSoCu ? ['choKt', 'daTt'] : ['choLamHs', 'choNop', 'choKt', 'daTt']
}

/**
 * Đổi trạng thái hồ sơ ở ô sửa nhanh — trạng thái suy từ các ngày, nên đổi trạng thái = điền / xoá ngày:
 * - lùi bước: xoá các ngày của bước sau (xoa = tên các ngày đang có sẽ bị xoá, để hỏi lại người dùng);
 * - tiến bước: ngày còn trống thì điền ngày gợi ý (tờ trình lùi theo Cài đặt, ĐNTT / nộp / thanh toán = hôm nay).
 */
export function datTrangThai(d: Dossier, st: StatusKey, s: Settings): { moi: Dossier; xoa: string[] } {
  const moi = { ...d }
  const xoa: string[] = []
  const bo = (k: 'ngayToTrinh' | 'ngayDntt' | 'ngayNopKeToan' | 'ngayKeToanTt') => {
    if (moi[k]) xoa.push(NHAN[k]!)
    moi[k] = ''
  }
  const t = today()
  if (st === 'daTt') {
    moi.ngayKeToanTt ||= t
  } else if (st === 'choKt') {
    bo('ngayKeToanTt')
    if (!d.hoSoCu) moi.ngayNopKeToan ||= t
  } else if (st === 'choNop') {
    bo('ngayKeToanTt')
    bo('ngayNopKeToan')
    moi.ngayToTrinh ||= suggestToTrinhDate(moi, s)
    moi.ngayDntt ||= suggestDnttDate(moi)
  } else if (st === 'choLamHs') {
    bo('ngayKeToanTt')
    bo('ngayNopKeToan')
    bo('ngayDntt')
  }
  return { moi: statusOf(moi) === statusOf(d) && xoa.length === 0 && Object.keys(NHAN).every((k) => moi[k as keyof Dossier] === d[k as keyof Dossier]) ? d : moi, xoa }
}

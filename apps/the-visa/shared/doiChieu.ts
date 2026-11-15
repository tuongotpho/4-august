// Đối chiếu giao dịch đọc được với các con số tổng ngân hàng in trên sao kê.
import type { Ky } from './kieu.js'

export interface MucDoiChieu {
  ten: string
  saoKe: number
  docDuoc: number
  khop: boolean
}

export function doiChieu(ky: Ky): { muc: MucDoiChieu[]; khop: boolean } {
  const chi = -ky.giaoDich.filter((g) => g.soTien < 0).reduce((s, g) => s + g.soTien, 0)
  const co = ky.giaoDich.filter((g) => g.soTien > 0).reduce((s, g) => s + g.soTien, 0)
  const muc: MucDoiChieu[] = [
    { ten: 'Nợ phát sinh trong kỳ', saoKe: ky.phatSinh, docDuoc: chi, khop: chi === ky.phatSinh },
    { ten: 'Đã thanh toán / ghi có', saoKe: ky.daTra, docDuoc: co, khop: co === ky.daTra },
    { ten: 'Dư nợ cuối kỳ', saoKe: ky.cuoiKy, docDuoc: ky.dauKy + chi - co, khop: ky.dauKy + chi - co === ky.cuoiKy },
  ]
  return { muc, khop: muc.every((m) => m.khop) }
}

// Kiểm cấu trúc một kỳ gửi lên máy chủ trước khi lưu (không tin dữ liệu từ trình duyệt).
import { z } from 'zod'
import type { Ky } from './kieu.js'

const NGAY = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const SO = z.number().int().safe()

export const KySchema = z.object({
  id: z.string().regex(/^\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}$/),
  tu: NGAY,
  den: NGAY,
  hanMuc: SO.optional(),
  hanTra: NGAY.optional(),
  toiThieu: SO.optional(),
  dauKy: SO,
  phatSinh: SO,
  daTra: SO,
  cuoiKy: SO,
  giaoDich: z.array(z.object({
    id: z.string().max(40),
    ngay: NGAY,
    ngayHT: NGAY,
    moTa: z.string().max(200),
    soTien: SO,
    nhomTay: z.string().max(60).optional(),
    nghiSai: z.string().max(200).optional(),
  })).max(2000),
  tenFile: z.string().max(200).optional(),
  luuLuc: z.string().optional(),
}).refine((k) => k.id === `${k.tu}_${k.den}`, 'id phải là <từ>_<đến>')

export function kiemKy(x: unknown): Ky {
  return KySchema.parse(x) as Ky
}

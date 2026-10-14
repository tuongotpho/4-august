// AI đọc tin nhắn tự do (Zalo dán sang) -> dữ liệu có cấu trúc. Chỉ TRÍCH; chuẩn hóa ở src/lib/trichTin.ts.
// Dùng Gemini (khoá Google AI Studio) qua REST generateContent, ép trả JSON theo schema (responseJsonSchema).
// "Dạy" AI bằng tin mẫu trong server/mauTin.ts (few-shot: gửi kèm mỗi lần như các lượt hỏi–đáp trước đó).
import { z } from 'zod'
import { homNay, thu, type LopGiang } from '../src/lib/model.js'
import type { KetQuaAI } from '../src/lib/trichTin.js'
import type { GoiY } from '../src/lib/tinh.js'
import { MAU_TIN } from './mauTin.js'

const MO_HINH = 'gemini-3.1-flash-lite' // rẻ nhất; đổi bằng biến ATLD_GEMINI_MODEL
const GOC_API = 'https://generativelanguage.googleapis.com/v1beta'

const LopSchema = z.object({
  ngay: z.string().describe('Ngày giảng YYYY-MM-DD (ngày đầu nếu nhiều ngày)'),
  soNgay: z.number().int().describe('Số ngày liên tiếp, thường là 1'),
  gioBD: z.string().describe("Giờ bắt đầu 'HH:mm' 24h, '' nếu không nói"),
  gioKT: z.string().describe("Giờ kết thúc 'HH:mm' 24h, '' nếu không nói"),
  buoi: z.enum(['sang', 'chieu', 'toi', 'ca_ngay', 'nhieu_ngay', '']).describe("Buổi nếu tin chỉ nói buổi; '' nếu không rõ"),
  hinhThuc: z.enum(['online', 'truc_tiep', '']),
  doiTac: z.string().describe('Công ty đối tác gửi lớp (người nhắn làm cho đơn vị nào), dùng đúng tên trong danh mục nếu khớp'),
  lienHe: z.string().describe('Tên người liên hệ / người nhắn bên đối tác'),
  khachHang: z.string().describe('Đơn vị / công ty được đào tạo'),
  diaDiem: z.string().describe('Địa điểm (tỉnh/quận/địa chỉ), hoặc Online'),
  noiDung: z.string().describe('Chủ đề, nhóm huấn luyện, số học viên… ngắn gọn'),
  chiPhi: z.number().nullable().describe('Thù lao cho giảng viên, đơn vị đồng (1tr5 = 1500000); null nếu không nói'),
  ghiChu: z.string().describe('Thông tin khác đáng giữ (yêu cầu mang tài liệu, người đón…)'),
  luuY: z.string().describe("Điều không chắc để anh soát lại, vd 'tin không ghi năm', 'thứ và ngày không khớp'; '' nếu chắc"),
})

export const KetQuaSchema = z.object({
  hanhDong: z.enum(['tao_lop', 'thanh_toan', 'khac']).describe(
    "tao_lop: tin có lịch giảng (mới hoặc báo lịch); thanh_toan: anh báo đã nhận tiền; khac: hỏi han / không liên quan",
  ),
  lop: z.array(LopSchema).describe('Các lớp trong tin (một tin có thể có nhiều lớp). Rỗng nếu không phải tao_lop'),
  thanhToan: z
    .object({
      tim: z.string().describe('Tên khách hàng / đối tác / người liên hệ của lớp đã trả tiền'),
      soTien: z.number().nullable(),
      ngay: z.string().describe("Ngày nhận YYYY-MM-DD, '' = hôm nay"),
    })
    .nullable(),
  traLoi: z.string().describe("Với 'khac': một câu trả lời ngắn, tiếng Việt; còn lại ''"),
})

function heThong(gy: GoiY) {
  return [
    'Bạn đọc tin nhắn (thường chép từ Zalo) mà các công ty đối tác gửi cho một giảng viên an toàn lao động (ATLĐ) để mời giảng,',
    'và trích ra lịch giảng. Giảng viên tự dán tin vào; tin có thể chỉ là đoạn chat lộn xộn, viết tắt, không dấu.',
    '',
    'Quy ước:',
    '- "1tr5" = 1.500.000; "1.5tr" = 1.500.000; "800k" = 800.000. Thù lao là tiền trả cho GIẢNG VIÊN, không phải học phí.',
    '- "8h" = 08:00, "13h30" = 13:30, "2h chiều" = 14:00. "Sáng" ~ 08:00–11:30, "chiều" ~ 13:30–17:00, "tối" ~ 19:30–21:30, "1 ngày" = cả ngày.',
    '- Ngày tương đối ("mai", "thứ 5 tuần sau", "12/11") tính theo ngày hôm nay cho bên dưới; ngày đã qua của năm nay mà không ghi năm thì có thể là năm sau — ghi vào luuY.',
    '- Nếu tin nói "zoom/online/meet" thì hinhThuc = online.',
    '- Tin có dòng "Người gửi: X" thì X thường là người liên hệ.',
    '- "Đơn vị huấn luyện / đào tạo" = đối tác (công ty mời giảng); rút về tên ngắn trong danh mục nếu khớp, vd "CÔNG TY TNHH ĐÀO TẠO VÀ TƯ VẤN VNB" -> "VNB".',
    '- "Đơn vị tổ chức", "đơn vị học", hoặc tên công ty đứng đầu tin = khách hàng (đơn vị được đào tạo).',
    '- Người phụ trách / người đón bên khách hàng ("Phụ trách đơn vị", "Đến liên hệ …") KHÔNG phải người liên hệ: ghi vào ghiChu kèm số điện thoại.',
    '- "Đối tượng", "nhóm" (nhóm 1–6, AT44, SCC…) -> noiDung.',
    '- Dòng "Giảng viên: …" và lời gọi "@tên" là chính giảng viên (người dùng) — bỏ qua.',
    '- Không bịa: thiếu thông tin thì để trống, ghi luuY. Tin không ghi thù lao thì chiPhi = null.',
    '',
    'Danh mục đã có (ưu tiên dùng đúng cách viết này khi khớp):',
    `Đối tác: ${gy.doiTac.slice(0, 40).join(', ')}`,
    `Người liên hệ (đối tác): ${gy.lienHe.slice(0, 60).map((x) => `${x.ten} (${x.doiTac})`).join(', ')}`,
  ].join('\n')
}

// Gemini nhận một phần của JSON Schema: bỏ khoá "$schema"
const { $schema: _, ...SCHEMA_JSON } = z.toJSONSchema(KetQuaSchema) as Record<string, unknown>

const hoi = (hn: string, tin: string) => ({ role: 'user', parts: [{ text: `Hôm nay: ${thu(hn)} ${hn}.\n\nTin nhắn:\n"""\n${tin.slice(0, 6000)}\n"""` }] })

/** Thân yêu cầu gửi Gemini (tách riêng để test) */
export function yeuCauGemini(tin: string, gy: GoiY, bayGio = new Date()) {
  return {
    systemInstruction: { parts: [{ text: heThong(gy) }] },
    contents: [
      ...MAU_TIN.flatMap((m) => [hoi(m.homNay, m.tin), { role: 'model', parts: [{ text: JSON.stringify(m.ketQua) }] }]),
      hoi(homNay(bayGio), tin),
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseJsonSchema: SCHEMA_JSON,
      // việc trích thông tin đơn giản: ít suy nghĩ, trả lời nhanh
      thinkingConfig: { thinkingLevel: 'low' },
    },
  }
}

export async function trichTin(tin: string, gy: GoiY, apiKey: string, bayGio = new Date(), goi: typeof fetch = fetch): Promise<KetQuaAI> {
  const r = await goi(`${GOC_API}/models/${process.env.ATLD_GEMINI_MODEL || MO_HINH}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(yeuCauGemini(tin, gy, bayGio)),
  })
  const d = (await r.json().catch(() => ({}))) as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[]
    error?: { message?: string }
  }
  if (!r.ok) throw new Error(`Gemini báo lỗi (${r.status}): ${d.error?.message ?? 'không rõ'}`)
  const chu = d.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? '').join('') ?? ''
  const kq = KetQuaSchema.safeParse((() => { try { return JSON.parse(chu) } catch { return null } })())
  if (!kq.success) throw new Error('AI không đọc được tin nhắn này')
  return kq.data as KetQuaAI
}

/** AI sửa một lớp theo lời nhắn ("đổi sang 14h", "thù lao 2tr") — trả về lớp mới (đã trích lại các ô) */
export async function suaTheoLoi(l: LopGiang, loi: string, gy: GoiY, apiKey: string, bayGio = new Date()): Promise<KetQuaAI> {
  const hienTai = {
    ngay: l.ngay, soNgay: l.soNgay, gioBD: l.gioBD, gioKT: l.gioKT, buoi: l.buoi, hinhThuc: l.hinhThuc, doiTac: l.doiTac, lienHe: l.lienHe,
    khachHang: l.khachHang, diaDiem: l.diaDiem, noiDung: l.noiDung, chiPhi: l.chiPhi, ghiChu: l.ghiChu,
  }
  return trichTin(
    `Đây là lớp đã lưu:\n${JSON.stringify(hienTai)}\n\nGiảng viên muốn sửa: "${loi}"\n\nTrả về hanhDong=tao_lop với ĐÚNG MỘT lớp là lớp trên sau khi sửa (giữ nguyên các ô không nhắc tới).`,
    gy,
    apiKey,
    bayGio,
  )
}

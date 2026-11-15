// Máy chủ MCP "the-visa": cho Claude / Codex tra cứu chi tiêu thẻ bằng ĐÚNG phần tính toán của web app (thư mục shared/).
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Ky } from '../../shared/kieu.js'
import { doiChieu } from '../../shared/doiChieu.js'
import { DS_NHOM, dsKhoanChi, nhomTuDong } from '../../shared/phanLoai.js'
import { cong, danhSachNam, nhanXet, thongKeNam, traDungHan } from '../../shared/thongKe.js'

const HUONG_DAN = `Sổ chi tiêu thẻ tín dụng VPBank của một gia đình, dựng từ các kỳ sao kê (mỗi kỳ ~ 1 tháng, ví dụ 21/09–20/10).
- Tiền: đồng (VND), số nguyên. Ngày: yyyy-mm-dd.
- Mỗi KỲ có số ngân hàng in: dauKy, phatSinh (nợ phát sinh), daTra (đã thanh toán / ghi có), cuoiKy (dư nợ cuối kỳ), hanTra, toiThieu. "khop" = các giao dịch cộng lại đúng bằng số ngân hàng in.
- KHOẢN CHI: giao dịch âm trên sao kê. Trả nợ thẻ ("Virtual Card payment") KHÔNG phải chi tiêu. Hoàn tiền của cửa hàng ("Credit VNM …") là khoản chi âm (trừ vào chi).
- Mỗi khoản chi có NHÓM (Xăng xe, Siêu thị & tạp hoá, Bảo hiểm…). Nhóm tự phân loại theo mô tả; người dùng có thể đã chọn tay.
- Thống kê năm tính theo NGÀY GIAO DỊCH (không theo kỳ). Năm chưa đủ 12 tháng thì nói rõ là mới có các tháng nào.
- Bắt đầu bằng tong_quan. Số liệu chỉ lấy từ công cụ — thiếu thì nói thiếu, KHÔNG đoán. Không đưa lời khuyên đầu tư / tài chính.
- Công cụ ghi duy nhất: doi_nhom (đổi nhóm một giao dịch) — chỉ gọi khi người dùng yêu cầu rõ; đổi lại được bất cứ lúc nào. Mọi lần ghi được ghi nhật ký.
- Tải sao kê mới, xoá kỳ: làm trên web app, không có công cụ.`

const json = (x: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(x, null, 1) }] })
type KetQua = { content: { type: 'text'; text: string }[]; isError?: boolean }

export interface NguonMcp {
  dsKy(): Promise<Ky[]>
  luuKy(ky: Ky): Promise<void>
  nhatKy(congCu: string, moTa: string): Promise<void>
}

export function taoMayChu(nguon: NguonMcp) {
  const server = new McpServer({ name: 'the-visa', version: '1.0.0' }, { instructions: HUONG_DAN })
  let tai: Promise<Ky[]> | null = null
  const lay = () => (tai ??= nguon.dsKy())

  const boc = <A,>(fn: (ky: Ky[], a: A) => unknown | Promise<unknown>) => async (a: A): Promise<KetQua> => {
    try {
      return json(await fn(await lay(), a))
    } catch (e) {
      return { content: [{ type: 'text', text: (e as Error).message }], isError: true }
    }
  }
  const chiKy = (ky: Ky[], k: Ky) => cong(dsKhoanChi([k]))

  server.registerTool('tong_quan', {
    title: 'Tổng quan',
    description: 'Số kỳ đã lưu, kỳ mới nhất (dư nợ, hạn trả), tổng chi, danh sách nhóm và các năm có dữ liệu. Gọi đầu tiên.',
    inputSchema: {},
    annotations: { readOnlyHint: true },
  }, boc((ky) => {
    const moi = ky[ky.length - 1]
    const tong = cong(dsKhoanChi(ky))
    return {
      soKy: ky.length,
      tuNgay: ky[0]?.tu ?? null,
      denNgay: moi?.den ?? null,
      tongChi: tong,
      trungBinhMoiKy: ky.length ? Math.round(tong / ky.length) : 0,
      kyMoiNhat: moi ? { id: moi.id, tu: moi.tu, den: moi.den, chi: chiKy(ky, moi), cuoiKy: moi.cuoiKy, hanTra: moi.hanTra, toiThieu: moi.toiThieu, hanMuc: moi.hanMuc } : null,
      kyTraDuTruocHan: (() => { const t = traDungHan(ky); return `${t.filter((x) => x.du).length}/${t.length}` })(),
      nhom: DS_NHOM,
      nam: danhSachNam(ky),
    }
  }))

  server.registerTool('danh_sach_ky', {
    title: 'Các kỳ sao kê',
    description: 'Mọi kỳ sao kê: tổng chi, số ngân hàng in (phát sinh, đã trả, dư nợ cuối kỳ, hạn trả), đối chiếu khớp chưa, đã trả đủ trước hạn chưa.',
    inputSchema: {},
    annotations: { readOnlyHint: true },
  }, boc((ky) => {
    const th = new Map(traDungHan(ky).map((x) => [x.ky.id, x]))
    return ky.map((k) => ({
      id: k.id, tu: k.tu, den: k.den, soGiaoDich: k.giaoDich.length, chi: chiKy(ky, k),
      phatSinh: k.phatSinh, daTra: k.daTra, cuoiKy: k.cuoiKy, hanTra: k.hanTra, toiThieu: k.toiThieu,
      khopTongNganHang: doiChieu(k).khop,
      traDuTruocHan: th.has(k.id) ? th.get(k.id)!.du : 'chờ sao kê kỳ sau',
    }))
  }))

  server.registerTool('giao_dich', {
    title: 'Tra giao dịch',
    description: 'Lọc khoản chi theo kỳ / năm / tháng / nhóm / từ khoá. Trả danh sách (mới nhất trước) + tổng tiền của TẤT CẢ dòng khớp.',
    inputSchema: {
      ky_id: z.string().optional().describe('id kỳ, vd 2026-09-21_2026-10-20'),
      nam: z.number().int().optional(),
      thang: z.number().int().min(1).max(12).optional().describe('cần kèm nam'),
      nhom: z.string().optional().describe('đúng tên nhóm trong tong_quan.nhom'),
      tim: z.string().optional().describe('tìm trong mô tả / nơi chi, không phân biệt hoa thường'),
      gioi_han: z.number().int().min(1).max(500).optional().describe('số dòng trả về, mặc định 100'),
    },
    annotations: { readOnlyHint: true },
  }, boc((ky, a: { ky_id?: string; nam?: number; thang?: number; nhom?: string; tim?: string; gioi_han?: number }) => {
    const t = a.tim?.toLowerCase()
    const tienTo = a.nam ? `${a.nam}-${a.thang ? String(a.thang).padStart(2, '0') : ''}` : ''
    const ds = dsKhoanChi(ky)
      .filter((x) => (!a.ky_id || x.kyId === a.ky_id) && (!tienTo || x.ngay.startsWith(tienTo)) && (!a.nhom || x.nhom === a.nhom)
        && (!t || `${x.g.moTa} ${x.ten}`.toLowerCase().includes(t)))
      .sort((x, y) => y.ngay.localeCompare(x.ngay))
    return {
      soDong: ds.length,
      tong: cong(ds),
      dong: ds.slice(0, a.gioi_han ?? 100).map((x) => ({
        ky_id: x.kyId, gd_id: x.g.id, ngay: x.ngay, noi_chi: x.ten, mo_ta: x.g.moTa, nhom: x.nhom,
        nhom_tu_chon: !!x.g.nhomTay, khu_vuc: x.khuVuc, tien: x.tien,
      })),
    }
  }))

  server.registerTool('thong_ke_nam', {
    title: 'Thống kê năm',
    description: 'Thống kê một năm dương lịch theo ngày giao dịch: tổng, từng tháng, theo nhóm, nơi chi nhiều nhất, so với năm trước.',
    inputSchema: { nam: z.number().int().describe('vd 2026') },
    annotations: { readOnlyHint: true },
  }, boc((ky, a: { nam: number }) => {
    const t = thongKeNam(ky, a.nam)
    return {
      nam: t.nam, tong: t.tong, soGiaoDich: t.soGiaoDich,
      coDuLieuTuThang: t.tuThang, denThang: t.denThang, soThangCoDuLieu: t.soThangCoDuLieu,
      theoThang: Object.fromEntries(t.thang.map((v, i) => [i + 1, v]).filter(([, v]) => v)),
      theoNhom: Object.fromEntries(t.theoNhom),
      noiChiNhieuNhat: t.theoTen.slice(0, 10),
      tongNamTruoc: t.tongNamTruoc || null,
    }
  }))

  server.registerTool('nhan_xet', {
    title: 'Nhận xét xu hướng',
    description: 'Các nhận xét tự động giống trên web app: kỳ mới nhất so với kỳ trước, hạn trả, nhóm tăng/giảm, khoản lặp lại, khoản lớn, trả nợ đúng hạn.',
    inputSchema: {},
    annotations: { readOnlyHint: true },
  }, boc((ky) => nhanXet(ky)))

  server.registerTool('doi_nhom', {
    title: 'Đổi nhóm một giao dịch',
    description: 'GHI: đổi nhóm của MỘT giao dịch (lấy ky_id, gd_id từ công cụ giao_dich). nhom = "tự động" để trả về nhóm tự phân loại. Chỉ gọi khi người dùng yêu cầu rõ.',
    inputSchema: {
      ky_id: z.string(),
      gd_id: z.string(),
      nhom: z.string().describe(`một trong: ${DS_NHOM.join(', ')}, hoặc "tự động"`),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  }, boc(async (ky, a: { ky_id: string; gd_id: string; nhom: string }) => {
    const k = ky.find((x) => x.id === a.ky_id)
    if (!k) throw new Error(`Không có kỳ ${a.ky_id}`)
    const g = k.giaoDich.find((x) => x.id === a.gd_id)
    if (!g) throw new Error(`Không có giao dịch ${a.gd_id} trong kỳ ${a.ky_id}`)
    const tuDong = a.nhom.trim().toLowerCase() === 'tự động'
    if (!tuDong && !DS_NHOM.includes(a.nhom)) throw new Error(`Nhóm "${a.nhom}" không có. Chọn một trong: ${DS_NHOM.join(', ')}`)
    const cu = g.nhomTay || nhomTuDong(g.moTa)
    const moi = tuDong ? nhomTuDong(g.moTa) : a.nhom
    const kyMoi: Ky = { ...k, giaoDich: k.giaoDich.map((x) => (x.id === g.id ? { ...x, nhomTay: moi === nhomTuDong(x.moTa) ? undefined : moi } : x)) }
    await nguon.luuKy(kyMoi)
    await nguon.nhatKy('doi_nhom', `${g.ngay} ${g.moTa} ${-g.soTien}đ: ${cu} → ${moi}`)
    tai = null
    return { ok: true, ngay: g.ngay, moTa: g.moTa, tu: cu, thanh: moi }
  }))

  return server
}

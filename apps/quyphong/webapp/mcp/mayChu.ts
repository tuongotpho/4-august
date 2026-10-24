// Máy chủ MCP "quyphong": cho Claude Code / Claude Desktop / claude.ai / Codex… tra cứu và ghi sổ quỹ phòng
// bằng ĐÚNG phần tính toán của web app. Dữ liệu là dữ liệu thật trên mây (Firebase của chính người dùng).

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as cc from './congCu.js';
import type { DuLieu, NoiGhi } from './congCu.js';

const HUONG_DAN = `Sổ quỹ phòng Kỹ thuật An toàn (KTAT): mỗi GIAO DỊCH là một khoản THU (tiền vào quỹ: thưởng, hoàn ứng, được chúc tết, thanh toán hóa đơn…) hoặc CHI (sinh nhật, liên hoan, chúc tết, công tác, đề tài/sáng kiến…).
- Tiền: đồng (VND), số nguyên. Ngày: yyyy-mm-dd, giờ Việt Nam. Tồn quỹ = tổng thu − tổng chi, có thể âm.
- Mỗi giao dịch thuộc một NHÓM cố định (xem nhom_thu / nhom_chi trong tong_quan). hinh_thuc: CK = chuyển khoản, TM = tiền mặt.
- CÔNG NỢ ỨNG (cong_no): thu nhóm "Ứng, vay" = người ứng tiền cho phòng (phòng phải trả); chi nhóm "Ứng, vay, trả" = phòng ứng tiền cho người (phải thu hồi). Dòng trả / hoàn ghi hoan_cho = id khoản ứng; da_hoan = khoản ứng cũ coi như đã xong.
- MẪU NHẬP (danh_sach_mau): khoản hay gặp đã điền sẵn loại, nhóm, hình thức — người dùng nói "sinh nhật sếp Nam 3 triệu" thì dùng mẫu "Sinh nhật".
- Bắt đầu bằng tong_quan. Số liệu chỉ lấy từ dữ liệu — thiếu thì nói thiếu, KHÔNG đoán.
- Công cụ ghi (them_giao_dich, sua_giao_dich, xoa_giao_dich) thay đổi dữ liệu THẬT — chỉ gọi khi người dùng yêu cầu rõ. them_giao_dich báo lại nếu nghi trùng: hỏi người dùng trước khi gửi lại với bo_qua_trung=true.
- xoa_giao_dich không hoàn tác được: hỏi người dùng, được đồng ý mới gửi xac_nhan = đúng nội dung giao dịch.
- Mọi lần ghi được ghi nhật ký; người dùng xem và thu hồi quyền của máy này trên web app (Kết nối AI).`;

const json = (x: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(x, null, 1) }] });
type KetQua = { content: { type: 'text'; text: string }[]; isError?: boolean };

/** Nguồn dữ liệu cắm vào máy chủ: đọc (tải 1 lần mỗi yêu cầu) và chỗ ghi */
export interface NguonMcp {
  lay(): Promise<DuLieu>;
  ghi: NoiGhi;
}

const loai = z.enum(['thu', 'chi']);
const hinhThuc = z.enum(['CK', 'TM', '']).describe('CK = chuyển khoản, TM = tiền mặt, "" = chưa rõ');
const ngay = z.string().describe('yyyy-mm-dd');
const soTien = z.union([z.number(), z.string()]).describe('Số đồng, vd 1500000; hoặc chữ "1,5tr", "500k"');

export function taoMayChu(nguon: NguonMcp) {
  const server = new McpServer({ name: 'quyphong', version: '1.0.0' }, { instructions: HUONG_DAN });

  // Bọc mọi công cụ: lỗi do người dùng/dữ liệu thì trả lời rõ ràng (isError) thay vì làm sập máy chủ
  const boc =
    <A,>(fn: (d: DuLieu, a: A) => unknown) =>
    async (a: A): Promise<KetQua> => {
      try {
        return json(await fn(await nguon.lay(), a));
      } catch (e) {
        return { ...json({ loi: (e as Error).message }), isError: true };
      }
    };
  const chiDoc = { readOnlyHint: true, openWorldHint: false } as const;
  const ghiDuoc = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;

  server.registerTool(
    'tong_quan',
    {
      title: 'Tổng quan sổ quỹ',
      description: 'Tồn quỹ, tổng thu / chi (toàn bộ, năm nay, tháng này), số giao dịch cần kiểm tra (thiếu tiền, thiếu TM/CK), 8 giao dịch gần nhất, và danh sách nhóm thu / chi hợp lệ. Gọi đầu tiên.',
      inputSchema: {},
      annotations: chiDoc,
    },
    boc((d) => cc.tongQuan(d)),
  );

  server.registerTool(
    'danh_sach_giao_dich',
    {
      title: 'Tìm / lọc giao dịch',
      description: 'Lọc sổ quỹ theo loại, nhóm, năm/tháng, khoảng ngày, từ khoá (nội dung, người, ghi chú — tìm không dấu được), cần kiểm tra, đã hoàn. Trả tổng thu/chi của TOÀN BỘ kết quả và tối đa gioi_han dòng (mới nhất trước), mỗi dòng có id và tồn quỹ sau dòng đó.',
      inputSchema: {
        loai: loai.optional(),
        nhom: z.string().optional(),
        nam: z.number().int().min(2000).max(2100).optional(),
        thang: z.number().int().min(1).max(12).optional(),
        tu_ngay: ngay.optional(),
        den_ngay: ngay.optional(),
        tim: z.string().optional().describe('Từ khoá, vd "sinh nhat", "Thái tộc"'),
        can_kiem_tra: z.boolean().optional().describe('true = chỉ dòng có cảnh báo: thiếu số tiền / ngày / TM-CK, nhóm "Khác" lớn, ứng quá hạn chưa hoàn…'),
        da_hoan: z.boolean().optional(),
        gioi_han: z.number().int().min(1).max(500).optional().describe('Mặc định 50'),
        cu_truoc: z.boolean().optional().describe('true = cũ nhất trước'),
      },
      annotations: chiDoc,
    },
    boc(cc.danhSachGiaoDich),
  );

  server.registerTool(
    'tong_hop',
    {
      title: 'Tổng hợp theo tháng và nhóm',
      description: 'Thu / chi / chênh lệch / tồn cuối tháng từng tháng, và thu, chi theo nhóm (số lần, số tiền). Bỏ trống nam = toàn bộ sổ.',
      inputSchema: { nam: z.number().int().min(2000).max(2100).optional() },
      annotations: chiDoc,
    },
    boc(cc.tongHop),
  );

  server.registerTool(
    'cong_no',
    {
      title: 'Công nợ tiền ứng',
      description:
        'Phòng đang nợ ai (người ứng tiền cho phòng, chưa trả) và ai đang giữ tiền phòng (phòng ứng ra, chưa hoàn): từng khoản với id, số tiền, đã trả, còn lại, số ngày; tổng hai chiều và tồn quỹ nếu thanh toán hết.',
      inputSchema: { ca_da_xong: z.boolean().optional().describe('true = kèm cả khoản đã trả / hoàn xong') },
      annotations: chiDoc,
    },
    boc(cc.congNoUng),
  );

  server.registerTool(
    'danh_sach_mau',
    {
      title: 'Mẫu nhập nhanh',
      description: 'Các mẫu nhập người dùng đang dùng (giống nút + trên điện thoại): tên, loại, nhóm, đầu câu nội dung, hình thức, số tiền cố định nếu có.',
      inputSchema: {},
      annotations: chiDoc,
    },
    boc((d) => cc.danhSachMau(d)),
  );

  server.registerTool(
    'them_giao_dich',
    {
      title: 'Ghi một khoản thu / chi',
      description: 'Thêm MỘT giao dịch vào sổ quỹ. Nên dùng mau (tên hoặc id mẫu) để tự điền loại, nhóm, hình thức; ô nào gửi kèm sẽ đè lên mẫu. noi_dung là câu ĐẦY ĐỦ (vd "Sinh nhật sếp Nam"). Không gửi ngay = hôm nay (giờ VN). Nghi trùng thì KHÔNG ghi mà trả nghi_trung.',
      inputSchema: {
        mau: z.string().optional().describe('Tên mẫu, vd "Sinh nhật", "Hoa sinh nhật", "Thưởng"'),
        loai: loai.optional().describe('Bắt buộc nếu không dùng mẫu (mặc định chi)'),
        ngay: ngay.optional(),
        so_tien: soTien.optional(),
        noi_dung: z.string().optional(),
        nhom: z.string().optional().describe('Phải nằm trong nhom_thu / nhom_chi'),
        hinh_thuc: hinhThuc.optional(),
        doi_tuong: z.string().optional().describe('Thu: đơn vị / người nộp. Chi: người nhận'),
        ghi_chu: z.string().optional(),
        da_hoan: z.boolean().optional(),
        hoan_cho: z.string().optional().describe('id khoản ứng (từ cong_no) mà khoản này trả / thu hồi'),
        bo_qua_trung: z.boolean().optional().describe('true = vẫn ghi dù nghi trùng (chỉ khi người dùng đã đồng ý)'),
      },
      annotations: { ...ghiDuoc, idempotentHint: false },
    },
    boc((d, a: cc.ThamSoThem) => cc.themGiaoDich(d, nguon.ghi, a)),
  );

  server.registerTool(
    'sua_giao_dich',
    {
      title: 'Sửa một giao dịch',
      description: 'Đổi các ô của MỘT giao dịch (chỉ gửi ô cần đổi), vd bổ sung số tiền, ghi TM/CK, đánh dấu đã hoàn, đổi nhóm. so_tien = null để xoá số tiền. Trả danh sách thay đổi và tồn quỹ mới.',
      inputSchema: {
        id: z.string().describe('id giao dịch (lấy từ danh_sach_giao_dich)'),
        loai: loai.optional(),
        ngay: ngay.optional(),
        so_tien: soTien.nullable().optional(),
        noi_dung: z.string().optional(),
        nhom: z.string().optional(),
        hinh_thuc: hinhThuc.optional(),
        doi_tuong: z.string().optional(),
        ghi_chu: z.string().optional(),
        da_hoan: z.boolean().optional(),
        hoan_cho: z.string().optional().describe('id khoản ứng mà dòng này trả / thu hồi; "" = bỏ liên kết'),
      },
      annotations: { ...ghiDuoc, idempotentHint: true },
    },
    boc((d, a: cc.ThamSoSua) => cc.suaGiaoDich(d, nguon.ghi, a)),
  );

  server.registerTool(
    'xoa_giao_dich',
    {
      title: 'XOÁ một giao dịch (không hoàn tác)',
      description: 'Xoá hẳn MỘT giao dịch. KHÔNG hoàn tác được. Bắt buộc: hỏi người dùng trước, nêu đúng nội dung + số tiền + ngày; chỉ khi họ đồng ý mới gửi xac_nhan = đúng nội dung giao dịch. Gửi sai xac_nhan thì không xoá và trả về chuỗi cần xác nhận.',
      inputSchema: { id: z.string(), xac_nhan: z.string().describe('Đúng bằng nội dung giao dịch') },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    boc((d, a: { id: string; xac_nhan: string }) => cc.xoaGiaoDich(d, nguon.ghi, a)),
  );

  return server;
}

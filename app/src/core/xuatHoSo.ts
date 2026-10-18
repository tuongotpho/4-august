// XUẤT TOÀN BỘ HỒ SƠ để lưu trữ ngoài app (hồ sơ thuế, hoá đơn, chứng từ phải giữ 10 năm).
// Phần này KHÔNG phụ thuộc thư viện: dựng danh sách file gốc cần đóng gói + các bảng tổng hợp (mảng dòng)
// — web app (may/xuatHoSo.ts) tải file, ghi Excel và nén ZIP.

import type { Kho } from './kho.js'
import { tenKy } from './kho.js'
import { tinhDoiTac, tinhTongQuan } from './tongQuan.js'
import { tongHopLo, TEN_GIAY_TO } from './loHang.js'
import { tinhCongNo, type SaoKe } from './saoKe.js'
import { lapSoQuy, QUY_TRONG, TEN_NHOM_PHIEU } from './soQuy.js'
import { TEN_NHOM, nhomHoaDon } from './hoaDonGoc.js'

type O = string | number | null

/** Tên an toàn cho thư mục / file trong ZIP (Windows không nhận : * ? " < > |) */
export const tenAnToanZip = (s: string) => s.normalize('NFC').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120) || 'khong-ten'

/** Một file gốc trên mây cần đóng gói */
export interface TepCanXuat {
  duongDan: string // đường dẫn trên Storage
  trongZip: string // đường dẫn trong ZIP
}

/** Dữ liệu tối thiểu từ mây (cùng dạng DuLieuMay của web app / máy chủ) */
export interface NguonXuat {
  toKhai: { mst: string; ky: string; tenFile: string; duongDan: string; loaiTKhai?: string; soLan?: number }[]
  chungTu: { mst: string; ngay: string; so: string; tenFile: string; duongDan: string }[]
  tepHoaDon: Record<string, { ten: string; ky: string; duongDan: string }[]>
  daXuat: Record<string, { tenFile: string; ky: string; duongDan: string }[]>
  loHang: { mst: string; lo: { ten: string; giayTo: { ten: string; duongDan: string; loai: string }[] } }[]
  saoKe: { mst: string; sk: SaoKe & { duongDan?: string } }[]
}

/** Danh sách file gốc của MỘT công ty, xếp vào thư mục dễ đọc. Trùng tên trong cùng thư mục thì đánh số. */
export function danhSachTepXuat(n: NguonXuat, mst: string): TepCanXuat[] {
  const kq: TepCanXuat[] = []
  const daCo = new Set<string>()
  const them = (duongDan: string | undefined, thuMuc: string, ten: string) => {
    if (!duongDan) return
    let p = `${thuMuc}/${tenAnToanZip(ten)}`
    for (let i = 2; daCo.has(p.toLowerCase()); i++) p = `${thuMuc}/${tenAnToanZip(ten).replace(/(\.[^.]+)?$/, ` (${i})$1`)}`
    daCo.add(p.toLowerCase())
    kq.push({ duongDan, trongZip: p })
  }
  const ky = (k: string) => (k ? tenAnToanZip(k) : 'khong-ro-ky')
  for (const t of n.toKhai.filter((x) => x.mst === mst)) them(t.duongDan, `1-To-khai/${ky(t.ky)}`, t.tenFile)
  for (const c of n.chungTu.filter((x) => x.mst === mst)) them(c.duongDan, `2-Chung-tu-nop-tien/${c.ngay.slice(6, 10) || 'khong-ro-nam'}`, c.tenFile)
  for (const h of n.tepHoaDon[mst] ?? []) them(h.duongDan, `3-Hoa-don/${ky(h.ky)}`, h.ten)
  for (const x of n.daXuat[mst] ?? []) them(x.duongDan, `4-To-khai-app-da-xuat/${ky(x.ky)}`, x.tenFile)
  for (const { lo } of n.loHang.filter((x) => x.mst === mst)) for (const g of lo.giayTo) them(g.duongDan, `5-Lo-hang/${tenAnToanZip(lo.ten)}`, `${g.loai}-${g.ten}`)
  for (const { sk } of n.saoKe.filter((x) => x.mst === mst)) them(sk.duongDan, '6-Sao-ke', sk.tenFile)
  return kq
}

/** Các bảng tổng hợp (mỗi bảng = 1 sheet Excel) của MỘT công ty */
export function bangTongHop(kho: Kho, mst: string, homNay = new Date()): Record<string, O[][]> {
  const tq = tinhTongQuan(kho, mst, homNay)
  const bang: Record<string, O[][]> = {}
  const hs = kho.congTy[mst]?.hoSo
  bang['Thong tin'] = [
    ['Tên người nộp thuế', hs?.tenNNT ?? ''], ['MST', mst], ['Địa chỉ', hs?.dchiNNT ?? ''], ['Cơ quan thuế', hs?.tenCQTNoiNop ?? ''],
    ['Xuất lúc', homNay.toLocaleString('vi-VN')], ['Nguồn', 'App kê khai thuế (khaithue) — số liệu lấy từ file người dùng đã nạp'],
  ]
  bang['Tong quan quy'] = [
    ['Quý', 'Hạn nộp', 'Có tờ khai', 'Doanh thu [34]', 'Phải nộp [40]', 'Đã nộp (chứng từ)', 'Chuyển kỳ sau [43]', 'HĐ bán: số', 'HĐ bán: chưa thuế', 'HĐ mua: số', 'HĐ mua: chưa thuế'],
    ...tq.quy.map((q) => [tenKy(q.khoa), q.hanNop, q.hieuLuc ? 'có' : 'chưa', q.hieuLuc?.ct34 ?? null, q.phaiNop, q.daNop, q.hieuLuc?.ct43 ?? null, q.hoaDon?.ban.n ?? null, q.hoaDon?.ban.v ?? null, q.hoaDon?.mua.n ?? null, q.hoaDon?.mua.v ?? null] as O[]),
  ]
  bang['Can xu ly'] = [['Mức', 'Nội dung'], ...tq.canhBao.map((c) => [c.muc === 'loi' ? 'LỖI' : 'Chú ý', c.noiDung] as O[])]
  bang['Hoa don'] = [
    ['Chiều', 'Ký hiệu', 'Số', 'Ngày', 'MST đối tác', 'Tên đối tác', 'Chưa thuế', 'Thuế', 'Trạng thái', 'Có file gốc', 'Nhóm hàng', 'Số lượng (dòng hàng)'],
    ...Object.entries(kho.hoaDon?.[mst] ?? {})
      .sort(([, a], [, b]) => a.ng.split('/').reverse().join('').localeCompare(b.ng.split('/').reverse().join('')))
      .map(([k, g]) => {
        const goc = kho.goc?.[mst]?.[k]
        return [g.l === 'ban' ? 'Bán ra' : 'Mua vào', g.kh, g.so, g.ng, (g.l === 'mua' ? g.mb : g.mm) ?? '', g.ten, g.v, g.t, g.tt,
          goc ? goc.nguon.toUpperCase() : (g.x ? 'file lẻ' : ''), goc ? TEN_NHOM[nhomHoaDon(goc, mst)] : '',
          goc ? goc.dong.map((d) => `${d.sl} ${d.dvt}`).join('; ') : ''] as O[]
      }),
  ]
  const dt = tinhDoiTac(kho, mst, null)
  bang['Doi tac'] = [
    ['Chiều', 'MST', 'Tên', 'Số HĐ', 'Chưa thuế', 'Thuế', 'Tỷ trọng', 'Lần gần nhất'],
    ...dt.ban.map((d) => ['Khách hàng', d.mst, d.ten, d.n, d.v, d.t, Math.round(d.tyTrong * 1000) / 10, d.cuoi] as O[]),
    ...dt.mua.map((d) => ['Nhà cung cấp', d.mst, d.ten, d.n, d.v, d.t, Math.round(d.tyTrong * 1000) / 10, d.cuoi] as O[]),
  ]
  const lo = tongHopLo(kho, mst, Object.values(kho.loHang?.[mst] ?? {}))
  bang['Lo hang'] = [
    ['Lô', 'Từ ngày', 'Đến ngày', 'NCC', 'Bên mua', 'Tấn mua', 'Tấn bán', 'Giá vốn', 'Cước', 'Chi phí khác', 'Doanh thu', 'Lãi gộp', 'Giấy tờ có', 'Giấy tờ thiếu', 'Hoá đơn'],
    ...lo.lo.map((k) => [k.lo.ten, k.tuNgay, k.denNgay, k.nhaCungCap.join(', '), k.benMua.join(', '), k.tanMua, k.tanBan, k.giaVon, k.cuoc, k.chiPhiKhac, k.doanhThu, k.laiGop,
      k.lo.giayTo.map((g) => `${TEN_GIAY_TO[g.loai]}: ${g.ten}`).join('; '), k.giayToThieu.map((l) => TEN_GIAY_TO[l]).join(', '),
      k.hoaDon.map((h) => `${h.kh}-${h.so}`).join(', ')] as O[]),
  ]
  const quy = kho.soQuy?.[mst] ?? QUY_TRONG()
  const sq = lapSoQuy(kho, mst, quy)
  bang['So quy tien mat'] = [
    ['Tồn đầu kỳ', quy.caiDat.tonDau, 'tính tới', quy.caiDat.ngayTonDau],
    ['Ngày', 'Số phiếu', 'Loại', 'Nhóm', 'Nội dung', 'Đối tác', 'Hoá đơn', 'Thu', 'Chi', 'Tồn'],
    ...sq.dong.map((d) => [d.ngay, d.so, d.loai === 'thu' ? 'Thu' : 'Chi', TEN_NHOM_PHIEU[d.nhom], d.noiDung, d.doiTac, d.hoaDon.map((x) => x.split('|').slice(2).join('-')).join(', '), d.thu || null, d.chi || null, d.ton] as O[]),
  ]
  const cn = tinhCongNo(kho, mst, Object.values(kho.saoKe?.[mst] ?? {}), 120, sq.daTraTheoHoaDon)
  bang['Cong no'] = [
    ['Chiều', 'MST', 'Tên', 'Số HĐ', 'Tiền hoá đơn', 'Đã thanh toán', 'Còn nợ'],
    ...cn.doiTac.map((d) => [d.l === 'ban' ? 'Phải thu' : 'Phải trả', d.mst, d.ten, d.soHoaDon, d.tongHoaDon, d.daThanhToan, d.conNo] as O[]),
  ]
  bang['Chung tu nop tien'] = [
    ['Số', 'Ngày', 'Tổng tiền', 'Nội dung'],
    ...Object.values(kho.chungTu?.[mst] ?? {}).map((c) => [c.so, c.ngay, c.tong, c.dong.map((d) => `${d.ndkt} ${d.kyThue}: ${d.tien}`).join('; ')] as O[]),
  ]
  return bang
}

/** Ghi chú đặt ở gốc ZIP */
export function docTruocZip(tenCty: string, mst: string, soTep: number, soTepLoi: number, homNay = new Date()): string {
  return [
    `HỒ SƠ THUẾ — ${tenCty} (MST ${mst})`,
    `Xuất từ app kê khai thuế lúc ${homNay.toLocaleString('vi-VN')}.`,
    '',
    'Trong gói:',
    '  0-Tong-hop.xlsx              bảng tổng hợp đọc bằng Excel (tổng quan quý, hoá đơn, đối tác, lô hàng, sổ quỹ, công nợ, chứng từ)',
    '  0-Du-lieu-app.json           bản sao toàn bộ dữ liệu app (để nạp lại / chuyển sang phần mềm khác)',
    '  1-To-khai/<kỳ>/              tờ khai XML đã nộp',
    '  2-Chung-tu-nop-tien/<năm>/   giấy nộp tiền',
    '  3-Hoa-don/<kỳ>/              danh sách hoá đơn Excel + hoá đơn gốc XML/PDF',
    '  4-To-khai-app-da-xuat/       XML tờ khai app đã lập (chưa ký)',
    '  5-Lo-hang/<lô>/              giấy tờ chứng minh lô hàng',
    '  6-Sao-ke/                    sao kê ngân hàng',
    '',
    `Số file gốc: ${soTep}${soTepLoi ? ` (${soTepLoi} file không tải được — xem 0-Loi-tai.txt)` : ''}.`,
    'Hồ sơ thuế, hoá đơn, chứng từ kế toán phải lưu trữ tối thiểu 10 năm. Nên chép gói này ra ổ cứng / USB và một nơi lưu trữ khác.',
  ].join('\r\n')
}


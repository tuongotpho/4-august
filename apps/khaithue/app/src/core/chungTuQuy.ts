// CHỨNG TỪ QUỸ theo chế độ kế toán DN nhỏ và vừa (Thông tư 133/2016/TT-BTC, Phụ lục 3 & 4):
//   Phiếu thu 01-TT, Phiếu chi 02-TT, Sổ quỹ tiền mặt S07-DNN, Sổ tiền gửi ngân hàng S08-DNN.
// Trường hợp công ty nhỏ: GIÁM ĐỐC KIÊM THỦ QUỸ, tài khoản cá nhân của thủ quỹ dùng như két tiền mặt —
//   công ty chuyển cho thủ quỹ  = rút tiền gửi về quỹ  -> PHIẾU THU (Nợ 1111 / Có 1121)
//   thủ quỹ chuyển vào công ty  = nộp tiền mặt vào NH  -> PHIẾU CHI (Nợ 1121 / Có 1111)
// Mỗi quý nạp sao kê -> app gợi ý đủ phiếu cho các giao dịch đó (không tạo trùng khi nạp lại), in phiếu, xuất sổ.

import type { HoSoDN } from './types.js'
import { boGiaoDichTrung, type GiaoDich, type KetQuaCongNo, type SaoKe } from './saoKe.js'
import { soPhieuMoi, type KetQuaQuy, type PhieuQuy, type SoQuy } from './soQuy.js'
import { tienBangChu } from './docSo.js'
import { tien } from './nhan.js'

/** Người ký trên chứng từ quỹ + cách nhận ra thủ quỹ trên sao kê */
export interface NguoiKyQuy {
  giamDoc: string
  keToanTruong: string // DN nhỏ không có kế toán trưởng thì ghi người phụ trách kế toán
  nguoiLap: string
  thuQuy: string
  /** Tên / số tài khoản của thủ quỹ như trên sao kê (không dấu cũng được), mỗi dòng một mục */
  nhanDien: string[]
}

export const NGUOI_KY_TRONG: NguoiKyQuy = { giamDoc: '', keToanTruong: '', nguoiLap: '', thuQuy: '', nhanDien: [] }

export const MO_TA_TT133 = 'Ban hành theo Thông tư số 133/2016/TT-BTC ngày 26/08/2016 của Bộ Tài chính'

const khongDau = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[Đđ]/g, 'D').toUpperCase().replace(/\s+/g, ' ').trim()
const iso = (dmy: string) => dmy.split('/').reverse().join('-')

/** Giao dịch có phải chuyển với thủ quỹ không (tên / số TK nằm trong cột đối ứng hoặc nội dung) */
export function laThuQuy(gd: GiaoDich, nhanDien: string[]): boolean {
  const nd = khongDau(`${gd.doiUng} ${gd.noiDung}`)
  return nhanDien.map(khongDau).filter((x) => x.length >= 4).some((x) => nd.includes(x))
}

export interface GoiYPhieu {
  phieu: PhieuQuy[]
  /** Giao dịch với thủ quỹ nhưng nội dung nhắc hoá đơn / tạm ứng — vẫn lập phiếu, cần người xem lại */
  canXem: { phieu: PhieuQuy; lyDo: string }[]
  /** Số giao dịch đã có phiếu từ lần trước (bỏ qua) */
  daCo: number
}

/**
 * Gợi ý phiếu thu / chi cho các giao dịch giữa tài khoản công ty và thủ quỹ trong [tu, den] (dd/MM/yyyy, trống = tất cả).
 * Số phiếu nối tiếp số đã có trong năm. Phiếu mang `nguon` = "idSaoKe#idGD" để lần sau không lập lại.
 */
export function goiYPhieuTuSaoKe(dsSaoKe: SaoKe[], quy: SoQuy, nguoiKy: NguoiKyQuy, tu = '', den = '', maMoi: () => string = () => Math.random().toString(36).slice(2)): GoiYPhieu {
  const daCoNguon = new Set(Object.values(quy.phieu).map((p) => p.nguon).filter(Boolean))
  // phiếu đã lập từ một bản sao của cùng giao dịch ở file sao kê khác (nhận theo số bút toán ghi trong nội dung phiếu)
  const daCoCT = new Set(Object.values(quy.phieu).filter((p) => p.nguon).map((p) => /bút toán ([^)\s]+)\)/.exec(p.noiDung)?.[1]).filter(Boolean))
  const tam: { sk: SaoKe; gd: GiaoDich }[] = []
  let daCo = 0
  for (const sk of boGiaoDichTrung(dsSaoKe).ds) {
    for (const gd of sk.giaoDich) {
      if (tu && iso(gd.ngay) < iso(tu)) continue
      if (den && iso(gd.ngay) > iso(den)) continue
      if (!laThuQuy(gd, nguoiKy.nhanDien)) continue
      if (daCoNguon.has(`${sk.id}#${gd.id}`) || (gd.soCT && daCoCT.has(gd.soCT))) {
        daCo++
        continue
      }
      tam.push({ sk, gd })
    }
  }
  tam.sort((a, b) => iso(a.gd.ngay).localeCompare(iso(b.gd.ngay)))
  // đánh số nối tiếp: thêm dần vào bản sao sổ quỹ để soPhieuMoi đếm cả phiếu vừa gợi ý
  const nhap: SoQuy = { ...quy, phieu: { ...quy.phieu } }
  const phieu: PhieuQuy[] = []
  const canXem: GoiYPhieu['canXem'] = []
  const ten = nguoiKy.thuQuy || nguoiKy.nhanDien[0] || 'Thủ quỹ'
  for (const { sk, gd } of tam) {
    const loai = gd.ra ? 'thu' : 'chi'
    const nh = `${sk.nganHang || 'ngân hàng'}${sk.soTaiKhoan ? ` TK ${sk.soTaiKhoan}` : ''}`
    const ct = gd.soCT ? `, bút toán ${gd.soCT}` : ''
    const p: PhieuQuy = {
      id: maMoi(), loai, so: soPhieuMoi(nhap, loai, gd.ngay), ngay: gd.ngay, soTien: gd.ra || gd.vao,
      nhom: loai === 'thu' ? 'rutNganHang' : 'nopNganHang',
      noiDung: loai === 'thu'
        ? `Rút tiền gửi ${nh} nhập quỹ tiền mặt (sao kê ngày ${gd.ngay}${ct})`
        : `Nộp tiền mặt vào ${nh} (sao kê ngày ${gd.ngay}${ct})`,
      doiTac: ten, hoaDon: [], nguon: `${sk.id}#${gd.id}`,
      tkNo: loai === 'thu' ? '1111' : '1121', tkCo: loai === 'thu' ? '1121' : '1111',
      kemTheo: `01 sổ phụ ngân hàng ngày ${gd.ngay}`,
    }
    nhap.phieu[p.id] = p
    phieu.push(p)
    const nd = khongDau(gd.noiDung)
    if (/\bHD\s*\d|HOA DON/.test(nd)) canXem.push({ phieu: p, lyDo: `nội dung nhắc hoá đơn: "${gd.noiDung}" — có thể là thanh toán hộ/chuyển nhầm, không phải nhập quỹ` })
    else if (/TAM UNG|\bUNG\b/.test(nd)) canXem.push({ phieu: p, lyDo: `nội dung "${gd.noiDung}" — nếu là tạm ứng đi mua hàng thì ghi Nợ 141 thay vì nhập quỹ` })
  }
  return { phieu, canXem, daCo }
}

/** Tồn quỹ đầu kỳ tối thiểu để sổ quỹ không bị âm ở bất kỳ ngày nào (0 = không cần) */
export function tonDauToiThieu(kq: KetQuaQuy): number {
  let thapNhat = 0
  for (const d of kq.dong) thapNhat = Math.min(thapNhat, d.ton - kq.tonDau)
  return -thapNhat
}

// ───────────── Tài khoản đối ứng cho sổ tiền gửi (S08-DNN) ─────────────

const TIEU_MUC: [RegExp, string][] = [
  [/^17\d\d$/, '33311'], // thuế GTGT
  [/^105\d$/, '3334'], // thuế TNDN
  [/^100\d$/, '3335'], // thuế TNCN
  [/^286\d$/, '3338'], // lệ phí môn bài
  [/^49\d\d$/, '3339'], // tiền chậm nộp, phạt
]

/** TK đối ứng gợi ý cho một giao dịch ngân hàng; '' = chưa đoán được, kế toán tự điền */
export function tkDoiUng(gd: GiaoDich, loaiHD: 'ban' | 'mua' | null, nguoiKy: NguoiKyQuy): string {
  if (laThuQuy(gd, nguoiKy.nhanDien)) return '1111'
  if (loaiHD) return loaiHD === 'ban' ? '131' : '331'
  const nd = khongDau(`${gd.doiUng} ${gd.noiDung}`)
  if (/KHO BAC|NTDT|NSNN/.test(nd)) {
    const tm = /TM:?\s*(\d{4})/.exec(nd)?.[1] ?? ''
    return TIEU_MUC.find(([re]) => re.test(tm))?.[1] ?? '333'
  }
  if (/TRA LAI|LAI TIEN GUI|BUT TOAN TRA LAI/.test(nd)) return '515'
  if (/THU PHI|PHI DICH VU|PHI QUAN LY|PHI CHUYEN/.test(nd)) return '6422'
  return ''
}

/** Mỗi giao dịch "idSaoKe#idGD" đã ghép với hoá đơn bán hay mua */
export function loaiGhep(congNo: KetQuaCongNo | null): Map<string, 'ban' | 'mua'> {
  const m = new Map<string, 'ban' | 'mua'>()
  for (const h of congNo?.hoaDon ?? []) for (const g of h.giaoDich) m.set(g, h.l)
  return m
}

// ───────────── Bảng sổ (mảng dòng, để ghi Excel) ─────────────

type O = string | number | null

function dauSo(dn: HoSoDN | null, mau: string, tenSo: string): O[][] {
  return [
    [`Đơn vị: ${dn?.tenNNT ?? ''}`, null, null, null, null, null, null, `Mẫu số ${mau}`],
    [`Địa chỉ: ${dn?.dchiNNT ?? ''}`, null, null, null, null, null, null, `(${MO_TA_TT133})`],
    [`Mã số thuế: ${dn?.mst ?? ''}`],
    [],
    [tenSo],
  ]
}

function cuoiSo(nguoiKy: NguoiKyQuy, ngay: string): O[][] {
  const [d, m, y] = ngay.split('/')
  return [
    [],
    ['- Sổ này có … trang, đánh số từ trang 01 đến trang …'],
    [`- Ngày mở sổ: ${ngay}`],
    [null, null, null, null, null, `Ngày ${d} tháng ${m} năm ${y}`],
    ['NGƯỜI GHI SỔ', null, null, 'KẾ TOÁN TRƯỞNG', null, 'GIÁM ĐỐC'],
    ['(Ký, họ tên)', null, null, '(Ký, họ tên)', null, '(Ký, họ tên, đóng dấu)'],
    [], [], [],
    [nguoiKy.nguoiLap, null, null, nguoiKy.keToanTruong, null, nguoiKy.giamDoc],
  ]
}

/** Sổ quỹ tiền mặt S07-DNN */
export function bangS07(kq: KetQuaQuy, dn: HoSoDN | null, nguoiKy: NguoiKyQuy, tieuDeKy: string, ngayKy: string): O[][] {
  const r: O[][] = [
    ...dauSo(dn, 'S07-DNN', 'SỔ QUỸ TIỀN MẶT'),
    [`Loại quỹ: Tiền mặt VNĐ — ${tieuDeKy}`],
    [],
    ['Ngày, tháng ghi sổ', 'Ngày, tháng chứng từ', 'Số hiệu chứng từ', null, 'Diễn giải', 'Số tiền', null, null, 'Ghi chú'],
    [null, null, 'Thu', 'Chi', null, 'Thu', 'Chi', 'Tồn'],
    ['A', 'B', 'C', 'D', 'E', 1, 2, 3, 'G'],
    [null, null, null, null, 'Số tồn đầu kỳ', null, null, kq.tonDau],
  ]
  for (const d of kq.dong) {
    r.push([d.ngay, d.ngay, d.loai === 'thu' ? d.so : null, d.loai === 'chi' ? d.so : null, d.noiDung, d.thu || null, d.chi || null, d.ton, d.doiTac])
  }
  r.push([null, null, null, null, 'Cộng số phát sinh trong kỳ', kq.tongThu, kq.tongChi, null])
  r.push([null, null, null, null, 'Số tồn cuối kỳ', null, null, kq.tonCuoi])
  return [...r, ...cuoiSo(nguoiKy, ngayKy)]
}

/** Sổ tiền gửi ngân hàng S08-DNN cho một sao kê (một tài khoản) trong [tu, den] */
export function bangS08(sk: SaoKe, soDuDau: number, ghep: Map<string, 'ban' | 'mua'>, dn: HoSoDN | null, nguoiKy: NguoiKyQuy, tu: string, den: string, ngayKy: string): { bang: O[][]; thieuTk: number; soDuCuoi: number } {
  const gd = sk.giaoDich.filter((g) => (!tu || iso(g.ngay) >= iso(tu)) && (!den || iso(g.ngay) <= iso(den)))
    .map((g, i) => ({ g, i })).sort((a, b) => iso(a.g.ngay).localeCompare(iso(b.g.ngay)) || a.i - b.i).map((x) => x.g)
  const r: O[][] = [
    ...dauSo(dn, 'S08-DNN', 'SỔ TIỀN GỬI NGÂN HÀNG'),
    [`Nơi mở tài khoản giao dịch: ${sk.nganHang}`],
    [`Số hiệu tài khoản tại nơi gửi: ${sk.soTaiKhoan}`],
    [`Kỳ: ${tu || sk.tuNgay} – ${den || sk.denNgay}`],
    [],
    ['Ngày, tháng ghi sổ', 'Chứng từ', null, 'Diễn giải', 'Tài khoản đối ứng', 'Số tiền', null, null, 'Ghi chú'],
    [null, 'Số hiệu', 'Ngày, tháng', null, null, 'Thu (gửi vào)', 'Chi (rút ra)', 'Còn lại'],
    ['A', 'B', 'C', 'D', 'E', 1, 2, 3, 'F'],
    [null, null, null, 'Số dư đầu kỳ', null, null, null, soDuDau],
    [null, null, null, 'Số phát sinh trong kỳ'],
  ]
  let du = soDuDau
  let thu = 0
  let chi = 0
  let thieuTk = 0
  for (const g of gd) {
    du += g.vao - g.ra
    thu += g.vao
    chi += g.ra
    const tk = tkDoiUng(g, ghep.get(`${sk.id}#${g.id}`) ?? null, nguoiKy)
    if (!tk) thieuTk++
    r.push([g.ngay, g.soCT ?? '', g.ngay, `${g.noiDung}${g.doiUng ? ` — ${g.doiUng}` : ''}`, tk || '?', g.vao || null, g.ra || null, du, tk ? null : 'chưa xác định TK đối ứng'])
  }
  r.push([null, null, null, 'Cộng số phát sinh trong kỳ', null, thu, chi, null])
  r.push([null, null, null, 'Số dư cuối kỳ', null, null, null, du])
  return { bang: [...r, ...cuoiSo(nguoiKy, ngayKy)], thieuTk, soDuCuoi: du }
}

/** Số dư đầu kỳ của sao kê tại ngày `tu`: lấy cột số dư của giao dịch đầu tiên (số dư sau GD − vào + ra) */
export function soDuTruoc(sk: SaoKe, tu: string): number | null {
  const ds = sk.giaoDich.map((g, i) => ({ g, i })).sort((a, b) => iso(a.g.ngay).localeCompare(iso(b.g.ngay)) || a.i - b.i)
  // Ngân hàng có file xếp mới -> cũ: thứ tự trong ngày đảo; thử cả hai chiều, lấy chiều số dư khớp liên tục
  const thuTu = (dsx: typeof ds) => {
    let khop = 0
    for (let k = 1; k < dsx.length; k++) {
      const a = dsx[k - 1].g
      const b = dsx[k].g
      if (a.soDu !== null && b.soDu !== null && Math.abs(a.soDu + b.vao - b.ra - b.soDu) < 1) khop++
    }
    return khop
  }
  const nguoc = [...ds].sort((a, b) => iso(a.g.ngay).localeCompare(iso(b.g.ngay)) || b.i - a.i)
  const dung = thuTu(nguoc) > thuTu(ds) ? nguoc : ds
  const dau = dung.find((x) => !tu || iso(x.g.ngay) >= iso(tu))
  if (!dau || dau.g.soDu === null) return null
  return dau.g.soDu - dau.g.vao + dau.g.ra
}

// ───────────── In phiếu thu / phiếu chi (01-TT, 02-TT) ─────────────

/** TK Nợ / Có của phiếu: lấy theo phiếu, thiếu thì đoán theo nhóm (phiếu lập tay) */
export function tkPhieu(p: PhieuQuy): { no: string; co: string } {
  if (p.loai === 'thu') {
    const co = { banHang: '131', rutNganHang: '1121' }[p.nhom as string] ?? ''
    return { no: p.tkNo ?? '1111', co: p.tkCo ?? co }
  }
  const no = { muaHang: '331', vanChuyen: '331', luong: '334', nopNganHang: '1121' }[p.nhom as string] ?? ''
  return { no: p.tkNo ?? no, co: p.tkCo ?? '1111' }
}

const h = (s: string | number) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function motPhieu(p: PhieuQuy, dn: HoSoDN | null, k: NguoiKyQuy): string {
  const thu = p.loai === 'thu'
  const [d, m, y] = p.ngay.split('/')
  const tk = tkPhieu(p)
  const ky = thu
    ? [['Giám đốc', '(Ký, họ tên, đóng dấu)', k.giamDoc], ['Kế toán trưởng', '(Ký, họ tên)', k.keToanTruong], ['Người nộp tiền', '(Ký, họ tên)', p.doiTac], ['Người lập phiếu', '(Ký, họ tên)', k.nguoiLap], ['Thủ quỹ', '(Ký, họ tên)', k.thuQuy]]
    : [['Giám đốc', '(Ký, họ tên, đóng dấu)', k.giamDoc], ['Kế toán trưởng', '(Ký, họ tên)', k.keToanTruong], ['Thủ quỹ', '(Ký, họ tên)', k.thuQuy], ['Người lập phiếu', '(Ký, họ tên)', k.nguoiLap], ['Người nhận tiền', '(Ký, họ tên)', p.doiTac]]
  return `<section class="phieu">
<table class="dau"><tr><td><b>Đơn vị:</b> ${h(dn?.tenNNT ?? '')}<br><b>Địa chỉ:</b> ${h(dn?.dchiNNT ?? '')}</td>
<td class="mau"><b>Mẫu số ${thu ? '01 - TT' : '02 - TT'}</b><br><i>(${MO_TA_TT133})</i></td></tr></table>
<table class="tieude"><tr><td class="trong"></td><td><h1>PHIẾU ${thu ? 'THU' : 'CHI'}</h1><i>Ngày ${d} tháng ${m} năm ${y}</i></td>
<td class="so">Quyển số: ${y}<br>Số: <b>${h(p.so)}</b><br>Nợ: ${h(tk.no)}<br>Có: ${h(tk.co)}</td></tr></table>
<p>Họ và tên người ${thu ? 'nộp' : 'nhận'} tiền: <b>${h(p.doiTac)}</b></p>
<p>Địa chỉ: ${h(p.diaChi ?? '')}</p>
<p>Lý do ${thu ? 'nộp' : 'chi'}: ${h(p.noiDung)}</p>
<p>Số tiền: <b>${tien(p.soTien)} đồng</b> (Viết bằng chữ): <i>${h(tienBangChu(p.soTien))}</i></p>
<p>Kèm theo: ${h(p.kemTheo ?? '')} Chứng từ gốc.</p>
<table class="ky"><tr><td colspan="${ky.length}" class="ngay">Ngày ${d} tháng ${m} năm ${y}</td></tr>
<tr>${ky.map(([c]) => `<td><b>${c}</b></td>`).join('')}</tr>
<tr>${ky.map(([, g]) => `<td><i>${g}</i></td>`).join('')}</tr>
<tr class="cho">${ky.map(() => '<td></td>').join('')}</tr>
<tr>${ky.map(([, , t]) => `<td>${h(t)}</td>`).join('')}</tr></table>
<p>Đã nhận đủ số tiền (viết bằng chữ): ${h(tienBangChu(p.soTien))}</p>
<p>+ Tỷ giá ngoại tệ (vàng bạc, đá quý): ……… &nbsp; + Số tiền quy đổi: ………</p>
</section>`
}

/** Trang HTML in được (mỗi phiếu một trang A5 ngang) */
export function htmlPhieu(ds: PhieuQuy[], dn: HoSoDN | null, nguoiKy: NguoiKyQuy): string {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Phiếu thu chi ${h(dn?.tenNNT ?? '')}</title>
<style>
@page { size: A5 landscape; margin: 8mm 10mm; }
body { font-family: 'Times New Roman', serif; font-size: 12.5pt; color: #000; margin: 0; }
.phieu { page-break-after: always; padding: 4mm 0; }
.phieu:last-child { page-break-after: auto; }
table { width: 100%; border-collapse: collapse; }
td { vertical-align: top; }
.dau .mau { text-align: center; width: 45%; font-size: 10.5pt; }
.tieude td { text-align: center; }
.tieude .trong { width: 25%; }
.tieude .so { width: 25%; text-align: left; font-size: 11.5pt; }
h1 { margin: 4px 0 0; font-size: 18pt; }
p { margin: 3px 0; }
.ky td { text-align: center; width: 20%; font-size: 11.5pt; }
.ky .ngay { text-align: right; font-style: italic; }
.ky .cho td { height: 16mm; }
@media screen { body { background: #eee; } .phieu { background: #fff; width: 190mm; margin: 6mm auto; padding: 8mm 10mm; box-shadow: 0 1px 4px #0003; } }
</style></head><body>
${ds.map((p) => motPhieu(p, dn, nguoiKy)).join('\n')}
</body></html>`
}

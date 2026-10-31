// BÁO CÁO TÀI CHÍNH đã nộp (file XML tờ khai 402 — BCTC theo TT200, xuất từ HTKK): đọc 3 bảng + SOÁT chéo giữa các bảng.
// Giai đoạn A (báo cáo 19): chỉ đọc và soát, chưa lập BCTC. Bảng cân đối (B01-DN), kết quả kinh doanh (B02-DN),
// lưu chuyển tiền tệ (B03-DN, trực tiếp hoặc gián tiếp). Mã chỉ tiêu giữ nguyên như trên mẫu ("ct411a" -> "411a").
import { docCayXml, type GhiChuKiem, type NutXml } from './xemHoaDon.js'

/** Mẫu tờ khai là BCTC mà app đọc được */
export const MA_BCTC: Record<string, string> = { '402': 'TT200' }
export const laBctc = (maTKhai: string) => maTKhai in MA_BCTC

export interface SoLieuBctc {
  cheDo: string
  nam: string
  tuNgay: string
  denNgay: string
  ngayLap: string
  nguoiKy: string
  daKiemToan: boolean
  /** Bảng cân đối kế toán: số cuối năm / đầu năm theo mã (vd "110", "411a") */
  cdkt: { cuoi: Record<string, number>; dau: Record<string, number> }
  /** Kết quả kinh doanh: năm nay / năm trước */
  kqkd: { nay: Record<string, number>; truoc: Record<string, number> }
  /** Lưu chuyển tiền tệ (null = file không có) */
  lctt: { phuongPhap: 'trucTiep' | 'gianTiep'; nay: Record<string, number>; truoc: Record<string, number> } | null
  /** File có phần thuyết minh (B09) không */
  coThuyetMinh: boolean
}

const con = (n: NutXml | null | undefined, ten: string) => n?.con.find((c) => c.ten === ten) ?? null
const chuCua = (n: NutXml | null): string => (n ? (n.chu + n.con.map(chuCua).join('')).trim() : '')
function tim(n: NutXml | null, ten: string): NutXml | null {
  for (const c of n?.con ?? []) {
    if (c.ten === ten) return c
    const x = tim(c, ten)
    if (x) return x
  }
  return null
}
/** <ct100>123</ct100>… -> { "100": 123 } (bỏ ô trống) */
function bangSo(n: NutXml | null): Record<string, number> {
  const kq: Record<string, number> = {}
  for (const c of n?.con ?? []) {
    const m = /^ct(\w+)$/.exec(c.ten)
    const s = chuCua(c)
    if (m && s !== '' && Number.isFinite(Number(s))) kq[m[1]] = Number(s)
  }
  return kq
}

/** Đọc file BCTC. Không phải BCTC app đọc được (mẫu khác, file hỏng) -> null */
export function docBctc(xml: string): SoLieuBctc | null {
  let goc: NutXml
  try {
    goc = docCayXml(xml)
  } catch {
    return null
  }
  const ma = chuCua(tim(goc, 'maTKhai'))
  if (goc.ten !== 'HSoThueDTu' || !laBctc(ma)) return null
  const chinh = tim(goc, 'CTieuTKhaiChinh')
  // Hoạt động liên tục / không liên tục: hai khối cùng cấu trúc
  const cd = con(chinh, 'CDKT_HoatDongLienTuc') ?? chinh?.con.find((c) => c.ten.startsWith('CDKT_')) ?? null
  if (!cd) return null
  const pl = tim(goc, 'PLuc')
  const kq = con(pl, 'PL_KQHDSXKD')
  const ltTT = con(pl, 'PL_LCTTTT')
  const ltGT = con(pl, 'PL_LCTTGT')
  const lt = ltTT ?? ltGT
  const DA_BIET = new Set(['PL_KQHDSXKD', 'PL_LCTTTT', 'PL_LCTTGT'])
  return {
    cheDo: MA_BCTC[ma],
    nam: chuCua(tim(goc, 'kyKKhai')),
    tuNgay: chuCua(tim(goc, 'kyKKhaiTuNgay')),
    denNgay: chuCua(tim(goc, 'kyKKhaiDenNgay')),
    ngayLap: chuCua(tim(goc, 'ngayLapTKhai')),
    nguoiKy: chuCua(tim(goc, 'nguoiKy')),
    daKiemToan: chuCua(con(chinh, 'bctcDaKiemToan')) === 'true',
    cdkt: { cuoi: bangSo(con(cd, 'SoCuoiNam')), dau: bangSo(con(cd, 'SoDauNam')) },
    kqkd: { nay: bangSo(con(kq, 'NamNay')), truoc: bangSo(con(kq, 'NamTruoc')) },
    lctt: lt ? { phuongPhap: ltTT ? 'trucTiep' : 'gianTiep', nay: bangSo(con(lt, 'NamNay')), truoc: bangSo(con(lt, 'NamTruoc')) } : null,
    coThuyetMinh: (pl?.con ?? []).some((c) => !DA_BIET.has(c.ten)),
  }
}

// ───────────── Tên chỉ tiêu (mẫu TT200) ─────────────

export const TEN_CDKT: [string, string][] = [
  ['100', 'A. TÀI SẢN NGẮN HẠN'], ['110', 'I. Tiền và các khoản tương đương tiền'], ['111', 'Tiền'], ['112', 'Các khoản tương đương tiền'],
  ['120', 'II. Đầu tư tài chính ngắn hạn'], ['121', 'Chứng khoán kinh doanh'], ['122', 'Dự phòng giảm giá chứng khoán kinh doanh'], ['123', 'Đầu tư nắm giữ đến ngày đáo hạn'],
  ['130', 'III. Các khoản phải thu ngắn hạn'], ['131', 'Phải thu ngắn hạn của khách hàng'], ['132', 'Trả trước cho người bán ngắn hạn'], ['133', 'Phải thu nội bộ ngắn hạn'],
  ['134', 'Phải thu theo tiến độ hợp đồng xây dựng'], ['135', 'Phải thu về cho vay ngắn hạn'], ['136', 'Phải thu ngắn hạn khác'], ['137', 'Dự phòng phải thu ngắn hạn khó đòi'], ['139', 'Tài sản thiếu chờ xử lý'],
  ['140', 'IV. Hàng tồn kho'], ['141', 'Hàng tồn kho'], ['149', 'Dự phòng giảm giá hàng tồn kho'],
  ['150', 'V. Tài sản ngắn hạn khác'], ['151', 'Chi phí trả trước ngắn hạn'], ['152', 'Thuế GTGT được khấu trừ'], ['153', 'Thuế và các khoản khác phải thu Nhà nước'],
  ['154', 'Giao dịch mua bán lại trái phiếu Chính phủ'], ['155', 'Tài sản ngắn hạn khác'],
  ['200', 'B. TÀI SẢN DÀI HẠN'], ['210', 'I. Các khoản phải thu dài hạn'], ['211', 'Phải thu dài hạn của khách hàng'], ['212', 'Trả trước cho người bán dài hạn'],
  ['213', 'Vốn kinh doanh ở đơn vị trực thuộc'], ['214', 'Phải thu nội bộ dài hạn'], ['215', 'Phải thu về cho vay dài hạn'], ['216', 'Phải thu dài hạn khác'], ['219', 'Dự phòng phải thu dài hạn khó đòi'],
  ['220', 'II. Tài sản cố định'], ['221', '1. TSCĐ hữu hình'], ['222', 'Nguyên giá'], ['223', 'Giá trị hao mòn luỹ kế'], ['224', '2. TSCĐ thuê tài chính'], ['225', 'Nguyên giá'],
  ['226', 'Giá trị hao mòn luỹ kế'], ['227', '3. TSCĐ vô hình'], ['228', 'Nguyên giá'], ['229', 'Giá trị hao mòn luỹ kế'],
  ['230', 'III. Bất động sản đầu tư'], ['231', 'Nguyên giá'], ['232', 'Giá trị hao mòn luỹ kế'],
  ['240', 'IV. Tài sản dở dang dài hạn'], ['241', 'Chi phí sản xuất, kinh doanh dở dang dài hạn'], ['242', 'Chi phí xây dựng cơ bản dở dang'],
  ['250', 'V. Đầu tư tài chính dài hạn'], ['251', 'Đầu tư vào công ty con'], ['252', 'Đầu tư vào công ty liên doanh, liên kết'], ['253', 'Đầu tư góp vốn vào đơn vị khác'],
  ['254', 'Dự phòng đầu tư tài chính dài hạn'], ['255', 'Đầu tư nắm giữ đến ngày đáo hạn'],
  ['260', 'VI. Tài sản dài hạn khác'], ['261', 'Chi phí trả trước dài hạn'], ['262', 'Tài sản thuế thu nhập hoãn lại'], ['263', 'Thiết bị, vật tư, phụ tùng thay thế dài hạn'], ['268', 'Tài sản dài hạn khác'],
  ['270', 'TỔNG CỘNG TÀI SẢN'],
  ['300', 'C. NỢ PHẢI TRẢ'], ['310', 'I. Nợ ngắn hạn'], ['311', 'Phải trả người bán ngắn hạn'], ['312', 'Người mua trả tiền trước ngắn hạn'], ['313', 'Thuế và các khoản phải nộp Nhà nước'],
  ['314', 'Phải trả người lao động'], ['315', 'Chi phí phải trả ngắn hạn'], ['316', 'Phải trả nội bộ ngắn hạn'], ['317', 'Phải trả theo tiến độ hợp đồng xây dựng'],
  ['318', 'Doanh thu chưa thực hiện ngắn hạn'], ['319', 'Phải trả ngắn hạn khác'], ['320', 'Vay và nợ thuê tài chính ngắn hạn'], ['321', 'Dự phòng phải trả ngắn hạn'],
  ['322', 'Quỹ khen thưởng, phúc lợi'], ['323', 'Quỹ bình ổn giá'], ['324', 'Giao dịch mua bán lại trái phiếu Chính phủ'],
  ['330', 'II. Nợ dài hạn'], ['331', 'Phải trả người bán dài hạn'], ['332', 'Người mua trả tiền trước dài hạn'], ['333', 'Chi phí phải trả dài hạn'], ['334', 'Phải trả nội bộ về vốn kinh doanh'],
  ['335', 'Phải trả nội bộ dài hạn'], ['336', 'Doanh thu chưa thực hiện dài hạn'], ['337', 'Phải trả dài hạn khác'], ['338', 'Vay và nợ thuê tài chính dài hạn'], ['339', 'Trái phiếu chuyển đổi'],
  ['340', 'Cổ phiếu ưu đãi'], ['341', 'Thuế thu nhập hoãn lại phải trả'], ['342', 'Dự phòng phải trả dài hạn'], ['343', 'Quỹ phát triển khoa học và công nghệ'],
  ['400', 'D. VỐN CHỦ SỞ HỮU'], ['410', 'I. Vốn chủ sở hữu'], ['411', 'Vốn góp của chủ sở hữu'], ['411a', '– Cổ phiếu phổ thông có quyền biểu quyết'], ['411b', '– Cổ phiếu ưu đãi'],
  ['412', 'Thặng dư vốn cổ phần'], ['413', 'Quyền chọn chuyển đổi trái phiếu'], ['414', 'Vốn khác của chủ sở hữu'], ['415', 'Cổ phiếu quỹ'], ['416', 'Chênh lệch đánh giá lại tài sản'],
  ['417', 'Chênh lệch tỷ giá hối đoái'], ['418', 'Quỹ đầu tư phát triển'], ['419', 'Quỹ hỗ trợ sắp xếp doanh nghiệp'], ['420', 'Quỹ khác thuộc vốn chủ sở hữu'],
  ['421', 'Lợi nhuận sau thuế chưa phân phối'], ['421a', '– LNST chưa phân phối luỹ kế đến cuối kỳ trước'], ['421b', '– LNST chưa phân phối kỳ này'], ['422', 'Nguồn vốn đầu tư XDCB'],
  ['430', 'II. Nguồn kinh phí và quỹ khác'], ['431', 'Nguồn kinh phí'], ['432', 'Nguồn kinh phí đã hình thành TSCĐ'],
  ['440', 'TỔNG CỘNG NGUỒN VỐN'],
]

export const TEN_KQKD: [string, string][] = [
  ['01', 'Doanh thu bán hàng và cung cấp dịch vụ'], ['02', 'Các khoản giảm trừ doanh thu'], ['10', 'Doanh thu thuần về bán hàng và cung cấp dịch vụ'],
  ['11', 'Giá vốn hàng bán'], ['20', 'Lợi nhuận gộp về bán hàng và cung cấp dịch vụ'], ['21', 'Doanh thu hoạt động tài chính'], ['22', 'Chi phí tài chính'],
  ['23', '– Trong đó: Chi phí lãi vay'], ['25', 'Chi phí bán hàng'], ['26', 'Chi phí quản lý doanh nghiệp'], ['30', 'Lợi nhuận thuần từ hoạt động kinh doanh'],
  ['31', 'Thu nhập khác'], ['32', 'Chi phí khác'], ['40', 'Lợi nhuận khác'], ['50', 'Tổng lợi nhuận kế toán trước thuế'], ['51', 'Chi phí thuế TNDN hiện hành'],
  ['52', 'Chi phí thuế TNDN hoãn lại'], ['60', 'Lợi nhuận sau thuế thu nhập doanh nghiệp'], ['70', 'Lãi cơ bản trên cổ phiếu'], ['71', 'Lãi suy giảm trên cổ phiếu'],
]

export const TEN_LCTT_TRUC_TIEP: [string, string][] = [
  ['01', 'Tiền thu từ bán hàng, cung cấp dịch vụ và doanh thu khác'], ['02', 'Tiền chi trả cho người cung cấp hàng hoá và dịch vụ'], ['03', 'Tiền chi trả cho người lao động'],
  ['04', 'Tiền lãi vay đã trả'], ['05', 'Thuế thu nhập doanh nghiệp đã nộp'], ['06', 'Tiền thu khác từ hoạt động kinh doanh'], ['07', 'Tiền chi khác cho hoạt động kinh doanh'],
  ['20', 'Lưu chuyển tiền thuần từ hoạt động kinh doanh'],
  ['21', 'Tiền chi mua sắm, xây dựng TSCĐ và tài sản dài hạn khác'], ['22', 'Tiền thu từ thanh lý, nhượng bán TSCĐ và tài sản dài hạn khác'],
  ['23', 'Tiền chi cho vay, mua công cụ nợ của đơn vị khác'], ['24', 'Tiền thu hồi cho vay, bán lại công cụ nợ của đơn vị khác'], ['25', 'Tiền chi đầu tư góp vốn vào đơn vị khác'],
  ['26', 'Tiền thu hồi đầu tư góp vốn vào đơn vị khác'], ['27', 'Tiền thu lãi cho vay, cổ tức và lợi nhuận được chia'], ['30', 'Lưu chuyển tiền thuần từ hoạt động đầu tư'],
  ['31', 'Tiền thu từ phát hành cổ phiếu, nhận vốn góp của chủ sở hữu'], ['32', 'Tiền trả lại vốn góp cho chủ sở hữu, mua lại cổ phiếu'], ['33', 'Tiền thu từ đi vay'],
  ['34', 'Tiền trả nợ gốc vay'], ['35', 'Tiền trả nợ gốc thuê tài chính'], ['36', 'Cổ tức, lợi nhuận đã trả cho chủ sở hữu'], ['40', 'Lưu chuyển tiền thuần từ hoạt động tài chính'],
  ['50', 'Lưu chuyển tiền thuần trong kỳ'], ['60', 'Tiền và tương đương tiền đầu kỳ'], ['61', 'Ảnh hưởng của thay đổi tỷ giá hối đoái'], ['70', 'Tiền và tương đương tiền cuối kỳ'],
]

/** Dòng tổng (in đậm) */
export const DONG_TONG = new Set(['100', '200', '270', '300', '400', '440', '10', '20', '30', '50', '60'])

// ───────────── Soát ─────────────

const tien = (v: number) => v.toLocaleString('vi-VN')
const gan = (a: number, b: number) => Math.abs(a - b) <= 1

/** Công thức cộng của từng dòng tổng (mẫu TT200). Số âm (dự phòng, hao mòn) đã mang dấu âm trong file. */
const CONG_CDKT: [string, string[]][] = [
  ['110', ['111', '112']], ['120', ['121', '122', '123']], ['130', ['131', '132', '133', '134', '135', '136', '137', '139']], ['140', ['141', '149']],
  ['150', ['151', '152', '153', '154', '155']], ['100', ['110', '120', '130', '140', '150']],
  ['210', ['211', '212', '213', '214', '215', '216', '219']], ['221', ['222', '223']], ['224', ['225', '226']], ['227', ['228', '229']], ['220', ['221', '224', '227']],
  ['230', ['231', '232']], ['240', ['241', '242']], ['250', ['251', '252', '253', '254', '255']], ['260', ['261', '262', '263', '268']],
  ['200', ['210', '220', '230', '240', '250', '260']], ['270', ['100', '200']],
  ['310', ['311', '312', '313', '314', '315', '316', '317', '318', '319', '320', '321', '322', '323', '324']],
  ['330', ['331', '332', '333', '334', '335', '336', '337', '338', '339', '340', '341', '342', '343']], ['300', ['310', '330']],
  ['411', ['411a', '411b']], ['421', ['421a', '421b']],
  ['410', ['411', '412', '413', '414', '415', '416', '417', '418', '419', '420', '421', '422']], ['430', ['431', '432']], ['400', ['410', '430']], ['440', ['300', '400']],
]
const CONG_KQKD: [string, [string, number][]][] = [
  ['10', [['01', 1], ['02', -1]]], ['20', [['10', 1], ['11', -1]]], ['30', [['20', 1], ['21', 1], ['22', -1], ['25', -1], ['26', -1]]],
  ['40', [['31', 1], ['32', -1]]], ['50', [['30', 1], ['40', 1]]], ['60', [['50', 1], ['51', -1], ['52', -1]]],
]
const CONG_LCTT_TT: [string, string[]][] = [
  ['20', ['01', '02', '03', '04', '05', '06', '07']], ['30', ['21', '22', '23', '24', '25', '26', '27']], ['40', ['31', '32', '33', '34', '35', '36']],
  ['50', ['20', '30', '40']], ['70', ['50', '60', '61']],
]

function soatCong(ten: string, b: Record<string, number>, cong: [string, string[]][], kq: GhiChuKiem[]) {
  for (const [tong, phan] of cong) {
    // Mẫu cũ không có dòng con (vd 411a) thì không soát dòng đó
    if (!(tong in b) || !phan.some((p) => p in b)) continue
    const s = phan.reduce((a, p) => a + (b[p] ?? 0), 0)
    if (!gan(s, b[tong])) kq.push({ muc: 'canhBao', noiDung: `${ten}: mã ${tong} = ${tien(b[tong])} nhưng cộng các mã ${phan.filter((p) => b[p]).join(', ')} = ${tien(s)} (lệch ${tien(b[tong] - s)}).` })
  }
}

/** Soát một BCTC: phép cộng từng bảng + đối chiếu chéo giữa các bảng + dấu hiệu cần xem. Thứ tự: cảnh báo trước. */
export function soatBctc(b: SoLieuBctc): GhiChuKiem[] {
  const kq: GhiChuKiem[] = []
  const c = (m: string) => b.cdkt.cuoi[m] ?? 0
  const d = (m: string) => b.cdkt.dau[m] ?? 0
  const k = (m: string) => b.kqkd.nay[m] ?? 0
  const l = (m: string) => b.lctt?.nay[m] ?? 0

  // 1. Phép cộng trong từng bảng
  soatCong('Bảng cân đối (cuối năm)', b.cdkt.cuoi, CONG_CDKT, kq)
  soatCong('Bảng cân đối (đầu năm)', b.cdkt.dau, CONG_CDKT, kq)
  for (const [tong, phan] of CONG_KQKD) {
    if (!(tong in b.kqkd.nay)) continue
    const s = phan.reduce((a, [m, dau]) => a + dau * k(m), 0)
    if (!gan(s, k(tong))) kq.push({ muc: 'canhBao', noiDung: `Kết quả kinh doanh: mã ${tong} = ${tien(k(tong))} nhưng tính lại theo công thức = ${tien(s)}.` })
  }
  if (b.lctt?.phuongPhap === 'trucTiep') soatCong('Lưu chuyển tiền tệ', b.lctt.nay, CONG_LCTT_TT, kq)
  if (!gan(c('270'), c('440'))) kq.push({ muc: 'canhBao', noiDung: `Bảng cân đối không cân: tổng tài sản ${tien(c('270'))} ≠ tổng nguồn vốn ${tien(c('440'))}.` })

  // 2. Lợi nhuận năm phải vào vốn chủ (mã 421)
  const lnst = k('60')
  const tang421 = c('421') - d('421')
  if (!gan(tang421, lnst)) {
    kq.push({
      muc: 'canhBao',
      noiDung: `Lợi nhuận sau thuế năm nay ${tien(lnst)} (kết quả kinh doanh mã 60) nhưng "Lợi nhuận chưa phân phối" (mã 421) chỉ ${tang421 >= 0 ? 'tăng' : 'giảm'} ${tien(Math.abs(tang421))}, lệch ${tien(lnst - tang421)}. ` +
        `Nếu năm nay không chia lợi nhuận thì hai số phải bằng nhau. Bảng vẫn cân nghĩa là đang có một khoản khác lệch đúng số này (thường là công nợ bị ép cho cân).`,
    })
  }
  if ('421b' in b.cdkt.cuoi && lnst && !gan(c('421b'), lnst) && gan(tang421, lnst)) {
    kq.push({ muc: 'thongTin', noiDung: `Mã 421b (lợi nhuận kỳ này) = ${tien(c('421b'))}, khác lợi nhuận sau thuế ${tien(lnst)} — xem lại cách tách 421a / 421b.` })
  }

  if (b.lctt) {
    // 3. Tiền cuối kỳ trên lưu chuyển tiền = tiền trên bảng cân đối
    if (!gan(l('70'), c('110'))) kq.push({ muc: 'canhBao', noiDung: `Tiền cuối kỳ trên lưu chuyển tiền (mã 70) ${tien(l('70'))} ≠ tiền trên bảng cân đối (mã 110) ${tien(c('110'))}.` })
    if (!gan(l('60'), d('110'))) kq.push({ muc: 'canhBao', noiDung: `Tiền đầu kỳ trên lưu chuyển tiền (mã 60) ${tien(l('60'))} ≠ tiền đầu năm trên bảng cân đối (mã 110) ${tien(d('110'))}.` })

    if (b.lctt.phuongPhap === 'trucTiep') {
      // 4. Vốn góp tăng thì phải có tiền nhận vốn góp
      const tang411 = c('411') - d('411')
      const vonTien = l('31') + l('32')
      if (!gan(tang411, vonTien)) {
        kq.push({
          muc: 'canhBao',
          noiDung: `Vốn góp (mã 411) ${tang411 >= 0 ? 'tăng' : 'giảm'} ${tien(Math.abs(tang411))} trong năm nhưng lưu chuyển tiền ghi nhận vốn góp (mã 31 − 32) = ${tien(vonTien)}. ` +
            `Nếu góp bằng tiền thì phải nằm ở mã 31 (hoạt động tài chính), không được gộp vào tiền từ kinh doanh. Nếu chưa thực góp thì không ghi vào mã 411.`,
        })
      }
      // 5. Tiền thu bán hàng / trả người bán so với doanh thu, hàng mua, công nợ (GTGT từ 0% đến 10%, dung sai 3%)
      const coDu = (m: string) => c(m) - d(m)
      const dt = k('10')
      const thuMin = dt - coDu('131') + coDu('312')
      const thuMax = (dt + k('21') + k('31')) * 1.1 - coDu('131') + coDu('312')
      if (dt > 0 && (l('01') < thuMin * 0.97 || l('01') > thuMax * 1.03)) {
        kq.push({
          muc: 'canhBao',
          noiDung: `Tiền thu bán hàng (mã 01) ${tien(l('01'))} nằm ngoài khoảng hợp lý ${tien(Math.round(thuMin))} – ${tien(Math.round(thuMax))} ` +
            `(tính từ doanh thu, thuế GTGT 0–10%, phải thu khách hàng và người mua trả trước đầu – cuối năm).`,
        })
      }
      const hangMua = k('11') + coDu('141')
      const traMin = hangMua - coDu('311') + coDu('132')
      const traMax = (hangMua + k('22') + k('25') + k('26') + k('32')) * 1.1 - coDu('311') + coDu('132')
      const tra = -l('02')
      if (hangMua > 0 && (tra < traMin * 0.97 || tra > traMax * 1.03)) {
        kq.push({
          muc: 'canhBao',
          noiDung: `Tiền trả người bán (mã 02) ${tien(tra)} nằm ngoài khoảng hợp lý ${tien(Math.round(traMin))} – ${tien(Math.round(traMax))} ` +
            `(tính từ giá vốn + chênh lệch tồn kho = hàng mua ${tien(hangMua)}, thuế GTGT 0–10%, phải trả người bán và trả trước người bán đầu – cuối năm).`,
        })
      }
      if (l('06')) kq.push({ muc: 'thongTin', noiDung: `Có "Tiền thu khác từ hoạt động kinh doanh" (mã 06) ${tien(l('06'))} — nên ghi rõ nguồn trong thuyết minh.` })
    }
  }

  // 6. Thuế TNDN so với 20% lợi nhuận trước thuế
  if (k('50') > 0 && !gan(k('51'), k('50') * 0.2)) {
    kq.push({ muc: 'thongTin', noiDung: `Thuế TNDN hiện hành ${tien(k('51'))} khác 20% lợi nhuận trước thuế (${tien(Math.round(k('50') * 0.2))}) — đúng nếu có ưu đãi, chi phí không được trừ hay lỗ chuyển sang; đối chiếu tờ khai quyết toán TNDN.` })
  }
  // 7. Số tròn — dấu hiệu số ước, không lấy từ sổ
  const tron = ([['25', 'Chi phí bán hàng', k('25')], ['26', 'Chi phí quản lý doanh nghiệp', k('26')], ['03', 'Tiền trả người lao động (lưu chuyển tiền)', -l('03')]] as const)
    .filter(([, , v]) => v >= 10_000_000 && v % 1_000_000 === 0)
  if (tron.length) {
    kq.push({
      muc: 'thongTin',
      noiDung: `Số tròn triệu: ${tron.map(([m, t, v]) => `${t} (mã ${m}) ${tien(v)}`).join('; ')}. Hay là số ước — muốn được trừ khi tính thuế phải có chứng từ (hợp đồng, bảng lương, tờ khai thuế TNCN khớp tổng lương).`,
    })
  }
  if (!b.coThuyetMinh) kq.push({ muc: 'thongTin', noiDung: 'File không có thuyết minh báo cáo tài chính (B09-DN) — bộ BCTC theo TT200 gồm 4 mẫu B01, B02, B03, B09.' })
  if (!b.lctt) kq.push({ muc: 'thongTin', noiDung: 'File không có báo cáo lưu chuyển tiền tệ — không soát được tiền và vốn góp.' })
  else if (b.lctt.phuongPhap === 'gianTiep') kq.push({ muc: 'thongTin', noiDung: 'Lưu chuyển tiền lập theo phương pháp gián tiếp — app mới soát kỹ phương pháp trực tiếp.' })

  kq.sort((a, b2) => (a.muc === b2.muc ? 0 : a.muc === 'canhBao' ? -1 : b2.muc === 'canhBao' ? 1 : 0))
  if (!kq.some((x) => x.muc === 'canhBao')) kq.unshift({ muc: 'dat', noiDung: 'Các phép cộng và đối chiếu chéo giữa ba bảng đều khớp.' })
  return kq
}

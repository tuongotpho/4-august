// Mẫu báo cáo tài chính của DOANH NGHIỆP SIÊU NHỎ theo THÔNG TƯ 58/2026/TT-BTC (25/05/2026, hiệu lực 01/07/2026, áp dụng cho năm tài chính
// bắt đầu từ 01/07/2026 — công ty theo năm dương lịch: từ BCTC năm 2027; thay thế TT132/2018). Nguyên văn Điều 10, Công báo số 323 ngày 11/06/2026.
// Doanh nghiệp siêu nhỏ nộp thuế TNDN theo thu nhập tính thuế phải lập và nộp trong 90 ngày kể từ ngày kết thúc năm, gồm 2 mẫu:
//   B01 - DNSN  Báo cáo tình hình tài chính      B02 - DNSN  Báo cáo kết quả hoạt động kinh doanh
// (Nộp TNDN theo tỷ lệ % trên doanh thu: không bắt buộc lập BCTC để nộp.) Không có lưu chuyển tiền tệ, không có thuyết minh.
import type { SoLieuBctc } from './bctc.js'

export const TEN_CDKT_TT58: [string, string][] = [
  ['#ts', 'TÀI SẢN'],
  ['110', '1. Tiền'], ['120', '2. Các khoản nợ phải thu'], ['130', '3. Hàng tồn kho'], ['140', '4. Tài sản cố định'], ['150', '5. Tài sản khác'],
  ['200', 'TỔNG CỘNG TÀI SẢN (200 = 110 + 120 + 130 + 140 + 150)'],
  ['#nv', 'NGUỒN VỐN'],
  ['300', 'I. Nợ phải trả'], ['310', '1. Các khoản nợ phải trả'], ['320', '2. Thuế và các khoản phải nộp Nhà nước'],
  ['400', 'II. Vốn chủ sở hữu'], ['410', '1. Vốn đầu tư của chủ sở hữu'], ['420', '2. Lợi nhuận sau thuế chưa phân phối'], ['430', '3. Các quỹ thuộc vốn chủ sở hữu'],
  ['500', 'TỔNG CỘNG NGUỒN VỐN (500 = 300 + 400)'],
]
export const CONG_CDKT_TT58: [string, string[]][] = [
  ['200', ['110', '120', '130', '140', '150']], ['300', ['310', '320']], ['400', ['410', '420', '430']], ['500', ['300', '400']],
]
export const TEN_KQKD_TT58: [string, string][] = [
  ['01', '1. Doanh thu và thu nhập thuần'], ['02', '2. Các khoản chi phí'], ['03', '3. Lợi nhuận kế toán trước thuế TNDN {(03) = (01) - (02)}'],
  ['10', '4. Chi phí thuế TNDN'], ['20', '5. Lợi nhuận sau thuế TNDN {(20) = (03) - (10)}'],
]
export const CONG_KQKD_TT58: [string, [string, number][]][] = [['03', [['01', 1], ['02', -1]]], ['20', [['03', 1], ['10', -1]]]]

/** Mã chi tiết (theo mẫu TT200 / TT99) gộp vào từng chỉ tiêu B01-DNSN — theo phần "Nội dung và phương pháp lập" của Điều 10 */
const GOP: Record<string, Record<string, string[]>> = {
  TT200: {
    '110': ['110'],
    // Phải thu khách hàng, trả trước người bán, thuế GTGT được khấu trừ, cho vay, tạm ứng, phải thu khác (trừ dự phòng)
    '120': ['130', '152', '210'],
    '130': ['140'],
    '140': ['220'],
    // Tiền gửi có kỳ hạn, thuế nộp thừa, tài sản khác
    '150': ['120', '151', '153', '154', '155', '230', '240', '250', '260'],
    '310': ['310', '330', '-313'],
    '320': ['313'],
    '410': ['411'],
    '420': ['421'],
    '430': ['412', '413', '414', '415', '416', '417', '418', '419', '420', '422', '430'],
  },
  TT99: {
    '110': ['110'],
    '120': ['130', '162', '210'],
    '130': ['140'],
    '140': ['220'],
    '150': ['120', '150', '161', '163', '164', '165', '230', '240', '250', '260', '270'],
    '310': ['310', '330', '-314', '-333'],
    '320': ['314', '333'],
    '410': ['411'],
    '420': ['420'],
    '430': ['412', '413', '414', '415', '416', '417', '418', '419'],
  },
}

/** Gộp bảng cân đối chi tiết (TT200 / TT99) thành 9 chỉ tiêu B01-DNSN */
export function cdktSangTT58(so: Record<string, number>, cheDo: string): Record<string, number> {
  const g = GOP[cheDo] ?? GOP.TT200
  const kq: Record<string, number> = {}
  for (const [ma, ds] of Object.entries(g)) kq[ma] = ds.reduce((a, m) => (m.startsWith('-') ? a - (so[m.slice(1)] ?? 0) : a + (so[m] ?? 0)), 0)
  kq['200'] = kq['110'] + kq['120'] + kq['130'] + kq['140'] + kq['150']
  kq['300'] = kq['310'] + kq['320']
  kq['400'] = kq['410'] + kq['420'] + kq['430']
  kq['500'] = kq['300'] + kq['400']
  return kq
}

/** Gộp kết quả kinh doanh chi tiết thành 5 chỉ tiêu B02-DNSN: doanh thu + thu nhập; mọi chi phí; thuế TNDN */
export function kqkdSangTT58(so: Record<string, number>, cheDo: string): Record<string, number> {
  const v = (m: string) => so[m] ?? 0
  const [dtTC, cpTC] = cheDo === 'TT99' ? ['22', '23'] : ['21', '22']
  const lai = cheDo === 'TT99' ? v('21') : 0 // lãi/lỗ bán bất động sản đầu tư (TT99)
  const dt = v('10') + v(dtTC) + v('31') + Math.max(0, lai)
  const cp = v('11') + v(cpTC) + v('25') + v('26') + v('32') + Math.max(0, -lai)
  const thue = v('51') + v('52')
  return { '01': dt, '02': cp, '03': dt - cp, '10': thue, '20': dt - cp - thue }
}

/** Đổi cả BCTC chi tiết sang mẫu doanh nghiệp siêu nhỏ (giữ kỳ, người ký) */
export function sangTT58(b: SoLieuBctc): SoLieuBctc {
  return {
    ...b,
    cheDo: 'TT58',
    cdkt: { cuoi: cdktSangTT58(b.cdkt.cuoi, b.cheDo), dau: Object.keys(b.cdkt.dau).length ? cdktSangTT58(b.cdkt.dau, b.cheDo) : {} },
    kqkd: { nay: kqkdSangTT58(b.kqkd.nay, b.cheDo), truoc: Object.keys(b.kqkd.truoc).length ? kqkdSangTT58(b.kqkd.truoc, b.cheDo) : {} },
    lctt: null,
    coThuyetMinh: false,
  }
}

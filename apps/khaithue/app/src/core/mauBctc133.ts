// Mẫu báo cáo tài chính năm của DOANH NGHIỆP NHỎ VÀ VỪA theo THÔNG TƯ 133/2016/TT-BTC (26/8/2016) — nguyên văn từ Công báo
// (133_2016_TT-BTC(15581).pdf + (15583).pdf). TT99/2025 thay TT200 nhưng không thay TT133, nên DN nhỏ và vừa (kể cả siêu nhỏ, năm 2026
// trước khi TT58 áp dụng) vẫn dùng được. Điều 71: bắt buộc B01a-DNN (hoặc B01b-DNN), B02-DNN, B09-DNN; gửi cơ quan thuế kèm
// Bảng cân đối tài khoản F01-DNN; B03-DNN (lưu chuyển tiền tệ) không bắt buộc, khuyến khích lập.
import type { SoLieuBctc } from './bctc.js'

export const TEN_CDKT_TT133: [string, string][] = [
  ['#ts', 'TÀI SẢN'],
  ['110', 'I. Tiền và các khoản tương đương tiền'],
  ['120', 'II. Đầu tư tài chính'], ['121', '1. Chứng khoán kinh doanh'], ['122', '2. Đầu tư nắm giữ đến ngày đáo hạn'], ['123', '3. Đầu tư góp vốn vào đơn vị khác'],
  ['124', '4. Dự phòng tổn thất đầu tư tài chính (*)'],
  ['130', 'III. Các khoản phải thu'], ['131', '1. Phải thu của khách hàng'], ['132', '2. Trả trước cho người bán'], ['133', '3. Vốn kinh doanh ở đơn vị trực thuộc'],
  ['134', '4. Phải thu khác'], ['135', '5. Tài sản thiếu chờ xử lý'], ['136', '6. Dự phòng phải thu khó đòi (*)'],
  ['140', 'IV. Hàng tồn kho'], ['141', '1. Hàng tồn kho'], ['142', '2. Dự phòng giảm giá hàng tồn kho (*)'],
  ['150', 'V. Tài sản cố định'], ['151', '- Nguyên giá'], ['152', '- Giá trị hao mòn lũy kế (*)'],
  ['160', 'VI. Bất động sản đầu tư'], ['161', '- Nguyên giá'], ['162', '- Giá trị hao mòn lũy kế (*)'],
  ['170', 'VII. XDCB dở dang'],
  ['180', 'VIII. Tài sản khác'], ['181', '1. Thuế GTGT được khấu trừ'], ['182', '2. Tài sản khác'],
  ['200', 'TỔNG CỘNG TÀI SẢN (200 = 110 + 120 + 130 + 140 + 150 + 160 + 170 + 180)'],
  ['#nv', 'NGUỒN VỐN'],
  ['300', 'I. Nợ phải trả'], ['311', '1. Phải trả người bán'], ['312', '2. Người mua trả tiền trước'], ['313', '3. Thuế và các khoản phải nộp Nhà nước'],
  ['314', '4. Phải trả người lao động'], ['315', '5. Phải trả khác'], ['316', '6. Vay và nợ thuê tài chính'], ['317', '7. Phải trả nội bộ về vốn kinh doanh'],
  ['318', '8. Dự phòng phải trả'], ['319', '9. Quỹ khen thưởng, phúc lợi'], ['320', '10. Quỹ phát triển khoa học và công nghệ'],
  ['400', 'II. Vốn chủ sở hữu'], ['411', '1. Vốn góp của chủ sở hữu'], ['412', '2. Thặng dư vốn cổ phần'], ['413', '3. Vốn khác của chủ sở hữu'],
  ['414', '4. Cổ phiếu quỹ (*)'], ['415', '5. Chênh lệch tỷ giá hối đoái'], ['416', '6. Các quỹ thuộc vốn chủ sở hữu'], ['417', '7. Lợi nhuận sau thuế chưa phân phối'],
  ['500', 'TỔNG CỘNG NGUỒN VỐN (500 = 300 + 400)'],
]
export const CONG_CDKT_TT133: [string, string[]][] = [
  ['120', ['121', '122', '123', '124']], ['130', ['131', '132', '133', '134', '135', '136']], ['140', ['141', '142']], ['150', ['151', '152']],
  ['160', ['161', '162']], ['180', ['181', '182']], ['200', ['110', '120', '130', '140', '150', '160', '170', '180']],
  ['300', ['311', '312', '313', '314', '315', '316', '317', '318', '319', '320']], ['400', ['411', '412', '413', '414', '415', '416', '417']], ['500', ['300', '400']],
]

export const TEN_KQKD_TT133: [string, string][] = [
  ['01', '1. Doanh thu bán hàng và cung cấp dịch vụ'], ['02', '2. Các khoản giảm trừ doanh thu'], ['10', '3. Doanh thu thuần về bán hàng và cung cấp dịch vụ (10 = 01 - 02)'],
  ['11', '4. Giá vốn hàng bán'], ['20', '5. Lợi nhuận gộp về bán hàng và cung cấp dịch vụ (20 = 10 - 11)'], ['21', '6. Doanh thu hoạt động tài chính'],
  ['22', '7. Chi phí tài chính'], ['23', '- Trong đó: Chi phí lãi vay'], ['24', '8. Chi phí quản lý kinh doanh'],
  ['30', '9. Lợi nhuận thuần từ hoạt động kinh doanh (30 = 20 + 21 - 22 - 24)'], ['31', '10. Thu nhập khác'], ['32', '11. Chi phí khác'],
  ['40', '12. Lợi nhuận khác (40 = 31 - 32)'], ['50', '13. Tổng lợi nhuận kế toán trước thuế (50 = 30 + 40)'], ['51', '14. Chi phí thuế TNDN'],
  ['60', '15. Lợi nhuận sau thuế thu nhập doanh nghiệp (60 = 50 - 51)'],
]
export const CONG_KQKD_TT133: [string, [string, number][]][] = [
  ['10', [['01', 1], ['02', -1]]], ['20', [['10', 1], ['11', -1]]], ['30', [['20', 1], ['21', 1], ['22', -1], ['24', -1]]],
  ['40', [['31', 1], ['32', -1]]], ['50', [['30', 1], ['40', 1]]], ['60', [['50', 1], ['51', -1]]],
]

export const TEN_LCTT_TT133: [string, string][] = [
  ['01', '1. Tiền thu từ bán hàng, cung cấp dịch vụ và doanh thu khác'], ['02', '2. Tiền chi trả cho người cung cấp hàng hóa, dịch vụ'], ['03', '3. Tiền chi trả cho người lao động'],
  ['04', '4. Tiền lãi vay đã trả'], ['05', '5. Thuế thu nhập doanh nghiệp đã nộp'], ['06', '6. Tiền thu khác từ hoạt động kinh doanh'], ['07', '7. Tiền chi khác cho hoạt động kinh doanh'],
  ['20', 'Lưu chuyển tiền thuần từ hoạt động kinh doanh'],
  ['21', '1. Tiền chi để mua sắm, xây dựng TSCĐ, BĐSĐT và các tài sản dài hạn khác'], ['22', '2. Tiền thu từ thanh lý, nhượng bán TSCĐ, BĐSĐT và các tài sản dài hạn khác'],
  ['23', '3. Tiền chi cho vay, đầu tư góp vốn vào đơn vị khác'], ['24', '4. Tiền thu hồi cho vay, đầu tư góp vốn vào đơn vị khác'], ['25', '5. Tiền thu lãi cho vay, cổ tức và lợi nhuận được chia'],
  ['30', 'Lưu chuyển tiền thuần từ hoạt động đầu tư'],
  ['31', '1. Tiền thu từ phát hành cổ phiếu, nhận vốn góp của chủ sở hữu'], ['32', '2. Tiền trả lại vốn góp cho các chủ sở hữu, mua lại cổ phiếu của doanh nghiệp đã phát hành'],
  ['33', '3. Tiền thu từ đi vay'], ['34', '4. Tiền trả nợ gốc vay và nợ thuê tài chính'], ['35', '5. Cổ tức, lợi nhuận đã trả cho chủ sở hữu'],
  ['40', 'Lưu chuyển tiền thuần từ hoạt động tài chính'], ['50', 'Lưu chuyển tiền thuần trong kỳ (50 = 20 + 30 + 40)'], ['60', 'Tiền và tương đương tiền đầu kỳ'],
  ['61', 'Ảnh hưởng của thay đổi tỷ giá hối đoái quy đổi ngoại tệ'], ['70', 'Tiền và tương đương tiền cuối kỳ (70 = 50 + 60 + 61)'],
]
export const CONG_LCTT_TT133: [string, string[]][] = [
  ['20', ['01', '02', '03', '04', '05', '06', '07']], ['30', ['21', '22', '23', '24', '25']], ['40', ['31', '32', '33', '34', '35']],
  ['50', ['20', '30', '40']], ['70', ['50', '60', '61']],
]

/** Mã chi tiết (TT200 / TT99) gộp vào từng chỉ tiêu B01a-DNN — dấu "-" là trừ ra */
const GOP: Record<string, Record<string, string[]>> = {
  TT200: {
    '110': ['110'], '121': ['121'], '122': ['123', '255'], '123': ['251', '252', '253'], '124': ['122', '254'],
    '131': ['131', '211'], '132': ['132', '212'], '133': ['213'], '134': ['133', '134', '135', '136', '214', '215', '216'], '135': ['139'], '136': ['137', '219'],
    '141': ['141'], '142': ['149'], '151': ['222', '225', '228'], '152': ['223', '226', '229'], '161': ['231'], '162': ['232'], '170': ['241', '242'],
    '181': ['152'], '182': ['151', '153', '154', '155', '261', '262', '263', '268'],
    '311': ['311', '331'], '312': ['312', '332'], '313': ['313'], '314': ['314'], '315': ['315', '316', '317', '318', '319', '324', '333', '335', '336', '337', '339', '340', '341'],
    '316': ['320', '338'], '317': ['334'], '318': ['321', '342'], '319': ['322', '323'], '320': ['343'],
    '411': ['411'], '412': ['412'], '413': ['413', '414'], '414': ['415'], '415': ['416', '417'], '416': ['418', '419', '420', '422', '430'], '417': ['421'],
  },
  TT99: {
    '110': ['110'], '121': ['121'], '122': ['123', '265'], '123': ['125', '261', '262', '263'], '124': ['122', '124', '126', '264', '266'],
    '131': ['131', '211'], '132': ['132', '212'], '133': ['213'], '134': ['133', '134', '135', '214', '215'], '135': ['137'], '136': ['136', '216'],
    '141': ['141'], '142': ['142'], '151': ['222', '225', '228'], '152': ['223', '226', '229'], '161': ['241'], '162': ['242'], '170': ['251', '252'],
    '181': ['162'], '182': ['150', '161', '163', '164', '165', '230', '261', '262', '270'],
    '311': ['311', '331'], '312': ['312', '332'], '313': ['314', '333'], '314': ['315'],
    '315': ['313', '316', '317', '318', '319', '320', '325', '334', '336', '337', '338', '340', '341', '342'],
    '316': ['321', '339'], '317': ['335'], '318': ['322', '343'], '319': ['323', '324'], '320': ['344'],
    '411': ['411'], '412': ['412'], '413': ['413', '414'], '414': ['415'], '415': ['416', '417'], '416': ['418', '419'], '417': ['420'],
  },
}
export function cdktSangTT133(so: Record<string, number>, cheDo: string): Record<string, number> {
  const g = GOP[cheDo] ?? GOP.TT200
  const kq: Record<string, number> = {}
  for (const [ma, ds] of Object.entries(g)) {
    // Danh sách gộp chỉ ghi mã chi tiết (hoặc cả nhóm khi mẫu đích gộp nguyên nhóm, vd tài sản sinh học TT99 150/230 -> 182)
    kq[ma] = ds.reduce((a, m) => a + (so[m] ?? 0), 0)
  }
  kq['120'] = kq['121'] + kq['122'] + kq['123'] + kq['124']
  kq['130'] = kq['131'] + kq['132'] + kq['133'] + kq['134'] + kq['135'] + kq['136']
  kq['140'] = kq['141'] + kq['142']
  kq['150'] = kq['151'] + kq['152']
  kq['160'] = kq['161'] + kq['162']
  kq['180'] = kq['181'] + kq['182']
  kq['200'] = kq['110'] + kq['120'] + kq['130'] + kq['140'] + kq['150'] + kq['160'] + kq['170'] + kq['180']
  kq['300'] = ['311', '312', '313', '314', '315', '316', '317', '318', '319', '320'].reduce((a, m) => a + kq[m], 0)
  kq['400'] = ['411', '412', '413', '414', '415', '416', '417'].reduce((a, m) => a + kq[m], 0)
  kq['500'] = kq['300'] + kq['400']
  return kq
}

/** Kết quả kinh doanh chi tiết -> B02-DNN: chi phí bán hàng + quản lý gộp thành "Chi phí quản lý kinh doanh" (24) */
export function kqkdSangTT133(so: Record<string, number>, cheDo: string): Record<string, number> {
  const v = (m: string) => so[m] ?? 0
  const [dtTC, cpTC, laiVay] = cheDo === 'TT99' ? ['22', '23', '24'] : ['21', '22', '23']
  const kq: Record<string, number> = {
    '01': v('01'), '02': v('02'), '10': v('10'), '11': v('11'), '20': v('20'),
    '21': v(dtTC) + (cheDo === 'TT99' ? Math.max(0, v('21')) : 0), '22': v(cpTC) + (cheDo === 'TT99' ? Math.max(0, -v('21')) : 0), '23': v(laiVay),
    '24': v('25') + v('26'), '31': v('31'), '32': v('32'),
  }
  kq['30'] = kq['20'] + kq['21'] - kq['22'] - kq['24']
  kq['40'] = kq['31'] - kq['32']
  kq['50'] = kq['30'] + kq['40']
  kq['51'] = v('51') + v('52')
  kq['60'] = kq['50'] - kq['51']
  return kq
}

/** Lưu chuyển tiền trực tiếp (mã TT200 / TT99) -> B03-DNN */
export function lcttSangTT133(so: Record<string, number>): Record<string, number> {
  const v = (m: string) => so[m] ?? 0
  const kq: Record<string, number> = {
    '01': v('01'), '02': v('02'), '03': v('03'), '04': v('04'), '05': v('05'), '06': v('06'), '07': v('07'),
    '21': v('21'), '22': v('22'), '23': v('23') + v('25'), '24': v('24') + v('26'), '25': v('27'),
    '31': v('31'), '32': v('32'), '33': v('33'), '34': v('34') + v('35'), '35': v('36'), '60': v('60'), '61': v('61'),
  }
  kq['20'] = ['01', '02', '03', '04', '05', '06', '07'].reduce((a, m) => a + kq[m], 0)
  kq['30'] = ['21', '22', '23', '24', '25'].reduce((a, m) => a + kq[m], 0)
  kq['40'] = ['31', '32', '33', '34', '35'].reduce((a, m) => a + kq[m], 0)
  kq['50'] = kq['20'] + kq['30'] + kq['40']
  kq['70'] = kq['50'] + kq['60'] + kq['61']
  return kq
}

export function sangTT133(b: SoLieuBctc): SoLieuBctc {
  const co = (x: Record<string, number>) => Object.keys(x).length > 0
  return {
    ...b,
    cheDo: 'TT133',
    cdkt: { cuoi: cdktSangTT133(b.cdkt.cuoi, b.cheDo), dau: co(b.cdkt.dau) ? cdktSangTT133(b.cdkt.dau, b.cheDo) : {} },
    kqkd: { nay: kqkdSangTT133(b.kqkd.nay, b.cheDo), truoc: co(b.kqkd.truoc) ? kqkdSangTT133(b.kqkd.truoc, b.cheDo) : {} },
    lctt: b.lctt && b.lctt.phuongPhap === 'trucTiep'
      ? { phuongPhap: 'trucTiep', nay: lcttSangTT133(b.lctt.nay), truoc: co(b.lctt.truoc) ? lcttSangTT133(b.lctt.truoc) : {} }
      : null,
  }
}

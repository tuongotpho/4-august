// Mẫu báo cáo tài chính năm theo THÔNG TƯ 99/2025/TT-BTC (27/10/2025, hiệu lực 01/01/2026, áp dụng cho năm tài chính bắt đầu
// từ 01/01/2026, thay thế TT200). Chép nguyên văn tên chỉ tiêu + mã số từ Phụ lục IV, Mục 1 — Công báo số 1577 + 1578 ngày 16/11/2025:
//   B 01 - DN  Báo cáo tình hình tài chính (thay "Bảng cân đối kế toán")
//   B 02 - DN  Báo cáo kết quả hoạt động kinh doanh
//   B 03 - DN  Báo cáo lưu chuyển tiền tệ (phương pháp trực tiếp)
// Ghi chú của mẫu: chỉ tiêu không có số liệu được miễn trình bày nhưng KHÔNG được đánh lại mã số; chỉ tiêu có dấu (*) ghi số âm.
// TT99 không thay thế TT133 — doanh nghiệp nhỏ và vừa vẫn có thể áp dụng TT133.

export const TEN_CDKT_TT99: [string, string][] = [
  ['100', 'A - TÀI SẢN NGẮN HẠN'], ['110', 'I. Tiền và các khoản tương đương tiền'], ['111', '1. Tiền'], ['112', '2. Các khoản tương đương tiền'],
  ['120', 'II. Đầu tư tài chính ngắn hạn'], ['121', '1. Chứng khoán kinh doanh'], ['122', '2. Dự phòng giảm giá chứng khoán kinh doanh (*)'],
  ['123', '3. Đầu tư nắm giữ đến ngày đáo hạn ngắn hạn'], ['124', '4. Dự phòng đầu tư nắm giữ đến ngày đáo hạn ngắn hạn (*)'], ['125', '5. Đầu tư ngắn hạn khác'],
  ['126', '6. Dự phòng tổn thất các khoản đầu tư ngắn hạn khác (*)'],
  ['130', 'III. Các khoản phải thu ngắn hạn'], ['131', '1. Phải thu ngắn hạn của khách hàng'], ['132', '2. Trả trước cho người bán ngắn hạn'], ['133', '3. Phải thu nội bộ ngắn hạn'],
  ['134', '4. Phải thu theo tiến độ hợp đồng xây dựng'], ['135', '5. Phải thu ngắn hạn khác'], ['136', '6. Dự phòng phải thu ngắn hạn khó đòi (*)'], ['137', '7. Tài sản thiếu chờ xử lý'],
  ['140', 'IV. Hàng tồn kho'], ['141', '1. Hàng tồn kho'], ['142', '2. Dự phòng giảm giá hàng tồn kho (*)'],
  ['150', 'V. Tài sản sinh học ngắn hạn'], ['151', '1. Súc vật nuôi lấy sản phẩm một lần ngắn hạn'], ['152', '2. Cây trồng theo mùa vụ hoặc lấy sản phẩm một lần ngắn hạn'],
  ['153', '3. Dự phòng tổn thất tài sản sinh học ngắn hạn (*)'],
  ['160', 'VI. Tài sản ngắn hạn khác'], ['161', '1. Chi phí chờ phân bổ ngắn hạn'], ['162', '2. Thuế GTGT được khấu trừ'], ['163', '3. Thuế và các khoản khác phải thu Nhà nước'],
  ['164', '4. Giao dịch mua bán lại trái phiếu Chính phủ'], ['165', '5. Tài sản ngắn hạn khác'],
  ['200', 'B - TÀI SẢN DÀI HẠN'], ['210', 'I. Các khoản phải thu dài hạn'], ['211', '1. Phải thu dài hạn của khách hàng'], ['212', '2. Trả trước cho người bán dài hạn'],
  ['213', '3. Vốn kinh doanh ở đơn vị trực thuộc'], ['214', '4. Phải thu nội bộ dài hạn'], ['215', '5. Phải thu dài hạn khác'], ['216', '6. Dự phòng phải thu dài hạn khó đòi (*)'],
  ['220', 'II. Tài sản cố định'], ['221', '1. Tài sản cố định hữu hình'], ['222', '– Nguyên giá'], ['223', '– Giá trị hao mòn lũy kế (*)'],
  ['224', '2. Tài sản cố định thuê tài chính'], ['225', '– Nguyên giá'], ['226', '– Giá trị hao mòn lũy kế (*)'], ['227', '3. Tài sản cố định vô hình'], ['228', '– Nguyên giá'],
  ['229', '– Giá trị hao mòn lũy kế (*)'],
  ['230', 'III. Tài sản sinh học dài hạn'], ['231', '1. Súc vật nuôi cho sản phẩm định kỳ'], ['232', 'a) Súc vật nuôi cho sản phẩm định kỳ chưa đến giai đoạn trưởng thành'],
  ['233', 'b) Súc vật nuôi cho sản phẩm định kỳ đến giai đoạn trưởng thành'], ['234', '– Nguyên giá'], ['235', '– Giá trị khấu hao lũy kế (*)'],
  ['236', '2. Súc vật nuôi lấy sản phẩm một lần dài hạn'], ['237', '3. Cây trồng theo mùa vụ hoặc lấy sản phẩm một lần dài hạn'], ['238', '4. Dự phòng tổn thất tài sản sinh học dài hạn (*)'],
  ['240', 'IV. Bất động sản đầu tư'], ['241', '– Nguyên giá'], ['242', '– Giá trị hao mòn lũy kế (*)'],
  ['250', 'V. Tài sản dở dang dài hạn'], ['251', '1. Chi phí sản xuất, kinh doanh dở dang dài hạn'], ['252', '2. Chi phí xây dựng cơ bản dở dang'],
  ['260', 'VI. Đầu tư tài chính dài hạn'], ['261', '1. Đầu tư vào công ty con'], ['262', '2. Đầu tư vào công ty liên doanh, liên kết'], ['263', '3. Đầu tư góp vốn vào đơn vị khác'],
  ['264', '4. Dự phòng tổn thất đầu tư vào đơn vị khác dài hạn (*)'], ['265', '5. Đầu tư nắm giữ đến ngày đáo hạn dài hạn'], ['266', '6. Dự phòng đầu tư nắm giữ đến ngày đáo hạn dài hạn (*)'],
  ['270', 'VII. Tài sản dài hạn khác'], ['271', '1. Chi phí chờ phân bổ dài hạn'], ['272', '2. Tài sản thuế thu nhập hoãn lại'], ['273', '3. Thiết bị, vật tư, phụ tùng thay thế dài hạn'],
  ['274', '4. Tài sản dài hạn khác'],
  ['280', 'TỔNG CỘNG TÀI SẢN (280 = 100 + 200)'],
  ['300', 'C - NỢ PHẢI TRẢ'], ['310', 'I. Nợ ngắn hạn'], ['311', '1. Phải trả người bán ngắn hạn'], ['312', '2. Người mua trả tiền trước ngắn hạn'], ['313', '3. Phải trả cổ tức, lợi nhuận'],
  ['314', '4. Thuế và các khoản phải nộp Nhà nước ngắn hạn'], ['315', '5. Phải trả người lao động'], ['316', '6. Chi phí phải trả ngắn hạn'], ['317', '7. Phải trả nội bộ ngắn hạn'],
  ['318', '8. Phải trả theo tiến độ hợp đồng xây dựng ngắn hạn'], ['319', '9. Doanh thu chờ phân bổ ngắn hạn'], ['320', '10. Phải trả ngắn hạn khác'],
  ['321', '11. Vay và nợ thuê tài chính ngắn hạn'], ['322', '12. Dự phòng phải trả ngắn hạn'], ['323', '13. Quỹ khen thưởng, phúc lợi'], ['324', '14. Quỹ bình ổn giá'],
  ['325', '15. Giao dịch mua bán lại trái phiếu Chính phủ'],
  ['330', 'II. Nợ dài hạn'], ['331', '1. Phải trả người bán dài hạn'], ['332', '2. Người mua trả tiền trước dài hạn'], ['333', '3. Thuế và các khoản phải nộp Nhà nước dài hạn'],
  ['334', '4. Chi phí phải trả dài hạn'], ['335', '5. Phải trả nội bộ về vốn kinh doanh'], ['336', '6. Phải trả nội bộ dài hạn'], ['337', '7. Doanh thu chờ phân bổ dài hạn'],
  ['338', '8. Phải trả dài hạn khác'], ['339', '9. Vay và nợ thuê tài chính dài hạn'], ['340', '10. Trái phiếu chuyển đổi'], ['341', '11. Cổ phiếu ưu đãi'],
  ['342', '12. Thuế thu nhập hoãn lại phải trả'], ['343', '13. Dự phòng phải trả dài hạn'], ['344', '14. Quỹ phát triển khoa học và công nghệ'],
  ['400', 'D - VỐN CHỦ SỞ HỮU'], ['411', '1. Vốn góp của chủ sở hữu'], ['411a', '– Cổ phiếu phổ thông có quyền biểu quyết'], ['411b', '– Cổ phiếu ưu đãi'],
  ['412', '2. Thặng dư vốn'], ['413', '3. Quyền chọn chuyển đổi trái phiếu'], ['414', '4. Vốn khác của chủ sở hữu'], ['415', '5. Cổ phiếu mua lại của chính mình (*)'],
  ['416', '6. Chênh lệch đánh giá lại tài sản'], ['417', '7. Chênh lệch tỷ giá hối đoái'], ['418', '8. Quỹ đầu tư phát triển'], ['419', '9. Quỹ khác thuộc vốn chủ sở hữu'],
  ['420', '10. Lợi nhuận sau thuế chưa phân phối'], ['420a', '– LNST chưa phân phối lũy kế đến cuối kỳ trước'], ['420b', '– LNST chưa phân phối kỳ này'],
  ['440', 'TỔNG CỘNG NGUỒN VỐN (440 = 300 + 400)'],
]

/** Công thức cộng các dòng tổng — mẫu chỉ in công thức cho 280 và 440; các nhóm còn lại cộng theo đúng các mã con liệt kê dưới nhóm */
export const CONG_CDKT_TT99: [string, string[]][] = [
  ['110', ['111', '112']], ['120', ['121', '122', '123', '124', '125', '126']], ['130', ['131', '132', '133', '134', '135', '136', '137']], ['140', ['141', '142']],
  ['150', ['151', '152', '153']], ['160', ['161', '162', '163', '164', '165']], ['100', ['110', '120', '130', '140', '150', '160']],
  ['210', ['211', '212', '213', '214', '215', '216']], ['221', ['222', '223']], ['224', ['225', '226']], ['227', ['228', '229']], ['220', ['221', '224', '227']],
  ['233', ['234', '235']], ['231', ['232', '233']], ['230', ['231', '236', '237', '238']], ['240', ['241', '242']], ['250', ['251', '252']],
  ['260', ['261', '262', '263', '264', '265', '266']], ['270', ['271', '272', '273', '274']], ['200', ['210', '220', '230', '240', '250', '260', '270']], ['280', ['100', '200']],
  ['310', ['311', '312', '313', '314', '315', '316', '317', '318', '319', '320', '321', '322', '323', '324', '325']],
  ['330', ['331', '332', '333', '334', '335', '336', '337', '338', '339', '340', '341', '342', '343', '344']], ['300', ['310', '330']],
  ['411', ['411a', '411b']], ['420', ['420a', '420b']], ['400', ['411', '412', '413', '414', '415', '416', '417', '418', '419', '420']], ['440', ['300', '400']],
]

export const TEN_KQKD_TT99: [string, string][] = [
  ['01', '1. Doanh thu bán hàng và cung cấp dịch vụ'], ['02', '2. Các khoản giảm trừ doanh thu'], ['10', '3. Doanh thu thuần về bán hàng và cung cấp dịch vụ (10 = 01 - 02)'],
  ['11', '4. Giá vốn hàng bán'], ['20', '5. Lợi nhuận gộp về bán hàng và cung cấp dịch vụ (20 = 10 - 11)'], ['21', '6. Lãi/lỗ của hoạt động bán, thanh lý bất động sản đầu tư'],
  ['22', '7. Doanh thu hoạt động tài chính'], ['23', '8. Chi phí tài chính'], ['24', '– Trong đó: Chi phí đi vay'], ['25', '9. Chi phí bán hàng'], ['26', '10. Chi phí quản lý doanh nghiệp'],
  ['30', '11. Lợi nhuận thuần từ hoạt động kinh doanh {30 = 20 + 21 + 22 - (23 + 25 + 26)}'], ['31', '12. Thu nhập khác'], ['32', '13. Chi phí khác'],
  ['40', '14. Lợi nhuận khác (40 = 31 - 32)'], ['50', '15. Tổng lợi nhuận kế toán trước thuế (50 = 30 + 40)'], ['51', '16. Chi phí thuế TNDN hiện hành'],
  ['52', '17. Chi phí thuế TNDN hoãn lại'], ['60', '18. Lợi nhuận sau thuế thu nhập doanh nghiệp (60 = 50 - 51 - 52)'], ['70', '19. Lãi cơ bản trên cổ phiếu (*)'],
  ['71', '20. Lãi suy giảm trên cổ phiếu (*)'],
]

export const CONG_KQKD_TT99: [string, [string, number][]][] = [
  ['10', [['01', 1], ['02', -1]]], ['20', [['10', 1], ['11', -1]]], ['30', [['20', 1], ['21', 1], ['22', 1], ['23', -1], ['25', -1], ['26', -1]]],
  ['40', [['31', 1], ['32', -1]]], ['50', [['30', 1], ['40', 1]]], ['60', [['50', 1], ['51', -1], ['52', -1]]],
]

export const TEN_LCTT_TT99: [string, string][] = [
  ['01', '1. Tiền thu từ bán hàng, cung cấp dịch vụ và doanh thu khác'], ['02', '2. Tiền chi trả cho người cung cấp hàng hóa và dịch vụ'], ['03', '3. Tiền chi trả cho người lao động'],
  ['04', '4. Chi phí đi vay đã trả'], ['05', '5. Thuế thu nhập doanh nghiệp đã nộp'], ['06', '6. Tiền thu khác từ hoạt động kinh doanh'], ['07', '7. Tiền chi khác cho hoạt động kinh doanh'],
  ['20', 'Lưu chuyển tiền thuần từ hoạt động kinh doanh'],
  ['21', '1. Tiền chi để mua sắm, xây dựng TSCĐ và các tài sản dài hạn khác'], ['22', '2. Tiền thu từ thanh lý, nhượng bán TSCĐ và các tài sản dài hạn khác'],
  ['23', '3. Tiền chi cho vay, mua các công cụ nợ của đơn vị khác'], ['24', '4. Tiền thu hồi cho vay, bán lại các công cụ nợ của đơn vị khác'], ['25', '5. Tiền chi đầu tư góp vốn vào đơn vị khác'],
  ['26', '6. Tiền thu hồi đầu tư góp vốn vào đơn vị khác'], ['27', '7. Tiền thu lãi cho vay, cổ tức và lợi nhuận được chia'], ['30', 'Lưu chuyển tiền thuần từ hoạt động đầu tư'],
  ['31', '1. Tiền thu từ phát hành cổ phiếu, nhận vốn góp của chủ sở hữu'], ['32', '2. Tiền trả lại vốn góp cho các chủ sở hữu, mua lại cổ phiếu đã phát hành'],
  ['33', '3. Tiền thu từ đi vay'], ['34', '4. Tiền trả nợ gốc vay'], ['35', '5. Tiền trả nợ gốc thuê tài chính'], ['36', '6. Cổ tức, lợi nhuận đã trả cho chủ sở hữu'],
  ['40', 'Lưu chuyển tiền thuần từ hoạt động tài chính'], ['50', 'Lưu chuyển tiền thuần trong kỳ (50 = 20 + 30 + 40)'], ['60', 'Tiền và tương đương tiền đầu kỳ'],
  ['61', 'Ảnh hưởng của thay đổi tỷ giá hối đoái quy đổi ngoại tệ'], ['70', 'Tiền và tương đương tiền cuối kỳ (70 = 50 + 60 + 61)'],
]

/**
 * Chuyển số CUỐI NĂM của BCTC theo TT200 sang mã TT99 — để làm số ĐẦU NĂM của BCTC năm đầu áp dụng TT99 (năm 2026).
 * Chỉ ghép các chỉ tiêu cùng nội dung; mã TT200 không có chỗ tương ứng rõ ràng (vd 135 phải thu cho vay, 419 quỹ hỗ trợ sắp xếp,
 * 430–432 nguồn kinh phí) trả về trong `khongGhep` để người lập tự xếp.
 */
const DOI_CDKT: Record<string, string> = {
  '100': '100', '110': '110', '111': '111', '112': '112', '120': '120', '121': '121', '122': '122', '123': '123',
  '130': '130', '131': '131', '132': '132', '133': '133', '134': '134', '136': '135', '137': '136', '139': '137',
  '140': '140', '141': '141', '149': '142',
  '150': '160', '151': '161', '152': '162', '153': '163', '154': '164', '155': '165',
  '200': '200', '210': '210', '211': '211', '212': '212', '213': '213', '214': '214', '216': '215', '219': '216',
  '220': '220', '221': '221', '222': '222', '223': '223', '224': '224', '225': '225', '226': '226', '227': '227', '228': '228', '229': '229',
  '230': '240', '231': '241', '232': '242', '240': '250', '241': '251', '242': '252',
  '250': '260', '251': '261', '252': '262', '253': '263', '254': '264', '255': '265',
  '260': '270', '261': '271', '262': '272', '263': '273', '268': '274', '270': '280',
  '300': '300', '310': '310', '311': '311', '312': '312', '313': '314', '314': '315', '315': '316', '316': '317', '317': '318', '318': '319',
  '319': '320', '320': '321', '321': '322', '322': '323', '323': '324', '324': '325',
  '330': '330', '331': '331', '332': '332', '333': '334', '334': '335', '335': '336', '336': '337', '337': '338', '338': '339', '339': '340',
  '340': '341', '341': '342', '342': '343', '343': '344',
  '400': '400', '411': '411', '411a': '411a', '411b': '411b', '412': '412', '413': '413', '414': '414', '415': '415', '416': '416', '417': '417',
  '418': '418', '420': '419', '421': '420', '421a': '420a', '421b': '420b', '440': '440',
}
/** Dòng tổng trung gian của TT200 không có ở TT99 (bỏ qua, không phải số liệu) */
const BO_QUA_TT200 = new Set(['410', '430'])

export function cdktTT200SangTT99(so: Record<string, number>): { so: Record<string, number>; khongGhep: string[] } {
  const kq: Record<string, number> = {}
  const khongGhep: string[] = []
  for (const [m, v] of Object.entries(so)) {
    if (!v) continue
    const moi = DOI_CDKT[m]
    if (moi) kq[moi] = (kq[moi] ?? 0) + v
    else if (!BO_QUA_TT200.has(m)) khongGhep.push(m)
  }
  return { so: kq, khongGhep }
}

/** Kết quả kinh doanh TT200 -> TT99 (cho cột "Năm trước"): DT tài chính 21→22, chi phí tài chính 22→23, lãi vay 23→24 */
export function kqkdTT200SangTT99(so: Record<string, number>): Record<string, number> {
  const doi: Record<string, string> = { '21': '22', '22': '23', '23': '24' }
  const kq: Record<string, number> = {}
  for (const [m, v] of Object.entries(so)) kq[doi[m] ?? m] = v
  return kq
}

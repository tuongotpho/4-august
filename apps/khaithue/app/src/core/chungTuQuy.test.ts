import { describe, expect, it } from 'vitest'
import { docSo, tienBangChu } from './docSo.js'
import { docSaoKe, type SaoKe } from './saoKe.js'
import { QUY_TRONG, lapSoQuy, type SoQuy } from './soQuy.js'
import { khoTrong } from './kho.js'
import { bangS07, bangS08, goiYPhieuTuSaoKe, htmlPhieu, soDuTruoc, tkDoiUng, tonDauToiThieu, type NguoiKyQuy } from './chungTuQuy.js'

describe('đọc số tiền bằng chữ', () => {
  it.each([
    [0, 'không'], [5, 'năm'], [10, 'mười'], [15, 'mười lăm'], [21, 'hai mươi mốt'], [24, 'hai mươi bốn'], [105, 'một trăm linh năm'],
    [1_000, 'một nghìn'], [1_005, 'một nghìn không trăm linh năm'], [1_205_000, 'một triệu hai trăm linh năm nghìn'],
    [31_662_900, 'ba mươi mốt triệu sáu trăm sáu mươi hai nghìn chín trăm'],
    [380_000_000, 'ba trăm tám mươi triệu'], [2_000_000_000, 'hai tỷ'],
    [1_000_000_005, 'một tỷ không trăm linh năm'],
    [24_587_034, 'hai mươi bốn triệu năm trăm tám mươi bảy nghìn không trăm ba mươi bốn'],
  ])('%i', (n, chu) => expect(docSo(n)).toBe(chu))
  it('viết hoa chữ đầu, thêm "đồng"', () => expect(tienBangChu(50_000)).toBe('Năm mươi nghìn đồng'))
})

// Mẫu sao kê MB Bank (Excel): cột PHÁT SINH NỢ / PHÁT SINH CÓ, BÚT TOÁN, xếp mới -> cũ
const MB = [
  ['SAO KÊ CHI TIẾT TÀI KHOẢN\nAccount Statement', null, null, null, null, 'NGÂN HÀNG TMCP QUÂN ĐỘI'],
  ['Tên khách hàng/Customer name: CONG TY A\n\nTài khoản/Account No: 123456789999'],
  ['Số dư đầu kỳ/ Opening Balance: 100,000,000 VND'],
  ['STT', 'NGÀY GIAO DỊCH', 'NGÀY HẠCH TOÁN', 'PHÁT SINH NỢ', 'PHÁT SINH CÓ', 'SỐ DƯ', 'ĐƠN VỊ THỤ HƯỞNG/ĐƠN VỊ CHUYỂN', 'NỘI DUNG', 'BÚT TOÁN'],
  ['6', '20/02/2026 01:00:00', '20/02/2026', '0.0', '1000.0', '406380632.0', '', 'Tra lai tien gui, so TK: 123456789999-20260220', '123456789999-20260220'],
  ['5', '16/02/2026 14:30:44', '16/02/2026', '15662900.0', '0.0', '406379632.0', 'NGUYEN VAN A', 'chuyen tien HD12C26AAA', 'FT5'],
  ['4', '15/02/2026 09:48:27', '15/02/2026', '20000000.0', '0.0', '422042532.0', 'NGUYEN VAN A', 'ung tien', 'FT4'],
  ['3', '10/02/2026 08:00:00', '10/02/2026', '0.0', '300000000.0', '442042532.0', 'CONG TY KHACH HANG B', 'TT tien hang', 'FT3'],
  ['2', '05/02/2026 10:00:00', '05/02/2026', '7957468.0', '0.0', '142042532.0', 'KHO BAC NHA NUOC KHU VUC X', 'NTDT+KB:1261 +MST:0100000001 (C:755-TM:1701-KT:00/Q4/2025-ST: 7957468-GChu:)', 'FT2'],
  ['1', '03/02/2026 07:00:00', '03/02/2026', '0.0', '50000000.0', '150000000.0', 'NGUYEN VAN A', 'NGUYEN VAN A chuyen tien', 'FT1'],
  ['', '', 'TỔNG TIỀN', '43620368.0', '350001000.0'],
]

const TQ: NguoiKyQuy = { giamDoc: 'Nguyễn Văn A', keToanTruong: 'Kế toán A', nguoiLap: 'Kế toán A', thuQuy: 'Nguyễn Văn A', nhanDien: ['Nguyễn Văn A'] }

function saoKe(): SaoKe {
  const sk = docSaoKe(MB as never, 'mb.xlsx')!
  return { ...sk, id: 'sk1' }
}

describe('sao kê MB Bank', () => {
  it('đọc được cột phát sinh nợ/có, số bút toán, số tài khoản', () => {
    const sk = saoKe()
    expect(sk.soTaiKhoan).toBe('123456789999')
    expect(sk.nganHang).toBe('MB')
    expect(sk.giaoDich).toHaveLength(6)
    expect(sk.giaoDich.find((g) => g.soCT === 'FT1')).toMatchObject({ ngay: '03/02/2026', vao: 50_000_000, ra: 0, doiUng: 'NGUYEN VAN A' })
  })
})

describe('gợi ý phiếu thu/chi từ sao kê (giám đốc kiêm thủ quỹ)', () => {
  it('ra cho thủ quỹ = phiếu THU (Nợ 1111/Có 1121), vào từ thủ quỹ = phiếu CHI; đánh số theo ngày', () => {
    let n = 0
    const g = goiYPhieuTuSaoKe([saoKe()], QUY_TRONG(), TQ, '', '', () => `p${++n}`)
    expect(g.phieu.map((p) => [p.so, p.ngay, p.loai, p.soTien, p.tkNo, p.tkCo])).toEqual([
      ['PC001', '03/02/2026', 'chi', 50_000_000, '1121', '1111'],
      ['PT001', '15/02/2026', 'thu', 20_000_000, '1111', '1121'],
      ['PT002', '16/02/2026', 'thu', 15_662_900, '1111', '1121'],
    ])
    expect(g.phieu[0].doiTac).toBe('Nguyễn Văn A')
    expect(g.phieu[0].noiDung).toContain('bút toán FT1')
    // nội dung nhắc hoá đơn / ứng tiền -> cần xem lại
    expect(g.canXem.map((x) => x.phieu.so)).toEqual(['PT001', 'PT002'])
  })

  it('nạp lại sao kê không lập trùng phiếu; số phiếu nối tiếp', () => {
    const quy: SoQuy = QUY_TRONG()
    const lan1 = goiYPhieuTuSaoKe([saoKe()], quy, TQ, '', '15/02/2026')
    for (const p of lan1.phieu) quy.phieu[p.id] = p
    const lan2 = goiYPhieuTuSaoKe([saoKe()], quy, TQ)
    expect(lan2.daCo).toBe(2)
    expect(lan2.phieu.map((p) => p.so)).toEqual(['PT002'])
  })

  it('tồn đầu tối thiểu: chi nộp ngân hàng trước khi có thu -> quỹ âm', () => {
    const quy: SoQuy = QUY_TRONG()
    for (const p of goiYPhieuTuSaoKe([saoKe()], quy, TQ).phieu) quy.phieu[p.id] = p
    const kq = lapSoQuy(khoTrong(), 'x', quy)
    expect(kq.tonCuoi).toBe(-50_000_000 + 20_000_000 + 15_662_900)
    expect(tonDauToiThieu(kq)).toBe(50_000_000)
    expect(kq.canhBao.some((c) => c.noiDung.includes('ÂM'))).toBe(true)
  })
})

describe('sổ tiền gửi S08-DNN và sổ quỹ S07-DNN', () => {
  it('TK đối ứng: thủ quỹ 1111, thuế theo tiểu mục, lãi 515, chưa rõ để trống', () => {
    const sk = saoKe()
    const tk = (ct: string, ghep: 'ban' | 'mua' | null = null) => tkDoiUng(sk.giaoDich.find((g) => g.soCT === ct)!, ghep, TQ)
    expect(tk('FT1')).toBe('1111')
    expect(tk('FT2')).toBe('33311')
    expect(tk('FT3')).toBe('')
    expect(tk('FT3', 'ban')).toBe('131')
    expect(tk('123456789999-20260220')).toBe('515')
  })

  it('số dư đầu kỳ suy từ cột số dư (file xếp mới -> cũ), sổ cộng đúng số dư cuối', () => {
    const sk = saoKe()
    expect(soDuTruoc(sk, '')).toBe(100_000_000)
    const { bang, thieuTk, soDuCuoi } = bangS08(sk, 100_000_000, new Map(), null, TQ, '', '', '30/09/2026')
    expect(soDuCuoi).toBe(406_380_632)
    expect(thieuTk).toBe(1)
    expect(bang.find((r) => r[3] === 'Cộng số phát sinh trong kỳ')?.slice(5, 7)).toEqual([350_001_000, 43_620_368])
  })

  it('S07: tồn đầu, cộng phát sinh, tồn cuối', () => {
    const quy: SoQuy = { caiDat: { tonDau: 50_000_000, ngayTonDau: '01/01/2026', nguoiKy: TQ }, phieu: {} }
    for (const p of goiYPhieuTuSaoKe([saoKe()], quy, TQ).phieu) quy.phieu[p.id] = p
    const kq = lapSoQuy(khoTrong(), 'x', quy)
    const b = bangS07(kq, null, TQ, 'Quý 1/2026', '31/03/2026')
    expect(b.find((r) => r[4] === 'Số tồn cuối kỳ')?.[7]).toBe(35_662_900)
    expect(b.find((r) => r[4] === 'Cộng số phát sinh trong kỳ')?.slice(5, 7)).toEqual([35_662_900, 50_000_000])
  })
})

describe('in phiếu 01-TT / 02-TT', () => {
  it('đủ nội dung bắt buộc của chứng từ', () => {
    const quy = QUY_TRONG()
    const [p] = goiYPhieuTuSaoKe([saoKe()], quy, TQ).phieu
    const html = htmlPhieu([p], { tenNNT: 'CÔNG TY A', dchiNNT: 'Phú Thọ' } as never, TQ)
    for (const s of ['Mẫu số 02 - TT', 'PHIẾU CHI', 'Ngày 03 tháng 02 năm 2026', 'Số: <b>PC001</b>', 'Nợ: 1121', 'Có: 1111', 'Năm mươi triệu đồng', 'Người nhận tiền', 'Thủ quỹ', 'Thông tư số 133/2016/TT-BTC']) {
      expect(html).toContain(s)
    }
  })
})

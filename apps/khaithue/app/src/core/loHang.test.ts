import { describe, expect, it } from 'vitest'
import { datLo, gopTuMay, khoTrong, napGoc, napHoaDon, xoaLo, type Kho } from './kho.js'
import { goiYLo, tinhLo, tongHopLo, type LoHang } from './loHang.js'
import type { HoaDonGoc } from './hoaDonGoc.js'
import type { HoaDon, HoSoDN } from './types.js'

const CTY = '2601102955'
const NCC = '2601066601' // viên nén
const XE = '2600937045' // nhà xe
const KHACH = '2600835029'

const hd = (h: Partial<HoaDon>): HoaDon => ({
  loai: 'mua', kyHieuMau: '1', kyHieu: 'C25TKL', so: '1', ngay: '10/03/2025', mstBan: NCC, tenBan: 'BẢO KHÁNH LINH', mstMua: CTY, tenMua: 'NGA ANH',
  chuaThue: 0, thue: 0, trangThai: 'Hóa đơn mới', file: 'x.xlsx', ...h,
})
const goc = (h: Partial<HoaDonGoc>): HoaDonGoc => ({
  nguon: 'pdf', tenFile: 'f.pdf', kyHieuMau: '1', kyHieu: 'C25TKL', so: '1', ngay: '10/03/2025', mstBan: NCC, tenBan: 'BẢO KHÁNH LINH', mstMua: CTY, tenMua: 'NGA ANH',
  chuaThue: 0, thue: 0, tong: 0, dong: [], mccqt: '', kyBan: null, ngayKy: '', lienQuan: null, ...h,
})

function dung(): Kho {
  let kho: Kho = { ...khoTrong(), chon: CTY, congTy: { [CTY]: { hoSo: { mst: CTY, tenNNT: 'NGA ANH' } as HoSoDN, kyNguon: '', suaTay: false } } }
  kho = napHoaDon(kho, CTY, [
    hd({ so: '1', ngay: '10/03/2025', chuaThue: 90_000_000, thue: 7_200_000 }), // 40 tấn viên nén
    hd({ so: '2', ngay: '11/03/2025', chuaThue: 45_000_000, thue: 3_600_000 }), // 20 tấn (đơn vị kg trên hoá đơn)
    hd({ kyHieu: 'C25TMV', so: '7', ngay: '12/03/2025', mstBan: XE, tenBan: 'MẠNH VINH', chuaThue: 8_000_000, thue: 640_000 }), // cước
    hd({ loai: 'ban', kyHieu: 'C25TNA', so: '30', ngay: '12/03/2025', mstBan: CTY, mstMua: KHACH, tenMua: 'RENTECH', chuaThue: 150_000_000, thue: 12_000_000 }),
    hd({ loai: 'ban', kyHieu: 'C25TNA', so: '31', ngay: '20/03/2025', mstBan: CTY, mstMua: KHACH, tenMua: 'RENTECH', chuaThue: 10_000_000, thue: 800_000 }), // chưa có file gốc
  ])
  for (const g of [
    goc({ so: '1', chuaThue: 90_000_000, dong: [{ ten: 'Viên nén gỗ', dvt: 'Tấn', sl: 40, dg: 2_250_000, tt: 90_000_000, ts: '8%' }] }),
    goc({ so: '2', ngay: '11/03/2025', chuaThue: 45_000_000, dong: [{ ten: 'Viên nén gỗ', dvt: 'kg', sl: 20_000, dg: 2250, tt: 45_000_000, ts: '8%' }] }),
    goc({ kyHieu: 'C25TMV', so: '7', ngay: '12/03/2025', mstBan: XE, chuaThue: 8_000_000, dong: [{ ten: 'Cước vận chuyển viên nén', dvt: 'Tấn', sl: 60, dg: 133_333, tt: 8_000_000, ts: '8%' }] }),
    goc({ kyHieu: 'C25TNA', so: '30', ngay: '12/03/2025', mstBan: CTY, mstMua: KHACH, chuaThue: 150_000_000, dong: [{ ten: 'Viên nén gỗ', dvt: 'tấn', sl: 60, dg: 2_500_000, tt: 150_000_000, ts: '8%' }] }),
  ]) kho = napGoc(kho, g).kho
  return kho
}
const K = { m1: 'mua|2601066601|C25TKL|1', m2: 'mua|2601066601|C25TKL|2', xe: 'mua|2600937045|C25TMV|7', b30: 'ban||C25TNA|30', b31: 'ban||C25TNA|31' }
const lo = (o: Partial<LoHang>): LoHang => ({ id: 'lo1', ten: 'Lô 12/03', ngayTao: '2025-03-12', ghiChu: '', hoaDon: [], giayTo: [], ...o })

describe('Lô hàng', () => {
  it('tính tấn (đổi kg -> tấn), giá vốn, cước, doanh thu, lãi gộp; xếp hoá đơn đúng nhóm', () => {
    const k = tinhLo(dung(), CTY, lo({ hoaDon: [K.m1, K.m2, K.xe, K.b30] }))
    expect(k).toMatchObject({ tanMua: 60, tanBan: 60, chenhTan: 0, giaVon: 135_000_000, cuoc: 8_000_000, doanhThu: 150_000_000, laiGop: 7_000_000, thueDauVao: 11_440_000, thueDauRa: 12_000_000, tuNgay: '10/03/2025', denNgay: '12/03/2025' })
    expect(k.hoaDon.map((h) => [h.so, h.nhom])).toEqual([['1', 'vienNen'], ['2', 'vienNen'], ['7', 'vanChuyen'], ['30', 'banRa']])
    expect(k.nhaCungCap).toEqual(['BẢO KHÁNH LINH'])
    expect(k.benMua).toEqual(['RENTECH'])
    // thiếu cả 4 giấy tờ bắt buộc + hợp đồng xe (vì có cước)
    expect(k.giayToThieu).toEqual(['hopDongMua', 'hopDongBan', 'phieuCan', 'bienBanGiaoNhan', 'hopDongXe'])
    expect(k.canhBao).toEqual([])
  })
  it('bán nhiều tấn hơn mua -> LỖI bán khống; thiếu file gốc -> không biết tấn, gõ tay thì dùng số gõ tay', () => {
    const khong = tinhLo(dung(), CTY, lo({ hoaDon: [K.m2, K.b30] }))
    expect(khong.chenhTan).toBe(40)
    expect(khong.canhBao.find((c) => c.muc === 'loi')!.noiDung).toContain('bán 60 tấn NHIỀU HƠN mua 20 tấn')
    const thieu = tinhLo(dung(), CTY, lo({ hoaDon: [K.m1, K.b31] }))
    expect(thieu.tanBan).toBeNull()
    expect(thieu.canhBao.map((c) => c.noiDung)).toEqual([expect.stringContaining('chưa đủ số tấn'), expect.stringContaining('lỗ 80.000.000 đ')])
    // bán nhỉnh hơn mua dưới 1% (40,2 so với 40) -> chỉ chú ý (chênh cân), không phải lỗi
    const can = tinhLo(dung(), CTY, lo({ hoaDon: [K.m1, K.b31], tanTay: { ban: 40.2 } }))
    expect(can.canhBao.filter((c) => c.noiDung.includes('chênh cân')).map((c) => c.muc)).toEqual(['chu_y'])
    const tay = tinhLo(dung(), CTY, lo({ hoaDon: [K.m1, K.b31], tanTay: { ban: 4 } }))
    expect([tay.tanMua, tay.tanBan, tay.chenhTan]).toEqual([40, 4, -36])
  })
  it('đủ giấy tờ; hoá đơn bị thay thế trong lô -> LỖI, không tính tiền', () => {
    const giay = (['hopDongMua', 'hopDongBan', 'phieuCan', 'bienBanGiaoNhan'] as const).map((loai) => ({ loai, ten: `${loai}.pdf`, duongDan: 'x', kichThuoc: 1 }))
    let kho = dung()
    expect(tinhLo(kho, CTY, lo({ hoaDon: [K.m1, K.b30], giayTo: giay })).giayToThieu).toEqual([])
    kho = napHoaDon(kho, CTY, [hd({ so: '1', chuaThue: 90_000_000, thue: 7_200_000, trangThai: 'Hóa đơn bị thay thế' })])
    const k = tinhLo(kho, CTY, lo({ hoaDon: [K.m1, K.b30], giayTo: giay }))
    expect(k.giaVon).toBe(0)
    expect(k.canhBao[0]).toMatchObject({ muc: 'loi', noiDung: expect.stringContaining('C25TKL-1 đã bị thay thế') })
  })
  it('tổng hợp: hoá đơn chưa vào lô, hoá đơn nằm trong 2 lô, luỹ kế tấn theo năm; gợi ý ghép lô 7 ngày', () => {
    let kho = dung()
    kho = datLo(kho, CTY, lo({ id: 'a', ten: 'A', hoaDon: [K.m1, K.b30] }))
    kho = datLo(kho, CTY, lo({ id: 'b', ten: 'B', hoaDon: [K.m1] }))
    const t = tongHopLo(kho, CTY, Object.values(kho.loHang![CTY]))
    expect(t.chuaVaoLo.map((h) => h.so).sort()).toEqual(['2', '31', '7'])
    expect(t.trungLo).toEqual([{ khoa: K.m1, lo: ['A', 'B'] }])
    expect(t.canhBao.some((c) => c.muc === 'loi' && c.noiDung.includes('nằm trong 2 lô'))).toBe(true)
    expect(t.theoNam).toEqual([{ nam: 2025, tanMua: 60, tanBan: 60, hoaDonThieuGoc: 1 }])
    // chưa có lô nào: gợi ý ghép HĐ bán 30 với mua 1, 2 và cước 7 (trong 7 ngày trước); HĐ bán 31 không còn HĐ mua nào để ghép
    const g = goiYLo(tongHopLo(dung(), CTY, []))
    expect(g.map((x) => [x.ban.so, x.mua.map((m) => m.so), x.cuoc.map((c) => c.so)])).toEqual([['30', ['1', '2'], ['7']]])
    expect(Object.keys(xoaLo(kho, CTY, 'b').loHang![CTY])).toEqual(['a'])
  })
  it('đồng bộ từ mây: danh sách lô trên mây thay hẳn bản trên máy', () => {
    const kho = datLo(dung(), CTY, lo({ id: 'cu', ten: 'Cũ' }))
    const moi = gopTuMay(kho, [], [], [], [], [{ mst: CTY, lo: lo({ id: 'moi', ten: 'Mới' }) }])
    expect(Object.keys(moi.loHang![CTY])).toEqual(['moi'])
    expect(gopTuMay(kho, [], [], [], []).loHang![CTY].cu).toBeTruthy() // không có danh sách từ mây -> giữ nguyên
  })
})

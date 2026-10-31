// Đi một vòng thật trên máy giả lập: đăng nhập -> lưu tờ khai + file Excel -> tải về -> dựng lại sổ
import { describe, expect, it } from 'vitest'
import { GoogleAuthProvider, signInAnonymously, signInWithCredential, signOut } from 'firebase/auth'
import { auth } from '../src/may/firebase'
import { khoaTepGoc, datCoTraVe, luuChungTu, xoaCongTyTrenMay, xoaTaiLieu, luuCongTy, luuDaXuat, luuTepHoaDon, luuToKhai, taiDuLieuMay, taiTep, luuLoHang, taiLenGiayTo, xoaLoHang, luuSaoKe, luuGhepTay, xoaSaoKeMay, themNguoiXem, boNguoiXem, taiNguoiXem, taiChiaSeChoToi, luuPhieuQuy, xoaPhieuQuy, luuTonDauQuy } from '../src/may/dongBo'
import { docTaiLieu } from '../src/core/taiLieu'
import { tinhTongQuan } from '../src/core/tongQuan'
import { docToKhai } from '../src/core/docToKhai'
import { dauKy, gopTuMay, khoTrong } from '../src/core/kho'
import { docXmlGoc, gocThanhHoaDon } from '../src/core/hoaDonGoc'
import { khoaCuaXem, parseInvoice } from '../src/core/xemHoaDon'
import { rutGonHoaDon } from '../src/core/kho'

const xml = (ky: string, ct43: number, ct22 = 0) => `<?xml version="1.0" encoding="UTF-8"?><HSoThueDTu xmlns="http://kekhaithue.gdt.gov.vn/TKhaiThue"><HSoKhaiThue id="ID_1"><TTinChung><TTinTKhaiThue><TKhaiThue><maTKhai>842</maTKhai><loaiTKhai>C</loaiTKhai><soLan>0</soLan><KyKKhaiThue><kyKKhai>${ky}</kyKKhai></KyKKhaiThue><maCQTNoiNop>21701</maCQTNoiNop><tenCQTNoiNop>CQT</tenCQTNoiNop><nguoiKy>A</nguoiKy></TKhaiThue><NNT><mst>0100000000</mst><tenNNT>Cty Mẫu</tenNNT><dchiNNT>X</dchiNNT><maTinhNNT>217</maTinhNNT><tenTinhNNT>PT</tenTinhNNT></NNT></TTinTKhaiThue></TTinChung><CTieuTKhaiChinh><ct22>${ct22}</ct22><ct43>${ct43}</ct43></CTieuTKhaiChinh></HSoKhaiThue></HSoThueDTu>`

describe('Đồng bộ hồ sơ lên mây (máy giả lập)', () => {
  it('lưu rồi tải về dựng lại đúng sổ, đúng file', async () => {
    const { user } = await signInAnonymously(auth)
    const uid = user.uid

    const x1 = xml('1/2026', 500)
    const tk1 = docToKhai(x1)
    const id1 = await luuToKhai(uid, tk1, x1, 'q1.xml')
    const idTrung = await luuToKhai(uid, tk1, x1, 'q1-lan-2.xml') // nạp lại đúng file đó
    expect(idTrung).toBe(id1)
    const x1b = xml('1/2026', 0)
    const id1b = await luuToKhai(uid, docToKhai(x1b), x1b, 'q1-khac.xml')
    await datCoTraVe(uid, '0100000000', [id1], true) // bản [43]=500 bị CQT trả về
    await luuCongTy(uid, { hoSo: { ...tk1.hoSo, nguoiKy: 'Người ký sửa tay' }, kyNguon: '2026-Q1', suaTay: true })

    const excel = new TextEncoder().encode('gia lap file excel').buffer as ArrayBuffer
    await luuTepHoaDon(uid, '0100000000', 'DANH SÁCH HÓA ĐƠN (3).xlsx', excel, { quy: 2, nam: 2026 }, 2, 5, [
      { l: 'ban', mb: '0100000000', kh: 'C26TAA', so: '1', ng: '10/05/2026', ten: 'Khách', v: 100_000_000, t: 8_000_000, tt: 'Hóa đơn mới' },
    ])
    const ctXml = '<?xml version="1.0"?><CHUNGTU><SO_CTU>77</SO_CTU><MST_NNOP>0100000000</MST_NNOP><NGAY_LAP>31/07/2026</NGAY_LAP><TONG_TIEN>4000</TONG_TIEN><ROW_CTIET><MA_NDKT>1701</MA_NDKT><KY_THUE>00/Q2/2026</KY_THUE><TIEN_PNOP>4000</TIEN_PNOP></ROW_CTIET></CHUNGTU>'
    const tl = docTaiLieu(ctXml)
    if (tl.loai === 'chungTu') await luuChungTu(uid, tl.ct, ctXml, 'ct.xml')
    await luuDaXuat(uid, '0100000000', { quy: 2, nam: 2026 }, 'gtgt', '0100000000000-01_GTGT_TT80-Q22026-L00.xml', '<x/>', 123)

    const may = await taiDuLieuMay(uid)
    expect(may.congTy.map((c) => c.hoSo.nguoiKy)).toEqual(['Người ký sửa tay'])
    expect(may.toKhai.map((t) => t.id).sort()).toEqual([id1, id1b].sort())
    expect(may.tepHoaDon['0100000000']).toMatchObject([{ ten: 'DANH SÁCH HÓA ĐƠN (3).xlsx', ky: '2026-Q2', soBan: 2, soMua: 5 }])
    expect(may.daXuat['0100000000']).toMatchObject([{ loai: 'gtgt', ky: '2026-Q2', ct40: 123 }])

    // tải lại file gốc: đúng từng byte
    const ve = await taiTep(may.tepHoaDon['0100000000'][0].duongDan)
    expect(new TextDecoder().decode(ve)).toBe('gia lap file excel')
    const xmlVe = await taiTep(may.toKhai.find((t) => t.id === id1)!.duongDan)
    expect(new TextDecoder().decode(xmlVe)).toBe(x1)

    // dựng lại sổ: bỏ bản bị trả về -> [22] quý 2 = 0
    const kho = gopTuMay(khoTrong(), may.congTy, may.toKhai, may.chungTu, Object.entries(may.tepHoaDon).flatMap(([m, ds]) => ds.map((d) => ({ mst: m, hd: d.hd ?? [] }))))
    // chứng từ + hoá đơn rút gọn về đủ -> tổng quan quý 2/2026 thấy đã nộp 4.000 và 1 hoá đơn bán ra
    const q2 = tinhTongQuan(kho, '0100000000', new Date(2026, 9, 3)).quy.find((x) => x.khoa === '2026-Q2')!
    expect(q2.daNop).toBe(4000)
    expect(q2.hoaDon?.ban).toEqual({ n: 1, v: 100_000_000, t: 8_000_000 })
    expect(kho.congTy['0100000000'].hoSo.nguoiKy).toBe('Người ký sửa tay')
    expect(dauKy(kho, '0100000000', { quy: 2, nam: 2026 }).ct22).toBe(0)
  })

  it('xoá 1 file và xoá toàn bộ công ty: sạch trên mây, không đụng công ty khác', async () => {
    await signOut(auth) // tài khoản mới, không dính dữ liệu của test trước
    const { user } = await signInAnonymously(auth)
    const uid = user.uid
    const x1 = xml('1/2026', 500)
    await luuCongTy(uid, { hoSo: docToKhai(x1).hoSo, kyNguon: '', suaTay: false }) // app luôn lưu công ty trước
    const id = await luuToKhai(uid, docToKhai(x1), x1, 'q1.xml')
    await luuTepHoaDon(uid, '0100000000', 'a.xlsx', new TextEncoder().encode('a').buffer as ArrayBuffer, { quy: 1, nam: 2026 }, 1, 0)
    await luuCongTy(uid, { hoSo: { ...docToKhai(x1).hoSo, mst: '0900000009', tenNNT: 'Cty khác' }, kyNguon: '', suaTay: true })

    let may = await taiDuLieuMay(uid)
    const tk = may.toKhai.find((t) => t.id === id)!
    await xoaTaiLieu(uid, '0100000000', 'toKhai', id, tk.duongDan)
    may = await taiDuLieuMay(uid)
    expect(may.toKhai).toEqual([])
    await expect(taiTep(tk.duongDan)).rejects.toBeTruthy() // file gốc cũng đã xoá

    const n = await xoaCongTyTrenMay(uid, '0100000000')
    expect(n).toBe(1) // còn 1 file hoá đơn
    may = await taiDuLieuMay(uid)
    expect(may.congTy.map((c) => c.hoSo.mst)).toEqual(['0900000009'])
    expect(may.tepHoaDon['0100000000']).toBeUndefined()
  })

  it('lô hàng: lưu lô + tải giấy tờ lên, tải về đúng, xoá lô xoá luôn file; xoá công ty xoá cả lô', async () => {
    await signOut(auth)
    const { user } = await signInAnonymously(auth)
    const uid = user.uid
    const M = '0100000009'
    await luuCongTy(uid, { hoSo: { mst: M, tenNNT: 'Cty Lô' } as never, kyNguon: '', suaTay: false })
    const lo = { id: 'lo-1', ten: 'Lô 01/03', ngayTao: '2026-03-01', ghiChu: '', hoaDon: ['mua|0200000002|C26TBB|7', 'ban||C26TNA|1'], tanTay: { ban: 12.5 }, giayTo: [] as never[] }
    const g = await taiLenGiayTo(uid, M, lo.id, 'phieuCan', new File([new TextEncoder().encode('phieu can so 1')], 'phiếu cân 1.jpg', { type: 'image/jpeg' }))
    expect(g).toMatchObject({ loai: 'phieuCan', ten: 'phiếu cân 1.jpg', kichThuoc: 14 })
    await luuLoHang(uid, M, { ...lo, giayTo: [g] as never[] })
    let may = await taiDuLieuMay(uid)
    expect(may.loHang).toEqual([{ mst: M, lo: expect.objectContaining({ id: 'lo-1', ten: 'Lô 01/03', hoaDon: lo.hoaDon, tanTay: { ban: 12.5 }, giayTo: [g] }) }])
    expect(new TextDecoder().decode(await taiTep(g.duongDan))).toBe('phieu can so 1')
    // dựng lại sổ từ mây: có lô
    const kho = gopTuMay(khoTrong(), may.congTy, may.toKhai, may.chungTu, [], may.loHang)
    expect(Object.keys(kho.loHang![M])).toEqual(['lo-1'])
    await xoaLoHang(uid, M, { ...lo, giayTo: [g] as never[] })
    may = await taiDuLieuMay(uid)
    expect(may.loHang).toEqual([])
    await expect(taiTep(g.duongDan)).rejects.toThrow()
    // lô thứ 2 rồi xoá cả công ty
    const g2 = await taiLenGiayTo(uid, M, 'lo-2', 'hopDongMua', new File([new Uint8Array([1, 2, 3])], 'hd.pdf'))
    await luuLoHang(uid, M, { ...lo, id: 'lo-2', giayTo: [g2] as never[] })
    await xoaCongTyTrenMay(uid, M)
    may = await taiDuLieuMay(uid)
    expect(may.loHang).toEqual([])
    await expect(taiTep(g2.duongDan)).rejects.toThrow()
  })

  it('sao kê: lưu giao dịch + file, gán tay, nạp lại giữ gán tay; xoá', async () => {
    await signOut(auth)
    const { user } = await signInAnonymously(auth)
    const uid = user.uid
    const M = '0100000008'
    await luuCongTy(uid, { hoSo: { mst: M, tenNNT: 'Cty Sao Kê' } as never, kyNguon: '', suaTay: false })
    const sk = { id: 'abc123', tenFile: 'vcb.xlsx', nganHang: 'VIETCOMBANK', soTaiKhoan: '123', tuNgay: '01/08/2025', denNgay: '31/08/2025', giaoDich: [{ id: '4', ngay: '02/08/2025', vao: 0, ra: 54_000_000, noiDung: 'CK', doiUng: '', soDu: null }] }
    const duongDan = await luuSaoKe(uid, M, sk, new TextEncoder().encode('file sao ke').buffer as ArrayBuffer)
    await luuGhepTay(uid, M, sk.id, { '4': ['mua|0200000002|C25TKL|10'] })
    let may = await taiDuLieuMay(uid)
    expect(may.saoKe).toEqual([{ mst: M, sk: expect.objectContaining({ id: 'abc123', tenFile: 'vcb.xlsx', giaoDich: sk.giaoDich, ghepTay: { '4': ['mua|0200000002|C25TKL|10'] }, duongDan }) }])
    expect(new TextDecoder().decode(await taiTep(duongDan!))).toBe('file sao ke')
    const kho = gopTuMay(khoTrong(), may.congTy, may.toKhai, may.chungTu, [], may.loHang, may.saoKe)
    expect(kho.saoKe![M].abc123.ghepTay).toEqual({ '4': ['mua|0200000002|C25TKL|10'] })
    await xoaSaoKeMay(uid, M, sk.id, duongDan)
    may = await taiDuLieuMay(uid)
    expect(may.saoKe).toEqual([])
    await expect(taiTep(duongDan!)).rejects.toThrow()
  })

  it('giám đốc chỉ xem: chủ thêm email -> giám đốc thấy lời mời, đọc được hồ sơ, KHÔNG ghi được; chủ bỏ -> hết đọc', async () => {
    const dangNhap = (email: string) => signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true })))
    await signOut(auth)
    const chu = (await dangNhap('chu@vidu.vn')).user
    const M = '0100000007'
    await luuCongTy(chu.uid, { hoSo: { mst: M, tenNNT: 'Cty Chủ' } as never, kyNguon: '', suaTay: false })
    await luuLoHang(chu.uid, M, { id: 'lo-x', ten: 'Lô X', ngayTao: '2026-01-01', ghiChu: '', hoaDon: [], giayTo: [] })
    await themNguoiXem(chu.uid, { email: 'chu@vidu.vn', ten: 'Anh Chủ' }, ' GiamDoc@ViDu.vn ')
    expect(await taiNguoiXem(chu.uid)).toEqual(['giamdoc@vidu.vn'])

    await signOut(auth)
    await dangNhap('giamdoc@vidu.vn')
    const loiMoi = await taiChiaSeChoToi('giamdoc@vidu.vn')
    expect(loiMoi).toEqual([expect.objectContaining({ chuUid: chu.uid, chuEmail: 'chu@vidu.vn', chuTen: 'Anh Chủ' })])
    const may = await taiDuLieuMay(chu.uid)
    expect(may.congTy.map((c) => c.hoSo.tenNNT)).toEqual(['Cty Chủ'])
    expect(may.loHang.map((x) => x.lo.ten)).toEqual(['Lô X'])
    await expect(luuLoHang(chu.uid, M, { id: 'lo-y', ten: 'Giám đốc tự thêm', ngayTao: '', ghiChu: '', hoaDon: [], giayTo: [] })).rejects.toThrow()

    await signOut(auth)
    const lai = (await dangNhap('chu@vidu.vn')).user
    expect(lai.uid).toBe(chu.uid)
    await boNguoiXem(chu.uid, 'giamdoc@vidu.vn')
    await signOut(auth)
    await dangNhap('giamdoc@vidu.vn')
    expect(await taiChiaSeChoToi('giamdoc@vidu.vn')).toEqual([])
    await expect(taiDuLieuMay(chu.uid)).rejects.toThrow()
  })

  it('sổ quỹ: lưu tồn đầu + phiếu, tải về dựng lại sổ; xoá phiếu; xoá công ty xoá cả sổ quỹ', async () => {
    await signOut(auth)
    const { user } = await signInAnonymously(auth)
    const uid = user.uid
    const M = '0100000006'
    await luuCongTy(uid, { hoSo: { mst: M, tenNNT: 'Cty Quỹ' } as never, kyNguon: '', suaTay: false })
    await luuTonDauQuy(uid, M, { tonDau: 5_000_000, ngayTonDau: '01/01/2025' })
    const p1 = { id: 'p1', loai: 'chi' as const, so: 'PC001', ngay: '02/01/2025', soTien: 1_000_000, nhom: 'khac' as const, noiDung: 'Mua văn phòng phẩm', doiTac: 'A', hoaDon: [] }
    await luuPhieuQuy(uid, M, p1)
    await luuPhieuQuy(uid, M, { ...p1, id: 'p2', so: 'PC002', soTien: 2_000_000 })
    let may = await taiDuLieuMay(uid)
    expect(may.soQuy).toEqual([{ mst: M, caiDat: expect.objectContaining({ tonDau: 5_000_000, ngayTonDau: '01/01/2025' }), phieu: expect.arrayContaining([expect.objectContaining({ id: 'p1', so: 'PC001' }), expect.objectContaining({ id: 'p2' })]) }])
    const kho = gopTuMay(khoTrong(), may.congTy, may.toKhai, may.chungTu, [], may.loHang, may.saoKe, may.soQuy)
    expect(Object.keys(kho.soQuy![M].phieu).sort()).toEqual(['p1', 'p2'])
    await xoaPhieuQuy(uid, M, 'p2')
    may = await taiDuLieuMay(uid)
    expect(may.soQuy[0].phieu.map((p) => p.id)).toEqual(['p1'])
    await xoaCongTyTrenMay(uid, M)
    may = await taiDuLieuMay(uid)
    expect(may.soQuy).toEqual([])
  })

  it('hoá đơn XML: lưu NGUYÊN VĂN file gốc (từng byte, kể cả BOM) + tóm tắt có khoá chống trùng; dựng lại sổ', async () => {
    await signOut(auth)
    const { user } = await signInAnonymously(auth)
    const uid = user.uid
    const M = '0100000007'
    const hd = `﻿<?xml version="1.0" encoding="UTF-8"?><HDon><DLHDon><TTChung><KHMSHDon>1</KHMSHDon><KHHDon>C26TAA</KHHDon><SHDon>00000017</SHDon><NLap>2026-10-08</NLap></TTChung><NDHDon><NBan><Ten>NCC thử</Ten><MST>0109999991</MST></NBan><NMua><Ten>Cty thử</Ten><MST>${M}</MST></NMua><DSHHDVu><HHDVu><TChat>1</TChat><THHDVu>Hàng</THHDVu><ThTien>1000</ThTien><TSuat>8%</TSuat></HHDVu></DSHHDVu><TToan><TgTCThue>1000</TgTCThue><TgTThue>80</TgTThue><TgTTTBSo>1080</TgTTTBSo></TToan></NDHDon></DLHDon><MCCQT>00AB</MCCQT></HDon>`
    const du = new TextEncoder().encode(hd)
    const g = docXmlGoc(new TextDecoder().decode(du), 'hd.xml')!
    await luuCongTy(uid, { hoSo: { mst: M, tenNNT: 'Cty thử' } as never, kyNguon: '', suaTay: false })
    await luuTepHoaDon(uid, M, 'hd.xml', du.slice().buffer as ArrayBuffer, { quy: 4, nam: 2026 }, 0, 1, rutGonHoaDon([gocThanhHoaDon(g, M)], true), undefined, g)
    const may = await taiDuLieuMay(uid)
    const t = may.tepHoaDon[M][0]
    expect(t).toMatchObject({ ten: 'hd.xml', ky: '2026-Q4', soMua: 1, khoaHD: `0109999991|1|C26TAA|17`, goc: { mstBan: '0109999991', mstMua: M, kyHieuMau: '1', kyHieu: 'C26TAA', so: '17', ngay: '08/10/2026', chuaThue: 1000, thue: 80, tong: 1080, mccqt: '00AB' } })
    expect(khoaTepGoc(t)).toBe(khoaCuaXem(parseInvoice(hd)))
    expect([...new Uint8Array(await taiTep(t.duongDan))]).toEqual([...du])
    const kho = gopTuMay(khoTrong(), may.congTy, may.toKhai, may.chungTu, Object.entries(may.tepHoaDon).flatMap(([m, ds]) => ds.map((d) => ({ mst: m, hd: d.hd ?? [], goc: d.goc }))))
    expect(Object.keys(kho.goc![M])).toHaveLength(1)
    expect(kho.hoaDon![M]['mua|0109999991|C26TAA|17']).toMatchObject({ l: 'mua', v: 1000, t: 80 })
    await xoaCongTyTrenMay(uid, M)
  })
})

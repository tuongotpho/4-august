import { describe, expect, it } from 'vitest'
import { CHUA_RO_TINH, demTinh, tinhTuDiaChi } from '../src/lib/tinh'

describe('tỉnh từ địa chỉ người bán', () => {
  it('lấy đoạn cuối, bỏ "Việt Nam" và tiền tố tỉnh / thành phố', () => {
    expect(tinhTuDiaChi('Số 12 Nguyễn Văn Linh, phường Hiến Nam, tỉnh Hưng Yên, Việt Nam')).toBe('Hưng Yên')
    expect(tinhTuDiaChi('Số 1 Tràng Tiền, Phường Hoàn Kiếm, Thành phố Hà Nội')).toBe('Hà Nội')
    expect(tinhTuDiaChi('25 Lê Lợi, Q.1, TP.HCM')).toBe('TP Hồ Chí Minh')
    expect(tinhTuDiaChi('Thôn Đông, xã Tân Lập, Hưng Yên')).toBe('Hưng Yên')
  })
  it('tên tỉnh cũ quy về tỉnh mới (sau 01/7/2025), không phân biệt dấu / cách đặt dấu', () => {
    expect(tinhTuDiaChi('Phường Đề Thám, Thành phố Thái Bình, Tỉnh Thái Bình')).toBe('Hưng Yên')
    expect(tinhTuDiaChi('TP Hải Dương, tỉnh Hải Dương')).toBe('Hải Phòng')
    expect(tinhTuDiaChi('Phường 1, TP Vũng Tàu, Tỉnh Bà Rịa - Vũng Tàu')).toBe('TP Hồ Chí Minh')
    expect(tinhTuDiaChi('xã Yên Thủy, tinh Hoa Binh')).toBe('Phú Thọ')
    expect(tinhTuDiaChi('Khánh Hoà')).toBe('Khánh Hòa')
  })
  it('không có dấu phẩy thì tìm "tỉnh X" trong chuỗi; không đoán được thì "(chưa rõ)"', () => {
    expect(tinhTuDiaChi('Km5 quốc lộ 39 tỉnh Hưng Yên Việt Nam')).toBe('Hưng Yên')
    expect(tinhTuDiaChi('')).toBe(CHUA_RO_TINH)
    expect(tinhTuDiaChi('Số 5 đường Trần Phú, phường Nguyễn Trãi')).toBe(CHUA_RO_TINH)
  })
  it('đếm tỉnh: nhiều nhất trước, chưa rõ cuối', () => {
    const ds = ['Hưng Yên', 'tỉnh Thái Bình', 'Hà Nội', ''].map((diaChiNguoiBan) => ({ diaChiNguoiBan }))
    expect(demTinh(ds)).toEqual([
      { tinh: 'Hưng Yên', soHd: 2 },
      { tinh: 'Hà Nội', soHd: 1 },
      { tinh: CHUA_RO_TINH, soHd: 1 },
    ])
  })
})

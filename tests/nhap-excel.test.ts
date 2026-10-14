import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CAI_DAT_MAC_DINH } from '../src/lib/model'
import { docNgay, nhapExcel, tachLienHe } from '../src/lib/nhapExcel'

describe('đọc ô', () => {
  it('ngày nhiều kiểu', () => {
    expect(docNgay('3-Jan', 2024)).toEqual({ ngay: '2024-01-03', soNgay: 1 })
    expect(docNgay('22-23/2', 2024)).toEqual({ ngay: '2024-02-22', soNgay: 2 })
    expect(docNgay('3/23/2024', 2024)).toEqual({ ngay: '2024-03-23', soNgay: 1 })
    expect(docNgay(46031, 2026)).toEqual({ ngay: '2026-01-09', soNgay: 1 })
    expect(docNgay(null, 2024)).toBeNull()
  })
  it('tách liên hệ kiểu "E Ngọc Anh_TIEC"', () => {
    expect(tachLienHe('E Ngọc Anh_Tiec')).toEqual({ ten: 'Ngọc Anh', doiTac: 'TIEC' })
    expect(tachLienHe('Ch Mai_Viện KTQT')).toEqual({ ten: 'Ch Mai', doiTac: 'KTQT' })
    expect(tachLienHe('A Hải_SHS (thuê)')).toEqual({ ten: 'A Hải', doiTac: 'SHS' })
    expect(tachLienHe('ESC online')).toEqual({ ten: '', doiTac: 'ESC' })
    expect(tachLienHe('Viện An toàn_ESC')).toEqual({ ten: '', doiTac: 'ESC' })
  })
})

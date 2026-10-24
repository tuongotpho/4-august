import { describe, expect, it } from 'vitest'
import cauHinh from '../vercel.json'
import { DS_APP } from './dsApp'

describe('Danh sách app ↔ chuyển tiếp trong vercel.json', () => {
  it('mỗi app có đủ: chuyển hướng không gạch cuối, chuyển tiếp đường dẫn gốc và đường dẫn con', () => {
    for (const a of DS_APP) {
      const ten = a.duongDan.slice(0, -1) // '/quy-phong'
      expect(cauHinh.redirects).toContainEqual({ source: ten, destination: a.duongDan, permanent: false })
      // ':path*' không khớp đường dẫn trống → phải có quy tắc riêng cho '/quy-phong/' (lỗi 404 ngày 24/10/2026)
      expect(cauHinh.rewrites).toContainEqual({ source: a.duongDan, destination: a.diaChiGoc + '/' })
      expect(cauHinh.rewrites).toContainEqual({ source: a.duongDan + ':path*', destination: a.diaChiGoc + '/:path*' })
    }
  })

  it('đường dẫn và mã app không trùng nhau', () => {
    expect(new Set(DS_APP.map((a) => a.duongDan)).size).toBe(DS_APP.length)
    expect(new Set(DS_APP.map((a) => a.ma)).size).toBe(DS_APP.length)
  })
})

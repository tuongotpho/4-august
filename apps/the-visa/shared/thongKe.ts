// Thống kê + tự viết nhận xét xu hướng từ các kỳ đã lưu. Không đoán: chỉ nói điều số liệu cho thấy.
import type { Ky } from './kieu.js'
import { dsKhoanChi, laTraNo, type KhoanChi } from './phanLoai.js'

export const cong = (a: { tien: number }[]) => a.reduce((s, x) => s + x.tien, 0)
export function gomTheo<T>(a: T[], khoa: (x: T) => string, gt: (x: T) => number) {
  const m = new Map<string, number>()
  for (const x of a) m.set(khoa(x), (m.get(khoa(x)) ?? 0) + gt(x))
  return m
}
export const tr = (n: number) => `${(n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`
export const dong = (n: number) => `${n.toLocaleString('vi-VN')}đ`
export const ngayVN = (iso: string) => iso.split('-').reverse().join('/')
const nhan = (k: Ky) => `${ngayVN(k.tu).slice(0, 5)}–${ngayVN(k.den).slice(0, 5)}`
export const nhanKy = nhan

/** Mỗi kỳ trước: đã trả đủ dư nợ cuối kỳ trước hạn chưa (dựa vào các khoản trả nợ ở kỳ sau) */
export function traDungHan(ky: Ky[]) {
  const s = [...ky].sort((a, b) => a.tu.localeCompare(b.tu))
  return s.slice(0, -1).map((k, i) => {
    const tra = s[i + 1].giaoDich.filter((g) => laTraNo(g) && (!k.hanTra || g.ngay <= k.hanTra))
    const da = tra.reduce((x, g) => x + g.soTien, 0)
    return { ky: k, daTra: da, du: da >= k.cuoiKy, ngayTra: tra.map((g) => g.ngay).sort().pop() }
  })
}

export interface NhanXet { tieuDe: string; noiDung: string; canhBao?: boolean }

export function nhanXet(ky: Ky[], homNay = new Date().toISOString().slice(0, 10)): NhanXet[] {
  const s = [...ky].sort((a, b) => a.tu.localeCompare(b.tu))
  if (!s.length) return []
  const kc = dsKhoanChi(s)
  const theoKy = s.map((k) => cong(kc.filter((x) => x.kyId === k.id)))
  const tong = cong(kc)
  const out: NhanXet[] = []
  const tb = tong / s.length
  const iMax = theoKy.indexOf(Math.max(...theoKy)), iMin = theoKy.indexOf(Math.min(...theoKy))
  out.push({
    tieuDe: 'Tổng quan',
    noiDung: `${s.length} kỳ chi ${dong(tong)}, trung bình ${tr(tb)}/kỳ. Cao nhất kỳ ${nhan(s[iMax])} (${tr(theoKy[iMax])}), thấp nhất kỳ ${nhan(s[iMin])} (${tr(theoKy[iMin])}).`,
  })

  // Kỳ mới nhất
  const moi = s[s.length - 1], cMoi = theoKy[theoKy.length - 1]
  const kcMoi = kc.filter((x) => x.kyId === moi.id)
  const lonNhat = kcMoi.reduce((m, x) => (x.tien > m.tien ? x : m), kcMoi[0])
  let nd = `Chi ${tr(cMoi)}`
  if (s.length > 1) {
    const truoc = theoKy[theoKy.length - 2], d = ((cMoi - truoc) / truoc) * 100
    nd += `, ${d >= 0 ? 'tăng' : 'giảm'} ${Math.abs(d).toFixed(0)}% so với kỳ trước (${tr(truoc)})`
  }
  nd += '.'
  if (lonNhat && lonNhat.tien > cMoi * 0.35)
    nd += ` Riêng khoản ${lonNhat.ten} ${dong(lonNhat.tien)} (${ngayVN(lonNhat.ngay)}) đã chiếm ${Math.round((lonNhat.tien / cMoi) * 100)}%; bỏ khoản này còn ${tr(cMoi - lonNhat.tien)}.`
  out.push({ tieuDe: `Kỳ mới nhất ${nhan(moi)}`, noiDung: nd, canhBao: s.length > 1 && cMoi > tb * 1.3 })

  // Hạn trả kỳ mới nhất
  if (moi.hanTra && moi.hanTra >= homNay && moi.cuoiKy > 0) {
    out.push({
      tieuDe: `Hạn trả: 17h ngày ${ngayVN(moi.hanTra)}`,
      noiDung: `Dư nợ ${dong(moi.cuoiKy)}${moi.toiThieu ? `, tối thiểu ${dong(moi.toiThieu)}` : ''}. Trả đủ dư nợ trước hạn để không bị tính lãi.`,
      canhBao: true,
    })
  }

  // Nhóm lớn nhất
  const nhom = [...gomTheo(kc, (x) => x.nhom, (x) => x.tien)].sort((a, b) => b[1] - a[1])
  if (nhom.length) {
    const [n0, v0] = nhom[0]
    out.push({ tieuDe: `Khoản lớn nhất: ${n0} — ${Math.round((v0 / tong) * 100)}%`, noiDung: `${dong(v0)} / ${kc.filter((x) => x.nhom === n0).length} lần trong ${s.length} kỳ.` })
  }

  // Nhóm tăng liên tục 3 kỳ gần nhất / thấp nhất từ trước tới nay
  if (s.length >= 3) {
    for (const [n] of nhom) {
      const v = s.map((k) => cong(kc.filter((x) => x.kyId === k.id && x.nhom === n)))
      const [a, b, c] = v.slice(-3)
      if (a > 0 && a < b && b < c && c > 500_000)
        out.push({ tieuDe: `${n} tăng 3 kỳ liền`, noiDung: `${tr(a)} → ${tr(b)} → ${tr(c)}.`, canhBao: true })
      if (s.length >= 4 && v.slice(0, -1).every((x) => x > 0) && c < Math.min(...v.slice(0, -1)) && Math.min(...v.slice(0, -1)) > 500_000)
        out.push({ tieuDe: `${n} giảm`, noiDung: `Kỳ mới nhất ${tr(c)} — thấp nhất ${s.length} kỳ (trước đây ${tr(Math.min(...v.slice(0, -1)))}–${tr(Math.max(...v.slice(0, -1)))}).` })
    }
  }

  // Khoản lặp lại: cùng nơi chi, gần như đúng một số tiền (±3%), ở ≥ 3 kỳ khác nhau.
  // Bỏ mua sắm online: đơn lẻ giá na ná nhau dễ bị gom nhầm thành "lặp".
  const lap: { chu: string; soKy: number; tien: number }[] = []
  for (const [ten, ds] of gomNhom(kc.filter((x) => x.tien > 0 && x.nhom !== 'Mua sắm online'), (x) => x.ten)) {
    const nhomTien = new Map<number, KhoanChi[]>()
    for (const x of [...ds].sort((a, b) => b.tien - a.tien)) {
      const k = [...nhomTien.keys()].find((t) => Math.abs(t - x.tien) <= t * 0.03)
      nhomTien.set(k ?? x.tien, [...(nhomTien.get(k ?? x.tien) ?? []), x])
    }
    for (const [t, xs] of nhomTien) {
      const soKy = new Set(xs.map((x) => x.kyId)).size
      const giua = xs.map((x) => x.tien).sort((a, b) => a - b)[Math.floor(xs.length / 2)] // số hay gặp, không lấy số lớn nhất
      if (soKy >= 3 && t >= 100_000) lap.push({ chu: `${ten} ~${dong(giua)} × ${xs.length} lần (${soKy} kỳ)`, soKy, tien: t * xs.length })
    }
  }
  lap.sort((a, b) => b.soKy - a.soKy || b.tien - a.tien)
  if (lap.length) out.push({ tieuDe: 'Khoản lặp lại đều đặn', noiDung: lap.slice(0, 5).map((x) => x.chu).join(' · ') })

  // Khoản lớn bất thường
  const lon = kc.filter((x) => x.tien >= 2_000_000 && x.nhom !== 'Xăng xe').sort((a, b) => b.tien - a.tien).slice(0, 5)
  if (lon.length)
    out.push({ tieuDe: 'Khoản lớn (≥ 2 triệu)', noiDung: lon.map((x) => `${x.ten} ${tr(x.tien)} (${ngayVN(x.ngay)})`).join(' · '), canhBao: true })

  // Cuối tuần
  const cuoiTuan = cong(kc.filter((x) => [0, 6].includes(new Date(x.ngay + 'T00:00:00').getDay())))
  if (tong > 0) out.push({ tieuDe: 'Cuối tuần', noiDung: `Thứ 7 + Chủ nhật chiếm ${Math.round((cuoiTuan / tong) * 100)}% tổng chi.` })

  // Trả nợ đúng hạn
  const th = traDungHan(s)
  if (th.length) {
    const du = th.filter((x) => x.du).length
    out.push({
      tieuDe: du === th.length ? 'Trả nợ: chưa mất đồng lãi nào' : 'Trả nợ: có kỳ chưa trả đủ',
      noiDung: `${du}/${th.length} kỳ đã trả đủ dư nợ trước hạn.${th.filter((x) => !x.du).map((x) => ` Kỳ ${nhan(x.ky)}: trả ${dong(x.daTra)} / nợ ${dong(x.ky.cuoiKy)}.`).join('')}`,
      canhBao: du !== th.length,
    })
  }
  return out
}

function gomNhom<T>(a: T[], khoa: (x: T) => string) {
  const m = new Map<string, T[]>()
  for (const x of a) m.set(khoa(x), [...(m.get(khoa(x)) ?? []), x])
  return m
}

/** Thống kê một năm dương lịch, theo NGÀY GIAO DỊCH (không theo kỳ sao kê) */
export function thongKeNam(ky: Ky[], nam: number) {
  const kc = dsKhoanChi(ky)
  const trongNam = kc.filter((x) => x.ngay.startsWith(`${nam}-`))
  const namTruoc = kc.filter((x) => x.ngay.startsWith(`${nam - 1}-`))
  const thang = Array.from({ length: 12 }, (_, i) => {
    const m = `${nam}-${String(i + 1).padStart(2, '0')}`
    return cong(trongNam.filter((x) => x.ngay.startsWith(m)))
  })
  const coDuLieu = thang.map((v, i) => ({ v, i })).filter((x) => x.v !== 0)
  return {
    nam,
    tong: cong(trongNam),
    tongNamTruoc: cong(namTruoc),
    thang,
    soThangCoDuLieu: coDuLieu.length,
    tuThang: coDuLieu.length ? coDuLieu[0].i + 1 : 0,
    denThang: coDuLieu.length ? coDuLieu[coDuLieu.length - 1].i + 1 : 0,
    theoNhom: [...gomTheo(trongNam, (x) => x.nhom, (x) => x.tien)].sort((a, b) => b[1] - a[1]),
    theoTen: [...gomTheo(trongNam, (x) => x.ten, (x) => x.tien)].sort((a, b) => b[1] - a[1]),
    soGiaoDich: trongNam.filter((x) => x.tien > 0).length,
    khoan: trongNam,
  }
}

export const danhSachNam = (ky: Ky[]) => [...new Set(dsKhoanChi(ky).map((x) => Number(x.ngay.slice(0, 4))))].sort()

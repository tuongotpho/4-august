// Sổ quỹ tiền mặt: tồn đầu, lập phiếu thu/chi (gắn hoá đơn), sổ quỹ có tồn luỹ kế, cảnh báo
import { useMemo, useState } from 'react'
import { tien } from '../core/nhan'
import { lapSoQuy, phieuTuHoaDon, soPhieuMoi, TEN_NHOM_PHIEU, type CaiDatQuy, type NhomPhieu, type PhieuQuy, type SoQuy } from '../core/soQuy'
import type { Kho } from '../core/kho'
import { DanhSachCanhBao } from './chung'

export interface ThaoTacQuy {
  luuPhieu: (p: PhieuQuy) => Promise<void> | void
  xoaPhieu: (p: PhieuQuy) => Promise<void> | void
  luuTonDau: (cd: CaiDatQuy) => Promise<void> | void
}

const homNay = () => new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
const hopLeNgay = (s: string) => /^\d{2}\/\d{2}\/\d{4}$/.test(s)
const maMoi = () => `pq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

export function SoQuyDN({ kho, mst, quy, tt }: { kho: Kho; mst: string; quy: SoQuy; tt: ThaoTacQuy }) {
  const [thang, setThang] = useState('') // MM/yyyy, '' = tất cả
  const [sua, setSua] = useState<PhieuQuy | null>(null)
  const [tonDau, setTonDau] = useState({ tien: String(quy.caiDat.tonDau || ''), ngay: quy.caiDat.ngayTonDau })
  const [loi, setLoi] = useState('')
  const khoang = thang ? [`01/${thang}`, `31/${thang}`] : ['', '']
  const k = useMemo(() => lapSoQuy(kho, mst, quy, khoang[0], khoang[1]), [kho, mst, quy, khoang[0], khoang[1]]) // eslint-disable-line react-hooks/exhaustive-deps
  const cacThang = useMemo(() => [...new Set(Object.values(quy.phieu).map((p) => p.ngay.slice(3)))].sort((a, b) => b.split('/').reverse().join('').localeCompare(a.split('/').reverse().join(''))), [quy])
  // Hoá đơn còn nợ để gắn phiếu (mới nhất trước)
  const hoaDon = useMemo(() => Object.entries(kho.hoaDon?.[mst] ?? {})
    .filter(([, g]) => !/bị thay thế|xóa bỏ|xoá bỏ|hủy bỏ|huỷ bỏ/i.test(g.tt ?? ''))
    .map(([khoa, g]) => ({ khoa, g, conLai: g.v + g.t - (k.daTraTheoHoaDon[khoa] ?? 0) }))
    .filter((x) => x.conLai > 1)
    .sort((a, b) => b.g.ng.split('/').reverse().join('').localeCompare(a.g.ng.split('/').reverse().join(''))), [kho, mst, k])

  const moi = (loai: 'thu' | 'chi') => setSua({ id: maMoi(), loai, so: soPhieuMoi(quy, loai, homNay()), ngay: homNay(), soTien: 0, nhom: loai === 'thu' ? 'banHang' : 'muaHang', noiDung: '', doiTac: '', hoaDon: [] })
  const luu = async () => {
    if (!sua) return
    if (!hopLeNgay(sua.ngay)) return setLoi('Ngày dạng dd/MM/yyyy')
    if (!(sua.soTien > 0)) return setLoi('Số tiền phải lớn hơn 0')
    setLoi('')
    try {
      await tt.luuPhieu(sua)
      setSua(null)
    } catch (e) {
      setLoi((e as Error).message)
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-end gap-2">
        <label>Tồn quỹ đầu kỳ <input className="w-36 rounded border border-slate-300 px-2 py-1" inputMode="numeric" value={tonDau.tien} onChange={(e) => setTonDau({ ...tonDau, tien: e.target.value.replace(/\D/g, '') })} /></label>
        <label>tính tới ngày <input className="w-28 rounded border border-slate-300 px-2 py-1" placeholder="dd/MM/yyyy" value={tonDau.ngay} onChange={(e) => setTonDau({ ...tonDau, ngay: e.target.value })} /></label>
        <button className="rounded-lg border border-emerald-600 px-3 py-1 text-emerald-700" onClick={() => void tt.luuTonDau({ tonDau: Number(tonDau.tien) || 0, ngayTonDau: hopLeNgay(tonDau.ngay) ? tonDau.ngay : '' })}>Lưu tồn đầu</button>
        <span className="ml-auto flex gap-2">
          <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-white" onClick={() => moi('thu')}>+ Phiếu thu</button>
          <button className="rounded-lg bg-amber-600 px-3 py-1.5 text-white" onClick={() => moi('chi')}>+ Phiếu chi</button>
        </span>
      </div>

      {sua && (
        <div className="space-y-2 rounded-xl border border-emerald-300 p-3">
          <p className="font-semibold">{sua.loai === 'thu' ? 'Phiếu thu' : 'Phiếu chi'} {sua.so}</p>
          <div className="grid gap-2 md:grid-cols-3">
            <label>Số phiếu <input className="w-full rounded border border-slate-300 px-2 py-1" value={sua.so} onChange={(e) => setSua({ ...sua, so: e.target.value })} /></label>
            <label>Ngày <input className="w-full rounded border border-slate-300 px-2 py-1" value={sua.ngay} onChange={(e) => setSua({ ...sua, ngay: e.target.value })} /></label>
            <label>Số tiền <input className="w-full rounded border border-slate-300 px-2 py-1" inputMode="numeric" value={sua.soTien || ''} onChange={(e) => setSua({ ...sua, soTien: Number(e.target.value.replace(/\D/g, '')) || 0 })} /></label>
            <label>Nhóm <select className="w-full rounded border border-slate-300 px-2 py-1" value={sua.nhom} onChange={(e) => setSua({ ...sua, nhom: e.target.value as NhomPhieu })}>
              {(Object.keys(TEN_NHOM_PHIEU) as NhomPhieu[]).map((n) => <option key={n} value={n}>{TEN_NHOM_PHIEU[n]}</option>)}
            </select></label>
            <label>{sua.loai === 'thu' ? 'Người nộp' : 'Người nhận'} <input className="w-full rounded border border-slate-300 px-2 py-1" value={sua.doiTac} onChange={(e) => setSua({ ...sua, doiTac: e.target.value })} /></label>
            <label>Nội dung <input className="w-full rounded border border-slate-300 px-2 py-1" value={sua.noiDung} onChange={(e) => setSua({ ...sua, noiDung: e.target.value })} /></label>
          </div>
          <label className="block">Gắn hoá đơn (thanh toán bằng tiền mặt){' '}
            <select className="max-w-full rounded border border-slate-300 px-2 py-1" value="" onChange={(e) => {
              const g = e.target.value
              if (!g) return
              const goiY = phieuTuHoaDon(kho, mst, g, quy, sua.ngay)
              const conLai = hoaDon.find((x) => x.khoa === g)?.conLai ?? 0
              setSua({ ...sua, hoaDon: [...new Set([...sua.hoaDon, g])], soTien: sua.soTien || conLai, doiTac: sua.doiTac || goiY?.doiTac || '', noiDung: sua.noiDung || goiY?.noiDung || '', nhom: goiY?.nhom ?? sua.nhom })
            }}>
              <option value="">— chọn hoá đơn —</option>
              {hoaDon.filter((x) => (sua.loai === 'thu' ? x.g.l === 'ban' : x.g.l === 'mua')).slice(0, 300).map((x) => (
                <option key={x.khoa} value={x.khoa}>{x.g.kh}-{x.g.so} {x.g.ng} {x.g.ten.slice(0, 30)} — còn {tien(x.conLai)}</option>
              ))}
            </select>
          </label>
          {sua.hoaDon.length > 0 && (
            <p>Đã gắn: {sua.hoaDon.map((x) => x.split('|').slice(2).join('-')).join(', ')}{' '}
              <button className="text-red-700 underline" onClick={() => setSua({ ...sua, hoaDon: [] })}>bỏ gắn</button></p>
          )}
          <div className="flex gap-2">
            <button className="rounded-lg bg-emerald-600 px-4 py-1.5 text-white" onClick={() => void luu()}>Lưu phiếu</button>
            <button className="rounded-lg border border-slate-300 px-4 py-1.5" onClick={() => setSua(null)}>Huỷ</button>
          </div>
          {loi && <p className="text-red-700">⚠️ {loi}</p>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <select className="rounded border border-slate-300 px-2 py-1" value={thang} onChange={(e) => setThang(e.target.value)}>
          <option value="">Tất cả các tháng</option>
          {cacThang.map((t) => <option key={t} value={t}>Tháng {t}</option>)}
        </select>
        <span>Tồn đầu <b>{tien(k.tonDau)}</b> · Thu <b className="text-emerald-700">{tien(k.tongThu)}</b> · Chi <b className="text-amber-700">{tien(k.tongChi)}</b> · Tồn cuối <b className={k.tonCuoi < 0 ? 'text-red-700' : ''}>{tien(k.tonCuoi)}</b> đ</span>
      </div>
      {k.canhBao.length > 0 && <DanhSachCanhBao ds={k.canhBao} />}
      <div className="max-h-[28rem] overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
            <tr><th className="p-1">Ngày</th><th className="p-1">Số phiếu</th><th className="p-1">Nội dung</th><th className="p-1">Đối tác</th><th className="p-1 text-right">Thu</th><th className="p-1 text-right">Chi</th><th className="p-1 text-right">Tồn</th><th /></tr>
          </thead>
          <tbody>
            {k.dong.map((d) => (
              <tr key={d.id} className="border-t border-slate-100">
                <td className="p-1">{d.ngay}</td>
                <td className="p-1">{d.so}</td>
                <td className="p-1">{d.noiDung || TEN_NHOM_PHIEU[d.nhom]}{d.hoaDon.length > 0 && <span className="text-slate-400"> · HĐ {d.hoaDon.map((x) => x.split('|').slice(2).join('-')).join(', ')}</span>}</td>
                <td className="p-1">{d.doiTac}</td>
                <td className="p-1 text-right">{d.thu ? tien(d.thu) : ''}</td>
                <td className="p-1 text-right">{d.chi ? tien(d.chi) : ''}</td>
                <td className={`p-1 text-right ${d.ton < 0 ? 'text-red-700' : ''}`}>{tien(d.ton)}</td>
                <td className="p-1 text-right whitespace-nowrap">
                  <button className="text-emerald-700 underline" onClick={() => setSua(quy.phieu[d.id])}>sửa</button>{' '}
                  <button className="text-red-700 underline" onClick={() => { if (confirm(`Xoá phiếu ${d.so}?`)) void tt.xoaPhieu(quy.phieu[d.id]) }}>xoá</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!k.dong.length && <p className="p-2 text-slate-500">Chưa có phiếu thu / chi nào{thang && ` trong tháng ${thang}`}.</p>}
      </div>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { luuNhieuLop, taiFile } from '../lib/hooks'
import {
  boDau, dinhDangTien, homNay, ngayVN, TEN_BUOI, TEN_HINH_THUC, TEN_TRANG_THAI, thu, trangThai, type LopGiang, type TrangThai,
} from '../lib/model'
import { NhanTrangThai } from './TheLop'

/** Đối tác bỏ trống: trang Tổng hợp gom dưới tên này */
export const CHUA_RO = '(chưa rõ)'

export interface LocBanDau {
  nam: string
  doiTac?: string
  lienHe?: string
  tim?: string
}

export default function DanhSach({ ds, onMo, locBanDau }: { ds: LopGiang[]; onMo: (l: LopGiang) => void; locBanDau?: LocBanDau }) {
  const cacNam = useMemo(() => [...new Set(ds.map((l) => l.ngay.slice(0, 4)))].sort().reverse(), [ds])
  const [nam, setNam] = useState(locBanDau?.nam ?? homNay().slice(0, 4))
  const [doiTac, setDoiTac] = useState(locBanDau?.doiTac ?? '')
  const [lienHe, setLienHe] = useState(locBanDau?.lienHe ?? '')
  const [tt, setTt] = useState<TrangThai | ''>('')
  const [tim, setTim] = useState(locBanDau?.tim ?? '')
  const [chon, setChon] = useState<Set<string>>(new Set())
  const [ngayTT, setNgayTT] = useState(homNay())

  const cacDoiTac = useMemo(() => {
    const d = [...new Set(ds.map((l) => l.doiTac).filter(Boolean))].sort()
    return ds.some((l) => !l.doiTac) ? [...d, CHUA_RO] : d
  }, [ds])
  const cacLienHe = useMemo(() => {
    const d = [...new Set(ds.map((l) => l.lienHe.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'))
    return ds.some((l) => !l.lienHe.trim()) ? [...d, CHUA_RO] : d
  }, [ds])
  const loc = useMemo(() => {
    const k = boDau(tim)
    return ds
      .filter((l) => !nam || l.ngay.startsWith(nam))
      .filter((l) => !doiTac || (doiTac === CHUA_RO ? !l.doiTac : l.doiTac === doiTac))
      .filter((l) => !lienHe || (lienHe === CHUA_RO ? !l.lienHe.trim() : l.lienHe.trim() === lienHe))
      .filter((l) => !tt || trangThai(l) === tt)
      .filter((l) => !k || boDau([l.khachHang, l.lienHe, l.doiTac, l.diaDiem, l.noiDung, l.ghiChu].join(' ')).includes(k))
      .slice()
      .reverse()
  }, [ds, nam, doiTac, lienHe, tt, tim])

  const tong = loc.filter((l) => !l.huy).reduce((s, l) => s + (l.chiPhi ?? 0), 0)
  const daChon = loc.filter((l) => chon.has(l.id))
  const tatCaChon = loc.length > 0 && daChon.length === loc.length

  async function danhDauDaTT() {
    const can = daChon.filter((l) => l.thanhToan !== 'da')
    if (!can.length) return
    if (!confirm(`Đánh dấu ĐÃ NHẬN TIỀN ${can.length} lớp (${dinhDangTien(can.reduce((s, l) => s + (l.chiPhi ?? 0), 0))} đ), ngày nhận ${ngayVN(ngayTT)}?`)) return
    await luuNhieuLop(can.map((l) => ({ ...l, thanhToan: 'da', ngayTT })))
    setChon(new Set())
  }

  function xuatCsv() {
    const o = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`
    const dong = [
      ['Ngày giảng', 'Thứ', 'Số ngày', 'Giờ bắt đầu', 'Giờ kết thúc', 'Buổi', 'Hình thức', 'Đối tác', 'Người liên hệ', 'Khách hàng', 'Địa điểm', 'Nội dung', 'Thù lao', 'Trạng thái', 'Ngày thanh toán', 'Ghi chú'],
      ...loc.map((l) => [
        ngayVN(l.ngay), thu(l.ngay), l.soNgay, l.gioBD, l.gioKT, TEN_BUOI[l.buoi], TEN_HINH_THUC[l.hinhThuc], l.doiTac, l.lienHe, l.khachHang,
        l.diaDiem, l.noiDung, l.chiPhi ?? '', TEN_TRANG_THAI[trangThai(l)], ngayVN(l.ngayTT), l.ghiChu,
      ]),
    ]
    // BOM để Excel mở đúng tiếng Việt
    taiFile('﻿' + dong.map((d) => d.map(o).join(',')).join('\r\n'), `lich-giang-${nam || 'tat-ca'}.csv`, 'text/csv;charset=utf-8')
  }

  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-end gap-2 !p-3">
        <label>
          <span className="lbl">Năm</span>
          <select className="inp" value={nam} onChange={(e) => setNam(e.target.value)}>
            <option value="">Tất cả</option>
            {cacNam.map((n) => <option key={n}>{n}</option>)}
          </select>
        </label>
        <label>
          <span className="lbl">Đối tác</span>
          <select className="inp" value={doiTac} onChange={(e) => setDoiTac(e.target.value)}>
            <option value="">Tất cả</option>
            {cacDoiTac.map((n) => <option key={n}>{n}</option>)}
          </select>
        </label>
        <label>
          <span className="lbl">Người liên hệ</span>
          <select className="inp" value={lienHe} onChange={(e) => setLienHe(e.target.value)}>
            <option value="">Tất cả</option>
            {cacLienHe.map((n) => <option key={n}>{n}</option>)}
          </select>
        </label>
        <label>
          <span className="lbl">Trạng thái</span>
          <select className="inp" value={tt} onChange={(e) => setTt(e.target.value as TrangThai | '')}>
            <option value="">Tất cả</option>
            {Object.entries(TEN_TRANG_THAI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="min-w-48 flex-1">
          <span className="lbl">Tìm</span>
          <input className="inp" value={tim} onChange={(e) => setTim(e.target.value)} placeholder="khách hàng, liên hệ, địa điểm…" />
        </label>
        <button className="btn" onClick={xuatCsv}>⬇ Xuất Excel (CSV)</button>
      </div>

      {daChon.length > 0 && (
        <div className="card flex flex-wrap items-center gap-2 !bg-teal-50 !p-2 text-sm">
          <b>Đã chọn {daChon.length} lớp</b> · {dinhDangTien(daChon.reduce((s, l) => s + (l.chiPhi ?? 0), 0))} đ
          <span className="ml-2">Ngày nhận tiền</span>
          <input type="date" className="inp !w-40" value={ngayTT} onChange={(e) => setNgayTT(e.target.value)} />
          <button className="btn-primary" onClick={() => void danhDauDaTT()}>✓ Đánh dấu đã nhận tiền</button>
          <button className="btn" onClick={() => setChon(new Set())}>Bỏ chọn</button>
        </div>
      )}

      <div className="card overflow-x-auto !p-0">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="w-8 p-2">
                <input type="checkbox" checked={tatCaChon} onChange={() => setChon(tatCaChon ? new Set() : new Set(loc.map((l) => l.id)))} />
              </th>
              <th className="p-2">Ngày</th>
              <th className="p-2">Khách hàng</th>
              <th className="p-2">Đối tác · Liên hệ</th>
              <th className="p-2">Giờ / Hình thức</th>
              <th className="p-2 text-right">Thù lao</th>
              <th className="p-2">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {loc.map((l) => (
              <tr key={l.id} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50" onClick={() => onMo(l)}>
                <td className="p-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={chon.has(l.id)}
                    onChange={() => setChon((s) => { const n = new Set(s); if (n.has(l.id)) n.delete(l.id); else n.add(l.id); return n })}
                  />
                </td>
                <td className="whitespace-nowrap p-2">
                  <span className="text-slate-400">{thu(l.ngay)} </span>{ngayVN(l.ngay)}
                  {l.soNgay > 1 && <span className="text-xs text-slate-500"> ({l.soNgay} ngày)</span>}
                </td>
                <td className="p-2">
                  <span className="font-medium text-slate-800">{l.khachHang}</span>
                  {l.diaDiem && <span className="block text-xs text-slate-500">{l.diaDiem}</span>}
                </td>
                <td className="p-2 text-slate-600">{[l.doiTac, l.lienHe].filter(Boolean).join(' · ')}</td>
                <td className="whitespace-nowrap p-2 text-slate-600">
                  {l.gioBD ? `${l.gioBD}–${l.gioKT}` : TEN_BUOI[l.buoi]}
                  {l.hinhThuc === 'online' && <span className="ml-1 text-xs text-sky-700">online</span>}
                </td>
                <td className="whitespace-nowrap p-2 text-right">{dinhDangTien(l.chiPhi)}</td>
                <td className="p-2"><NhanTrangThai l={l} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50 text-sm font-medium">
              <td className="p-2" colSpan={5}>{loc.length} lớp</td>
              <td className="p-2 text-right">{dinhDangTien(tong)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { luuNhieuLop } from '../lib/hooks'
import { dinhDangTien, homNay, ngayVN, type LopGiang } from '../lib/model'
import { congNo } from '../lib/tinh'
import { DongLop } from './TheLop'

/** Lớp đã giảng chưa nhận tiền, gom theo đối tác — nợ lâu nhất lên đầu */
export default function CongNo({ ds, onMo }: { ds: LopGiang[]; onMo: (l: LopGiang) => void }) {
  const nhom = congNo(ds)
  const [ngayTT, setNgayTT] = useState(homNay())
  const tong = nhom.reduce((s, n) => s + n.tong, 0)
  const thieu = nhom.flatMap((n) => n.lop).filter((l) => l.chiPhi === null)

  async function nhanTien(lop: LopGiang[]) {
    const co = lop.filter((l) => l.chiPhi !== null)
    if (!co.length) return alert('Các lớp này chưa ghi thù lao — mở từng lớp để nhập trước.')
    if (!confirm(`Đánh dấu đã nhận ${dinhDangTien(co.reduce((s, l) => s + (l.chiPhi ?? 0), 0))} đ cho ${co.length} lớp, ngày ${ngayVN(ngayTT)}?`)) return
    await luuNhieuLop(co.map((l) => ({ ...l, thanhToan: 'da', ngayTT })))
  }

  if (!nhom.length) return <div className="card text-center text-slate-500">🎉 Không còn lớp nào chờ thanh toán.</div>

  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-center gap-3 !p-3">
        <div>
          <div className="text-xs text-slate-500">Tổng chờ thanh toán</div>
          <div className="text-xl font-bold text-amber-700">{dinhDangTien(tong)} đ</div>
        </div>
        <div className="text-sm text-slate-600">{nhom.reduce((s, n) => s + n.lop.length, 0)} lớp · {nhom.length} đối tác</div>
        {thieu.length > 0 && <div className="chip bg-red-100 text-red-700">{thieu.length} lớp chưa ghi thù lao</div>}
        <label className="ml-auto flex items-center gap-2 text-sm">
          Ngày nhận tiền <input type="date" className="inp !w-40" value={ngayTT} onChange={(e) => setNgayTT(e.target.value)} />
        </label>
      </div>
      {nhom.map((n) => (
        <div key={n.doiTac} className="card !p-3">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-800">{n.doiTac}</h3>
            <span className="text-sm text-slate-600">{n.lop.length} lớp · <b>{dinhDangTien(n.tong)} đ</b></span>
            <span className={`chip ${n.soNgayCho > 30 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>chờ {n.soNgayCho} ngày</span>
            <button className="btn ml-auto !py-0.5 !text-xs" onClick={() => void nhanTien(n.lop)}>✓ Đã nhận tiền cả nhóm</button>
          </div>
          {n.lop.map((l) => <DongLop key={l.id} l={l} onMo={onMo} />)}
        </div>
      ))}
    </div>
  )
}

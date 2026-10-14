import { useMemo, useState } from 'react'
import { dinhDangTien, homNay, type LopGiang } from '../lib/model'
import { theoDoiTac, theoNam, theoThang } from '../lib/tinh'

const trieu = (n: number) => (n / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })

export default function TongHop({ ds }: { ds: LopGiang[] }) {
  const nam = useMemo(() => theoNam(ds), [ds])
  const [chon, setChon] = useState(homNay().slice(0, 4))
  const thang = useMemo(() => theoThang(ds, chon), [ds, chon])
  const dt = useMemo(() => theoDoiTac(ds, chon), [ds, chon])
  const maxThang = Math.max(1, ...thang.map((t) => t.tien))
  const maxNam = Math.max(1, ...nam.map((t) => t.tien))
  const tongNam = nam.find((x) => x.khoa === chon)

  return (
    <div className="space-y-4">
      <div className="card !p-3">
        <h3 className="mb-2 font-semibold text-slate-800">Theo năm</h3>
        <div className="space-y-1.5">
          {nam.map((n) => (
            <button key={n.khoa} onClick={() => setChon(n.khoa)} className={`flex w-full items-center gap-2 rounded px-1 text-left text-sm ${n.khoa === chon ? 'bg-teal-50' : ''}`}>
              <span className="w-12 font-medium">{n.khoa}</span>
              <span className="h-5 flex-1 rounded bg-slate-100">
                <span className="block h-5 rounded bg-teal-600" style={{ width: `${(n.tien / maxNam) * 100}%` }} />
              </span>
              <span className="w-44 text-right text-slate-700">{trieu(n.tien)} tr · {n.soLop} lớp</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card !p-3">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="font-semibold text-slate-800">Năm {chon} theo tháng</h3>
            {tongNam && (
              <span className="text-sm text-slate-600">
                {dinhDangTien(tongNam.tien)} đ · TB {trieu(tongNam.tien / 12)} tr/tháng
              </span>
            )}
          </div>
          <div className="flex h-48 items-end gap-1">
            {thang.map((t) => (
              <div key={t.khoa} className="flex flex-1 flex-col items-center justify-end gap-1" title={`Tháng ${t.khoa}: ${dinhDangTien(t.tien)} đ, ${t.soLop} lớp`}>
                <span className="text-[10px] text-slate-500">{t.tien ? trieu(t.tien) : ''}</span>
                <span className="relative w-full rounded-t bg-slate-100" style={{ height: `${(t.tien / maxThang) * 140}px` }}>
                  <span className="absolute bottom-0 block w-full rounded-t bg-teal-600" style={{ height: `${t.tien ? (t.daTT / t.tien) * 100 : 0}%` }} />
                  <span className="absolute inset-0 rounded-t border border-teal-600/40" />
                </span>
                <span className="text-xs text-slate-600">{Number(t.khoa)}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">Cột đậm = đã nhận tiền, phần nhạt = chưa nhận / sắp giảng. Đơn vị: triệu đồng.</p>
        </div>

        <div className="card !p-3">
          <h3 className="mb-2 font-semibold text-slate-800">Năm {chon} theo đối tác</h3>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr><th className="py-1">Đối tác</th><th className="py-1 text-right">Lớp</th><th className="py-1 text-right">Thù lao</th><th className="py-1 text-right">Chưa nhận</th></tr>
            </thead>
            <tbody>
              {dt.map((d) => (
                <tr key={d.khoa} className="border-t border-slate-100">
                  <td className="py-1">{d.khoa}</td>
                  <td className="py-1 text-right">{d.soLop}</td>
                  <td className="py-1 text-right">{dinhDangTien(d.tien)}</td>
                  <td className={`py-1 text-right ${d.tien - d.daTT ? 'text-amber-700' : 'text-slate-300'}`}>{dinhDangTien(d.tien - d.daTT)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

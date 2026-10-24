import { useMemo, useState } from 'react'
import { dinhDangTien, homNay, type LopGiang } from '../lib/model'
import { theoDoiTac, theoLienHe, theoNam, theoThang } from '../lib/tinh'
import TongToanBo from './TongToanBo'

const trieu = (n: number) => (n / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })

/** onLoc: bấm một đối tác / người liên hệ -> sang Danh sách, lọc sẵn theo đó + năm đang xem */
export default function TongHop({ ds, onLoc }: { ds: LopGiang[]; onLoc: (loc: { doiTac?: string; lienHe?: string; tim?: string; nam: string }) => void }) {
  const nam = useMemo(() => theoNam(ds), [ds])
  // chon = '' -> tất cả các năm
  const [chon, setChon] = useState(homNay().slice(0, 4))
  const thang = useMemo(() => theoThang(ds, chon), [ds, chon])
  const dt = useMemo(() => theoDoiTac(ds, chon || undefined), [ds, chon])
  const lh = useMemo(() => theoLienHe(ds, chon || undefined), [ds, chon])
  const tong = useMemo(() => nam.reduce((s, n) => ({ soLop: s.soLop + n.soLop, tien: s.tien + n.tien, daTT: s.daTT + n.daTT }), { soLop: 0, tien: 0, daTT: 0 }), [nam])
  const tenKy = chon ? `Năm ${chon}` : 'Tất cả các năm'
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
          <button onClick={() => setChon('')} className={`flex w-full items-center gap-2 rounded border-t border-slate-200 px-1 pt-1.5 text-left text-sm font-semibold ${chon === '' ? 'bg-teal-50' : ''}`}>
            <span className="flex-1">Tất cả {nam.length} năm{nam.length > 0 && ` (${nam[0].khoa}–${nam[nam.length - 1].khoa})`}</span>
            <span className="text-right text-slate-800">{trieu(tong.tien)} tr · {tong.soLop} lớp</span>
          </button>
        </div>
      </div>
      {/* chọn "Tất cả": tổng toàn bộ đến hôm nay nằm ngay dưới thống kê theo năm */}
      {chon === '' && <TongToanBo ds={ds} onLoc={onLoc} />}

      {/* dưới: trái = người liên hệ; phải = theo tháng ở trên, đối tác ở dưới */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="space-y-4">
            <div className="card !p-3">
              <h3 className="mb-2 font-semibold text-slate-800">{tenKy} theo người liên hệ</h3>
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr><th className="py-1">Người liên hệ</th><th className="py-1 text-right">Lớp</th><th className="py-1 text-right">Thù lao</th><th className="py-1 text-right">Chưa nhận</th></tr>
                </thead>
                <tbody>
                  {lh.map((d) => (
                    <tr key={d.khoa} className="cursor-pointer border-t border-slate-100 hover:bg-teal-50" title={`Xem các lớp qua ${d.khoa} – ${tenKy.toLowerCase()}`} onClick={() => onLoc({ lienHe: d.khoa, nam: chon })}>
                      <td className="py-1">
                        <span className="text-teal-700 underline decoration-dotted underline-offset-2">{d.khoa}</span>
                        {d.doiTac && <span className="ml-1 text-xs text-slate-400">{d.doiTac}</span>}
                      </td>
                      <td className="py-1 text-right">{d.soLop}</td>
                      <td className="py-1 text-right">{dinhDangTien(d.tien)}</td>
                      <td className={`py-1 text-right ${d.tien - d.daTT ? 'text-amber-700' : 'text-slate-300'}`}>{dinhDangTien(d.tien - d.daTT)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-slate-400">Bấm vào một người để xem danh sách lớp họ giao.</p>
            </div>
        </div>
        <div className="space-y-4">
            {chon === '' ? (
              <div className="card !p-3">
                <h3 className="mb-2 font-semibold text-slate-800">Tất cả các năm đã giảng</h3>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  {([
                    ['Tổng thù lao', `${dinhDangTien(tong.tien)} đ`],
                    ['Số lớp', `${tong.soLop} lớp`],
                    ['Số năm', `${nam.length} năm`],
                    ['Trung bình mỗi năm', `${trieu(nam.length ? tong.tien / nam.length : 0)} tr · ${nam.length ? Math.round(tong.soLop / nam.length) : 0} lớp`],
                    ['Trung bình mỗi lớp', `${dinhDangTien(tong.soLop ? Math.round(tong.tien / tong.soLop) : 0)} đ`],
                    ['Chưa nhận / sắp giảng', `${dinhDangTien(tong.tien - tong.daTT)} đ`],
                    ['Số đối tác', `${dt.length}`],
                    ['Số người liên hệ', `${lh.length}`],
                  ] as const).map(([k, v]) => (
                    <div key={k} className="rounded bg-slate-50 p-2">
                      <dt className="text-xs text-slate-500">{k}</dt>
                      <dd className="font-semibold text-slate-800">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-2 text-xs text-slate-400">Không tính lớp đã huỷ. Bảng đối tác và người liên hệ cũng đang tính cho tất cả các năm. Chi tiết đến hôm nay ở khối phía trên.</p>
              </div>
            ) : (
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
            )}

            <div className="card !p-3">
              <h3 className="mb-2 font-semibold text-slate-800">{tenKy} theo đối tác</h3>
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr><th className="py-1">Đối tác</th><th className="py-1 text-right">Lớp</th><th className="py-1 text-right">Thù lao</th><th className="py-1 text-right">Chưa nhận</th></tr>
                </thead>
                <tbody>
                  {dt.map((d) => (
                    <tr key={d.khoa} className="cursor-pointer border-t border-slate-100 hover:bg-teal-50" title={`Xem các lớp của ${d.khoa} – ${tenKy.toLowerCase()}`} onClick={() => onLoc({ doiTac: d.khoa, nam: chon })}>
                      <td className="py-1 text-teal-700 underline decoration-dotted underline-offset-2">{d.khoa}</td>
                      <td className="py-1 text-right">{d.soLop}</td>
                      <td className="py-1 text-right">{dinhDangTien(d.tien)}</td>
                      <td className={`py-1 text-right ${d.tien - d.daTT ? 'text-amber-700' : 'text-slate-300'}`}>{dinhDangTien(d.tien - d.daTT)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-slate-400">Bấm vào một đối tác để xem danh sách lớp.</p>
            </div>

        </div>
      </div>

    </div>
  )
}

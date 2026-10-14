import { useMemo, useState } from 'react'
import { dinhDangTien, homNay, ngayVN, type LopGiang } from '../lib/model'
import { tongDenNay, type CachChia } from '../lib/tinh'

const trieu = (n: number) => (n / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const CACH: [CachChia, string, string][] = [
  ['doiTac', 'Đối tác', 'Công ty đối tác'],
  ['lienHe', 'Người liên hệ', 'Người liên hệ'],
  ['khachHang', 'Khách hàng', 'Khách hàng (đơn vị học)'],
  ['diaDiem', 'Địa điểm', 'Địa điểm'],
  ['hinhThuc', 'Hình thức', 'Hình thức'],
  ['nam', 'Năm', 'Năm'],
]
const MOT_TRANG = 15

/** Tổng toàn bộ các lớp đã giảng tính đến hôm nay, chia theo đối tác / người liên hệ / khách hàng / ... */
export default function TongToanBo({ ds, onLoc }: { ds: LopGiang[]; onLoc: (loc: { doiTac?: string; lienHe?: string; tim?: string; nam: string }) => void }) {
  const [chia, setChia] = useState<CachChia>('doiTac')
  const [het, setHet] = useState(false)
  const dong = useMemo(() => tongDenNay(ds, chia), [ds, chia])
  const tong = useMemo(() => dong.reduce((s, d) => ({ soLop: s.soLop + d.soLop, tien: s.tien + d.tien, daTT: s.daTT + d.daTT }), { soLop: 0, tien: 0, daTT: 0 }), [dong])
  const dem = useMemo(() => Object.fromEntries(CACH.map(([k]) => [k, tongDenNay(ds, k).length])) as Record<CachChia, number>, [ds])
  const nam = useMemo(() => tongDenNay(ds, 'nam'), [ds])
  const max = Math.max(1, ...dong.map((d) => d.tien))
  const hien = het ? dong : dong.slice(0, MOT_TRANG)
  const ten = CACH.find(([k]) => k === chia)![2]

  // bấm 1 dòng -> Danh sách mọi năm, lọc theo dòng đó
  const loc = (khoa: string) => {
    if (chia === 'doiTac') onLoc({ doiTac: khoa, nam: '' })
    else if (chia === 'lienHe') onLoc({ lienHe: khoa, nam: '' })
    else if (chia === 'nam') onLoc({ nam: khoa })
    else if (chia === 'khachHang' || chia === 'diaDiem') onLoc({ tim: khoa.startsWith('(') ? '' : khoa, nam: '' })
  }
  const bamDuoc = chia !== 'hinhThuc'

  return (
    <div className="card !p-3">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold text-slate-800">Tổng toàn bộ đến hôm nay</h3>
        <span className="text-xs text-slate-500">
          Lớp đã giảng từ {nam[0] ? ngayVN(nam[0].tu) : '—'} đến {ngayVN(homNay())} · không tính lớp huỷ, lớp sắp tới
        </span>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:grid-cols-8">
        {([
          ['Số lớp', `${tong.soLop}`],
          ['Tổng thù lao', `${trieu(tong.tien)} tr`],
          ['Đã nhận', `${trieu(tong.daTT)} tr`],
          ['Chưa nhận', `${trieu(tong.tien - tong.daTT)} tr`],
          ['Số năm', `${nam.length}`],
          ['Đối tác', `${dem.doiTac}`],
          ['Người liên hệ', `${dem.lienHe}`],
          ['Khách hàng', `${dem.khachHang}`],
        ] as const).map(([k, v]) => (
          <div key={k} className="rounded bg-slate-50 p-2">
            <div className="text-xs text-slate-500">{k}</div>
            <div className="font-semibold text-slate-800">{v}</div>
          </div>
        ))}
      </div>

      <div className="mb-2 flex flex-wrap gap-1">
        {CACH.map(([k, t]) => (
          <button key={k} onClick={() => { setChia(k); setHet(false) }} className={`rounded-md px-2.5 py-1 text-sm ${chia === k ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
            Theo {t.toLowerCase()} <span className="opacity-70">({dem[k]})</span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="w-8 py-1">#</th>
              <th className="py-1">{ten}</th>
              <th className="py-1 text-right">Lớp</th>
              <th className="py-1 text-right">Thù lao</th>
              <th className="w-28 py-1 pl-2">Tỷ lệ</th>
              <th className="py-1 text-right">Chưa nhận</th>
              <th className="py-1 text-right">Giảng từ – gần nhất</th>
            </tr>
          </thead>
          <tbody>
            {hien.map((d, i) => (
              <tr key={d.khoa} className={`border-t border-slate-100 ${bamDuoc ? 'cursor-pointer hover:bg-teal-50' : ''}`} onClick={bamDuoc ? () => loc(d.khoa) : undefined}>
                <td className="py-1 text-slate-400">{i + 1}</td>
                <td className="py-1">
                  <span className={bamDuoc ? 'text-teal-700 underline decoration-dotted underline-offset-2' : ''}>{d.khoa}</span>
                  {d.phu && <span className="ml-1 text-xs text-slate-400">{d.phu}</span>}
                </td>
                <td className="py-1 text-right">{d.soLop}</td>
                <td className="py-1 text-right">{dinhDangTien(d.tien)}</td>
                <td className="py-1 pl-2">
                  <span className="flex items-center gap-1">
                    <span className="h-2 flex-1 rounded bg-slate-100">
                      <span className="block h-2 rounded bg-teal-600" style={{ width: `${(d.tien / max) * 100}%` }} />
                    </span>
                    <span className="w-9 text-right text-xs text-slate-500">{tong.tien ? ((d.tien / tong.tien) * 100).toFixed(1) : 0}%</span>
                  </span>
                </td>
                <td className={`py-1 text-right ${d.tien - d.daTT ? 'text-amber-700' : 'text-slate-300'}`}>{dinhDangTien(d.tien - d.daTT)}</td>
                <td className="whitespace-nowrap py-1 text-right text-xs text-slate-500">{ngayVN(d.tu)} – {ngayVN(d.den)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-300 font-semibold">
              <td />
              <td className="py-1">Cộng {dong.length} dòng</td>
              <td className="py-1 text-right">{tong.soLop}</td>
              <td className="py-1 text-right">{dinhDangTien(tong.tien)}</td>
              <td className="py-1 pl-2 text-xs text-slate-500">100%</td>
              <td className="py-1 text-right">{dinhDangTien(tong.tien - tong.daTT)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      {dong.length > MOT_TRANG && (
        <button className="mt-2 text-sm text-teal-700 hover:underline" onClick={() => setHet(!het)}>
          {het ? 'Thu gọn' : `Xem đủ ${dong.length} dòng`}
        </button>
      )}
      <p className="mt-1 text-xs text-slate-400">
        {bamDuoc ? 'Bấm một dòng để xem danh sách lớp. ' : ''}Chữ xám nhỏ cạnh tên là đối tác đi kèm. Khách hàng viết hoa/thường khác nhau được gộp làm một.
      </p>
    </div>
  )
}

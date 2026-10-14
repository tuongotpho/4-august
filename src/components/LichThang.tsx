import { useMemo, useState } from 'react'
import { congNgay, homNay, ngayCuoi, ngayVN, trangThai, type LopGiang } from '../lib/model'
import { DongLop, MAU_TRANG_THAI } from './TheLop'

const THU = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

export default function LichThang({ ds, onMo, onThem }: { ds: LopGiang[]; onMo: (l: LopGiang) => void; onThem: (ngay: string) => void }) {
  const hn = homNay()
  const [thang, setThang] = useState(hn.slice(0, 7))
  const [chon, setChon] = useState(hn)

  // mỗi ngày -> các lớp diễn ra ngày đó (lớp nhiều ngày hiện ở mọi ngày)
  const theoNgay = useMemo(() => {
    const m = new Map<string, LopGiang[]>()
    for (const l of ds) {
      for (let n = l.ngay; n <= ngayCuoi(l); n = congNgay(n, 1)) m.set(n, [...(m.get(n) ?? []), l])
    }
    return m
  }, [ds])

  const o = useMemo(() => {
    const dau = `${thang}-01`
    const t = new Date(dau + 'T00:00:00Z').getUTCDay()
    const batDau = congNgay(dau, -((t + 6) % 7)) // về thứ 2
    return Array.from({ length: 42 }, (_, i) => congNgay(batDau, i))
  }, [thang])
  const hienO = o.slice(0, o[35].slice(0, 7) === thang ? 42 : 35)

  const sapToi = ds.filter((l) => !l.huy && ngayCuoi(l) >= hn && l.ngay <= congNgay(hn, 30))
  const doiThang = (n: number) => {
    const d = new Date(thang + '-01T00:00:00Z')
    d.setUTCMonth(d.getUTCMonth() + n)
    setThang(d.toISOString().slice(0, 7))
  }
  const trongThang = ds.filter((l) => l.ngay.startsWith(thang) && !l.huy)

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="card !p-2 sm:!p-4">
        <div className="mb-2 flex items-center gap-2">
          <button className="btn !px-2" onClick={() => doiThang(-1)} aria-label="Tháng trước">‹</button>
          <h2 className="text-center font-semibold whitespace-nowrap text-slate-800 sm:min-w-36">Tháng {thang.slice(5)}/{thang.slice(0, 4)}</h2>
          <button className="btn !px-2" onClick={() => doiThang(1)} aria-label="Tháng sau">›</button>
          <button className="btn whitespace-nowrap" onClick={() => { setThang(hn.slice(0, 7)); setChon(hn) }}>Hôm nay</button>
          <span className="ml-auto text-right text-xs text-slate-500">
            {trongThang.length} lớp · {trongThang.reduce((s, l) => s + (l.chiPhi ?? 0), 0).toLocaleString('vi-VN')} đ
          </span>
        </div>
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-slate-200 bg-slate-200 text-xs">
          {THU.map((t) => <div key={t} className="bg-slate-50 py-1 text-center font-medium text-slate-500">{t}</div>)}
          {hienO.map((n) => {
            const lop = theoNgay.get(n) ?? []
            const ngoai = !n.startsWith(thang)
            return (
              <button
                key={n}
                onClick={() => setChon(n)}
                onDoubleClick={() => onThem(n)}
                className={`min-h-16 bg-white p-1 text-left align-top sm:min-h-24 ${ngoai ? 'opacity-40' : ''} ${chon === n ? 'ring-2 ring-inset ring-teal-600' : ''}`}
              >
                <span className={`mb-0.5 inline-block rounded px-1 ${n === hn ? 'bg-teal-700 font-bold text-white' : 'text-slate-600'}`}>{Number(n.slice(8))}</span>
                {lop.slice(0, 3).map((l) => (
                  <span key={l.id} className={`mb-0.5 block truncate rounded px-1 leading-4 ${MAU_TRANG_THAI[trangThai(l)]}`}>
                    <span className="hidden sm:inline">{l.gioBD} </span>{l.khachHang}
                  </span>
                ))}
                {lop.length > 3 && <span className="block text-slate-400">+{lop.length - 3}</span>}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-slate-400">Chạm vào ngày để xem lớp; dùng nút “+ Thêm lớp ngày này” bên dưới để thêm.</p>
      </div>

      <div className="space-y-4">
        <div className="card !p-3">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">{ngayVN(chon)}</h3>
            <button className="btn !py-0.5 !text-xs" onClick={() => onThem(chon)}>+ Thêm lớp ngày này</button>
          </div>
          {(theoNgay.get(chon) ?? []).length === 0 && <p className="text-sm text-slate-400">Không có lớp.</p>}
          {(theoNgay.get(chon) ?? []).map((l) => <DongLop key={l.id} l={l} onMo={onMo} coNgay={false} />)}
        </div>
        <div className="card !p-3">
          <h3 className="mb-1 font-semibold text-slate-800">Sắp tới (30 ngày)</h3>
          {sapToi.length === 0 && <p className="text-sm text-slate-400">Chưa có lịch.</p>}
          {sapToi.map((l) => <DongLop key={l.id} l={l} onMo={onMo} />)}
        </div>
      </div>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { congNgay, dinhDangTien, homNay, ngayCuoi, ngayVN, TEN_BUOI, thu, trangThai, type LopGiang } from '../lib/model'
import { MAU_TRANG_THAI, NhanTrangThai, VIEN_TRANG_THAI } from './TheLop'

const THU = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

/** Một lớp trong khung "ngày được chọn": đủ thông tin, tên khách hàng không bị cắt */
function TheLopNgay({ l, onMo, coNgay = false }: { l: LopGiang; onMo: (l: LopGiang) => void; coNgay?: boolean }) {
  const tt = trangThai(l)
  const hn = homNay()
  const tenNgay = l.ngay === hn ? 'Hôm nay' : l.ngay === congNgay(hn, 1) ? 'Mai' : `${thu(l.ngay)} ${ngayVN(l.ngay, false)}`
  const dong: [string, string][] = [
    ['Đối tác', [l.doiTac, l.lienHe].filter(Boolean).join(' · ')],
    ['Ở đâu', l.hinhThuc === 'online' ? 'Online' : l.diaDiem],
    ['Nội dung', l.noiDung],
  ]
  return (
    <button
      className={`block w-full rounded-md border border-l-4 border-slate-200 ${VIEN_TRANG_THAI[tt]} px-3 py-2 text-left hover:bg-slate-50 ${l.huy ? 'opacity-60' : ''}`}
      onClick={() => onMo(l)}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold tabular-nums text-slate-700">
          {coNgay && <span className="text-teal-700">{tenNgay} · </span>}
          {l.gioBD ? `${l.gioBD}–${l.gioKT}` : TEN_BUOI[l.buoi]}
          {l.soNgay > 1 && <span className="font-normal text-slate-500"> · {ngayVN(l.ngay, false)}–{ngayVN(ngayCuoi(l), false)}</span>}
        </span>
        <span className="ml-auto"><NhanTrangThai l={l} /></span>
      </div>
      <div className={`mt-0.5 font-semibold leading-snug text-slate-900 ${l.huy ? 'line-through' : ''}`}>
        {l.hinhThuc === 'online' && '💻 '}
        {l.khachHang || '(chưa rõ khách hàng)'}
      </div>
      <dl className="mt-1 grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-0.5 text-xs">
        {dong.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-slate-400">{k}</dt>
            <dd className="text-slate-700">{v}</dd>
          </div>
        ))}
        <dt className="text-slate-400">Thù lao</dt>
        <dd className="font-medium text-slate-800">{l.chiPhi === null ? 'chưa ghi' : `${dinhDangTien(l.chiPhi)} đ`}</dd>
      </dl>
    </button>
  )
}

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

  const sapToi = ds
    .filter((l) => !l.huy && ngayCuoi(l) >= hn && l.ngay <= congNgay(hn, 30))
    .sort((a, b) => (a.ngay + (a.gioBD || '99')).localeCompare(b.ngay + (b.gioBD || '99')))
  const doiThang = (n: number) => {
    const d = new Date(thang + '-01T00:00:00Z')
    d.setUTCMonth(d.getUTCMonth() + n)
    setThang(d.toISOString().slice(0, 7))
  }
  const trongThang = ds.filter((l) => l.ngay.startsWith(thang) && !l.huy)
  const lopChon = [...(theoNgay.get(chon) ?? [])].sort((a, b) => (a.gioBD || '99').localeCompare(b.gioBD || '99'))

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="card min-w-0 !p-2 sm:!p-4">
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
        <p className="mt-2 text-xs text-slate-400">Chạm vào ngày để xem lớp; nút “+ Thêm lớp” ở khung ngày để thêm (máy tính: bấm đúp vào ngày).</p>
      </div>

      <div className="space-y-4">
        <div className="card !p-3">
          <div className="mb-2 flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-slate-800">{thu(chon) === 'CN' ? 'Chủ nhật' : `Thứ ${Number(thu(chon).slice(1))}`}, {ngayVN(chon)}</h3>
              {lopChon.length > 0 && (
                <p className="text-xs text-slate-500">{lopChon.length} lớp · {lopChon.reduce((s, l) => s + (l.huy ? 0 : l.chiPhi ?? 0), 0).toLocaleString('vi-VN')} đ</p>
              )}
            </div>
            <button className="btn shrink-0 !py-1 !text-xs" onClick={() => onThem(chon)}>+ Thêm lớp</button>
          </div>
          {lopChon.length === 0 && <p className="text-sm text-slate-400">Không có lớp.</p>}
          <div className="space-y-2">
            {lopChon.map((l) => <TheLopNgay key={l.id} l={l} onMo={onMo} />)}
          </div>
        </div>
        <div className="card !p-3">
          <h3 className="mb-2 font-semibold text-slate-800">Sắp tới (30 ngày)</h3>
          {sapToi.length === 0 && <p className="text-sm text-slate-400">Chưa có lịch.</p>}
          <div className="space-y-2">
            {sapToi.map((l) => <TheLopNgay key={l.id} l={l} onMo={onMo} coNgay />)}
          </div>
        </div>
      </div>
    </div>
  )
}

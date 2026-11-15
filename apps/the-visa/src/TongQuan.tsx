// Tab "Theo kỳ": dashboard như bản HTML đầu tiên, nhưng tính từ dữ liệu đã lưu.
import { useMemo, useState } from 'react'
import type { ChartConfiguration } from 'chart.js'
import type { Ky } from '../shared/kieu'
import { DS_NHOM, MAU_NHOM, dsKhoanChi, type KhoanChi } from '../shared/phanLoai'
import { cong, dong, gomTheo, ngayVN, nhanKy, nhanXet, tr } from '../shared/thongKe'
import { BieuDo, trucTrieu } from './BieuDo'
import { BangGiaoDich } from './BangGiaoDich'

const NGOAI_SINH_HOAT = ['Bảo hiểm', 'Sửa điện thoại', 'Viễn thông', 'Kính mắt', 'Chuyển tiền qua VPBank NEO', 'Khác (chưa rõ)']
const MAU_KY = ['#94a3b8', '#ea580c', '#2563eb', '#16a34a', '#9333ea', '#0f766e', '#db2777', '#ca8a04']
const tip = { callbacks: { label: (c: { dataset: { label?: string }; label: string; raw: unknown }) => ` ${c.dataset.label || c.label}: ${dong(Number(c.raw))}` } }

export function TongQuan({ ky, doiNhom }: { ky: Ky[]; doiNhom: (k: KhoanChi, nhom: string) => void }) {
  const [chon, setChon] = useState<string>('')
  const tatCa = useMemo(() => dsKhoanChi(ky), [ky])
  const khoan = useMemo(() => tatCa.filter((x) => !chon || x.kyId === chon), [tatCa, chon])
  const nhomCo = useMemo(() => [...new Set([...DS_NHOM, ...tatCa.map((x) => x.nhom)])].filter((n) => tatCa.some((x) => x.nhom === n)), [tatCa])
  const nx = useMemo(() => nhanXet(ky), [ky])

  const tong = cong(khoan)
  const sinhHoat = cong(khoan.filter((x) => !NGOAI_SINH_HOAT.includes(x.nhom)))
  const lonNhat = khoan.reduce<KhoanChi | null>((m, x) => (!m || x.tien > m.tien ? x : m), null)
  const nho = khoan.filter((x) => x.tien > 0 && x.tien < 200_000)
  let soSanh = ''
  if (chon) {
    const i = ky.findIndex((k) => k.id === chon)
    if (i > 0) {
      const truoc = cong(tatCa.filter((x) => x.kyId === ky[i - 1].id))
      const d = ((tong - truoc) / truoc) * 100
      soSanh = `${d > 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(0)}% so với kỳ trước`
    }
  }

  const cfg = useMemo(() => {
    const theoKy: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: ky.map(nhanKy),
        datasets: nhomCo.map((n) => ({ label: n, backgroundColor: MAU_NHOM[n] ?? '#94a3b8', data: ky.map((k) => cong(tatCa.filter((x) => x.kyId === k.id && x.nhom === n))) })),
      },
      options: {
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } }, tooltip: tip },
        scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ...trucTrieu } },
        onClick: (_e, el) => { if (el.length) setChon(ky[el[0].index].id) },
      },
    }
    const bn = gomTheo(khoan, (x) => x.nhom, (x) => x.tien)
    const ns = nhomCo.filter((n) => (bn.get(n) ?? 0) > 0)
    const coCau: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: { labels: ns.map((n) => `${n} ${Math.round(((bn.get(n) ?? 0) / tong) * 100)}%`), datasets: [{ data: ns.map((n) => bn.get(n) ?? 0), backgroundColor: ns.map((n) => MAU_NHOM[n] ?? '#94a3b8'), borderWidth: 1 }] },
      options: { cutout: '58%', plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 11 } } }, tooltip: tip } },
    }
    const bt = [...gomTheo(khoan, (x) => x.ten, (x) => x.tien)].sort((a, b) => b[1] - a[1]).slice(0, 10)
    const noiChi: ChartConfiguration = {
      type: 'bar',
      data: { labels: bt.map((x) => x[0]), datasets: [{ label: 'Tổng chi', data: bt.map((x) => x[1]), backgroundColor: bt.map((x) => MAU_NHOM[khoan.find((k) => k.ten === x[0])!.nhom] ?? '#94a3b8') }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: tip }, scales: { x: trucTrieu, y: { grid: { display: false } } } },
    }
    const thu = [0, 0, 0, 0, 0, 0, 0]
    khoan.forEach((x) => { thu[(new Date(x.ngay + 'T00:00:00').getDay() + 6) % 7] += x.tien })
    const theoThu: ChartConfiguration = {
      type: 'bar',
      data: { labels: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'], datasets: [{ label: 'Tổng chi', data: thu, backgroundColor: thu.map((_, i) => (i >= 5 ? '#ea580c' : '#0b8a5f')) }] },
      options: { plugins: { legend: { display: false }, tooltip: tip }, scales: { x: { grid: { display: false } }, y: trucTrieu } },
    }
    const congDon: ChartConfiguration = {
      type: 'line',
      data: {
        datasets: (chon ? ky.filter((k) => k.id === chon) : ky).map((k) => {
          const g = tatCa.filter((x) => x.kyId === k.id).sort((a, b) => a.ngay.localeCompare(b.ngay))
          const dau = Date.parse(k.tu)
          let acc = 0
          return {
            label: `Kỳ ${nhanKy(k)}`, stepped: true, pointRadius: 2, borderWidth: 2, borderColor: MAU_KY[ky.indexOf(k) % MAU_KY.length],
            data: g.map((x) => { acc += x.tien; return { x: Math.round((Date.parse(x.ngay) - dau) / 864e5) + 1, y: acc } }),
          }
        }),
      },
      options: {
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10 } } },
        scales: { x: { type: 'linear', min: -3, max: 33, title: { display: true, text: 'Ngày thứ … trong kỳ' } }, y: trucTrieu },
      },
    }
    return { theoKy, coCau, noiChi, theoThu, congDon }
  }, [ky, tatCa, khoan, nhomCo, chon, tong])

  if (!ky.length) return <div className="card">Chưa có kỳ sao kê nào. Sang tab <b>Tải sao kê</b> để thêm.</div>

  const kpi: [string, string, string][] = [
    ['Tổng chi', tr(tong), soSanh || `${khoan.length} giao dịch`],
    chon ? ['Số giao dịch', String(khoan.length), 'lần quẹt thẻ'] : ['Trung bình mỗi kỳ', tr(tong / ky.length), `${ky.length} kỳ sao kê`],
    ['Chi sinh hoạt đều đặn', tr(sinhHoat), `${tong ? Math.round((sinhHoat / tong) * 100) : 0}% · xăng, siêu thị, online, thuốc, ăn uống`],
    ['Khoản lớn nhất', lonNhat ? tr(lonNhat.tien) : '—', lonNhat ? `${lonNhat.ten} · ${ngayVN(lonNhat.ngay)}` : ''],
    ['Khoản lặt vặt (< 200k)', `${nho.length} lần`, `cộng lại ${tr(cong(nho))}`],
  ]
  return (
    <>
      <div className="bar">
        <button className={`chip ${!chon ? 'on' : ''}`} onClick={() => setChon('')}>Cả {ky.length} kỳ</button>
        {ky.map((k) => <button key={k.id} className={`chip ${chon === k.id ? 'on' : ''}`} onClick={() => setChon(k.id)}>Kỳ {nhanKy(k)}</button>)}
      </div>
      <div className="grid kpis">
        {kpi.map(([l, v, d]) => <div key={l} className="card kpi"><div className="l">{l}</div><div className="v">{v}</div><div className="d sub">{d}</div></div>)}
      </div>
      <div className="grid two" style={{ marginTop: 14 }}>
        <div className="card"><h2>Chi theo kỳ sao kê, chia theo nhóm</h2><BieuDo cauHinh={cfg.theoKy} /><div className="sub">Bấm vào cột để xem riêng kỳ đó.</div></div>
        <div className="card"><h2>Cơ cấu theo nhóm</h2><BieuDo cauHinh={cfg.coCau} /></div>
      </div>
      <div className="grid two" style={{ marginTop: 14 }}>
        <div className="card"><h2>Nơi tiêu nhiều nhất</h2><BieuDo cauHinh={cfg.noiChi} /></div>
        <div className="card"><h2>Chi theo thứ trong tuần</h2><BieuDo cauHinh={cfg.theoThu} /></div>
      </div>
      <div className="card" style={{ marginTop: 14 }}><h2>Chi tiêu cộng dồn trong kỳ</h2><BieuDo cauHinh={cfg.congDon} /></div>
      {!chon && (
        <div className="card" style={{ marginTop: 14 }}>
          <h2>Nhận xét xu hướng (tự động)</h2>
          <div className="notes">{nx.map((n) => <div key={n.tieuDe} className={`note ${n.canhBao ? 'w' : ''}`}><b>{n.tieuDe}</b>{n.noiDung}</div>)}</div>
        </div>
      )}
      <div className="card" style={{ marginTop: 14 }}><h2>Danh sách giao dịch</h2><BangGiaoDich khoan={khoan} doiNhom={doiNhom} /></div>
    </>
  )
}

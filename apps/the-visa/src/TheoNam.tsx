// Tab "Theo năm": thống kê năm dương lịch theo NGÀY GIAO DỊCH.
import { useMemo, useState } from 'react'
import type { ChartConfiguration } from 'chart.js'
import type { Ky } from '../shared/kieu'
import { MAU_NHOM, type KhoanChi } from '../shared/phanLoai'
import { cong, danhSachNam, dong, thongKeNam, tr } from '../shared/thongKe'
import { BieuDo, trucTrieu } from './BieuDo'
import { BangGiaoDich } from './BangGiaoDich'

const THANG = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12']
const tip = { callbacks: { label: (c: { dataset: { label?: string }; label: string; raw: unknown }) => ` ${c.dataset.label || c.label}: ${dong(Number(c.raw))}` } }

export function TheoNam({ ky, doiNhom }: { ky: Ky[]; doiNhom: (k: KhoanChi, nhom: string) => void }) {
  const nams = useMemo(() => danhSachNam(ky), [ky])
  const [nam, setNam] = useState(nams[nams.length - 1] ?? new Date().getFullYear())
  const t = useMemo(() => thongKeNam(ky, nam), [ky, nam])

  const cfg = useMemo(() => {
    const nhom = t.theoNhom.map((x) => x[0])
    const thang: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: THANG,
        datasets: nhom.map((n) => ({
          label: n, backgroundColor: MAU_NHOM[n] ?? '#94a3b8',
          data: THANG.map((_, i) => cong(t.khoan.filter((x) => x.nhom === n && x.ngay.slice(5, 7) === String(i + 1).padStart(2, '0')))),
        })),
      },
      options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } }, tooltip: tip }, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ...trucTrieu } } },
    }
    const coCau: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: { labels: t.theoNhom.map(([n, v]) => `${n} ${Math.round((v / t.tong) * 100)}%`), datasets: [{ data: t.theoNhom.map((x) => x[1]), backgroundColor: nhom.map((n) => MAU_NHOM[n] ?? '#94a3b8'), borderWidth: 1 }] },
      options: { cutout: '58%', plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 11 } } }, tooltip: tip } },
    }
    const top = t.theoTen.slice(0, 10)
    const noiChi: ChartConfiguration = {
      type: 'bar',
      data: { labels: top.map((x) => x[0]), datasets: [{ label: 'Tổng chi', data: top.map((x) => x[1]), backgroundColor: top.map((x) => MAU_NHOM[t.khoan.find((k) => k.ten === x[0])!.nhom] ?? '#94a3b8') }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: tip }, scales: { x: trucTrieu, y: { grid: { display: false } } } },
    }
    return { thang, coCau, noiChi }
  }, [t])

  if (!nams.length) return <div className="card">Chưa có dữ liệu.</div>
  const thangMax = t.thang.indexOf(Math.max(...t.thang))
  const tbThang = t.soThangCoDuLieu ? t.tong / t.soThangCoDuLieu : 0
  // bảo hiểm đóng theo năm: không nhân 12 khi ước cả năm, chỉ cộng một lần
  const baoHiem = t.theoNhom.find(([n]) => n === 'Bảo hiểm')?.[1] ?? 0
  const uocNam = t.soThangCoDuLieu ? ((t.tong - baoHiem) / t.soThangCoDuLieu) * 12 + baoHiem : 0
  const duNam = t.soThangCoDuLieu === 12
  return (
    <>
      <div className="bar">
        {nams.map((n) => <button key={n} className={`chip ${n === nam ? 'on' : ''}`} onClick={() => setNam(n)}>Năm {n}</button>)}
      </div>
      {!duNam && (
        <div className="sub" style={{ marginBottom: 10 }}>
          Năm {nam} mới có dữ liệu từ tháng {t.tuThang} đến tháng {t.denThang} (tính theo ngày giao dịch). Số "cả năm" là số của các tháng đã có, chưa phải cả 12 tháng.
        </div>
      )}
      <div className="grid kpis">
        <div className="card kpi"><div className="l">Tổng chi năm {nam}{duNam ? '' : ` (T${t.tuThang}–T${t.denThang})`}</div><div className="v">{tr(t.tong)}</div><div className="d sub">{t.soGiaoDich} giao dịch</div></div>
        <div className="card kpi"><div className="l">Trung bình mỗi tháng</div><div className="v">{tr(tbThang)}</div><div className="d sub">{duNam ? 'cả 12 tháng' : `ước cả năm ≈ ${tr(uocNam)}${baoHiem ? ' (bảo hiểm tính 1 lần)' : ''}`}</div></div>
        <div className="card kpi"><div className="l">Tháng chi nhiều nhất</div><div className="v">{THANG[thangMax]}</div><div className="d sub">{tr(t.thang[thangMax])}</div></div>
        <div className="card kpi"><div className="l">Nhóm lớn nhất</div><div className="v" style={{ fontSize: 18 }}>{t.theoNhom[0]?.[0] ?? '—'}</div><div className="d sub">{t.theoNhom[0] ? `${tr(t.theoNhom[0][1])} · ${Math.round((t.theoNhom[0][1] / t.tong) * 100)}%` : ''}</div></div>
        <div className="card kpi"><div className="l">So với năm {nam - 1}</div><div className="v">{t.tongNamTruoc ? `${t.tong >= t.tongNamTruoc ? '▲' : '▼'} ${Math.abs(((t.tong - t.tongNamTruoc) / t.tongNamTruoc) * 100).toFixed(0)}%` : '—'}</div><div className="d sub">{t.tongNamTruoc ? `năm ${nam - 1}: ${tr(t.tongNamTruoc)}` : `chưa có dữ liệu năm ${nam - 1}`}</div></div>
      </div>
      <div className="card" style={{ marginTop: 14 }}><h2>Chi từng tháng năm {nam}, chia theo nhóm</h2><BieuDo cauHinh={cfg.thang} cao={320} /></div>
      <div className="grid two" style={{ marginTop: 14 }}>
        <div className="card"><h2>Cơ cấu cả năm</h2><BieuDo cauHinh={cfg.coCau} /></div>
        <div className="card"><h2>Nơi tiêu nhiều nhất trong năm</h2><BieuDo cauHinh={cfg.noiChi} /></div>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <h2>Bảng nhóm × tháng (triệu đồng)</h2>
        <div className="tbl">
          <table>
            <thead><tr><th>Nhóm</th>{THANG.map((m, i) => (t.thang[i] ? <th key={m} className="n">{m}</th> : null))}<th className="n">Cả năm</th></tr></thead>
            <tbody>
              {t.theoNhom.map(([n, v]) => (
                <tr key={n}>
                  <td><span className="dot" style={{ background: MAU_NHOM[n] ?? '#94a3b8' }} />{n}</td>
                  {THANG.map((m, i) => (t.thang[i] ? <td key={m} className="n">{(cong(t.khoan.filter((x) => x.nhom === n && x.ngay.slice(5, 7) === String(i + 1).padStart(2, '0'))) / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}</td> : null))}
                  <td className="n"><b>{(v / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}</b></td>
                </tr>
              ))}
              <tr>
                <td><b>Tổng</b></td>
                {THANG.map((m, i) => (t.thang[i] ? <td key={m} className="n"><b>{(t.thang[i] / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}</b></td> : null))}
                <td className="n"><b>{(t.tong / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}</b></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="card" style={{ marginTop: 14 }}><h2>Giao dịch năm {nam}</h2><BangGiaoDich khoan={t.khoan} doiNhom={doiNhom} /></div>
    </>
  )
}

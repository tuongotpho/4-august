import { useEffect, useRef, useState } from 'react'

/**
 * Biểu đồ cột một chuỗi số (VD doanh thu theo tháng).
 * Cột mảnh bo đầu, lưới mờ, chạm/rê vào cột hiện số chính xác; chỉ ghi số trên cột cao nhất & cột cuối.
 * Vẽ đúng theo bề rộng thật của khung (đo bằng ResizeObserver) để chữ luôn 12px — không phóng to theo khung
 * như khi dùng viewBox cố định (máy tính thẻ rộng 800px từng làm chữ to 25px).
 */
export function BarChart({
  data,
  format,
  color = 'var(--color-red-600)',
  height = 180,
  unit,
}: {
  data: { label: string; value: number; sub?: string }[]
  format: (n: number) => string
  color?: string
  height?: number
  unit?: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const khung = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(340)
  useEffect(() => {
    const el = khung.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const H = height
  const top = 22
  const bottom = 26
  const plotH = H - top - bottom
  const max = Math.max(1, ...data.map((d) => d.value))
  const n = data.length
  const slot = W / Math.max(1, n)
  const bw = Math.min(32, slot * 0.55)
  const maxIdx = data.reduce((m, d, i) => (d.value > data[m].value ? i : m), 0)
  const y = (v: number) => top + plotH - (v / max) * plotH

  const h = hover ?? -1
  return (
    <div ref={khung} className="relative select-none">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block w-full" role="img" aria-label={data.map((d) => `${d.label}: ${format(d.value)}`).join(', ')}>
        {[0.5, 1].map((t) => (
          <line key={t} x1={0} x2={W} y1={y(max * t)} y2={y(max * t)} stroke="var(--color-slate-200)" strokeDasharray="3 4" />
        ))}
        <line x1={0} x2={W} y1={top + plotH} y2={top + plotH} stroke="var(--color-slate-300)" />
        {data.map((d, i) => {
          const cx = slot * i + slot / 2
          const bh = Math.max(d.value > 0 ? 3 : 0, top + plotH - y(d.value))
          const r = Math.min(4, bw / 2, bh)
          const x0 = cx - bw / 2
          const y0 = top + plotH - bh
          const showLabel = d.value > 0 && (i === maxIdx || i === n - 1 || i === h)
          return (
            <g key={i}>
              {bh > 0 && (
                <path
                  d={`M${x0},${top + plotH} V${y0 + r} Q${x0},${y0} ${x0 + r},${y0} H${x0 + bw - r} Q${x0 + bw},${y0} ${x0 + bw},${y0 + r} V${top + plotH} Z`}
                  fill={color}
                  opacity={h === -1 || h === i ? 1 : 0.45}
                />
              )}
              {showLabel && (
                <text x={cx} y={y0 - 6} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--color-slate-700)">
                  {format(d.value)}
                </text>
              )}
              <text x={cx} y={H - 8} textAnchor="middle" fontSize="12" fill="var(--color-slate-500)">
                {d.label}
              </text>
              {/* vùng chạm rộng hơn cột */}
              <rect
                x={slot * i}
                y={0}
                width={slot}
                height={H}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setHover(hover === i ? null : i)}
              />
            </g>
          )
        })}
      </svg>
      {hover != null && data[hover] && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg"
          style={{ left: `${Math.min(85, Math.max(15, ((hover + 0.5) / n) * 100))}%` }}
        >
          <div className="font-semibold">{data[hover].label}</div>
          <div>
            {format(data[hover].value)}
            {unit ? ' ' + unit : ''}
          </div>
          {data[hover].sub && <div className="text-slate-300">{data[hover].sub}</div>}
        </div>
      )}
    </div>
  )
}

/** Thanh ngang so sánh (VD top khách, cơ cấu loại chai) — nhãn & số nằm cạnh thanh, không cần chú thích màu */
export function HBars({
  rows,
  format,
  color = 'var(--color-red-600)',
  onClick,
}: {
  rows: { key: string; label: string; value: number; sub?: string }[]
  format: (n: number) => string
  color?: string
  onClick?: (key: string) => void
}) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <button key={r.key} type="button" onClick={() => onClick?.(r.key)} className={`block w-full text-left ${onClick ? 'cursor-pointer' : 'cursor-default'}`}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate font-medium text-slate-800">{r.label}</span>
            <span className="shrink-0 font-bold tabular-nums text-slate-900">
              {format(r.value)}
              {r.sub && <span className="ml-1 text-xs font-normal text-slate-500">{r.sub}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </div>
        </button>
      ))}
    </div>
  )
}

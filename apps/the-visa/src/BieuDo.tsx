// Bọc Chart.js thành component React: vẽ lại khi cấu hình đổi.
import { useEffect, useRef } from 'react'
import Chart, { type ChartConfiguration } from 'chart.js/auto'

const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim()
export const mauChu = () => css('--mute')

export function BieuDo({ cauHinh, cao = 290 }: { cauHinh: ChartConfiguration<any>; cao?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    Chart.defaults.color = css('--mute')
    Chart.defaults.borderColor = css('--line')
    Chart.defaults.font.family = 'Segoe UI, system-ui, sans-serif'
    const c = new Chart(ref.current!, { ...cauHinh, options: { maintainAspectRatio: false, ...cauHinh.options } })
    return () => c.destroy()
  }, [cauHinh])
  return <div className="chart" style={{ height: cao }}><canvas ref={ref} /></div>
}

export const trucTrieu = { ticks: { callback: (v: string | number) => `${Number(v) / 1e6} tr` } }

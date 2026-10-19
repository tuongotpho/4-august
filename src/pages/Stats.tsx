import { useMemo, useState } from 'react'
import { BarChart, HBars } from '../charts'
import { fmtMonth, lastMonths, monthOf, monthStats, money, num, orderQty, orderTotal, qtyByProduct, short, today } from '../logic'
import { Card, Empty, Stat, custName, useApp } from '../ui'

type Metric = 'revenue' | 'profit' | 'qty'
const METRICS: { id: Metric; label: string }[] = [
  { id: 'revenue', label: 'Doanh thu' },
  { id: 'profit', label: 'Lãi' },
  { id: 'qty', label: 'Số chai' },
]

export default function Stats() {
  const ctx = useApp()
  const { data, productById, openCustomer } = ctx
  const [n, setN] = useState(6)
  const [metric, setMetric] = useState<Metric>('revenue')
  const months = lastMonths(monthOf(today()), n)
  const from = months[0]
  const inRange = useMemo(() => data.orders.filter((o) => monthOf(o.date) >= from), [data.orders, from])
  const stats = useMemo(() => monthStats(data.orders, months), [data.orders, months.join()])
  const tot = stats.reduce((s, m) => ({ revenue: s.revenue + m.revenue, profit: s.profit + m.profit, qty: s.qty + m.qty, orders: s.orders + m.orders }), { revenue: 0, profit: 0, qty: 0, orders: 0 })
  const margin = tot.revenue ? Math.round((tot.profit / tot.revenue) * 100) : 0

  const top = useMemo(() => {
    const m = new Map<string, { money: number; qty: number }>()
    for (const o of inRange) {
      const x = m.get(o.customerId) ?? { money: 0, qty: 0 }
      x.money += orderTotal(o)
      x.qty += orderQty(o)
      m.set(o.customerId, x)
    }
    return [...m].sort((a, b) => b[1].money - a[1].money).slice(0, 10)
  }, [inRange])
  const mix = [...qtyByProduct(inRange)].sort((a, b) => b[1] - a[1])
  const fmt = metric === 'qty' ? num : short

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-xl bg-slate-200/60 p-1 text-xs font-semibold">
        {[3, 6, 12].map((k) => (
          <button key={k} onClick={() => setN(k)} className={`flex-1 cursor-pointer rounded-lg py-2 ${n === k ? 'bg-white text-red-800 shadow-sm' : 'text-slate-600'}`}>
            {k} tháng
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Doanh thu" value={short(tot.revenue)} sub={`${tot.orders} đơn`} />
        <Stat label="Lãi" value={short(tot.profit)} tone="green" sub={`biên lãi ${margin}%`} />
        <Stat label="Số chai" value={num(tot.qty)} />
        <Stat label="TB mỗi đơn" value={short(tot.orders ? tot.revenue / tot.orders : 0)} />
      </div>

      <Card
        title="Theo tháng"
        right={
          <div className="flex gap-1 text-xs font-semibold">
            {METRICS.map((m) => (
              <button key={m.id} onClick={() => setMetric(m.id)} className={`cursor-pointer rounded-lg px-2.5 py-1.5 ${metric === m.id ? 'bg-red-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {m.label}
              </button>
            ))}
          </div>
        }
      >
        <BarChart
          data={stats.map((s) => ({ label: fmtMonth(s.month), value: Math.max(0, s[metric]), sub: `${s.orders} đơn · ${num(s.qty)} chai` }))}
          format={fmt}
          color={metric === 'profit' ? 'var(--color-emerald-600)' : 'var(--color-red-600)'}
          unit={metric === 'qty' ? 'chai' : undefined}
        />
        {metric === 'profit' && <p className="mt-2 text-xs text-slate-500">Lãi = tiền bán − giá vốn lúc bán. Đơn bán khi chưa nhập giá vốn sẽ tính lãi bằng cả tiền bán.</p>}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Khách lấy nhiều nhất" subtitle={`${n} tháng gần đây · bấm để xem chi tiết`}>
          {top.length === 0 ? (
            <Empty>Chưa có đơn.</Empty>
          ) : (
            <HBars rows={top.map(([id, x]) => ({ key: id, label: custName(ctx, id), value: x.money, sub: `${num(x.qty)} chai` }))} format={money} onClick={openCustomer} />
          )}
        </Card>
        <Card title="Theo loại chai" subtitle={`${n} tháng gần đây`}>
          {mix.length === 0 ? (
            <Empty>Chưa có đơn.</Empty>
          ) : (
            <HBars
              rows={mix.map(([pid, q]) => ({ key: pid, label: productById.get(pid)?.name ?? '(đã xoá)', value: q, sub: `${Math.round((q / Math.max(1, tot.qty)) * 100)}%` }))}
              format={(v) => num(v) + ' chai'}
              color="var(--color-amber-600)"
            />
          )}
        </Card>
      </div>

      <Card title="Bảng số liệu">
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="px-1 py-1.5 font-medium">Tháng</th>
                <th className="px-1 py-1.5 text-right font-medium">Đơn</th>
                <th className="px-1 py-1.5 text-right font-medium">Chai</th>
                <th className="px-1 py-1.5 text-right font-medium">Doanh thu</th>
                <th className="px-1 py-1.5 text-right font-medium">Lãi</th>
              </tr>
            </thead>
            <tbody>
              {[...stats].reverse().map((s) => (
                <tr key={s.month} className="border-t border-slate-100">
                  <td className="px-1 py-1.5">{fmtMonth(s.month)}</td>
                  <td className="px-1 py-1.5 text-right">{s.orders}</td>
                  <td className="px-1 py-1.5 text-right">{num(s.qty)}</td>
                  <td className="px-1 py-1.5 text-right font-semibold">{money(s.revenue)}</td>
                  <td className="px-1 py-1.5 text-right text-emerald-700">{money(s.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

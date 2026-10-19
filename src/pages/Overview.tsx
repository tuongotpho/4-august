import { useMemo } from 'react'
import { BarChart } from '../charts'
import { Icon } from '../icons'
import { fmtDate, fmtMonth, lastMonths, monthOf, monthStats, money, num, predictAll, short, today, type Prediction } from '../logic'
import { Avatar, Btn, Card, Empty, Stat, useApp } from '../ui'
import { OrderRow } from './Orders'

export function PredictBadge({ p }: { p: Prediction }) {
  if (p.status === 'unknown')
    return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">{p.orders ? 'Mới mua 1 lần' : 'Chưa mua'}</span>
  if (p.status === 'overdue')
    return <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800">Quá {-p.daysLeft!} ngày</span>
  if (p.status === 'soon')
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
        {p.daysLeft === 0 ? 'Hôm nay' : `Còn ${p.daysLeft} ngày`}
      </span>
    )
  return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">Còn {p.daysLeft} ngày</span>
}

export default function Overview() {
  const { data, debts, stock, openOrder, openCustomer, go, productById } = useApp()
  const now = today()
  const thisMonth = monthOf(now)
  const months = lastMonths(thisMonth, 6)
  const stats = useMemo(() => monthStats(data.orders, months), [data.orders, months.join()])
  const cur = stats[stats.length - 1]
  const prev = stats[stats.length - 2]
  const totalDebt = [...debts.values()].reduce((s, d) => s + Math.max(0, d), 0)
  const debtors = [...debts.values()].filter((d) => d > 0).length
  const preds = useMemo(() => predictAll(data, now), [data, now])
  const due = preds.filter((p) => p.status === 'overdue' || p.status === 'soon')
  const low = stock.filter((s) => s.low && !s.product.inactive)
  const recent = [...data.orders].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 5)

  const pct = prev.revenue ? Math.round(((cur.revenue - prev.revenue) / prev.revenue) * 100) : null

  return (
    <div className="space-y-4">
      <Btn onClick={() => openOrder()} className="w-full py-3.5 text-base lg:hidden">
        <Icon name="plus" className="h-5 w-5" strokeWidth={2.4} /> Lên đơn mới
      </Btn>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={`Doanh thu ${fmtMonth(thisMonth)}`}
          value={short(cur.revenue)}
          sub={pct == null ? `${cur.orders} đơn` : `${cur.orders} đơn · ${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}% so tháng trước`}
        />
        <Stat label="Lãi tháng này" value={short(cur.profit)} tone="green" sub="theo giá vốn đã nhập" />
        <Stat label="Số chai đã bán" value={num(cur.qty)} sub="tháng này" />
        <Stat label="Khách còn nợ" value={short(totalDebt)} tone={totalDebt > 0 ? 'red' : 'slate'} sub={`${debtors} khách`} />
      </div>

      {low.length > 0 && (
        <button onClick={() => go('stock')} className="flex w-full cursor-pointer items-center gap-3 rounded-2xl bg-amber-50 p-3 text-left ring-1 ring-amber-200">
          <Icon name="box" className="h-6 w-6 shrink-0 text-amber-700" />
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-bold text-amber-900">Sắp hết hàng</div>
            <div className="text-amber-800">{low.map((s) => `${s.product.name}: còn ${s.stock}`).join(' · ')}</div>
          </div>
          <Icon name="chevron" className="h-4 w-4 text-amber-700" />
        </button>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Khách sắp tới lượt mua"
          subtitle="Dựa trên nhịp mua thật của từng khách (cần ít nhất 2 lần mua)"
          right={
            <Btn kind="ghost" className="text-xs" onClick={() => go('customers')}>
              Tất cả
            </Btn>
          }
        >
          {due.length === 0 ? (
            <Empty>Chưa có khách nào tới hạn mua lại.</Empty>
          ) : (
            <div className="-mx-1 divide-y divide-slate-100">
              {due.slice(0, 8).map((p) => (
                <button key={p.customer.id} onClick={() => openCustomer(p.customer.id)} className="flex w-full cursor-pointer items-center gap-3 px-1 py-2.5 text-left">
                  <Avatar name={p.customer.name} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-slate-900">{p.customer.name}</div>
                    <div className="truncate text-xs text-slate-500">
                      ~{p.cycle} ngày/lần · lần cuối {fmtDate(p.lastDate!)} · TB{' '}
                      {[...p.avgByProduct]
                        .filter(([, q]) => q >= 0.5)
                        .map(([pid, q]) => `${Math.round(q)} ${productById.get(pid)?.name.replace(/^Chai\s*/i, '') ?? ''}`)
                        .join(', ')}
                    </div>
                  </div>
                  <PredictBadge p={p} />
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card title="Doanh thu 6 tháng" subtitle="Chạm vào cột để xem số">
          <BarChart data={stats.map((s) => ({ label: fmtMonth(s.month), value: s.revenue, sub: `${num(s.qty)} chai · lãi ${money(s.profit)}` }))} format={short} />
        </Card>
      </div>

      <Card
        title="Đơn gần đây"
        right={
          <Btn kind="ghost" className="text-xs" onClick={() => go('orders')}>
            Tất cả
          </Btn>
        }
      >
        {recent.length === 0 ? <Empty>Chưa có đơn nào. Bấm "Lên đơn mới" để bắt đầu.</Empty> : recent.map((o) => <OrderRow key={o.id} order={o} />)}
      </Card>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { Icon } from '../icons'
import { fmtDate, fmtMonth, invoiceNo, monthOf, money, orderDue, orderQty, orderTotal, today } from '../logic'
import { store } from '../store'
import type { Order } from '../types'
import { Avatar, Btn, Card, Empty, Modal, custName, fold, inputCls, useApp } from '../ui'

/** Một dòng đơn — bấm để mở thao tác (xem hoá đơn / sửa / xoá) */
export function OrderRow({ order, hideCustomer }: { order: Order; hideCustomer?: boolean }) {
  const ctx = useApp()
  const [menu, setMenu] = useState(false)
  const name = custName(ctx, order.customerId)
  const due = orderDue(order)
  return (
    <>
      <button onClick={() => setMenu(true)} className="flex w-full cursor-pointer items-center gap-3 border-b border-slate-100 py-2.5 text-left last:border-0">
        {!hideCustomer && <Avatar name={name} className="h-9 w-9 text-xs" />}
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-slate-900">{hideCustomer ? fmtDate(order.date) : name}</div>
          <div className="truncate text-xs text-slate-500">
            {invoiceNo(order.no)} · {!hideCustomer && fmtDate(order.date) + ' · '}
            {order.items.map((i) => `${i.qty} ${i.name.replace(/^Chai\s*/i, '')}`).join(', ')}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-bold tabular-nums">{money(orderTotal(order))}</div>
          {due > 0 ? (
            <div className="text-[11px] font-semibold text-red-700">nợ {money(due)}</div>
          ) : (
            <div className="text-[11px] text-emerald-700">đã trả</div>
          )}
        </div>
      </button>
      {menu && <OrderActions order={order} onClose={() => setMenu(false)} />}
    </>
  )
}

function OrderActions({ order, onClose }: { order: Order; onClose: () => void }) {
  const ctx = useApp()
  const { canEdit, openInvoice, openOrder, toast } = ctx
  const del = async () => {
    if (!confirm(`Xoá ${invoiceNo(order.no)} của ${custName(ctx, order.customerId)}?\nTồn kho và công nợ sẽ tự tính lại.`)) return
    await store.remove('orders', order.id)
    toast('Đã xoá đơn')
    onClose()
  }
  return (
    <Modal title={`${invoiceNo(order.no)} · ${custName(ctx, order.customerId)}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded-2xl bg-slate-50 p-3 text-sm">
          {order.items.map((i) => (
            <div key={i.productId} className="flex justify-between py-0.5">
              <span>
                {i.name} × {i.qty}
              </span>
              <span className="tabular-nums">{money(i.qty * i.price)}</span>
            </div>
          ))}
          {order.discount > 0 && (
            <div className="flex justify-between py-0.5 text-emerald-700">
              <span>Giảm giá</span>
              <span>− {money(order.discount)}</span>
            </div>
          )}
          <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 font-bold">
            <span>Tổng · đã trả {money(order.paid)}</span>
            <span>{money(orderTotal(order))}</span>
          </div>
          {order.note && <div className="mt-1 text-xs text-slate-500">Ghi chú: {order.note}</div>}
        </div>
        <Btn
          onClick={() => {
            onClose()
            openInvoice(order.id)
          }}
          className="w-full py-3"
        >
          <Icon name="image" className="h-5 w-5" /> Xem / gửi ảnh hoá đơn
        </Btn>
        {canEdit && (
          <div className="grid grid-cols-2 gap-2">
            <Btn
              kind="soft"
              onClick={() => {
                onClose()
                openOrder({ orderId: order.id })
              }}
            >
              <Icon name="edit" className="h-4 w-4" /> Sửa đơn
            </Btn>
            <Btn kind="danger" onClick={del}>
              <Icon name="trash" className="h-4 w-4" /> Xoá đơn
            </Btn>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default function Orders() {
  const ctx = useApp()
  const { data, openOrder } = ctx
  const months = useMemo(() => {
    const s = new Set(data.orders.map((o) => monthOf(o.date)))
    s.add(monthOf(today()))
    return [...s].sort().reverse()
  }, [data.orders])
  const [month, setMonth] = useState(months[0])
  const [q, setQ] = useState('')
  const [onlyDebt, setOnlyDebt] = useState(false)

  const list = data.orders
    .filter((o) => (q ? true : monthOf(o.date) === month))
    .filter((o) => !onlyDebt || orderDue(o) > 0)
    .filter((o) => !q || fold(custName(ctx, o.customerId) + ' ' + invoiceNo(o.no)).includes(fold(q)))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)

  const byDay = new Map<string, Order[]>()
  for (const o of list) byDay.set(o.date, [...(byDay.get(o.date) ?? []), o])
  const sum = list.reduce((s, o) => s + orderTotal(o), 0)
  const qty = list.reduce((s, o) => s + orderQty(o), 0)

  return (
    <div className="space-y-4">
      <Btn onClick={() => openOrder()} className="w-full py-3.5 text-base">
        <Icon name="plus" className="h-5 w-5" strokeWidth={2.4} /> Lên đơn mới
      </Btn>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm khách / số HĐ…" className={`${inputCls} pl-9`} />
        </div>
        {!q && (
          <select value={month} onChange={(e) => setMonth(e.target.value)} className={`${inputCls} w-auto`}>
            {months.map((m) => (
              <option key={m} value={m}>
                {fmtMonth(m)}
              </option>
            ))}
          </select>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={onlyDebt} onChange={(e) => setOnlyDebt(e.target.checked)} className="h-4 w-4 accent-red-700" /> Chỉ đơn còn nợ
      </label>
      <p className="text-sm text-slate-600">
        {list.length} đơn · {qty} chai · <b className="text-slate-900">{money(sum)}</b>
      </p>
      {list.length === 0 ? (
        <Card>
          <Empty>Không có đơn nào.</Empty>
        </Card>
      ) : (
        [...byDay].map(([day, orders]) => (
          <Card key={day} title={fmtDate(day)} right={<span className="text-sm font-semibold tabular-nums text-slate-600">{money(orders.reduce((s, o) => s + orderTotal(o), 0))}</span>}>
            {orders.map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </Card>
        ))
      )}
    </div>
  )
}

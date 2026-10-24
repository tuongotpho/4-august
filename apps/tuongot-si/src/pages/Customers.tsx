import { useMemo, useState } from 'react'
import { BarChart } from '../charts'
import { Icon } from '../icons'
import { byDateAsc, fmtDate, fmtMonth, lastMonths, monthOf, money, num, orderQty, orderTotal, predict, predictAll, qtyByProduct, today } from '../logic'
import { newId, store } from '../store'
import type { Customer, Receipt } from '../types'
import { Avatar, Btn, Card, Empty, Field, Modal, MoneyInput, Stat, fold, inputCls, useApp } from '../ui'
import { OrderRow } from './Orders'
import { PredictBadge } from './Overview'

type Sort = 'next' | 'debt' | 'name'

export default function Customers() {
  const { data, debts, openCustomer, canEdit } = useApp()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('next')
  const [adding, setAdding] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const now = today()
  const preds = useMemo(() => {
    const all = predictAll({ ...data, customers: data.customers.map((c) => ({ ...c, inactive: false })) }, now)
    return all
  }, [data, now])

  const list = preds
    .filter((p) => showInactive || !p.customer.inactive)
    .filter((p) => !q || fold(p.customer.name + ' ' + (p.customer.phone ?? '') + ' ' + (p.customer.address ?? '')).includes(fold(q)))
  if (sort === 'debt') list.sort((a, b) => (debts.get(b.customer.id) ?? 0) - (debts.get(a.customer.id) ?? 0))
  if (sort === 'name') list.sort((a, b) => a.customer.name.localeCompare(b.customer.name, 'vi'))
  const inactiveCount = data.customers.filter((c) => c.inactive).length

  return (
    <div className="space-y-4">
      {canEdit && (
        <Btn onClick={() => setAdding(true)} kind="soft" className="w-full py-3">
          <Icon name="plus" className="h-5 w-5" /> Thêm khách
        </Btn>
      )}
      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm khách (tên, SĐT, địa chỉ)…" className={`${inputCls} pl-9`} />
      </div>
      <div className="flex gap-1 rounded-xl bg-slate-200/60 p-1 text-xs font-semibold">
        {(
          [
            ['next', 'Sắp mua'],
            ['debt', 'Nợ nhiều'],
            ['name', 'Tên A–Z'],
          ] as [Sort, string][]
        ).map(([k, l]) => (
          <button key={k} onClick={() => setSort(k)} className={`flex-1 cursor-pointer rounded-lg py-2 ${sort === k ? 'bg-white text-red-800 shadow-sm' : 'text-slate-600'}`}>
            {l}
          </button>
        ))}
      </div>
      <Card>
        {list.length === 0 ? (
          <Empty>{data.customers.length ? 'Không tìm thấy khách.' : 'Chưa có khách nào.'}</Empty>
        ) : (
          <div className="-my-1 divide-y divide-slate-100">
            {list.map((p) => {
              const d = debts.get(p.customer.id) ?? 0
              return (
                <button key={p.customer.id} onClick={() => openCustomer(p.customer.id)} className="flex w-full cursor-pointer items-center gap-3 py-2.5 text-left">
                  <Avatar name={p.customer.name} />
                  <div className="min-w-0 flex-1">
                    <div className={`truncate font-semibold ${p.customer.inactive ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{p.customer.name}</div>
                    <div className="truncate text-xs text-slate-500">
                      {p.lastDate ? `Mua ${p.orders} lần · cuối ${fmtDate(p.lastDate)}` : 'Chưa mua'}
                      {d > 0 && <span className="font-semibold text-red-700"> · nợ {money(d)}</span>}
                    </div>
                  </div>
                  <PredictBadge p={p} />
                </button>
              )
            })}
          </div>
        )}
      </Card>
      {inactiveCount > 0 && (
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="h-4 w-4 accent-red-700" /> Hiện cả {inactiveCount} khách đã ngừng theo dõi
        </label>
      )}
      {adding && <CustomerEdit onClose={() => setAdding(false)} />}
    </div>
  )
}

export function CustomerEdit({ customer, onClose }: { customer?: Customer; onClose: () => void }) {
  const { toast, data } = useApp()
  const [c, setC] = useState<Customer>(customer ?? { id: newId(), name: '', createdAt: Date.now() })
  const save = async () => {
    if (!c.name.trim()) return
    const dup = data.customers.find((x) => x.id !== c.id && fold(x.name) === fold(c.name.trim()))
    if (dup && !confirm(`Đã có khách tên "${dup.name}". Vẫn lưu?`)) return
    await store.put('customers', c.id, { ...c, name: c.name.trim(), phone: c.phone?.trim() || undefined, address: c.address?.trim() || undefined, note: c.note?.trim() || undefined })
    toast(customer ? 'Đã lưu' : 'Đã thêm khách ' + c.name)
    onClose()
  }
  return (
    <Modal title={customer ? 'Sửa thông tin khách' : 'Thêm khách'} onClose={onClose} zIndex="z-[60]">
      <div className="space-y-3">
        <Field label="Tên khách / quán">
          <input autoFocus value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Số điện thoại">
          <input value={c.phone ?? ''} inputMode="tel" onChange={(e) => setC({ ...c, phone: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Địa chỉ">
          <input value={c.address ?? ''} onChange={(e) => setC({ ...c, address: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Ghi chú">
          <input value={c.note ?? ''} onChange={(e) => setC({ ...c, note: e.target.value })} className={inputCls} placeholder="VD: thích cay nhiều, giao sáng" />
        </Field>
        {customer && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={!!c.inactive} onChange={(e) => setC({ ...c, inactive: e.target.checked || undefined })} className="h-4 w-4 accent-red-700" />
            Ngừng theo dõi (không lấy hàng nữa — vẫn giữ lịch sử)
          </label>
        )}
        <Btn onClick={save} disabled={!c.name.trim()} className="w-full py-3">
          Lưu
        </Btn>
      </div>
    </Modal>
  )
}

function ReceiptForm({ customer, debt, receipt, onClose }: { customer: Customer; debt: number; receipt?: Receipt; onClose: () => void }) {
  const { toast } = useApp()
  const [amount, setAmount] = useState(receipt?.amount ?? Math.max(0, debt))
  const [date, setDate] = useState(receipt?.date ?? today())
  const [note, setNote] = useState(receipt?.note ?? '')
  const save = async () => {
    if (!amount) return
    const r: Receipt = { id: receipt?.id ?? newId(), customerId: customer.id, date, amount, note: note.trim() || undefined, createdAt: receipt?.createdAt ?? Date.now() }
    await store.put('receipts', r.id, r)
    toast(`Đã ghi thu ${money(amount)}`)
    onClose()
  }
  const del = async () => {
    if (!receipt || !confirm(`Xoá khoản thu ${money(receipt.amount)} ngày ${fmtDate(receipt.date)}?`)) return
    await store.remove('receipts', receipt.id)
    toast('Đã xoá khoản thu')
    onClose()
  }
  return (
    <Modal title={`${receipt ? 'Sửa khoản thu' : 'Thu nợ'} · ${customer.name}`} onClose={onClose} zIndex="z-[60]">
      <div className="space-y-3">
        {!receipt && <p className="text-sm text-slate-600">Đang nợ: <b className="text-red-700">{money(Math.max(0, debt))}</b></p>}
        <Field label="Số tiền khách trả">
          <MoneyInput value={amount} onChange={setAmount} autoFocus />
        </Field>
        <Field label="Ngày">
          <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value || today())} className={inputCls} />
        </Field>
        <Field label="Ghi chú">
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder="VD: chuyển khoản MB" />
        </Field>
        <Btn onClick={save} disabled={!amount} className="w-full py-3">
          Lưu khoản thu
        </Btn>
        {receipt && (
          <Btn kind="danger" onClick={del} className="w-full">
            <Icon name="trash" className="h-4 w-4" /> Xoá khoản thu
          </Btn>
        )}
      </div>
    </Modal>
  )
}

/** Chi tiết một khách: số liệu, dự đoán, biểu đồ lượng mua, lịch sử đơn + thu nợ */
export function CustomerDetail({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const { data, debts, canEdit, openOrder, productById } = useApp()
  const [edit, setEdit] = useState(false)
  const [receipt, setReceipt] = useState<Receipt | 'new' | null>(null)
  const customer = data.customers.find((c) => c.id === customerId)
  const orders = useMemo(() => data.orders.filter((o) => o.customerId === customerId).sort(byDateAsc).reverse(), [data.orders, customerId])
  const receipts = useMemo(() => data.receipts.filter((r) => r.customerId === customerId).sort(byDateAsc).reverse(), [data.receipts, customerId])
  if (!customer) return null
  const now = today()
  const p = predict(customer, data.orders, now)
  const debt = debts.get(customer.id) ?? 0
  const totalMoney = orders.reduce((s, o) => s + orderTotal(o), 0)
  const totalQty = orders.reduce((s, o) => s + orderQty(o), 0)
  const months = lastMonths(monthOf(now), 12)
  const qtyByMonth = new Map(months.map((m) => [m, 0]))
  for (const o of orders) if (qtyByMonth.has(monthOf(o.date))) qtyByMonth.set(monthOf(o.date), qtyByMonth.get(monthOf(o.date))! + orderQty(o))
  const byProd = qtyByProduct(orders)

  // gộp lịch sử đơn + thu nợ theo thời gian
  const history = [...orders.map((o) => ({ kind: 'order' as const, date: o.date, createdAt: o.createdAt, o })), ...receipts.map((r) => ({ kind: 'receipt' as const, date: r.date, createdAt: r.createdAt, r }))]
    .sort(byDateAsc)
    .reverse()

  return (
    <Modal title={customer.name} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 text-sm text-slate-600">
          {customer.phone && (
            <a href={`tel:${customer.phone}`} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-800">
              <Icon name="phone" className="h-4 w-4" /> {customer.phone}
            </a>
          )}
          {customer.address && <span className="rounded-full bg-slate-100 px-3 py-1.5">{customer.address}</span>}
          {customer.note && <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-900">{customer.note}</span>}
        </div>

        {canEdit && (
          <div className="grid grid-cols-2 gap-2">
            <Btn onClick={() => openOrder({ customerId: customer.id })} className="py-3">
              <Icon name="plus" className="h-5 w-5" /> Lên đơn
            </Btn>
            <Btn kind="soft" onClick={() => setReceipt('new')} className="py-3">
              <Icon name="coins" className="h-5 w-5" /> Thu nợ
            </Btn>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Stat label="Đang nợ" value={money(Math.max(0, debt))} tone={debt > 0 ? 'red' : 'green'} sub={debt < 0 ? `Trả dư ${money(-debt)}` : undefined} />
          <Stat label="Tổng đã mua" value={money(totalMoney)} sub={`${num(totalQty)} chai · ${orders.length} đơn`} />
        </div>

        <div className="rounded-2xl bg-slate-50 p-3 text-sm">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-bold text-slate-900">Dự đoán lần mua tới</span>
            <PredictBadge p={p} />
          </div>
          {p.status === 'unknown' ? (
            <p className="text-slate-600">Cần ít nhất 2 lần mua để ước lượng nhịp mua của khách này.</p>
          ) : (
            <p className="text-slate-700">
              Thường {p.cycle} ngày lấy hàng một lần. Lần cuối {fmtDate(p.lastDate!)} → dự kiến khoảng <b>{fmtDate(p.nextDate!)}</b>. Mỗi lần trung bình{' '}
              {[...p.avgByProduct]
                .map(([pid, q]) => `${Math.round(q * 10) / 10} ${productById.get(pid)?.name ?? '?'}`)
                .join(', ')}
              .
            </p>
          )}
        </div>

        <div>
          <div className="mb-1 text-sm font-bold text-slate-900">Số chai mua 12 tháng</div>
          <BarChart data={months.map((m) => ({ label: fmtMonth(m).replace(/\/\d+$/, ''), value: qtyByMonth.get(m)! }))} format={num} unit="chai" height={150} />
          {byProd.size > 0 && (
            <div className="mt-1 text-xs text-slate-500">
              Tổng theo loại: {[...byProd].map(([pid, q]) => `${productById.get(pid)?.name ?? '?'} ${num(q)}`).join(' · ')}
            </div>
          )}
        </div>

        <div>
          <div className="mb-1 text-sm font-bold text-slate-900">Lịch sử</div>
          {history.length === 0 ? (
            <Empty>Chưa có giao dịch.</Empty>
          ) : (
            history.map((h) =>
              h.kind === 'order' ? (
                <OrderRow key={h.o.id} order={h.o} hideCustomer />
              ) : (
                <button key={h.r.id} onClick={() => canEdit && setReceipt(h.r)} className="flex w-full cursor-pointer items-center gap-3 border-b border-slate-100 py-2.5 text-left last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900">{fmtDate(h.r.date)}</div>
                    <div className="truncate text-xs text-slate-500">Thu nợ{h.r.note ? ' · ' + h.r.note : ''}</div>
                  </div>
                  <div className="font-bold text-emerald-700 tabular-nums">+ {money(h.r.amount)}</div>
                </button>
              ),
            )
          )}
        </div>

        {canEdit && (
          <Btn kind="ghost" onClick={() => setEdit(true)} className="w-full">
            <Icon name="edit" className="h-4 w-4" /> Sửa thông tin khách
          </Btn>
        )}
      </div>
      {edit && <CustomerEdit customer={customer} onClose={() => setEdit(false)} />}
      {receipt && <ReceiptForm customer={customer} debt={debt} receipt={receipt === 'new' ? undefined : receipt} onClose={() => setReceipt(null)} />}
    </Modal>
  )
}

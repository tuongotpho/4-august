import { useMemo, useState } from 'react'
import { Icon } from './icons'
import { debtBefore, invoiceNo, money, nextOrderNo, orderTotal, today } from './logic'
import { newId, store } from './store'
import type { Customer, Order, OrderItem } from './types'
import { Avatar, Btn, Field, Modal, MoneyInput, QtyStepper, fold, inputCls, useApp } from './ui'

/** Lên đơn mới / sửa đơn. Lưu xong gọi onSaved(id) để mở ảnh hoá đơn. */
export default function OrderForm({
  orderId,
  customerId: presetCustomer,
  onClose,
  onSaved,
}: {
  orderId?: string
  customerId?: string
  onClose: () => void
  onSaved: (id: string) => void
}) {
  const { data, customerById, stock, toast } = useApp()
  const editing = orderId ? data.orders.find((o) => o.id === orderId) : undefined
  const products = useMemo(() => [...data.products].filter((p) => !p.inactive || editing?.items.some((i) => i.productId === p.id)).sort((a, b) => a.order - b.order), [data.products, editing])

  const [customerId, setCustomerId] = useState(editing?.customerId ?? presetCustomer ?? '')
  const [date, setDate] = useState(editing?.date ?? today())
  const [lines, setLines] = useState<Record<string, { qty: number; price: number }>>(() => {
    const m: Record<string, { qty: number; price: number }> = {}
    for (const p of products) {
      const it = editing?.items.find((i) => i.productId === p.id)
      m[p.id] = { qty: it?.qty ?? 0, price: it?.price ?? p.price }
    }
    return m
  })
  const [discount, setDiscount] = useState(editing?.discount ?? 0)
  const [paid, setPaid] = useState(editing?.paid ?? 0)
  const [note, setNote] = useState(editing?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [newCust, setNewCust] = useState<string | null>(null)

  const items: OrderItem[] = products
    .filter((p) => lines[p.id]?.qty > 0)
    .map((p) => {
      const old = editing?.items.find((i) => i.productId === p.id)
      // giữ giá vốn cũ khi sửa đơn, đơn mới lấy giá vốn hiện tại
      return { productId: p.id, name: p.name, qty: lines[p.id].qty, price: lines[p.id].price, cost: old?.cost ?? p.cost }
    })
  const draft: Order = {
    id: editing?.id ?? '__draft',
    no: editing?.no ?? nextOrderNo(data.orders),
    customerId,
    date,
    items,
    discount,
    paid,
    note: note.trim() || undefined,
    createdAt: editing?.createdAt ?? Date.now(),
  }
  const total = orderTotal(draft)
  const oldDebt = customerId ? debtBefore(data, draft) : 0
  const after = oldDebt + total - paid

  const stockOf = (pid: string) => {
    const r = stock.find((s) => s.product.id === pid)
    const mine = editing?.items.find((i) => i.productId === pid)?.qty ?? 0
    return (r?.stock ?? 0) + mine // khi sửa đơn: số đã trừ của chính đơn này được cộng lại
  }

  const save = async () => {
    if (!customerId) return toast('Chọn khách hàng trước')
    if (!items.length) return toast('Chưa nhập số lượng chai nào')
    setSaving(true)
    try {
      const id = editing?.id ?? newId()
      await store.put('orders', id, { ...draft, id })
      toast(editing ? 'Đã sửa đơn' : `Đã lưu ${invoiceNo(draft.no)}`)
      onSaved(id)
    } catch (e) {
      console.error(e)
      toast('Lưu không được: ' + (e as Error).message)
      setSaving(false)
    }
  }

  const customer = customerById.get(customerId)

  return (
    <Modal title={editing ? `Sửa ${invoiceNo(editing.no)}` : `Đơn mới · ${invoiceNo(draft.no)}`} onClose={onClose}>
      <div className="space-y-4">
        {/* Khách */}
        {customer ? (
          <div className="flex items-center gap-3 rounded-2xl bg-red-50 p-3 ring-1 ring-red-100">
            <Avatar name={customer.name} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold text-slate-900">{customer.name}</div>
              <div className="text-xs text-slate-600">
                {oldDebt > 0 ? <span className="font-semibold text-red-700">Đang nợ {money(oldDebt)}</span> : oldDebt < 0 ? `Trả dư ${money(-oldDebt)}` : 'Không nợ'}
              </div>
            </div>
            {!editing && (
              <Btn kind="ghost" onClick={() => setCustomerId('')} className="text-xs">
                Đổi khách
              </Btn>
            )}
          </div>
        ) : newCust !== null ? (
          <NewCustomerInline
            initial={newCust}
            onCancel={() => setNewCust(null)}
            onCreated={(c) => {
              setCustomerId(c.id)
              setNewCust(null)
            }}
          />
        ) : (
          <CustomerPicker onPick={setCustomerId} onNew={(q) => setNewCust(q)} />
        )}

        {/* Hàng */}
        <div className="space-y-2">
          {products.length === 0 && <p className="text-sm text-slate-500">Chưa có loại hàng — vào tab Kho để thêm.</p>}
          {products.map((p) => {
            const l = lines[p.id] ?? { qty: 0, price: p.price }
            const st = stockOf(p.id)
            const over = l.qty > st
            return (
              <div key={p.id} className={`rounded-2xl border p-3 ${l.qty ? 'border-red-200 bg-red-50/40' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900">{p.name}</div>
                    <div className={`text-xs ${over ? 'font-semibold text-amber-700' : 'text-slate-500'}`}>
                      Tồn {st}
                      {over && ' — không đủ hàng!'}
                    </div>
                  </div>
                  <QtyStepper value={l.qty} onChange={(qty) => setLines({ ...lines, [p.id]: { ...l, qty } })} />
                </div>
                {l.qty > 0 && (
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <span className="shrink-0 text-slate-500">Giá</span>
                    <div className="w-36">
                      <MoneyInput value={l.price} onChange={(price) => setLines({ ...lines, [p.id]: { ...l, price } })} />
                    </div>
                    <span className="ml-auto font-bold tabular-nums">{money(l.qty * l.price)}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Ngày bán">
            <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value || today())} className={inputCls} />
          </Field>
          <Field label="Giảm giá">
            <MoneyInput value={discount} onChange={setDiscount} />
          </Field>
        </div>

        {/* Thanh toán */}
        <div className="space-y-2 rounded-2xl bg-slate-50 p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold text-slate-600">Tổng đơn</span>
            <span className="text-2xl font-extrabold tabular-nums text-slate-900">{money(total)}</span>
          </div>
          <Field label="Khách trả ngay">
            <MoneyInput value={paid} onChange={setPaid} />
          </Field>
          <div className="flex flex-wrap gap-1.5">
            <Chip onClick={() => setPaid(total)}>Trả đủ đơn</Chip>
            {oldDebt > 0 && <Chip onClick={() => setPaid(total + oldDebt)}>Trả hết cả nợ cũ</Chip>}
            <Chip onClick={() => setPaid(0)}>Chưa trả (ghi nợ)</Chip>
          </div>
          <div className="flex items-baseline justify-between border-t border-slate-200 pt-2 text-sm">
            <span className="text-slate-600">Sau đơn này khách {after > 0 ? 'còn nợ' : after < 0 ? 'trả dư' : 'hết nợ'}</span>
            <span className={`font-bold tabular-nums ${after > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{money(Math.abs(after))}</span>
          </div>
        </div>

        <Field label="Ghi chú (không bắt buộc)">
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder="VD: giao tận nơi, hẹn trả cuối tháng…" />
        </Field>

        <Btn onClick={save} disabled={saving || !customerId || !items.length} className="w-full py-3 text-base">
          <Icon name="receipt" className="h-5 w-5" /> {saving ? 'Đang lưu…' : editing ? 'Lưu & xem hoá đơn' : 'Lưu đơn & xuất hoá đơn'}
        </Btn>
      </div>
    </Modal>
  )
}

function Chip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="cursor-pointer rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 active:bg-slate-100">
      {children}
    </button>
  )
}

function CustomerPicker({ onPick, onNew }: { onPick: (id: string) => void; onNew: (q: string) => void }) {
  const { data, debts } = useApp()
  const [q, setQ] = useState('')
  const lastBuy = useMemo(() => {
    const m = new Map<string, string>()
    for (const o of data.orders) if ((m.get(o.customerId) ?? '') < o.date) m.set(o.customerId, o.date)
    return m
  }, [data.orders])
  const list = data.customers
    .filter((c) => !c.inactive && (!q || fold(c.name + ' ' + (c.phone ?? '')).includes(fold(q))))
    .sort((a, b) => (lastBuy.get(b.id) ?? '').localeCompare(lastBuy.get(a.id) ?? '') || a.name.localeCompare(b.name, 'vi'))
    .slice(0, 8)
  return (
    <div className="space-y-2">
      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm khách (tên, SĐT)…" className={`${inputCls} pl-9`} />
      </div>
      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
        {list.map((c) => {
          const d = debts.get(c.id) ?? 0
          return (
            <button key={c.id} onClick={() => onPick(c.id)} className="flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left active:bg-slate-50">
              <Avatar name={c.name} className="h-8 w-8 text-xs" />
              <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
              {d > 0 && <span className="text-xs font-semibold text-red-700">nợ {money(d)}</span>}
            </button>
          )
        })}
        <button onClick={() => onNew(q)} className="flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left font-semibold text-red-700 active:bg-red-50">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-red-100">
            <Icon name="plus" className="h-4 w-4" />
          </span>
          Thêm khách mới{q ? ` "${q}"` : ''}
        </button>
      </div>
    </div>
  )
}

function NewCustomerInline({ initial, onCancel, onCreated }: { initial: string; onCancel: () => void; onCreated: (c: Customer) => void }) {
  const { toast } = useApp()
  const [name, setName] = useState(initial)
  const [phone, setPhone] = useState('')
  const create = async () => {
    if (!name.trim()) return
    const c: Customer = { id: newId(), name: name.trim(), phone: phone.trim() || undefined, createdAt: Date.now() }
    await store.put('customers', c.id, c)
    toast('Đã thêm khách ' + c.name)
    onCreated(c)
  }
  return (
    <div className="space-y-2 rounded-2xl border border-red-200 p-3">
      <div className="text-sm font-bold">Khách mới</div>
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên khách / quán" className={inputCls} />
      <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Số điện thoại (không bắt buộc)" className={inputCls} />
      <div className="flex justify-end gap-2">
        <Btn kind="ghost" onClick={onCancel}>
          Huỷ
        </Btn>
        <Btn onClick={create} disabled={!name.trim()}>
          Thêm khách
        </Btn>
      </div>
    </div>
  )
}

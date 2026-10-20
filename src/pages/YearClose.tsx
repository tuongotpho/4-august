// Chốt sổ cuối năm (31/12): đối chiếu tồn sổ sách với số chai đếm thực trong kho.
//  - Sổ nhiều hơn thực  → số chai đó coi như đã bán lẻ không ghi đơn → tạo một đơn "Khách lẻ" đã trả đủ.
//  - Thực nhiều hơn sổ  → hàng có trong kho mà chưa ghi nhập → tạo một phiếu nhập bù, đã trả đủ.
// Sau khi chốt, tồn sổ sách ngày 31/12 khớp đúng kho thực; năm sau bắt đầu sạch.

import { useMemo, useState } from 'react'
import { Icon } from '../icons'
import { closingNote, costAt, fmtDate, fold, invoiceNo, latestCost, money, nextOrderNo, nextPurchaseNo, num, purchaseNo, stockAsOf, today } from '../logic'
import { newId, store } from '../store'
import type { Customer, Order, Purchase } from '../types'
import { Btn, Card, Modal, MoneyInput, inputCls, useApp } from '../ui'

const KHACH_LE = 'Khách lẻ'

export function YearCloseCard() {
  const { canEdit } = useApp()
  const [open, setOpen] = useState(false)
  if (!canEdit) return null
  return (
    <Card title="Chốt sổ cuối năm" subtitle="Ngày 31/12: đếm kho thực, app tự tạo đơn bán lẻ / phiếu nhập bù cho khớp sổ">
      <Btn kind="soft" onClick={() => setOpen(true)} className="w-full py-3">
        <Icon name="check" className="h-4 w-4" /> Chốt sổ theo kho thực
      </Btn>
      {open && <YearCloseForm onClose={() => setOpen(false)} />}
    </Card>
  )
}

export function YearCloseForm({ onClose }: { onClose: () => void }) {
  const { data, toast } = useApp()
  const now = today()
  // tháng 12 thì chốt năm nay, còn lại (đầu năm sau mới chốt) thì năm trước
  const [year, setYear] = useState(+now.slice(0, 4) - (now.slice(5, 7) === '12' ? 0 : 1))
  const date = `${year}-12-31`
  const book = useMemo(() => stockAsOf(data, date), [data, date])
  const products = data.products.filter((p) => !p.inactive || (book.get(p.id) ?? 0) !== 0).sort((a, b) => a.order - b.order)
  const [actual, setActual] = useState<Record<string, string>>({})
  const [price, setPrice] = useState<Record<string, number>>({})
  const [cost, setCost] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)

  const rows = products.map((p) => {
    const b = book.get(p.id) ?? 0
    const raw = actual[p.id]
    const a = raw === undefined || raw === '' ? b : Number(raw.replace(/\D/g, '')) || 0
    return { p, book: b, actual: a, diff: b - a, typed: raw !== undefined && raw !== '' }
  })
  const sell = rows.filter((r) => r.diff > 0).map((r) => ({ ...r, qty: r.diff, price: price[r.p.id] ?? r.p.price }))
  const buy = rows.filter((r) => r.diff < 0).map((r) => ({ ...r, qty: -r.diff, cost: cost[r.p.id] ?? latestCost(data, r.p.id) ?? r.p.cost }))
  const sellTotal = sell.reduce((s, r) => s + r.qty * r.price, 0)
  const buyTotal = buy.reduce((s, r) => s + r.qty * r.cost, 0)
  const tag = closingNote(year)
  const done = data.orders.some((o) => o.note?.startsWith(tag)) || data.purchases.some((p) => p.note?.startsWith(tag))
  const allTyped = rows.every((r) => r.typed)

  const save = async () => {
    if (!sell.length && !buy.length) return toast('Kho thực khớp sổ — không cần tạo gì')
    const lines = [
      sell.length && `• Đơn bán "${KHACH_LE}" ${invoiceNo(nextOrderNo(data.orders))}: ${sell.map((r) => `${r.qty} ${r.p.name}`).join(', ')} = ${money(sellTotal)} (đã trả đủ)`,
      buy.length && `• Phiếu nhập bù ${purchaseNo(nextPurchaseNo(data.purchases))}: ${buy.map((r) => `${r.qty} ${r.p.name}`).join(', ')} = ${money(buyTotal)} (đã trả đủ)`,
    ].filter(Boolean)
    if (!confirm(`Chốt sổ ngày ${fmtDate(date)}, sẽ tạo:\n${lines.join('\n')}\n\nSau đó tồn sổ sách khớp kho thực. Đồng ý?`)) return
    setSaving(true)
    try {
      const stamp = Date.now()
      if (sell.length) {
        let kh = data.customers.find((c) => fold(c.name) === fold(KHACH_LE))
        if (!kh) {
          kh = { id: newId(), name: KHACH_LE, note: 'Hàng bán lẻ không ghi đơn — dùng khi chốt sổ cuối năm', inactive: true, createdAt: stamp } satisfies Customer
          await store.put('customers', kh.id, kh)
        }
        const o: Order = {
          id: newId(),
          no: nextOrderNo(data.orders),
          customerId: kh.id,
          date,
          items: sell.map((r) => ({ productId: r.p.id, name: r.p.name, qty: r.qty, price: r.price, cost: costAt(data, r.p.id, date) ?? r.p.cost })),
          discount: 0,
          paid: sellTotal,
          note: `${tag}: hàng bán lẻ không ghi đơn (đối chiếu kho thực)`,
          createdAt: stamp,
        }
        await store.put('orders', o.id, o)
      }
      if (buy.length) {
        const pu: Purchase = {
          id: newId(),
          no: nextPurchaseNo(data.purchases),
          date,
          items: buy.map((r) => ({ productId: r.p.id, name: r.p.name, qty: r.qty, unitCost: r.cost })),
          paid: buyTotal,
          note: `${tag}: bù hàng có trong kho chưa ghi nhập`,
          createdAt: stamp + 1,
        }
        await store.put('purchases', pu.id, pu)
      }
      toast(`Đã chốt sổ năm ${year}`)
      onClose()
    } catch (e) {
      toast('Lưu không được: ' + (e as Error).message)
      setSaving(false)
    }
  }

  return (
    <Modal title={`Chốt sổ ngày ${fmtDate(date)}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-600">Năm</span>
          <select value={year} onChange={(e) => (setYear(+e.target.value), setActual({}))} className={`${inputCls} w-auto`}>
            {[0, 1, 2].map((k) => {
              const y = +now.slice(0, 4) - k
              return (
                <option key={y} value={y}>
                  {y}
                </option>
              )
            })}
          </select>
        </div>
        {done && (
          <p className="rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-950">
            Năm {year} đã chốt sổ một lần rồi (có đơn / phiếu ghi "{tag}"). Chốt lần nữa sẽ cộng thêm — chỉ làm nếu đã đếm lại kho.
          </p>
        )}
        <p className="text-sm text-slate-600">Nhập số chai đếm được trong kho thực tế. Ô để trống = coi như khớp sổ.</p>

        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.p.id} className={`rounded-2xl border p-3 ${r.diff ? 'border-amber-300 bg-amber-50/60' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-slate-900">{r.p.name}</div>
                  <div className="text-xs text-slate-500">Sổ sách: {num(r.book)} chai</div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-slate-600">Thực</span>
                  <input
                    inputMode="numeric"
                    value={actual[r.p.id] ?? ''}
                    placeholder={String(r.book)}
                    onChange={(e) => setActual({ ...actual, [r.p.id]: e.target.value.replace(/\D/g, '') })}
                    className={`${inputCls} w-24 text-right tabular-nums`}
                  />
                </label>
              </div>
              {r.diff !== 0 && (
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <span className={`shrink-0 font-semibold ${r.diff > 0 ? 'text-red-700' : 'text-teal-700'}`}>
                    {r.diff > 0 ? `Thiếu ${num(r.diff)} → bán lẻ, giá` : `Dư ${num(-r.diff)} → nhập bù, vốn`}
                  </span>
                  <div className="ml-auto w-32">
                    {r.diff > 0 ? (
                      <MoneyInput value={price[r.p.id] ?? r.p.price} onChange={(v) => setPrice({ ...price, [r.p.id]: v })} />
                    ) : (
                      <MoneyInput value={cost[r.p.id] ?? latestCost(data, r.p.id) ?? r.p.cost} onChange={(v) => setCost({ ...cost, [r.p.id]: v })} />
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-1 rounded-2xl bg-slate-50 p-3 text-sm">
          {!sell.length && !buy.length ? (
            <p className="text-emerald-700">Kho thực khớp sổ sách — không cần tạo gì.</p>
          ) : (
            <>
              {sell.length > 0 && (
                <div className="flex justify-between gap-2">
                  <span>Đơn bán "{KHACH_LE}" (đã trả đủ)</span>
                  <b className="tabular-nums">{money(sellTotal)}</b>
                </div>
              )}
              {buy.length > 0 && (
                <div className="flex justify-between gap-2">
                  <span>Phiếu nhập bù (đã trả đủ)</span>
                  <b className="tabular-nums">{money(buyTotal)}</b>
                </div>
              )}
            </>
          )}
          {!allTyped && <p className="pt-1 text-xs text-slate-500">Còn loại chưa nhập số đếm — đang coi là khớp sổ.</p>}
        </div>

        <Btn onClick={save} disabled={saving || (!sell.length && !buy.length)} className="w-full py-3 text-base">
          <Icon name="check" className="h-5 w-5" /> {saving ? 'Đang lưu…' : 'Chốt sổ'}
        </Btn>
      </div>
    </Modal>
  )
}

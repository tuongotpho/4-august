// Phiếu nhập hàng & người bán: mỗi lần lấy hàng của người bán là một phiếu PN…, ghi đã trả bao nhiêu;
// ảnh phiếu có mã QR vào tài khoản người bán để mình quét trả tiền.

import { useState } from 'react'
import { Icon } from '../icons'
import { PurchaseModal } from '../InvoiceModal'
import { debtBySupplier, latestCost, money, nextPurchaseNo, purchaseDue, purchaseNo, purchaseTotal, today } from '../logic'
import { newId, store } from '../store'
import { DEFAULT_SUPPLIER, type Purchase, type PurchaseItem, type Supplier } from '../types'
import { Btn, Card, Field, Modal, MoneyInput, QtyStepper, inputCls, useApp } from '../ui'

/** Ghi phiếu rồi cập nhật giá vốn các loại hàng theo lần nhập mới nhất */
async function luuPhieu(pu: Purchase, data: ReturnType<typeof useApp>['data']) {
  await store.put('purchases', pu.id, pu)
  const sau = { ...data, purchases: [...data.purchases.filter((x) => x.id !== pu.id), pu] }
  for (const i of pu.items) {
    const p = data.products.find((x) => x.id === i.productId)
    const c = latestCost(sau, i.productId)
    if (p && c !== undefined && c !== p.cost) await store.put('products', p.id, { ...p, cost: c })
  }
}

/** Tạo / sửa phiếu nhập. Lưu xong gọi onSaved(id) để mở ảnh phiếu. */
export function PurchaseForm({ purchase, onClose, onSaved }: { purchase?: Purchase; onClose: () => void; onSaved: (id: string) => void }) {
  const { data, toast } = useApp()
  const products = data.products.filter((p) => !p.inactive || purchase?.items.some((i) => i.productId === p.id)).sort((a, b) => a.order - b.order)
  const [supplierId, setSupplierId] = useState(purchase?.supplierId ?? (data.suppliers.length === 1 ? data.suppliers[0].id : ''))
  const [rows, setRows] = useState<Record<string, { qty: number; cost: number }>>(() =>
    Object.fromEntries(
      products.map((p) => {
        const it = purchase?.items.find((i) => i.productId === p.id)
        return [p.id, { qty: it?.qty ?? 0, cost: it?.unitCost ?? latestCost(data, p.id) ?? p.cost }]
      }),
    ),
  )
  const [date, setDate] = useState(purchase?.date ?? today())
  const [paid, setPaid] = useState(purchase?.paid ?? 0)
  const [note, setNote] = useState(purchase?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [editSup, setEditSup] = useState<Supplier | 'new' | null>(null)

  const items: PurchaseItem[] = products.filter((p) => rows[p.id]?.qty > 0).map((p) => ({ productId: p.id, name: p.name, qty: rows[p.id].qty, unitCost: rows[p.id].cost }))
  const draft: Purchase = {
    id: purchase?.id ?? newId(),
    no: purchase?.no ?? nextPurchaseNo(data.purchases),
    supplierId: supplierId || undefined,
    date,
    items,
    paid,
    note: note.trim() || undefined,
    createdAt: purchase?.createdAt ?? Date.now(),
  }
  const total = purchaseTotal(draft)

  const taoNguoiBanMacDinh = async () => {
    const s: Supplier = { id: newId(), ...DEFAULT_SUPPLIER, createdAt: Date.now() }
    await store.put('suppliers', s.id, s)
    setSupplierId(s.id)
  }

  const save = async () => {
    if (!items.length) return toast('Chưa nhập số lượng chai nào')
    setSaving(true)
    try {
      await luuPhieu(draft, data)
      toast(`${purchase ? 'Đã sửa' : 'Đã lưu'} ${purchaseNo(draft.no)}`)
      onSaved(draft.id)
    } catch (e) {
      toast('Lưu không được: ' + (e as Error).message)
      setSaving(false)
    }
  }

  return (
    <Modal title={purchase ? `Sửa ${purchaseNo(purchase.no)}` : `Phiếu nhập mới · ${purchaseNo(draft.no)}`} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Người bán (để có mã QR chuyển khoản)">
          {data.suppliers.length === 0 ? (
            <Btn kind="soft" onClick={taoNguoiBanMacDinh} className="w-full py-3">
              <Icon name="plus" className="h-4 w-4" /> {DEFAULT_SUPPLIER.name} · {DEFAULT_SUPPLIER.bankName} {DEFAULT_SUPPLIER.bankAccount}
            </Btn>
          ) : (
            <div className="flex gap-2">
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputCls}>
                <option value="">— Không ghi người bán —</option>
                {data.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.bankName} {s.bankAccount}
                  </option>
                ))}
              </select>
              <Btn kind="ghost" onClick={() => setEditSup('new')} aria-label="Thêm người bán">
                <Icon name="plus" className="h-5 w-5" />
              </Btn>
            </div>
          )}
        </Field>

        <div className="space-y-2">
          {products.length === 0 && <p className="text-sm text-slate-500">Chưa có loại hàng — tạo ở tab Kho trước.</p>}
          {products.map((p) => {
            const r = rows[p.id]
            return (
              <div key={p.id} className={`rounded-2xl border p-3 ${r.qty ? 'border-teal-200 bg-teal-50/40' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">{p.name}</span>
                  <QtyStepper value={r.qty} onChange={(qty) => setRows({ ...rows, [p.id]: { ...r, qty } })} />
                </div>
                {r.qty > 0 && (
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <span className="shrink-0 text-slate-500">Giá nhập</span>
                    <div className="w-36">
                      <MoneyInput value={r.cost} onChange={(cost) => setRows({ ...rows, [p.id]: { ...r, cost } })} />
                    </div>
                    <span className="ml-auto font-semibold tabular-nums">{money(r.qty * r.cost)}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="space-y-2 rounded-2xl bg-slate-50 p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold text-slate-600">Tổng phiếu</span>
            <span className="text-2xl font-extrabold tabular-nums">{money(total)}</span>
          </div>
          <Field label="Mình đã trả người bán">
            <MoneyInput value={paid} onChange={setPaid} />
          </Field>
          <div className="flex flex-wrap gap-1.5">
            {[
              ['Trả đủ', total],
              ['Chưa trả', 0],
            ].map(([l, v]) => (
              <button key={l} type="button" onClick={() => setPaid(v as number)} className="cursor-pointer rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                {l}
              </button>
            ))}
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2 text-sm">
            <span className="text-slate-600">Còn phải trả (phiếu này)</span>
            <b className={total - paid > 0 ? 'text-teal-700' : 'text-emerald-700'}>{money(Math.max(0, total - paid))}</b>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Ngày nhập">
            <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value || today())} className={inputCls} />
          </Field>
          <Field label="Ghi chú">
            <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder="VD: mẻ ớt chỉ thiên" />
          </Field>
        </div>
        <p className="text-xs text-slate-500">Giá nhập mỗi chai là giá vốn để tính lãi; phiếu mới nhất tự cập nhật giá vốn của loại hàng.</p>

        <Btn onClick={save} disabled={saving || !items.length} className="w-full py-3 text-base">
          <Icon name="receipt" className="h-5 w-5" /> {saving ? 'Đang lưu…' : 'Lưu & xem phiếu (có QR trả tiền)'}
        </Btn>
      </div>
      {editSup && (
        <SupplierForm
          supplier={editSup === 'new' ? undefined : editSup}
          onClose={() => setEditSup(null)}
          onSaved={(id) => {
            setSupplierId(id)
            setEditSup(null)
          }}
        />
      )}
    </Modal>
  )
}

export function SupplierForm({ supplier, onClose, onSaved }: { supplier?: Supplier; onClose: () => void; onSaved?: (id: string) => void }) {
  const { toast } = useApp()
  const [s, setS] = useState<Supplier>(supplier ?? { id: newId(), name: '', bankBin: '970422', bankName: 'MB Bank', bankAccount: '', accountName: '', createdAt: Date.now() })
  const set = (k: keyof Supplier) => (e: React.ChangeEvent<HTMLInputElement>) => setS({ ...s, [k]: e.target.value })
  const save = async () => {
    if (!s.name.trim()) return
    const v: Supplier = { ...s, name: s.name.trim(), phone: s.phone?.trim() || undefined, bankAccount: s.bankAccount.replace(/\s/g, ''), accountName: s.accountName.trim().toUpperCase() }
    await store.put('suppliers', v.id, v)
    toast('Đã lưu người bán ' + v.name)
    onSaved ? onSaved(v.id) : onClose()
  }
  return (
    <Modal title={supplier ? 'Sửa người bán' : 'Thêm người bán'} onClose={onClose} zIndex="z-[60]">
      <div className="space-y-3">
        <Field label="Tên người bán">
          <input autoFocus value={s.name} onChange={set('name')} className={inputCls} />
        </Field>
        <Field label="Số điện thoại">
          <input value={s.phone ?? ''} inputMode="tel" onChange={set('phone')} className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ngân hàng">
            <input value={s.bankName} onChange={set('bankName')} className={inputCls} />
          </Field>
          <Field label="Mã ngân hàng" hint="MB = 970422">
            <input value={s.bankBin} inputMode="numeric" onChange={set('bankBin')} className={inputCls} />
          </Field>
        </div>
        <Field label="Số tài khoản">
          <input value={s.bankAccount} inputMode="numeric" onChange={set('bankAccount')} className={inputCls} />
        </Field>
        <Field label="Chủ tài khoản" hint="Không dấu, đúng như app ngân hàng hiện">
          <input value={s.accountName} onChange={set('accountName')} className={`${inputCls} uppercase`} />
        </Field>
        <Btn onClick={save} disabled={!s.name.trim()} className="w-full py-3">
          Lưu
        </Btn>
      </div>
    </Modal>
  )
}

/** Thao tác trên một phiếu: xem ảnh + QR, đánh dấu đã trả đủ, sửa, xoá */
export function PurchaseActions({ purchase: pu, onClose, onEdit, onImage }: { purchase: Purchase; onClose: () => void; onEdit: () => void; onImage: () => void }) {
  const { data, toast, canEdit } = useApp()
  const nb = data.suppliers.find((s) => s.id === pu.supplierId)
  const due = purchaseDue(pu)
  const del = async () => {
    if (!confirm(`Xoá ${purchaseNo(pu.no)}? Tồn kho và nợ người bán sẽ tự tính lại.`)) return
    await store.remove('purchases', pu.id)
    toast('Đã xoá phiếu')
    onClose()
  }
  return (
    <Modal title={`${purchaseNo(pu.no)}${nb ? ' · ' + nb.name : ''}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded-2xl bg-slate-50 p-3 text-sm">
          {pu.items.map((i) => (
            <div key={i.productId} className="flex justify-between py-0.5">
              <span>
                {i.name} × {i.qty} @ {money(i.unitCost)}
              </span>
              <span className="tabular-nums">{money(i.qty * i.unitCost)}</span>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 font-bold">
            <span>Tổng · đã trả {money(pu.paid)}</span>
            <span>{money(purchaseTotal(pu))}</span>
          </div>
          {due > 0 && <div className="mt-1 text-right text-xs font-semibold text-teal-700">Còn phải trả {money(due)}</div>}
        </div>
        <Btn onClick={onImage} className="w-full py-3">
          <Icon name="image" className="h-5 w-5" /> Xem phiếu · QR trả tiền người bán
        </Btn>
        {canEdit && (
          <div className="grid grid-cols-2 gap-2">
            {due > 0 && (
              <Btn
                kind="soft"
                className="col-span-2"
                onClick={async () => {
                  await store.put('purchases', pu.id, { ...pu, paid: purchaseTotal(pu) })
                  toast('Đã ghi: trả đủ ' + purchaseNo(pu.no))
                  onClose()
                }}
              >
                <Icon name="check" className="h-4 w-4" /> Đã chuyển khoản đủ
              </Btn>
            )}
            <Btn kind="soft" onClick={onEdit}>
              <Icon name="edit" className="h-4 w-4" /> Sửa phiếu
            </Btn>
            <Btn kind="danger" onClick={del}>
              <Icon name="trash" className="h-4 w-4" /> Xoá phiếu
            </Btn>
          </div>
        )}
      </div>
    </Modal>
  )
}

/** Thẻ "Người bán": số tài khoản, mình còn nợ bao nhiêu */
export function SupplierCard() {
  const { data, canEdit } = useApp()
  const [edit, setEdit] = useState<Supplier | 'new' | null>(null)
  const no = debtBySupplier(data.purchases)
  return (
    <Card
      title="Người bán (nơi lấy hàng)"
      right={
        canEdit && (
          <Btn kind="ghost" className="text-xs" onClick={() => setEdit('new')}>
            <Icon name="plus" className="h-4 w-4" /> Thêm
          </Btn>
        )
      }
    >
      {data.suppliers.length === 0 ? (
        <p className="py-2 text-sm text-slate-500">Chưa có. Lần nhập hàng đầu tiên bấm một chạm là thêm {DEFAULT_SUPPLIER.name} ({DEFAULT_SUPPLIER.bankName} {DEFAULT_SUPPLIER.bankAccount}).</p>
      ) : (
        data.suppliers.map((s) => {
          const d = no.get(s.id) ?? 0
          return (
            <button key={s.id} onClick={() => canEdit && setEdit(s)} className="flex w-full cursor-pointer items-center gap-3 border-b border-slate-100 py-2.5 text-left last:border-0">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-900">{s.name}</div>
                <div className="truncate text-xs text-slate-500">
                  {s.bankName} {s.bankAccount} · {s.accountName}
                </div>
              </div>
              <div className={`text-right text-sm font-bold tabular-nums ${d > 0 ? 'text-teal-700' : 'text-emerald-700'}`}>
                {d > 0 ? `nợ ${money(d)}` : 'hết nợ'}
              </div>
            </button>
          )
        })
      )}
      {edit && <SupplierForm supplier={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </Card>
  )
}

export { PurchaseModal }

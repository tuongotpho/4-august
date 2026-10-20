import { useState } from 'react'
import { Icon } from '../icons'
import { byDateAsc, fmtDate, latestCost, money, num, purchaseDue, purchaseNo, purchaseQty, purchaseTotal, today } from '../logic'
import { newId, store } from '../store'
import { DEFAULT_PRODUCTS, type Product, type Purchase, type StockIn } from '../types'
import { PurchaseActions, PurchaseForm, PurchaseModal, SupplierCard } from './Purchases'
import { YearCloseCard, YearCloseForm } from './YearClose'
import { CostFixCard } from './CostFix'
import { Btn, Card, Empty, Field, Modal, MoneyInput, QtyStepper, inputCls, useApp } from '../ui'

export default function Stock() {
  const { data, stock, canEdit, productById } = useApp()
  const [importing, setImporting] = useState<StockIn | null>(null)
  const [phieu, setPhieu] = useState<Purchase | 'new' | null>(null)
  const [thaoTac, setThaoTac] = useState<Purchase | null>(null)
  const [anh, setAnh] = useState<string | null>(null)
  const [editProd, setEditProd] = useState<Product | 'new' | null>(null)
  const [chotSo, setChotSo] = useState(false)
  const am = stock.filter((r) => r.stock < 0)
  // Lịch sử: phiếu nhập + các lần nhập lẻ kiểu cũ, mới nhất trước
  const lichSu = [
    ...data.purchases.map((p) => ({ k: 'pn' as const, date: p.date, createdAt: p.createdAt, p })),
    ...data.stockIns.map((x) => ({ k: 'le' as const, date: x.date, createdAt: x.createdAt, x })),
  ]
    .sort(byDateAsc)
    .reverse()
  const tenNb = (id?: string) => data.suppliers.find((s) => s.id === id)?.name
  const value = stock.reduce((s, r) => s + Math.max(0, r.stock) * r.product.cost, 0)

  return (
    <div className="space-y-4">
      {canEdit && (
        <Btn onClick={() => setPhieu('new')} className="w-full py-3.5 text-base">
          <Icon name="box" className="h-5 w-5" /> Nhập hàng
        </Btn>
      )}

      {canEdit && data.products.length === 0 && (
        <Card title="Bắt đầu: tạo các loại chai">
          <p className="mb-3 text-sm text-slate-600">Tạo sẵn 3 loại: chai 1 lít, 500ml, 330ml. Sau đó bấm vào từng loại để đặt giá bán.</p>
          <Btn
            onClick={async () => {
              for (const [i, p] of DEFAULT_PRODUCTS.entries()) await store.put('products', ['p1000', 'p500', 'p330'][i], p)
            }}
            className="w-full"
          >
            Tạo 3 loại chai
          </Btn>
        </Card>
      )}

      {am.length > 0 && (
        <div className="rounded-2xl bg-red-50 p-3 text-sm text-red-900 ring-1 ring-red-300">
          <div className="font-bold">Tồn kho bị âm — sổ ghi bán nhiều hơn nhập</div>
          <div className="mt-0.5">{am.map((r) => `${r.product.name}: âm ${num(-r.stock)} chai`).join(' · ')}</div>
          <p className="mt-1 text-xs text-red-800">Thường do thiếu phiếu nhập (hoặc hàng tồn từ trước chưa ghi). Ghi phiếu nhập còn thiếu, hoặc đếm kho thực rồi chốt sổ.</p>
          {canEdit && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Btn kind="soft" onClick={() => setPhieu('new')}>
                <Icon name="box" className="h-4 w-4" /> Ghi phiếu nhập
              </Btn>
              <Btn kind="soft" onClick={() => setChotSo(true)}>
                <Icon name="check" className="h-4 w-4" /> Chốt sổ
              </Btn>
            </div>
          )}
        </div>
      )}

      <Card title="Tồn kho" subtitle={`Tồn = đã nhập − đã bán · vốn đang nằm trong kho ≈ ${money(value)}`}>
        <div className="grid gap-2 sm:grid-cols-3">
          {stock
            .filter((r) => !r.product.inactive)
            .map((r) => (
              <button
                key={r.product.id}
                onClick={() => canEdit && setEditProd(r.product)}
                className={`cursor-pointer rounded-2xl p-3 text-left ring-1 ${r.stock <= 0 ? 'bg-red-50 ring-red-200' : r.low ? 'bg-amber-50 ring-amber-200' : 'bg-slate-50 ring-slate-200'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{r.product.name}</span>
                  <Icon name="edit" className="h-4 w-4 text-slate-400" />
                </div>
                <div className={`mt-1 text-3xl font-extrabold tabular-nums ${r.stock <= 0 ? 'text-red-700' : r.low ? 'text-amber-700' : 'text-slate-900'}`}>
                  {num(r.stock)}
                  <span className="ml-1 text-sm font-medium text-slate-500">chai</span>
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  Bán {r.product.price ? money(r.product.price) : <b className="text-red-700">chưa đặt giá</b>} · vốn {money(r.product.cost)}
                </div>
                <div className="text-xs text-slate-500">
                  Đã nhập {num(r.inQty)} · đã bán {num(r.soldQty)}
                </div>
              </button>
            ))}
        </div>
        {canEdit && (
          <Btn kind="ghost" className="mt-3 w-full text-xs" onClick={() => setEditProd('new')}>
            <Icon name="plus" className="h-4 w-4" /> Thêm loại hàng khác
          </Btn>
        )}
      </Card>

      <SupplierCard />

      <YearCloseCard />

      <CostFixCard />

      <Card title="Lịch sử nhập hàng" subtitle="Bấm phiếu để xem ảnh có mã QR trả tiền người bán">
        {lichSu.length === 0 ? (
          <Empty>Chưa nhập lần nào. Bấm "Nhập hàng" để ghi số chai có trong kho.</Empty>
        ) : (
          lichSu.map((h) =>
            h.k === 'pn' ? (
              <button
                key={h.p.id}
                onClick={() => setThaoTac(h.p)}
                className={`flex w-full cursor-pointer items-center gap-3 text-left ${
                  purchaseDue(h.p) > 0 ? 'my-1 rounded-xl border-l-4 border-teal-600 bg-teal-50 py-2 pr-2 pl-2.5' : 'border-b border-slate-100 py-2.5 last:border-0'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-slate-900">
                    {purchaseNo(h.p.no)} · {tenNb(h.p.supplierId) ?? 'không ghi người bán'}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {fmtDate(h.p.date)} · {purchaseQty(h.p)} chai · {h.p.items.map((i) => `${i.qty} ${i.name.replace(/^Chai\s*/i, '')}`).join(', ')}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-bold tabular-nums text-slate-700">{money(purchaseTotal(h.p))}</div>
                  {purchaseDue(h.p) > 0 ? (
                    <div className="mt-0.5 inline-block rounded-full bg-teal-700 px-2 py-0.5 text-[11px] font-bold text-white">nợ {money(purchaseDue(h.p))}</div>
                  ) : <div className="text-[11px] text-emerald-700">đã trả</div>}
                </div>
              </button>
            ) : (
              <button key={h.x.id} onClick={() => canEdit && setImporting(h.x)} className="flex w-full cursor-pointer items-center gap-3 border-b border-slate-100 py-2.5 text-left last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900">
                    {productById.get(h.x.productId)?.name ?? '(đã xoá)'} · +{num(h.x.qty)}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {fmtDate(h.x.date)} · vốn {money(h.x.unitCost)}/chai{h.x.note ? ' · ' + h.x.note : ''}
                  </div>
                </div>
                <div className="font-bold tabular-nums text-slate-700">{money(h.x.qty * h.x.unitCost)}</div>
              </button>
            ),
          )
        )}
      </Card>

      {phieu && (
        <PurchaseForm
          purchase={phieu === 'new' ? undefined : phieu}
          onClose={() => setPhieu(null)}
          onSaved={(id) => {
            setPhieu(null)
            setAnh(id)
          }}
        />
      )}
      {thaoTac && (
        <PurchaseActions
          purchase={thaoTac}
          onClose={() => setThaoTac(null)}
          onEdit={() => (setPhieu(thaoTac), setThaoTac(null))}
          onImage={() => (setAnh(thaoTac.id), setThaoTac(null))}
        />
      )}
      {anh && <PurchaseModal purchaseId={anh} onClose={() => setAnh(null)} />}
      {chotSo && <YearCloseForm onClose={() => setChotSo(false)} />}
      {importing && <StockInForm entry={importing} onClose={() => setImporting(null)} />}
      {editProd && <ProductForm product={editProd === 'new' ? undefined : editProd} onClose={() => setEditProd(null)} />}
    </div>
  )
}

/** Sửa / xoá một lần nhập lẻ kiểu cũ (trước khi có phiếu nhập). Nhập mới dùng PurchaseForm. Nhập hàng: chọn loại chai, số lượng, giá vốn mỗi chai. Giá vốn mới cập nhật vào loại hàng để tính lãi các đơn sau. */
function StockInForm({ entry, onClose }: { entry?: StockIn; onClose: () => void }) {
  const { data, toast } = useApp()
  const products = data.products.filter((p) => !p.inactive || p.id === entry?.productId).sort((a, b) => a.order - b.order)
  const [rows, setRows] = useState<Record<string, { qty: number; cost: number }>>(() =>
    Object.fromEntries(products.map((p) => [p.id, { qty: entry?.productId === p.id ? entry.qty : 0, cost: entry?.productId === p.id ? entry.unitCost : p.cost }])),
  )
  const [date, setDate] = useState(entry?.date ?? today())
  const [note, setNote] = useState(entry?.note ?? '')
  const shown = entry ? products.filter((p) => p.id === entry.productId) : products
  const filled = shown.filter((p) => rows[p.id]?.qty > 0)

  const save = async () => {
    if (!filled.length) return
    for (const p of filled) {
      const r = rows[p.id]
      const s: StockIn = { id: entry?.id ?? newId(), productId: p.id, date, qty: r.qty, unitCost: r.cost, note: note.trim() || undefined, createdAt: entry?.createdAt ?? Date.now() }
      await store.put('stockIns', s.id, s)
      // lần nhập mới nhất quyết định giá vốn hiện tại
      const c = latestCost({ ...data, stockIns: [...data.stockIns.filter((x) => x.id !== s.id), s] }, p.id)
      if (c !== undefined && c !== p.cost) await store.put('products', p.id, { ...p, cost: c })
    }
    toast(entry ? 'Đã sửa lần nhập' : `Đã nhập ${filled.map((p) => `${rows[p.id].qty} ${p.name}`).join(', ')}`)
    onClose()
  }
  const del = async () => {
    if (!entry || !confirm('Xoá lần nhập này? Tồn kho sẽ giảm tương ứng.')) return
    await store.remove('stockIns', entry.id)
    toast('Đã xoá lần nhập')
    onClose()
  }

  return (
    <Modal title={entry ? 'Sửa lần nhập' : 'Nhập hàng'} onClose={onClose}>
      <div className="space-y-3">
        {shown.map((p) => {
          const r = rows[p.id]
          return (
            <div key={p.id} className={`rounded-2xl border p-3 ${r.qty ? 'border-red-200 bg-red-50/40' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold">{p.name}</span>
                <QtyStepper value={r.qty} step={1} onChange={(qty) => setRows({ ...rows, [p.id]: { ...r, qty } })} />
              </div>
              {r.qty > 0 && (
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <span className="shrink-0 text-slate-500">Vốn/chai</span>
                  <div className="w-36">
                    <MoneyInput value={r.cost} onChange={(cost) => setRows({ ...rows, [p.id]: { ...r, cost } })} />
                  </div>
                  <span className="ml-auto font-semibold tabular-nums">{money(r.qty * r.cost)}</span>
                </div>
              )}
            </div>
          )
        })}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ngày nhập">
            <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value || today())} className={inputCls} />
          </Field>
          <Field label="Ghi chú">
            <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder="VD: mẻ ớt chỉ thiên" />
          </Field>
        </div>
        <p className="text-xs text-slate-500">Giá vốn/chai gồm ớt, tỏi, chai, nhãn… Dùng để tính lãi. Không rõ thì để 0, sửa sau được.</p>
        <Btn onClick={save} disabled={!filled.length} className="w-full py-3">
          Lưu
        </Btn>
        {entry && (
          <Btn kind="danger" onClick={del} className="w-full">
            <Icon name="trash" className="h-4 w-4" /> Xoá lần nhập
          </Btn>
        )}
      </div>
    </Modal>
  )
}

function ProductForm({ product, onClose }: { product?: Product; onClose: () => void }) {
  const { data, toast } = useApp()
  const [p, setP] = useState<Product>(product ?? { id: newId(), name: '', price: 0, cost: 0, lowStock: 20, order: data.products.length + 1 })
  const used = !!product && (data.orders.some((o) => o.items.some((i) => i.productId === product.id)) || data.stockIns.some((s) => s.productId === product.id))
  const save = async () => {
    if (!p.name.trim()) return
    await store.put('products', p.id, { ...p, name: p.name.trim() })
    toast('Đã lưu ' + p.name)
    onClose()
  }
  const del = async () => {
    if (!product || !confirm(`Xoá loại hàng "${product.name}"?`)) return
    await store.remove('products', product.id)
    onClose()
  }
  return (
    <Modal title={product ? product.name : 'Thêm loại hàng'} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Tên loại hàng">
          <input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} className={inputCls} placeholder="VD: Chai 1 lít" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Giá bán buôn / chai">
            <MoneyInput value={p.price} onChange={(price) => setP({ ...p, price })} />
          </Field>
          <Field label="Giá vốn / chai">
            <MoneyInput value={p.cost} onChange={(cost) => setP({ ...p, cost })} />
          </Field>
        </div>
        <Field label="Báo sắp hết khi tồn còn ≤" hint="Đặt 0 nếu không cần báo">
          <input inputMode="numeric" value={p.lowStock} onChange={(e) => setP({ ...p, lowStock: Number(e.target.value.replace(/\D/g, '')) || 0 })} className={inputCls} />
        </Field>
        <p className="text-xs text-slate-500">Đổi giá chỉ áp dụng cho đơn mới — đơn cũ giữ nguyên giá lúc bán.</p>
        {product && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={!!p.inactive} onChange={(e) => setP({ ...p, inactive: e.target.checked || undefined })} className="h-4 w-4 accent-red-700" />
            Ngừng bán loại này (ẩn khỏi form lên đơn)
          </label>
        )}
        <Btn onClick={save} disabled={!p.name.trim()} className="w-full py-3">
          Lưu
        </Btn>
        {product && !used && (
          <Btn kind="danger" onClick={del} className="w-full">
            <Icon name="trash" className="h-4 w-4" /> Xoá loại hàng
          </Btn>
        )}
      </div>
    </Modal>
  )
}

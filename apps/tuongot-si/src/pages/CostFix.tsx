// Tính lại giá vốn các đơn cũ theo giá nhập TẠI NGÀY BÁN.
// Đơn ghi lùi ngày (nhập bù sổ) trước đây lấy giá vốn lúc gõ đơn → lãi sai; thẻ này chỉ hiện khi có đơn lệch.

import { useMemo, useState } from 'react'
import { Icon } from '../icons'
import { costFixes, fmtDate, invoiceNo, money } from '../logic'
import { store } from '../store'
import { Btn, Card, Modal, custName, useApp } from '../ui'

export function CostFixCard() {
  const ctx = useApp()
  const { data, canEdit, toast } = ctx
  const fixes = useMemo(() => costFixes(data), [data])
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  if (!canEdit || !fixes.length) return null
  const before = fixes.reduce((s, f) => s + f.before, 0)
  const after = fixes.reduce((s, f) => s + f.after, 0)

  const run = async () => {
    setSaving(true)
    try {
      for (const f of fixes) await store.put('orders', f.fixed.id, f.fixed)
      toast(`Đã tính lại giá vốn ${fixes.length} đơn`)
      setOpen(false)
    } catch (e) {
      toast('Lưu không được: ' + (e as Error).message)
    }
    setSaving(false)
  }

  return (
    <Card title="Giá vốn đơn cũ bị lệch" subtitle={`${fixes.length} đơn đang tính lãi theo giá vốn khác giá nhập tại ngày bán`}>
      <p className="text-sm text-slate-600">
        Lãi các đơn này: <b>{money(before)}</b> → tính lại thành <b className="text-emerald-700">{money(after)}</b>
      </p>
      <Btn kind="soft" onClick={() => setOpen(true)} className="mt-2 w-full">
        <Icon name="edit" className="h-4 w-4" /> Xem & tính lại
      </Btn>
      {open && (
        <Modal title="Tính lại giá vốn theo ngày bán" onClose={() => setOpen(false)}>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Mỗi đơn lấy giá nhập của phiếu nhập gần nhất trước ngày bán. Giá bán, số tiền khách trả, công nợ không đổi — chỉ đổi số lãi.</p>
            <div className="max-h-[50vh] divide-y divide-slate-100 overflow-y-auto rounded-2xl border border-slate-200 text-sm">
              {fixes.map((f) => (
                <div key={f.order.id} className="px-3 py-2">
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold">
                      {invoiceNo(f.order.no)} · {fmtDate(f.order.date)}
                    </span>
                    <span className="tabular-nums">
                      {money(f.before)} → <b className={f.after >= f.before ? 'text-emerald-700' : 'text-red-700'}>{money(f.after)}</b>
                    </span>
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {custName(ctx, f.order.customerId)} ·{' '}
                    {f.fixed.items
                      .map((it, k) => (it.cost !== f.order.items[k].cost ? `${it.name.replace(/^Chai\s*/i, '')} vốn ${money(f.order.items[k].cost)}→${money(it.cost)}` : ''))
                      .filter(Boolean)
                      .join(', ')}
                  </div>
                </div>
              ))}
            </div>
            <Btn onClick={run} disabled={saving} className="w-full py-3">
              <Icon name="check" className="h-5 w-5" /> {saving ? 'Đang lưu…' : `Tính lại ${fixes.length} đơn`}
            </Btn>
          </div>
        </Modal>
      )}
    </Card>
  )
}

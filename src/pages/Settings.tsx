import { useRef, useState } from 'react'
import { Icon } from '../icons'
import McpPanel from '../McpPanel'
import { isDemo } from '../store'
import { today } from '../logic'
import { store } from '../store'
import type { AppData, Settings } from '../types'
import { Btn, COPYRIGHT, Field, Modal, inputCls, useApp } from '../ui'

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { data, toast } = useApp()
  const [s, setS] = useState<Settings>(data.settings)
  const fileRef = useRef<HTMLInputElement>(null)
  const set = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => setS({ ...s, [k]: e.target.value })

  const save = async () => {
    await store.saveSettings({ ...s, bankAccount: s.bankAccount.replace(/\s/g, ''), accountName: s.accountName.toUpperCase() })
    toast('Đã lưu cài đặt')
    onClose()
  }

  const backup = () => {
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `tuongot-buon-saoluu-${today()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const restore = async (f: File) => {
    try {
      const d = JSON.parse(await f.text()) as AppData
      if (!Array.isArray(d.orders) || !Array.isArray(d.customers)) throw new Error('File không đúng định dạng sao lưu')
      if (!confirm(`Nạp ${d.customers.length} khách, ${d.orders.length} đơn từ file?\nDữ liệu hiện tại sẽ bị THAY THẾ hoàn toàn.`)) return
      await store.replaceAll({ ...d, products: d.products ?? [], receipts: d.receipts ?? [], stockIns: d.stockIns ?? [] })
      toast('Đã khôi phục dữ liệu')
      onClose()
    } catch (e) {
      alert('Không nạp được: ' + (e as Error).message)
    }
  }

  return (
    <Modal title="Cài đặt" onClose={onClose}>
      <div className="space-y-5">
        <section className="space-y-3">
          <h4 className="text-sm font-bold text-slate-900">Thông tin in trên hoá đơn</h4>
          <Field label="Tên cửa hàng">
            <input value={s.shopName} onChange={set('shopName')} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Số điện thoại">
              <input value={s.shopPhone} inputMode="tel" onChange={set('shopPhone')} className={inputCls} />
            </Field>
            <Field label="Địa chỉ">
              <input value={s.shopAddress} onChange={set('shopAddress')} className={inputCls} />
            </Field>
          </div>
          <Field label="Lời cảm ơn cuối hoá đơn">
            <input value={s.invoiceNote} onChange={set('invoiceNote')} className={inputCls} />
          </Field>
        </section>

        <section className="space-y-3">
          <h4 className="text-sm font-bold text-slate-900">Tài khoản nhận tiền (mã QR)</h4>
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
          <Field label="Chủ tài khoản" hint="Viết không dấu, đúng như trên app ngân hàng">
            <input value={s.accountName} onChange={set('accountName')} className={`${inputCls} uppercase`} />
          </Field>
        </section>

        <Btn onClick={save} className="w-full py-3">
          Lưu cài đặt
        </Btn>

        <section className="space-y-2 border-t border-slate-100 pt-4">
          <h4 className="text-sm font-bold text-slate-900">Sao lưu dữ liệu</h4>
          <p className="text-xs text-slate-500">Nên tải bản sao lưu mỗi tháng một lần, cất vào Google Drive.</p>
          <div className="grid grid-cols-2 gap-2">
            <Btn kind="soft" onClick={backup}>
              <Icon name="download" className="h-4 w-4" /> Tải sao lưu
            </Btn>
            <Btn kind="ghost" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" className="h-4 w-4" /> Nạp từ file
            </Btn>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
        </section>

        {!isDemo && <McpPanel />}

        <p className="border-t border-slate-100 pt-4 text-center text-xs text-slate-500">
          Sổ bán buôn tương ớt · {COPYRIGHT}
        </p>
      </div>
    </Modal>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Icon } from './icons'
import { amountToPay, drawInvoice } from './invoiceImage'
import { debtBefore, invoiceNo, money } from './logic'
import { Btn, Modal, useApp } from './ui'

/** Xem ảnh hoá đơn + gửi khách (chia sẻ thẳng sang Zalo/Messenger trên điện thoại, hoặc chép / tải về) */
export default function InvoiceModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const { data, customerById, toast } = useApp()
  const order = data.orders.find((o) => o.id === orderId)
  const customer = order ? customerById.get(order.customerId) : undefined
  const oldDebt = useMemo(() => (order ? debtBefore(data, order) : 0), [data, order])
  const [showDebt, setShowDebt] = useState(true)
  const [url, setUrl] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    if (!order) return
    let alive = true
    setUrl(null)
    drawInvoice({ order, customer, settings: data.settings, oldDebt, showDebt })
      .then((c) => {
        if (!alive) return
        setUrl(c.toDataURL('image/png'))
        c.toBlob((b) => alive && b && setBlob(b), 'image/png')
      })
      .catch((e) => {
        console.error(e)
        alive && setErr(true)
      })
    return () => {
      alive = false
    }
  }, [order, customer, data.settings, oldDebt, showDebt])

  if (!order) return null
  const fileName = `${invoiceNo(order.no)}-${(customer?.name ?? 'khach').replace(/[^\p{L}\p{N}]+/gu, '-')}.png`
  const file = blob ? new File([blob], fileName, { type: 'image/png' }) : null
  const canShare = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })

  const download = () => {
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    toast('Đã tải ảnh hoá đơn về máy')
  }
  const share = async () => {
    if (!file) return
    try {
      await navigator.share({ files: [file], title: `Hoá đơn ${invoiceNo(order.no)}` })
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') download()
    }
  }
  const copy = async () => {
    if (!blob) return
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      toast('Đã chép ảnh — mở Zalo, dán (Ctrl+V) để gửi')
    } catch {
      download()
    }
  }

  const due = amountToPay({ order, oldDebt, showDebt })

  return (
    <Modal title={`Hoá đơn ${invoiceNo(order.no)}`} onClose={onClose} zIndex="z-[60]">
      <div className="space-y-3">
        {oldDebt !== 0 && (
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                onClick={() => setShowDebt(v)}
                className={`flex-1 cursor-pointer rounded-lg py-2 transition ${showDebt === v ? 'bg-white text-red-800 shadow-sm' : 'text-slate-600'}`}
              >
                {v ? `Kèm ${oldDebt > 0 ? 'nợ cũ' : 'tiền dư'} ${money(Math.abs(oldDebt))}` : 'Chỉ đơn này'}
              </button>
            ))}
          </div>
        )}

        <div className="max-h-[58vh] overflow-y-auto rounded-2xl bg-slate-100 p-2">
          {url ? (
            <img src={url} alt="Ảnh hoá đơn" className="mx-auto block w-full max-w-md rounded-xl shadow-md" />
          ) : err ? (
            <p className="py-16 text-center text-sm text-red-600">Không tạo được ảnh hoá đơn.</p>
          ) : (
            <div className="flex h-64 items-center justify-center gap-2 text-sm text-slate-500">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-red-600 border-t-transparent" /> Đang vẽ hoá đơn…
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-500">
          Khách phải trả <b className="text-slate-800">{money(due)}</b> — mã QR đã điền sẵn số tiền này.
        </p>

        {canShare ? (
          <Btn onClick={share} disabled={!file} className="w-full py-3 text-base">
            <Icon name="share" className="h-5 w-5" /> Gửi khách (Zalo, Messenger…)
          </Btn>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <Btn kind="soft" onClick={copy} disabled={!blob}>
            <Icon name="copy" className="h-4 w-4" /> Chép ảnh
          </Btn>
          <Btn kind="soft" onClick={download} disabled={!url}>
            <Icon name="download" className="h-4 w-4" /> Tải về máy
          </Btn>
        </div>
      </div>
    </Modal>
  )
}

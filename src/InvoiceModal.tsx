import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Icon } from './icons'
import { amountToPay, drawInvoice, drawPurchase, purchaseAmountToPay } from './invoiceImage'
import { debtBefore, invoiceNo, money, oldDebtOrders, purchaseNo, supplierDebtBefore } from './logic'
import { Btn, Modal, useApp } from './ui'

/** Khung chung: vẽ ảnh, xem trước, gửi (chia sẻ sang Zalo/Messenger trên điện thoại) / chép / tải về */
function AnhChiaSe({
  title,
  fileName,
  draw,
  top,
  note,
  onClose,
}: {
  title: string
  fileName: string
  draw: () => Promise<HTMLCanvasElement>
  top?: ReactNode
  note?: ReactNode
  onClose: () => void
}) {
  const { toast } = useApp()
  const [url, setUrl] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    let alive = true
    setUrl(null)
    draw()
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
  }, [draw])

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
    toast('Đã tải ảnh về máy')
  }
  const share = async () => {
    if (!file) return
    try {
      await navigator.share({ files: [file], title })
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

  return (
    <Modal title={title} onClose={onClose} zIndex="z-[60]">
      <div className="space-y-3">
        {top}
        <div className="max-h-[58vh] overflow-y-auto rounded-2xl bg-slate-100 p-2">
          {url ? (
            <img src={url} alt={title} className="mx-auto block w-full max-w-md rounded-xl shadow-md" />
          ) : err ? (
            <p className="py-16 text-center text-sm text-red-600">Không tạo được ảnh.</p>
          ) : (
            <div className="flex h-64 items-center justify-center gap-2 text-sm text-slate-500">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-red-600 border-t-transparent" /> Đang vẽ…
            </div>
          )}
        </div>
        {note && <p className="text-center text-xs text-slate-500">{note}</p>}
        {canShare && (
          <Btn onClick={share} disabled={!file} className="w-full py-3 text-base">
            <Icon name="share" className="h-5 w-5" /> Gửi (Zalo, Messenger…)
          </Btn>
        )}
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

function KemNoCu({ oldDebt, value, onChange, chu }: { oldDebt: number; value: boolean; onChange: (v: boolean) => void; chu: [string, string] }) {
  if (!oldDebt) return null
  return (
    <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold">
      {[true, false].map((v) => (
        <button
          key={String(v)}
          onClick={() => onChange(v)}
          className={`flex-1 cursor-pointer rounded-lg py-2 transition ${value === v ? 'bg-white text-red-800 shadow-sm' : 'text-slate-600'}`}
        >
          {v ? `Kèm ${oldDebt > 0 ? chu[0] : 'tiền dư'} ${money(Math.abs(oldDebt))}` : chu[1]}
        </button>
      ))}
    </div>
  )
}

const tenTep = (so: string, ten?: string) => `${so}-${(ten ?? 'khach').replace(/[^\p{L}\p{N}]+/gu, '-')}.png`

/** Hoá đơn bán — QR là tài khoản của shop, khách quét trả tiền */
export default function InvoiceModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const { data, customerById } = useApp()
  const order = data.orders.find((o) => o.id === orderId)
  const customer = order ? customerById.get(order.customerId) : undefined
  const oldDebt = useMemo(() => (order ? debtBefore(data, order) : 0), [data, order])
  const oldOrders = useMemo(() => (order ? oldDebtOrders(data, order) : []), [data, order])
  const [showDebt, setShowDebt] = useState(true)
  const draw = useCallback(
    () => drawInvoice({ order: order!, customer, settings: data.settings, oldDebt, showDebt, oldOrders }),
    [order, customer, data.settings, oldDebt, showDebt, oldOrders],
  )
  if (!order) return null
  return (
    <AnhChiaSe
      title={`Hoá đơn ${invoiceNo(order.no)}`}
      fileName={tenTep(invoiceNo(order.no), customer?.name)}
      draw={draw}
      top={<KemNoCu oldDebt={oldDebt} value={showDebt} onChange={setShowDebt} chu={['nợ cũ', 'Chỉ đơn này']} />}
      note={
        <>
          Khách phải trả <b className="text-slate-800">{money(amountToPay({ order, oldDebt, showDebt }))}</b> — mã QR đã điền sẵn số tiền này.
        </>
      }
      onClose={onClose}
    />
  )
}

/** Phiếu nhập — QR là tài khoản của NGƯỜI BÁN, mình quét để trả tiền họ */
export function PurchaseModal({ purchaseId, onClose }: { purchaseId: string; onClose: () => void }) {
  const { data } = useApp()
  const pu = data.purchases.find((p) => p.id === purchaseId)
  const nb = pu?.supplierId ? data.suppliers.find((s) => s.id === pu.supplierId) : undefined
  const oldDebt = useMemo(() => (pu ? supplierDebtBefore(data.purchases, pu) : 0), [data.purchases, pu])
  const [showDebt, setShowDebt] = useState(true)
  const draw = useCallback(() => drawPurchase({ purchase: pu!, supplier: nb, settings: data.settings, oldDebt, showDebt }), [pu, nb, data.settings, oldDebt, showDebt])
  if (!pu) return null
  const can = purchaseAmountToPay({ purchase: pu, oldDebt, showDebt })
  return (
    <AnhChiaSe
      title={`Phiếu nhập ${purchaseNo(pu.no)}`}
      fileName={tenTep(purchaseNo(pu.no), nb?.name)}
      draw={draw}
      top={<KemNoCu oldDebt={oldDebt} value={showDebt} onChange={setShowDebt} chu={['nợ lần trước', 'Chỉ phiếu này']} />}
      note={
        nb ? (
          <>
            Mình còn phải trả <b className="text-slate-800">{money(can)}</b> — mở app ngân hàng quét mã QR trên phiếu để chuyển cho {nb.name}.
          </>
        ) : (
          'Phiếu chưa ghi người bán nên không có mã QR — sửa phiếu để chọn người bán.'
        )
      }
      onClose={onClose}
    />
  )
}

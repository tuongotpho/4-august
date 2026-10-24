import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './icons'
import { openOrderDebts, type StockRow } from './logic'
import type { AppData, Customer, Product } from './types'

export interface Ctx {
  data: AppData
  canEdit: boolean
  customerById: Map<string, Customer>
  productById: Map<string, Product>
  /** Nợ hiện tại từng khách (dương = khách còn nợ) */
  debts: Map<string, number>
  stock: StockRow[]
  toast: (msg: string) => void
  go: (tab: string) => void
  /** Mở form lên đơn: không truyền gì = đơn mới; truyền customerId = đơn mới cho khách đó; orderId = sửa đơn */
  openOrder: (o?: { orderId?: string; customerId?: string }) => void
  openInvoice: (orderId: string) => void
  openCustomer: (customerId: string) => void
}

export const AppCtx = createContext<Ctx>(null as unknown as Ctx)

// Nợ còn lại từng đơn — tính một lần cho cả danh sách, nhớ theo bộ dữ liệu hiện tại
const noDonCache = new WeakMap<object, { receipts: object; m: Map<string, number> }>()
/** id đơn → số còn nợ thật (đã trừ các lần thu nợ, đơn cũ nhất trước). Không có = đã trả đủ. */
export function useOrderDebts(): Map<string, number> {
  const { data } = useApp()
  const c = noDonCache.get(data.orders)
  if (c && c.receipts === data.receipts) return c.m
  const m = openOrderDebts(data)
  noDonCache.set(data.orders, { receipts: data.receipts, m })
  return m
}
export const useApp = () => useContext(AppCtx)

export const custName = (ctx: Ctx, id: string) => ctx.customerById.get(id)?.name ?? '(đã xoá)'

export function Card({
  title,
  subtitle,
  right,
  children,
  className = '',
}: {
  title?: ReactNode
  subtitle?: ReactNode
  right?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`min-w-0 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04)] sm:p-5 ${className}`}>
      {(title || right) && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold tracking-tight text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

type BtnKind = 'primary' | 'ghost' | 'danger' | 'soft'
const btnCls: Record<BtnKind, string> = {
  primary: 'bg-red-700 text-white shadow-sm shadow-red-900/20 hover:bg-red-800 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none',
  soft: 'bg-red-50 text-red-800 ring-1 ring-inset ring-red-200 hover:bg-red-100',
  ghost: 'text-slate-600 hover:bg-slate-100',
  danger: 'text-red-600 hover:bg-red-50',
}

export function Btn({ kind = 'primary', className = '', ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: BtnKind }) {
  return (
    <button
      {...p}
      className={`inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed ${btnCls[kind]} ${className}`}
    />
  )
}

// text-base (16px) để iPhone không tự phóng to khi chạm vào ô nhập
export const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/20 sm:text-sm'

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

/** Ô nhập tiền: hiện dấu chấm phân cách nghìn, bàn phím số trên điện thoại */
export function MoneyInput({
  value,
  onChange,
  className = '',
  placeholder = '0',
  autoFocus,
}: {
  value: number
  onChange: (n: number) => void
  className?: string
  placeholder?: string
  autoFocus?: boolean
}) {
  return (
    <div className="relative">
      <input
        inputMode="numeric"
        autoFocus={autoFocus}
        value={value ? value.toLocaleString('vi-VN') : ''}
        placeholder={placeholder}
        onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, '')) || 0)}
        onFocus={(e) => e.target.select()}
        className={`${inputCls} pr-8 text-right tabular-nums ${className}`}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-sm text-slate-400">đ</span>
    </div>
  )
}

/** Ô số lượng có nút − / + to, dễ bấm bằng ngón cái */
export function QtyStepper({ value, onChange, step = 1 }: { value: number; onChange: (n: number) => void; step?: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - step))}
        className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl bg-slate-100 text-slate-700 active:bg-slate-200"
        aria-label="Bớt"
      >
        <Icon name="minus" className="h-5 w-5" strokeWidth={2.4} />
      </button>
      <input
        inputMode="numeric"
        value={value || ''}
        placeholder="0"
        onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, '')) || 0)}
        onFocus={(e) => e.target.select()}
        className="h-10 w-16 rounded-xl border border-slate-200 bg-white text-center text-lg font-bold tabular-nums focus:border-red-600 focus:outline-none"
      />
      <button
        type="button"
        onClick={() => onChange(value + step)}
        className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl bg-red-700 text-white active:bg-red-800"
        aria-label="Thêm"
      >
        <Icon name="plus" className="h-5 w-5" strokeWidth={2.4} />
      </button>
    </div>
  )
}

export function Modal({
  title,
  onClose,
  children,
  zIndex = 'z-50',
}: {
  title: string
  onClose: () => void
  children: ReactNode
  zIndex?: string
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return createPortal(
    <div className={`fixed inset-0 ${zIndex} flex items-end justify-center bg-slate-900/60 backdrop-blur-sm sm:items-center`} onClick={onClose}>
      <div
        className="animate-sheet-up max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-100 bg-white/95 px-5 py-3.5 backdrop-blur">
          <h3 className="min-w-0 truncate text-base font-bold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
            aria-label="Đóng"
          >
            <Icon name="x" className="h-4 w-4" strokeWidth={2.2} />
          </button>
        </div>
        <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

const AVATAR_TONES = [
  'bg-red-100 text-red-800',
  'bg-amber-100 text-amber-800',
  'bg-orange-100 text-orange-800',
  'bg-emerald-100 text-emerald-800',
  'bg-sky-100 text-sky-800',
  'bg-violet-100 text-violet-800',
]

export function Avatar({ name, className = 'h-10 w-10 text-sm' }: { name: string; className?: string }) {
  const last = name.trim().split(/\s+/).pop() ?? '?'
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return (
    <span className={`grid shrink-0 place-items-center rounded-full font-bold ${AVATAR_TONES[h % AVATAR_TONES.length]} ${className}`}>
      {last[0]?.toUpperCase()}
    </span>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-slate-500">{children}</p>
}

/** Ô số liệu lớn ở đầu trang */
export function Stat({ label, value, sub, tone = 'slate' }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'slate' | 'red' | 'green' | 'amber' }) {
  const color = { slate: 'text-slate-900', red: 'text-red-700', green: 'text-emerald-700', amber: 'text-amber-700' }[tone]
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-3.5 shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-extrabold tracking-tight tabular-nums ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  )
}

export { fold } from './logic'

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), Math.min(7000, Math.max(2200, msg.length * 50)))
    return () => clearTimeout(t)
  }, [msg])
  const node = msg ? (
    <div className="keep-colors pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex justify-center px-4 lg:bottom-8 lg:pl-64">
      <div className="animate-fade-up flex max-w-md items-center gap-2 rounded-full bg-slate-900/95 py-2 pr-4 pl-2.5 text-sm text-white shadow-xl backdrop-blur">
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500">
          <Icon name="check" className="h-3 w-3" strokeWidth={3} />
        </span>
        {msg}
      </div>
    </div>
  ) : null
  return [node, setMsg] as const
}

export const COPYRIGHT = '(C) August87 - 0982722036'

/**
 * Chân trang chung (mẫu thống nhất trang chủ + 5 app): nằm cuối nội dung, đường kẻ mảnh phía trên,
 * cách nội dung 32px, đệm 16px, chữ 12px xám, căn giữa. Dòng 1 luôn là bản quyền; dòng 2 = ghi chú riêng của app (nếu có).
 * trenNenMau: biến thể chữ trắng mờ cho nền màu (màn đăng nhập đỏ).
 */
export function ChanTrang({ ghiChu, trenNenMau = false }: { ghiChu?: ReactNode; trenNenMau?: boolean }) {
  return (
    <footer
      className={`mt-8 w-full border-t px-4 py-4 text-center text-xs ${trenNenMau ? 'keep-colors border-white/15 text-white/60' : 'border-slate-200 text-slate-500'}`}
    >
      <p>{COPYRIGHT}</p>
      {ghiChu && <p className="mt-1">{ghiChu}</p>}
    </footer>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { MO_CAI_DAT, QUA_CONG, TRANG_CHU, veTrangChuDangNhap } from './cong'
import { Icon, type IconName } from './icons'
import InstallBanner from './InstallBanner'
import InvoiceModal from './InvoiceModal'
import { debtByCustomer, stockRows } from './logic'
import OrderForm from './OrderForm'
import { CustomerDetail } from './pages/Customers'
import Customers from './pages/Customers'
import Orders from './pages/Orders'
import Overview from './pages/Overview'
import SettingsModal from './pages/Settings'
import Stats from './pages/Stats'
import Stock from './pages/Stock'
import { emptyData, isDemo, login, logout, store, watchAuth, type AuthState } from './store'
import type { AppData } from './types'
import { AppCtx, COPYRIGHT, type Ctx, useToast } from './ui'

const TABS: { id: string; label: string; icon: IconName }[] = [
  { id: 'overview', label: 'Tổng quan', icon: 'home' },
  { id: 'orders', label: 'Đơn hàng', icon: 'receipt' },
  { id: 'customers', label: 'Khách', icon: 'users' },
  { id: 'stock', label: 'Kho', icon: 'box' },
  { id: 'stats', label: 'Thống kê', icon: 'chart' },
]

const THEME_KEY = 'tuongot-theme'
const readDark = () => {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark'
  } catch {
    return false
  }
}
const initialTab = () => {
  const h = location.hash.slice(1)
  return TABS.some((t) => t.id === h) ? h : 'overview'
}

export default function App() {
  const [data, setData] = useState<AppData>(emptyData)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [auth, setAuth] = useState<AuthState>({ checked: false, user: null, isAdmin: false })
  const [tab, setTab] = useState(initialTab)
  const [orderForm, setOrderForm] = useState<{ orderId?: string; customerId?: string } | null>(null)
  const [invoiceId, setInvoiceId] = useState<string | null>(null)
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(MO_CAI_DAT)
  const [toastNode, toast] = useToast()
  const [dark, setDark] = useState(readDark)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0a0f0d' : '#b91c1c')
    try {
      localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light')
    } catch {
      /* ẩn danh */
    }
  }, [dark])

  useEffect(() => watchAuth(setAuth), [])
  // Dữ liệu kinh doanh: chỉ tải khi đúng chủ shop đã đăng nhập (luật Firestore cũng chặn người khác)
  useEffect(() => {
    if (!auth.isAdmin) return
    setLoadError(null)
    return store.subscribe(
      (d, r) => (setData(d), setReady(r)),
      (e) => setLoadError(e.message),
    )
  }, [auth.isAdmin])
  useEffect(() => {
    const h = () => (setTab(initialTab()), setCustomerId(null))
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])
  useEffect(() => {
    document.title = data.settings.shopName + ' · Bán buôn'
  }, [data.settings.shopName])

  const go = useCallback((t: string) => {
    location.hash = t
    setTab(t)
    setCustomerId(null)
    window.scrollTo(0, 0)
  }, [])

  const doLogin = useCallback(() => {
    login().catch((e: { code?: string; message?: string }) => {
      if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') return
      if (e?.code === 'auth/unauthorized-domain')
        alert(`Tên miền ${location.hostname} chưa được cấp phép đăng nhập.\nVào Firebase Console → app-from-ai → Authentication → Settings → Authorized domains → Add domain.`)
      else alert('Đăng nhập lỗi: ' + (e?.message ?? e))
    })
  }, [])

  const ctx: Ctx = useMemo(
    () => ({
      data,
      canEdit: auth.isAdmin,
      customerById: new Map(data.customers.map((c) => [c.id, c])),
      productById: new Map(data.products.map((p) => [p.id, p])),
      debts: debtByCustomer(data),
      stock: stockRows(data),
      toast,
      go,
      openOrder: (o) => setOrderForm(o ?? {}),
      openInvoice: setInvoiceId,
      openCustomer: setCustomerId,
    }),
    [data, auth.isAdmin, toast, go],
  )

  const current = TABS.find((t) => t.id === tab) ?? TABS[0]
  const shop = data.settings.shopName

  // ---- Qua cổng chung, chưa đăng nhập: đăng nhập ở trang chủ ----
  if (!isDemo && QUA_CONG && auth.checked && !auth.user) {
    veTrangChuDangNhap()
    return <p className="p-8 text-sm text-slate-500">Đang về trang chủ để đăng nhập…</p>
  }

  // ---- Chưa đăng nhập / không phải chủ shop ----
  if (!isDemo && !auth.isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-red-800 to-red-950 px-6 text-center text-white">
        <div className="grid h-20 w-20 place-items-center rounded-3xl bg-white text-red-700 shadow-xl">
          <Icon name="chili" className="h-11 w-11" strokeWidth={1.6} />
        </div>
        <h1 className="mt-5 text-2xl font-extrabold">Sổ bán buôn tương ớt</h1>
        <p className="mt-2 max-w-xs text-sm text-red-100/80">Khách quen · công nợ · tồn kho · hoá đơn có mã QR chuyển khoản</p>
        {!auth.checked ? (
          <p className="mt-8 text-sm text-red-100/80">Đang kiểm tra đăng nhập…</p>
        ) : (
          <>
            {auth.user && (
              <p className="mt-6 max-w-xs rounded-xl bg-white/10 px-4 py-2 text-sm">
                Tài khoản <b>{auth.user.email}</b> không có quyền mở sổ này.
              </p>
            )}
            <button onClick={auth.user ? () => logout().then(doLogin) : doLogin} className="mt-6 flex cursor-pointer items-center gap-2 rounded-2xl bg-white px-6 py-3.5 font-bold text-red-800 shadow-lg active:scale-[0.98]">
              <Icon name="login" className="h-5 w-5" /> {auth.user ? 'Đăng nhập tài khoản khác' : 'Đăng nhập Google'}
            </button>
          </>
        )}
        <p className="mt-10 text-xs text-red-100/60">{COPYRIGHT}</p>
      </div>
    )
  }

  return (
    <AppCtx.Provider value={ctx}>
      <div className="min-h-screen lg:pl-64">
        {/* Thanh bên (máy tính) */}
        <aside className="keep-colors fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-gradient-to-b from-red-800 to-red-950 text-white lg:flex">
          <div className="flex items-center gap-3 px-5 py-6">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-red-700 shadow-lg shadow-black/20">
              <Icon name="chili" className="h-6 w-6" strokeWidth={1.7} />
            </div>
            <div className="min-w-0">
              <div className="line-clamp-2 text-[15px] leading-snug font-bold">{shop}</div>
              <div className="mt-0.5 text-xs text-red-200/70">Sổ bán buôn</div>
            </div>
          </div>
          <div className="px-3 pb-3">
            <button onClick={() => setOrderForm({})} className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-bold text-red-800 shadow">
              <Icon name="plus" className="h-5 w-5" strokeWidth={2.4} /> Lên đơn mới
            </button>
          </div>
          <nav className="flex-1 space-y-1 px-3">
            {TABS.map((t) => {
              const on = tab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => go(t.id)}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${on ? 'bg-white/15 text-white ring-1 ring-white/15' : 'text-red-100/75 hover:bg-white/5 hover:text-white'}`}
                >
                  <Icon name={t.icon} className={`h-5 w-5 ${on ? 'text-red-200' : ''}`} />
                  {t.label}
                </button>
              )
            })}
          </nav>
          <div className="space-y-1 border-t border-white/10 p-4 text-sm">
            <button onClick={() => setDark((d) => !d)} className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 font-medium text-red-100/90 hover:bg-white/10">
              <Icon name={dark ? 'sun' : 'moon'} className="h-5 w-5" /> {dark ? 'Giao diện sáng' : 'Giao diện tối'}
            </button>
            {/* Qua cổng chung: cài đặt (?cai-dat), đăng xuất ở trang chủ */}
            {QUA_CONG ? (
              <a href={TRANG_CHU} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 font-medium text-red-100/90 hover:bg-white/10">
                <Icon name="home" className="h-5 w-5" /> Trang chủ
              </a>
            ) : (
              <button onClick={() => setShowSettings(true)} className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 font-medium text-red-100/90 hover:bg-white/10">
                <Icon name="settings" className="h-5 w-5" /> Cài đặt
              </button>
            )}
            {auth.user && !QUA_CONG && (
              <button onClick={() => logout()} className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 font-medium text-red-100/90 hover:bg-white/10" title={auth.user.email}>
                <Icon name="logout" className="h-5 w-5" /> Đăng xuất
              </button>
            )}
          </div>
        </aside>

        {/* Đầu trang (điện thoại) */}
        <header className="keep-colors sticky top-0 z-30 bg-red-800 px-4 pt-[max(0.625rem,env(safe-area-inset-top))] pb-2.5 text-white shadow-md lg:hidden">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white text-red-700">
                <Icon name="chili" className="h-5 w-5" strokeWidth={1.7} />
              </span>
              <div className="min-w-0 leading-tight">
                <div className="truncate text-[15px] font-bold">{shop}</div>
                <div className="text-[11px] text-red-100/80">{current.label}</div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button onClick={() => setDark((d) => !d)} className="grid h-9 w-9 cursor-pointer place-items-center rounded-xl hover:bg-white/10" aria-label="Đổi giao diện sáng/tối">
                <Icon name={dark ? 'sun' : 'moon'} className="h-5 w-5" />
              </button>
              {QUA_CONG ? (
                <a href={TRANG_CHU} className="grid h-9 w-9 place-items-center rounded-xl hover:bg-white/10" aria-label="Trang chủ">
                  <Icon name="home" className="h-5 w-5" />
                </a>
              ) : (
                <button onClick={() => setShowSettings(true)} className="grid h-9 w-9 cursor-pointer place-items-center rounded-xl hover:bg-white/10" aria-label="Cài đặt">
                  <Icon name="settings" className="h-5 w-5" />
                </button>
              )}
              {auth.user && !QUA_CONG && (
                <button onClick={() => confirm('Đăng xuất?') && logout()} className="grid h-9 w-9 cursor-pointer place-items-center rounded-xl hover:bg-white/10" aria-label="Đăng xuất">
                  <Icon name="logout" className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </header>

        {isDemo && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 lg:px-10">
            Chế độ thử: dữ liệu chỉ lưu trên trình duyệt này.
          </div>
        )}
        {loadError && (
          <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-900 lg:px-10">Không tải được dữ liệu: {loadError}</div>
        )}

        <main className="px-4 pt-4 pb-24 sm:px-6 lg:px-10 lg:pt-8 lg:pb-12">
          <div className="mb-6 hidden items-end justify-between lg:flex">
            <div>
              <p className="text-xs font-semibold tracking-widest text-red-700 uppercase">{shop}</p>
              <h1 className="mt-1 text-[28px] font-extrabold tracking-tight text-slate-900">{current.label}</h1>
            </div>
          </div>
          {tab === 'overview' && <InstallBanner />}
          <div key={tab} className="animate-fade-up mx-auto max-w-5xl">
            {!ready ? (
              <p className="py-10 text-center text-slate-500">Đang tải dữ liệu…</p>
            ) : tab === 'orders' ? (
              <Orders />
            ) : tab === 'customers' ? (
              <Customers />
            ) : tab === 'stock' ? (
              <Stock />
            ) : tab === 'stats' ? (
              <Stats />
            ) : (
              <Overview />
            )}
          </div>
        </main>

        {/* Bản quyền cố định ở đáy màn hình (máy tính); điện thoại chỉ ghi trong Cài đặt */}
        <footer className="fixed right-0 bottom-0 left-64 z-20 hidden border-t border-slate-200/80 bg-white/90 py-1.5 text-center text-xs text-slate-400 backdrop-blur lg:block">
          {COPYRIGHT}
        </footer>

        {/* Menu dưới (điện thoại) */}
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/95 pb-[max(0.125rem,calc(env(safe-area-inset-bottom)-0.75rem))] backdrop-blur lg:hidden">
          <div className="grid grid-cols-5 px-1">
            {TABS.map((t) => {
              const on = tab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => go(t.id)}
                  aria-current={on ? 'page' : undefined}
                  className={`flex cursor-pointer flex-col items-center gap-0.5 pt-1.5 pb-1 text-[11px] transition ${on ? 'font-semibold text-red-800' : 'text-slate-500'}`}
                >
                  <span className={`grid h-7 w-12 place-items-center rounded-full transition ${on ? 'bg-red-100' : ''}`}>
                    <Icon name={t.icon} className="h-5 w-5" strokeWidth={on ? 2.1 : 1.8} />
                  </span>
                  {t.label}
                </button>
              )
            })}
          </div>
        </nav>
      </div>

      {customerId && <CustomerDetail customerId={customerId} onClose={() => setCustomerId(null)} />}
      {orderForm && (
        <OrderForm
          orderId={orderForm.orderId}
          customerId={orderForm.customerId}
          onClose={() => setOrderForm(null)}
          onSaved={(id) => {
            setOrderForm(null)
            setInvoiceId(id)
          }}
        />
      )}
      {invoiceId && <InvoiceModal orderId={invoiceId} onClose={() => setInvoiceId(null)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {toastNode}
    </AppCtx.Provider>
  )
}


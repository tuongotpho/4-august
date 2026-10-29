import type { User } from 'firebase/auth'
import { useEffect, useState } from 'react'
import { DS_APP, duongVeHopLe, type AppCon } from './dsApp'
import { dangNhap, dangXuat, ketQuaChuyenTrang, theoDoiNguoiDung } from './firebase'

const BAN_QUYEN = '(C) August87 - 0982722036'

type Tab = 'ungDung' | 'caiDat'

export default function App() {
  // undefined = đang kiểm tra phiên đăng nhập
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [loi, setLoi] = useState('')
  const [tab, setTab] = useState<Tab>(() => (location.hash === '#cai-dat' ? 'caiDat' : 'ungDung'))

  // App gửi về đây kèm ?ve= (vd link bot mở hồ sơ khi phiên đã hết) → đăng nhập xong mở lại đúng trang đó
  const [ve] = useState(() => duongVeHopLe(new URLSearchParams(location.search).get('ve')))
  const appVe = ve ? DS_APP.find((a) => ve.startsWith(a.duongDan)) : undefined

  useEffect(() => {
    ketQuaChuyenTrang().catch((e) => setLoi(thongBaoLoi(e)))
    return theoDoiNguoiDung(setUser)
  }, [])
  useEffect(() => {
    if (user && ve) location.replace(ve)
  }, [user, ve])
  // Đổi #cai-dat trên thanh địa chỉ (không tải lại trang) cũng chuyển tab
  useEffect(() => {
    const doi = () => setTab(location.hash === '#cai-dat' ? 'caiDat' : 'ungDung')
    window.addEventListener('hashchange', doi)
    return () => window.removeEventListener('hashchange', doi)
  }, [])

  const chonTab = (t: Tab) => {
    setTab(t)
    history.replaceState(null, '', t === 'caiDat' ? '#cai-dat' : location.pathname)
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-md">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))]">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-sm font-extrabold text-slate-900">LT</span>
          <h1 className="text-lg font-bold">App by Lê Thanh</h1>
          {user && (
            <nav className="ml-4 hidden gap-1 sm:flex">
              <NutTab dang={tab === 'ungDung'} onClick={() => chonTab('ungDung')}>Ứng dụng</NutTab>
              <NutTab dang={tab === 'caiDat'} onClick={() => chonTab('caiDat')}>Cài đặt</NutTab>
            </nav>
          )}
          {user && <AnhDaiDien user={user} className="ml-auto" />}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24 sm:pb-6">
        {user === undefined ? (
          <p className="text-sm text-slate-500">Đang kiểm tra đăng nhập…</p>
        ) : !user ? (
          <>
            <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm sm:p-6">
              <h2 className="text-lg font-bold">{appVe ? `Đăng nhập để mở ${appVe.ten}` : 'Đăng nhập để dùng các app'}</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
                Đăng nhập Google một lần ở đây là tất cả các app đều nhận. Dữ liệu mỗi app vẫn cất riêng, chỉ tài khoản của anh xem được.
              </p>
              <button
                className="mt-4 inline-flex items-center justify-center rounded-lg bg-slate-900 px-5 py-2.5 font-semibold text-white hover:bg-slate-800"
                onClick={() => {
                  setLoi('')
                  dangNhap().catch((e) => setLoi(thongBaoLoi(e)))
                }}
              >
                Đăng nhập bằng Google
              </button>
              {loi && <p className="mx-auto mt-3 max-w-md rounded-lg bg-red-50 p-2 text-left text-sm text-red-700">{loi}</p>}
            </section>
            <LuoiApp khoa />
          </>
        ) : tab === 'ungDung' ? (
          <LuoiApp />
        ) : (
          <CaiDat user={user} />
        )}
        {/* Chân trang chung (mẫu thống nhất trang chủ + các app): cuối nội dung, đường kẻ mảnh phía trên, cách 32px, đệm 16px, chữ 12px xám */}
        <footer className="mt-8 w-full border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-500">
          <p>{BAN_QUYEN}</p>
        </footer>
      </main>

      {user && (
        // Điện thoại: thanh tab dưới đáy
        <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
          <NutTabDuoi dang={tab === 'ungDung'} onClick={() => chonTab('ungDung')}>Ứng dụng</NutTabDuoi>
          <NutTabDuoi dang={tab === 'caiDat'} onClick={() => chonTab('caiDat')}>Cài đặt</NutTabDuoi>
        </nav>
      )}
    </div>
  )
}

/** Lưới các app. khoa = chưa đăng nhập: hiện ô mờ, không bấm được */
function LuoiApp({ khoa = false }: { khoa?: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {DS_APP.map((a) => {
        const noiDung = (
          <>
            <KyHieu a={a} />
            <span className="min-w-0">
              <span className="block font-semibold">{a.ten}</span>
              <span className="block text-sm text-slate-500">{khoa ? '🔒 Đăng nhập để mở' : a.moTa}</span>
            </span>
          </>
        )
        return khoa ? (
          <div key={a.ma} aria-disabled className="flex items-center gap-3.5 rounded-xl border border-slate-200 bg-white p-4 opacity-55 grayscale">
            {noiDung}
          </div>
        ) : (
          <a
            key={a.ma}
            href={a.duongDan}
            className="flex items-center gap-3.5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-px hover:border-[var(--mau)] focus-visible:outline-2 focus-visible:outline-[var(--mau)]"
            style={{ '--mau': a.mau } as React.CSSProperties}
          >
            {noiDung}
          </a>
        )
      })}
    </div>
  )
}

function CaiDat({ user }: { user: User }) {
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-bold">👤 Tài khoản</h2>
        <div className="flex flex-wrap items-center gap-3">
          <AnhDaiDien user={user} lon />
          <div className="min-w-0">
            <div className="font-semibold">{user.displayName || 'Tài khoản Google'}</div>
            <div className="truncate text-sm text-slate-500">{user.email}</div>
          </div>
          <button
            className="ml-auto rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
            onClick={() => confirm('Đăng xuất khỏi tất cả các app?') && void dangXuat()}
          >
            Đăng xuất
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Đăng xuất ở đây là đăng xuất khỏi tất cả các app. Điện thoại: mở trang bằng Chrome / Safari → menu → <b>Thêm vào màn hình chính</b> để dùng như một app.
        </p>
      </section>

      <h2 className="pt-2 font-bold">⚙️ Cài đặt từng app</h2>
      {DS_APP.map((a) => (
        <CaiDatApp key={a.ma} a={a} />
      ))}
    </div>
  )
}

function CaiDatApp({ a }: { a: AppCon }) {
  const [daChep, setDaChep] = useState(false)
  const mcp = `${a.diaChiGoc}/mcp`
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" style={{ borderLeft: `4px solid ${a.mau}` }}>
      <div className="flex flex-wrap items-center gap-3">
        <KyHieu a={a} nho />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{a.ten}</div>
          <div className="text-xs text-slate-500">{a.caiDat}</div>
        </div>
        <a
          href={`${a.duongDan}?cai-dat`}
          className="rounded-lg px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
          style={{ background: a.mau }}
        >
          Mở cài đặt riêng →
        </a>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500">Kết nối AI:</span>
        <code className="rounded bg-slate-100 px-2 py-0.5 text-xs">{mcp}</code>
        <button
          className="rounded-md border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-50"
          onClick={() => void navigator.clipboard.writeText(mcp).then(() => (setDaChep(true), setTimeout(() => setDaChep(false), 1500)))}
        >
          {daChep ? 'Đã chép ✓' : 'Chép'}
        </button>
      </div>
    </section>
  )
}

function KyHieu({ a, nho = false }: { a: AppCon; nho?: boolean }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-lg font-bold text-white ${nho ? 'h-9 w-9 text-sm' : 'h-11 w-11'}`}
      style={{ background: a.mau }}
    >
      {a.kyHieu}
    </span>
  )
}

function AnhDaiDien({ user, lon = false, className = '' }: { user: User; lon?: boolean; className?: string }) {
  const [loi, setLoi] = useState(false)
  const co = lon ? 'h-12 w-12 text-lg' : 'h-8 w-8 text-sm'
  const chu = (user.displayName || user.email || '?').trim()[0]?.toUpperCase()
  return user.photoURL && !loi ? (
    <img src={user.photoURL} alt="" referrerPolicy="no-referrer" onError={() => setLoi(true)} className={`${co} shrink-0 rounded-full ${className}`} title={user.email ?? ''} />
  ) : (
    <span className={`${co} grid shrink-0 place-items-center rounded-full bg-slate-600 font-bold text-white ${className}`} title={user.email ?? ''}>
      {chu}
    </span>
  )
}

function NutTab({ dang, onClick, children }: { dang: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-md px-3 py-1.5 text-sm font-medium ${dang ? 'bg-white/15 text-white' : 'text-slate-300 hover:bg-white/10'}`}>
      {children}
    </button>
  )
}

function NutTabDuoi({ dang, onClick, children }: { dang: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`flex-1 py-3 text-sm ${dang ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>
      {children}
    </button>
  )
}

function thongBaoLoi(e: unknown) {
  const ma = (e as { code?: string }).code ?? ''
  if (ma.includes('popup-closed') || ma.includes('cancelled')) return ''
  if (ma.includes('unauthorized-domain'))
    return `Tên miền ${location.hostname} chưa được phép đăng nhập: Firebase Console → app-from-ai → Authentication → Settings → Authorized domains → thêm tên miền này.`
  return 'Đăng nhập không được: ' + ((e as Error).message || ma)
}

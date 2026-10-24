import type { User } from 'firebase/auth'
import { useEffect, useState } from 'react'
import DossierEditor from './components/DossierEditor'
import DossierList from './components/DossierList'
import SettingsPage from './components/SettingsPage'
import SummaryPage from './components/SummaryPage'
import TemplatesPage from './components/TemplatesPage'
import { MO_CAI_DAT, QUA_CONG, TRANG_CHU, veTrangChuDangNhap } from './lib/cong'
import { taiBoDocPdf } from './lib/dossierOps'
import { CHUA_DANG_NHAP, setStore } from './lib/store'

type Tab = 'hoSo' | 'tongHop' | 'mau' | 'caiDat'

// [tab, tên trên máy tính, biểu tượng + tên ngắn cho thanh tab dưới đáy (điện thoại)]
const TABS: [Tab, string, string, string][] = [
  ['hoSo', 'Hồ sơ thanh toán', '📄', 'Hồ sơ'],
  ['tongHop', 'Tổng hợp', '📊', 'Tổng hợp'],
  ['mau', 'Mẫu in', '🖨️', 'Mẫu in'],
  // Qua cổng chung: Cài đặt mở từ trang chủ (?cai-dat), không nằm trên thanh tab
  ...(QUA_CONG ? [] : [['caiDat', 'Cài đặt & sao lưu', '⚙️', 'Cài đặt'] as [Tab, string, string, string]]),
]

type Mode = { kind: 'checking' } | { kind: 'login' } | { kind: 'cloud'; user: User }

const fb = () => import('./lib/firebase')

export default function App() {
  const [mode, setMode] = useState<Mode>({ kind: 'checking' })
  const [loginErr, setLoginErr] = useState('')

  useEffect(() => {
    let unsub = () => {}
    fb().then(({ onUser, storeFor }) => {
      // Firebase (cần để đăng nhập) tải trước; xong mới tải nền các phần nặng khác.
      // Tải sẵn: web có cập nhật giữa chừng thì trang đang mở vẫn đọc được PDF, xuất được Word
      for (const tai of [taiBoDocPdf, () => import('./lib/docx'), () => import('./lib/backup'), () => import('./lib/ruiRoExcel')]) tai().catch(() => {})
      unsub = onUser((u) => {
        if (u) {
          setStore(storeFor(u))
          setMode({ kind: 'cloud', user: u })
        } else {
          setStore(CHUA_DANG_NHAP)
          setMode({ kind: 'login' }) // bắt buộc đăng nhập: dữ liệu luôn cất trên mạng
        }
      })
    })
    return () => unsub()
  }, [])

  async function login() {
    setLoginErr('')
    try {
      await (await fb()).dangNhapGoogle()
    } catch (e) {
      const code = (e as { code?: string }).code ?? ''
      if (code.includes('popup-closed') || code.includes('cancelled')) return
      setLoginErr(
        code.includes('unauthorized-domain')
          ? 'Tên miền này chưa được phép đăng nhập. Vào Firebase Console → Authentication → Settings → Authorized domains, thêm tên miền của trang.'
          : code.includes('popup-blocked')
            ? 'Trình duyệt đã chặn cửa sổ đăng nhập. Cho phép cửa sổ bật lên (popup) cho trang này rồi bấm lại.'
          : code.includes('operation-not-allowed')
            ? 'Chưa bật đăng nhập Google: Firebase Console → Authentication → Sign-in method → Google → Enable.'
            : 'Đăng nhập không được: ' + ((e as Error).message || code),
      )
    }
  }

  if (mode.kind === 'checking') return <p className="p-8 text-slate-500">Đang khởi động…</p>

  if (mode.kind === 'login' && QUA_CONG) {
    // Qua cổng chung: đăng nhập ở trang chủ
    veTrangChuDangNhap()
    return <p className="p-8 text-slate-500">Đang về trang chủ để đăng nhập…</p>
  }

  if (mode.kind === 'login') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
        <div className="card w-full max-w-md space-y-4 text-center">
          <h1 className="flex items-center justify-center gap-2 text-xl font-bold text-slate-800"><img src="icon-192.png" alt="" className="h-9 w-9" />Quản lý hóa đơn</h1>
          <p className="text-sm text-slate-600">
            Đăng nhập Google để dữ liệu được cất trên mạng: mở ở máy nào, điện thoại nào cũng thấy cùng một bộ hồ sơ. Chỉ tài khoản của anh xem
            được dữ liệu của anh.
          </p>
          <button className="btn-primary w-full justify-center py-2.5 text-base" onClick={login}>
            Đăng nhập bằng Google
          </button>
          {loginErr && <p className="rounded bg-red-50 p-2 text-left text-xs text-red-700">{loginErr}</p>}
        </div>
        <ChanTrang />
      </div>
    )
  }

  return <Main key={mode.user.uid} user={mode.user} />
}

function Main({ user }: { user: User }) {
  const [tab, setTab] = useState<Tab>(MO_CAI_DAT ? 'caiDat' : 'hoSo')
  // ?hs=<id>: mở thẳng hồ sơ đó (link bot Telegram gửi về sau khi tạo hồ sơ)
  const [editingId, setEditingId] = useState<string | null>(() => new URLSearchParams(location.search).get('hs'))
  useEffect(() => {
    if (new URLSearchParams(location.search).has('hs')) history.replaceState(null, '', location.pathname)
  }, [])
  const chonTab = (k: Tab) => {
    setTab(k)
    setEditingId(null)
    window.scrollTo(0, 0)
  }
  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      {/* Thanh đầu trang cố định khi cuộn */}
      <div className="sticky top-0 z-40 shadow-sm">
      <header className="border-b border-slate-200 bg-white pt-[env(safe-area-inset-top)]">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 lg:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            {QUA_CONG && <NutTrangChu />}
            <h1 className="flex min-w-0 items-center gap-2 text-lg font-bold text-slate-800">
              <img src="favicon-32.png" alt="" className="h-7 w-7" />
              <span className="truncate">Quản lý hóa đơn</span>
            </h1>
          </div>
          {/* Máy tính: tab ở đầu trang; điện thoại: thanh tab dưới đáy */}
          <nav className="hidden flex-wrap gap-1 sm:flex">
            {TABS.map(([k, label]) => (
              <button
                key={k}
                onClick={() => chonTab(k)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  tab === k ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
            <TaiKhoan user={user} />
            {/* Qua cổng chung: đăng xuất ở trang chủ (nút nhà góc trái) */}
            {!QUA_CONG && (
              <button className="btn !py-1 !text-xs" onClick={() => fb().then((m) => m.dangXuat())}>
                Đăng xuất
              </button>
            )}
          </div>
        </div>
      </header>

      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white/95 backdrop-blur sm:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {TABS.map(([k, , icon, ngan]) => (
          <button key={k} onClick={() => chonTab(k)} className={`flex flex-1 flex-col items-center py-1.5 text-[11px] ${tab === k ? 'font-semibold text-blue-700' : 'text-slate-500'}`}>
            <span className="text-lg leading-6">{icon}</span>
            {ngan}
          </button>
        ))}
      </nav>

      <main className="px-4 py-5 lg:px-6">
        {tab === 'hoSo' &&
          (editingId ? (
            <DossierEditor id={editingId} onClose={() => setEditingId(null)} />
          ) : (
            <DossierList onOpen={setEditingId} />
          ))}
        {tab === 'tongHop' && (
          <SummaryPage
            onOpen={(id) => {
              setTab('hoSo')
              setEditingId(id)
            }}
          />
        )}
        {tab === 'mau' && <TemplatesPage />}
        {tab === 'caiDat' && <SettingsPage />}
      </main>
      <ChanTrang />
    </div>
  )
}

/** Góc tài khoản: ảnh đại diện Google, tên, email (+ biểu tượng ☁ = đang lưu lên mạng). */
function TaiKhoan({ user }: { user: User }) {
  const [anhLoi, setAnhLoi] = useState(false)
  const ten = user.displayName || user.email?.split('@')[0] || 'Tài khoản'
  return (
    <span className="flex items-center gap-2" title="Đang đăng nhập — dữ liệu tự lưu lên mạng (Firebase), đồng bộ mọi máy">
      {user.photoURL && !anhLoi ? (
        // ảnh Google: tắt referrer để khỏi bị chặn tải ảnh
        <img src={user.photoURL} alt="" referrerPolicy="no-referrer" onError={() => setAnhLoi(true)} className="h-8 w-8 rounded-full border border-slate-200" />
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
          {ten.trim().split(/\s+/).pop()?.[0]?.toUpperCase()}
        </span>
      )}
      {/* Điện thoại: chỉ ảnh đại diện cho gọn */}
      <span className="hidden flex-col leading-tight sm:flex">
        <span className="text-sm font-medium text-slate-800">{ten}</span>
        <span className="text-[11px] text-slate-500">☁ {user.email}</span>
      </span>
    </span>
  )
}

/** Nút về trang chủ chung (mẫu thống nhất 5 app): góc trái đầu trang, ô 40px bo 8px, biểu tượng ngôi nhà. */
function NutTrangChu() {
  return (
    <a href={TRANG_CHU} aria-label="Về trang chủ" title="Về trang chủ" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
        <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </svg>
    </a>
  )
}

/** Chân trang chung (mẫu thống nhất trang chủ + 5 app): cuối nội dung, đường kẻ mảnh phía trên, cách 32px, đệm 16px, chữ 12px xám, căn giữa. */
function ChanTrang() {
  return (
    <footer className="mt-8 w-full border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-500">
      <p>(C) August87 - 0982722036</p>
    </footer>
  )
}

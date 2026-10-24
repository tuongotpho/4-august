import type { User } from 'firebase/auth'
import { useEffect, useState } from 'react'
import CaiDatPage from './components/CaiDatPage'
import CongNo from './components/CongNo'
import DanhSach, { type LocBanDau } from './components/DanhSach'
import DanTin from './components/DanTin'
import LichThang from './components/LichThang'
import SuaLop from './components/SuaLop'
import TongHop from './components/TongHop'
import { MO_CAI_DAT, QUA_CONG, TRANG_CHU, veTrangChuDangNhap } from './lib/cong'
import { dongBoNen, useLoiLich, useLop } from './lib/hooks'
import { GIO_MAC_DINH, homNay, lopMoi, type LopGiang } from './lib/model'
import { CHUA_DANG_NHAP, setStore } from './lib/store'
import { congNo } from './lib/tinh'

type Tab = 'lich' | 'danhSach' | 'congNo' | 'tongHop' | 'caiDat'
type Mode = { kind: 'checking' } | { kind: 'login' } | { kind: 'cloud'; user: User }

const fb = () => import('./lib/firebase')

export default function App() {
  const [mode, setMode] = useState<Mode>({ kind: 'checking' })
  const [loiDN, setLoiDN] = useState('')

  useEffect(() => {
    let unsub = () => {}
    fb().then(({ onUser, storeFor }) => {
      unsub = onUser((u) => {
        if (u) {
          setStore(storeFor(u))
          setMode({ kind: 'cloud', user: u })
        } else {
          setStore(CHUA_DANG_NHAP)
          setMode({ kind: 'login' })
        }
      })
    })
    return () => unsub()
  }, [])

  async function dangNhap() {
    setLoiDN('')
    try {
      await (await fb()).dangNhapGoogle()
    } catch (e) {
      const code = (e as { code?: string }).code ?? ''
      if (code.includes('popup-closed') || code.includes('cancelled')) return
      setLoiDN(
        code.includes('unauthorized-domain')
          ? 'Tên miền này chưa được phép đăng nhập: Firebase Console → Authentication → Settings → Authorized domains, thêm tên miền của trang.'
          : code.includes('popup-blocked')
            ? 'Trình duyệt đã chặn cửa sổ đăng nhập. Cho phép cửa sổ bật lên (popup) rồi bấm lại.'
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
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="card w-full max-w-md space-y-4 text-center">
          <h1 className="flex items-center justify-center gap-2 text-xl font-bold text-slate-800"><img src="icon.svg" alt="" className="h-9 w-9" />Lịch giảng ATLĐ</h1>
          <p className="text-sm text-slate-600">Đăng nhập Google để dữ liệu được cất trên mạng: máy tính, điện thoại đều thấy cùng một lịch. Chỉ tài khoản của anh xem được dữ liệu của anh.</p>
          <button className="btn-primary w-full py-2.5 text-base" onClick={() => void dangNhap()}>Đăng nhập bằng Google</button>
          {loiDN && <p className="rounded bg-red-50 p-2 text-left text-xs text-red-700">{loiDN}</p>}
          <BanQuyen />
        </div>
      </div>
    )
  }
  return <ManHinh user={mode.user} />
}

function BanQuyen() {
  return <footer className="mt-6 text-center text-xs text-slate-400">(C) August87 - 0982722036</footer>
}

function ManHinh({ user }: { user: User }) {
  const ds = useLop()
  const loiLich = useLoiLich()
  const [tab, setTab] = useState<Tab>(MO_CAI_DAT ? 'caiDat' : 'lich')
  const [sua, setSua] = useState<{ lop: LopGiang; moi: boolean } | null>(null)
  const [danTin, setDanTin] = useState(false)
  // Bộ lọc mang từ trang Tổng hợp sang Danh sách; đổi `lan` để Danh sách dựng lại với bộ lọc mới
  const [loc, setLoc] = useState<LocBanDau & { lan: number }>()

  // Mở thẳng một lớp: link từ Google Calendar / bot Telegram (?lop=id)
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('lop')
    if (!id || !ds) return
    const l = ds.find((x) => x.id === id)
    if (l) setSua({ lop: l, moi: false })
    history.replaceState(null, '', location.pathname)
  }, [ds])

  // Lớp còn chờ đẩy lên Google Calendar (sửa lúc mất mạng, lỗi lần trước…) -> thử lại khi mở app
  useEffect(() => {
    if (ds) void dongBoNen()
  }, [ds === null]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!ds) return <p className="p-8 text-slate-500">Đang tải lịch…</p>

  const soNo = congNo(ds).reduce((s, n) => s + n.lop.length, 0)
  const TABS: [Tab, string, string][] = [
    ['lich', '📅', 'Lịch'],
    ['danhSach', '📋', 'Danh sách'],
    ['congNo', '💰', `Công nợ${soNo ? ` (${soNo})` : ''}`],
    ['tongHop', '📊', 'Tổng hợp'],
    // Qua cổng chung: Cài đặt mở từ trang chủ (?cai-dat), không nằm trên thanh tab
    ...(QUA_CONG ? [] : [['caiDat', '⚙️', 'Cài đặt'] as [Tab, string, string]]),
  ]
  const mo = (l: LopGiang) => setSua({ lop: l, moi: !ds.some((x) => x.id === l.id) })
  const them = (ngay = homNay()) => setSua({ lop: lopMoi({ ngay, gioBD: GIO_MAC_DINH.sang[0], gioKT: GIO_MAC_DINH.sang[1] }), moi: true })

  return (
    <div className="mx-auto max-w-7xl p-2 pb-24 sm:p-4">
      <header className="mb-3 flex items-center gap-2">
        <h1 className="flex items-center gap-2 text-lg font-bold text-slate-800"><img src="icon.svg" alt="" className="h-7 w-7" />Lịch giảng ATLĐ</h1>
        {/* máy tính: tab ở trên; điện thoại: thanh tab dưới đáy */}
        <nav className="ml-4 hidden gap-1 sm:flex">
          {TABS.map(([k, icon, ten]) => (
            <button key={k} onClick={() => setTab(k)} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${tab === k ? 'bg-teal-700 text-white' : 'text-slate-600 hover:bg-slate-200'}`}>
              {icon} {ten}
            </button>
          ))}
        </nav>
        <span className="flex-1" />
        <button className="btn" onClick={() => setDanTin(true)}>📋 <span className="hidden sm:inline">Dán tin nhắn</span><span className="sm:hidden">Dán tin</span></button>
        <button className="btn-primary hidden sm:inline-flex" onClick={() => them()}>+ Thêm lớp</button>
        {QUA_CONG ? (
          <a className="btn" href={TRANG_CHU}>← <span className="hidden sm:inline">Trang chủ</span></a>
        ) : (
          <button className="hidden text-xs text-slate-400 hover:text-slate-600 sm:block" title={user.email ?? ''} onClick={() => void fb().then((f) => f.dangXuat())}>Đăng xuất</button>
        )}
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white/95 backdrop-blur sm:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {TABS.map(([k, icon, ten]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex flex-1 flex-col items-center py-1.5 text-[11px] ${tab === k ? 'font-semibold text-teal-700' : 'text-slate-500'}`}>
            <span className="text-lg leading-6">{icon}</span>
            {ten.replace(/ \(.*\)$/, '')}
            {k === 'congNo' && soNo > 0 && <span className="absolute ml-6 -mt-0.5 rounded-full bg-amber-500 px-1 text-[10px] text-white">{soNo}</span>}
          </button>
        ))}
      </nav>
      {/* nút + nổi trên điện thoại */}
      <button
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-teal-700 text-3xl text-white shadow-lg active:bg-teal-800 sm:hidden"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        onClick={() => them()}
        aria-label="Thêm lớp"
      >
        +
      </button>

      {loiLich && <p className="mb-2 rounded bg-amber-50 px-3 py-1.5 text-xs text-amber-800">📅 Chưa đồng bộ được Google Calendar: {loiLich}</p>}

      {tab === 'lich' && <LichThang ds={ds} onMo={mo} onThem={them} />}
      {tab === 'danhSach' && <DanhSach key={loc?.lan ?? 0} ds={ds} onMo={mo} locBanDau={loc} />}
      {tab === 'congNo' && <CongNo ds={ds} onMo={mo} />}
      {tab === 'tongHop' && (
        <TongHop
          ds={ds}
          onLoc={(l) => {
            setLoc({ ...l, lan: Date.now() })
            setTab('danhSach')
            scrollTo(0, 0)
          }}
        />
      )}
      {tab === 'caiDat' && <CaiDatPage ds={ds} />}

      <BanQuyen />

      {danTin && <DanTin onDong={() => setDanTin(false)} onMo={(l) => setSua({ lop: l, moi: true })} />}
      {sua && <SuaLop key={sua.lop.id} lop={sua.lop} moi={sua.moi} tatCa={ds} onDong={() => setSua(null)} />}
    </div>
  )
}

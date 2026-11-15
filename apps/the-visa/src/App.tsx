import { useCallback, useEffect, useMemo, useState } from 'react'
import type { User } from 'firebase/auth'
import type { Ky } from '../shared/kieu'
import { nhomTuDong, type KhoanChi } from '../shared/phanLoai'
import { CHE_DO_THU, khoMayChu, khoThu, type Kho } from './kho'
import { auth, dangNhap, dangXuat, theoDoi } from './firebase'
import { TongQuan } from './TongQuan'
import { TheoNam } from './TheoNam'
import { TaiLen } from './TaiLen'
import { CacKy } from './CacKy'
import { ChoPhepAi, QuanLyKetNoi } from './KetNoiAi'

type Tab = 'ky' | 'nam' | 'tai' | 'ds' | 'ai'
const QUA_CONG = location.pathname.startsWith('/the-visa/')
/** Máy chủ MCP chuyển sang đây khi một ứng dụng AI xin quyền */
const YEU_CAU_AI = new URLSearchParams(location.search).get('ket-noi-ai')
const layVe = () => auth.currentUser!.getIdToken()

export function App() {
  const [user, setUser] = useState<User | null | undefined>(CHE_DO_THU ? null : undefined)
  useEffect(() => (CHE_DO_THU ? undefined : theoDoi(setUser)), [])
  const kho: Kho | null = useMemo(() => (CHE_DO_THU ? khoThu() : user ? khoMayChu(layVe) : null), [user])

  const [ky, setKy] = useState<Ky[] | null>(null)
  const [loi, setLoi] = useState('')
  const [tab, setTab] = useState<Tab>('ky')
  const taiLai = useCallback(async () => {
    if (!kho) return
    try { setKy(await kho.tai()); setLoi('') } catch (e) { setLoi((e as Error).message) }
  }, [kho])
  useEffect(() => { taiLai() }, [taiLai])
  useEffect(() => { if (ky && !ky.length) setTab('tai') }, [ky])

  const doiNhom = useCallback(async (k: KhoanChi, nhom: string) => {
    if (!kho || !ky) return
    const cu = ky.find((x) => x.id === k.kyId)!
    const moi: Ky = { ...cu, giaoDich: cu.giaoDich.map((g) => (g.id === k.g.id ? { ...g, nhomTay: nhom === nhomTuDong(g.moTa) ? undefined : nhom } : g)) }
    setKy(ky.map((x) => (x.id === moi.id ? moi : x)))
    try { await kho.luu(moi) } catch (e) { setLoi('Lưu nhóm lỗi: ' + (e as Error).message); taiLai() }
  }, [kho, ky, taiLai])

  if (user === undefined) return <div className="giua sub">Đang mở…</div>
  if (!CHE_DO_THU && !user)
    return (
      <div className="giua">
        <div>
          <h1>Chi tiêu thẻ tín dụng</h1>
          <p className="sub">{YEU_CAU_AI ? 'Một ứng dụng AI đang xin quyền xem chi tiêu. Đăng nhập trước để quyết định.' : 'Đăng nhập bằng tài khoản Google được phép để xem.'}</p>
          <button className="nut" onClick={() => dangNhap().catch((e) => setLoi(e.message))}>Đăng nhập Google</button>
          {loi && <div className="loi">{loi}</div>}
          <footer>(C) August87 - 0982722036</footer>
        </div>
      </div>
    )

  if (YEU_CAU_AI && user) return <ChoPhepAi yeuCau={YEU_CAU_AI} layVe={layVe} email={user.email ?? ''} />

  return (
    <div className="wrap">
      <div className="top">
        {QUA_CONG && <a className="nha" href="/" title="Về trang chủ">⌂</a>}
        <div>
          <h1>Chi tiêu thẻ tín dụng</h1>
          <div className="sub">{ky ? `${ky.length} kỳ sao kê đã lưu` : 'Đang tải…'}{CHE_DO_THU && ' · CHẾ ĐỘ THỬ trên máy, dữ liệu chỉ nằm trong trình duyệt'}</div>
        </div>
        <div className="phai">
          {user && <span className="sub">{user.email}</span>}
          {user && <button className="chip" onClick={() => dangXuat()}>Đăng xuất</button>}
        </div>
      </div>
      <div className="tabs">
        {([['ky', 'Theo kỳ'], ['nam', 'Theo năm'], ['tai', 'Tải sao kê'], ['ds', 'Các kỳ đã lưu'], ['ai', 'Kết nối AI']] as [Tab, string][]).map(([t, ten]) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{ten}</button>
        ))}
      </div>
      {loi && <div className="loi">{loi}</div>}
      {ky && kho && (
        <>
          {tab === 'ky' && <TongQuan ky={ky} doiNhom={doiNhom} />}
          {tab === 'nam' && <TheoNam ky={ky} doiNhom={doiNhom} />}
          {tab === 'tai' && (
            <TaiLen daCo={ky} luu={async (k, file) => {
              const da = await kho.luu(k)
              await kho.luuPdf(k.id, file).catch((e) => setLoi('Đã lưu số liệu, nhưng cất file gốc lỗi: ' + e.message))
              setKy((ds) => [...(ds ?? []).filter((x) => x.id !== da.id), da].sort((a, b) => a.tu.localeCompare(b.tu)))
            }} />
          )}
          {tab === 'ds' && (
            <CacKy ky={ky}
              moPdf={async (id) => { const u = await kho.moPdf(id); if (u) window.open(u, '_blank'); else setLoi('Không mở được file gốc của kỳ này') }}
              xoa={async (k) => { await kho.xoa(k.id); setKy(ky.filter((x) => x.id !== k.id)) }} />
          )}
        </>
      )}
      {tab === 'ai' && <QuanLyKetNoi layVe={CHE_DO_THU ? null : layVe} />}
      <footer>(C) August87 - 0982722036</footer>
    </div>
  )
}

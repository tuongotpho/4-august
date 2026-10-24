import { useMemo, useState } from 'react'
import { luuLop, useGoiY, xoaLop } from '../lib/hooks'
import {
  congNgay, doanBuoi, docTien, dinhDangTien, GIO_MAC_DINH, homNay, ngayVN, TEN_BUOI, TEN_TRANG_THAI, thu, trangThai, type Buoi, type LopGiang,
} from '../lib/model'
import { lanTruoc, lienHeGanDay, mucTienHayGap, timTrung, trungGio } from '../lib/tinh'

interface Props {
  lop: LopGiang
  tatCa: LopGiang[]
  moi?: boolean
  onDong: () => void
}

/** Nút chọn nhanh (chạm thay vì gõ — dùng nhiều trên điện thoại) */
function Chip({ chon, onClick, children }: { chon?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm ${chon ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300 bg-white text-slate-700 active:bg-slate-100'}`}
    >
      {children}
    </button>
  )
}

// điện thoại: một hàng vuốt ngang; máy tính (chuột không vuốt được): xuống dòng cho thấy hết
const Hang = ({ children }: { children: React.ReactNode }) => <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">{children}</div>

const trieu = (n: number) => (n % 1_000_000 === 0 ? `${n / 1_000_000}tr` : n >= 1_000_000 ? `${Math.floor(n / 1_000_000)}tr${String((n % 1_000_000) / 1000).replace(/0+$/, '')}` : `${n / 1000}k`)

/** Thêm / sửa một lớp giảng. Điện thoại: chiếm cả màn hình, nút Lưu luôn ở đáy; máy tính: cửa sổ nổi. */
export default function SuaLop({ lop, tatCa, moi, onDong }: Props) {
  const [l, setL] = useState<LopGiang>(lop)
  const [tien, setTien] = useState(l.chiPhi === null ? '' : dinhDangTien(l.chiPhi))
  const [dangLuu, setDangLuu] = useState(false)
  const [loi, setLoi] = useState('')
  const [chiTiet, setChiTiet] = useState(!moi || !!(l.noiDung || l.ghiChu || l.tinGoc))
  const [goiYTruoc, setGoiYTruoc] = useState('')
  const gy = useGoiY(tatCa)
  const ganDay = useMemo(() => lienHeGanDay(tatCa), [tatCa])
  const mucTien = useMemo(() => mucTienHayGap(tatCa), [tatCa])
  const dat = (p: Partial<LopGiang>) => setL((x) => ({ ...x, ...p }))
  const hn = homNay()
  const ngayNhanh = Array.from({ length: 8 }, (_, i) => congNgay(hn, i))

  const canhBao = useMemo(() => {
    const ds: string[] = []
    const t = timTrung(tatCa, l)
    if (t) ds.push(`Có thể trùng lớp đã có: ${t.khachHang} (${ngayVN(t.ngay)})`)
    for (const x of trungGio(tatCa, l)) if (x.id !== t?.id) ds.push(`Trùng giờ với lớp ${x.khachHang} ${x.gioBD}–${x.gioKT}`)
    return ds
  }, [tatCa, l])

  function doiGio(p: Partial<Pick<LopGiang, 'gioBD' | 'gioKT'>>) {
    const n = { ...l, ...p }
    dat({ ...p, buoi: doanBuoi(n.gioBD, n.gioKT, n.soNgay) })
  }

  /** Chọn buổi = điền luôn giờ chuẩn của buổi đó (sửa lại giờ nếu khác) */
  function doiBuoi(b: Buoi) {
    const [bd, kt] = GIO_MAC_DINH[b]
    dat({ buoi: b, soNgay: b === 'nhieu_ngay' ? Math.max(2, l.soNgay) : 1, gioBD: bd, gioKT: kt })
  }

  /** Chọn người liên hệ -> điền đối tác, hình thức, thù lao như lần gần nhất với người này */
  function chonLienHe(ten: string) {
    const truoc = lanTruoc(tatCa, ten)
    const lh = gy.lienHe.find((x) => x.ten === ten)
    const p: Partial<LopGiang> = { lienHe: ten }
    const da: string[] = []
    const doiTac = truoc?.doiTac || lh?.doiTac
    if (doiTac && !l.doiTac) (p.doiTac = doiTac), da.push(doiTac)
    if (truoc) {
      if (moi) (p.hinhThuc = truoc.hinhThuc), da.push(truoc.hinhThuc === 'online' ? 'online' : 'trực tiếp')
      if (!tien.trim() && truoc.chiPhi !== null) {
        setTien(dinhDangTien(truoc.chiPhi))
        da.push(`${dinhDangTien(truoc.chiPhi)} đ`)
      }
    }
    dat(p)
    setGoiYTruoc(truoc && da.length ? `Điền như lần trước (${ngayVN(truoc.ngay)}): ${da.join(' · ')}` : '')
  }

  async function luu() {
    if (!l.khachHang.trim()) return setLoi('Nhập tên khách hàng (đơn vị được đào tạo)')
    const chiPhi = tien.trim() ? docTien(tien) : null
    if (tien.trim() && chiPhi === null) return setLoi('Thù lao không hiểu được — gõ số, vd 1500000 hoặc 1tr5')
    setDangLuu(true)
    try {
      const doiLich = moi || ['ngay', 'soNgay', 'gioBD', 'gioKT', 'khachHang', 'doiTac', 'lienHe', 'diaDiem', 'noiDung', 'hinhThuc', 'huy', 'ghiChu']
        .some((k) => l[k as keyof LopGiang] !== lop[k as keyof LopGiang]) || chiPhi !== lop.chiPhi
      await luuLop({ ...l, khachHang: l.khachHang.trim(), chiPhi, ngayTT: l.thanhToan === 'da' ? l.ngayTT || homNay() : '' }, doiLich)
      onDong()
    } catch (e) {
      setLoi((e as Error).message)
      setDangLuu(false)
    }
  }

  async function xoa() {
    if (!confirm(`Xoá hẳn lớp "${l.khachHang}" ngày ${ngayVN(l.ngay)}? (Muốn giữ lại để tra cứu thì đánh dấu "Lớp bị hủy")`)) return
    await xoaLop(lop)
    onDong()
  }

  const tt = trangThai({ ...l, chiPhi: tien.trim() ? docTien(tien) : null })

  return (
    <div className="fixed inset-0 z-40 flex justify-center bg-black/40 sm:items-start sm:overflow-y-auto sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onDong()}>
      <div className="flex h-full w-full max-w-2xl flex-col bg-white sm:h-auto sm:rounded-lg sm:shadow-xl">
        <header className="flex items-center gap-2 border-b border-slate-200 px-2 py-2 sm:px-4">
          <button className="rounded px-2 py-1 text-xl text-slate-500" onClick={onDong} aria-label="Đóng">←</button>
          <h2 className="flex-1 text-lg font-semibold text-slate-800">{moi ? 'Thêm lớp' : 'Sửa lớp'}</h2>
          <span className="chip bg-slate-100 text-slate-600">{TEN_TRANG_THAI[tt]}</span>
        </header>

        <datalist id="dl-doitac">{gy.doiTac.map((x) => <option key={x} value={x} />)}</datalist>
        <datalist id="dl-lienhe">{gy.lienHe.map((x) => <option key={x.ten} value={x.ten}>{x.doiTac}</option>)}</datalist>
        <datalist id="dl-khach">{gy.khachHang.slice(0, 300).map((x) => <option key={x} value={x} />)}</datalist>
        <datalist id="dl-diadiem">{gy.diaDiem.map((x) => <option key={x} value={x} />)}</datalist>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
          {/* ----- Khi nào ----- */}
          <section className="space-y-2">
            <span className="lbl">Ngày giảng — {thu(l.ngay)} {ngayVN(l.ngay)}</span>
            <Hang>
              {ngayNhanh.map((n, i) => (
                <Chip key={n} chon={l.ngay === n} onClick={() => dat({ ngay: n })}>
                  {i === 0 ? 'Hôm nay' : i === 1 ? 'Mai' : `${thu(n)} ${ngayVN(n, false)}`}
                </Chip>
              ))}
              <label className={`relative shrink-0 rounded-full border px-3 py-1.5 text-sm ${ngayNhanh.includes(l.ngay) ? 'border-slate-300 text-slate-700' : 'border-teal-700 bg-teal-700 text-white'}`}>
                📅 {ngayNhanh.includes(l.ngay) ? 'Ngày khác' : ngayVN(l.ngay, false)}
                <input type="date" className="absolute inset-0 cursor-pointer opacity-0" onClick={(e) => e.currentTarget.showPicker?.()} value={l.ngay} onChange={(e) => e.target.value && dat({ ngay: e.target.value })} />
              </label>
            </Hang>
            <Hang>
              {(Object.keys(TEN_BUOI) as Buoi[]).map((b) => <Chip key={b} chon={l.buoi === b} onClick={() => doiBuoi(b)}>{TEN_BUOI[b]}</Chip>)}
            </Hang>
            <div className="flex items-center gap-2">
              <input type="time" className="inp !w-32" value={l.gioBD} onChange={(e) => doiGio({ gioBD: e.target.value })} aria-label="Từ giờ" />
              <span className="text-slate-400">→</span>
              <input type="time" className="inp !w-32" value={l.gioKT} onChange={(e) => doiGio({ gioKT: e.target.value })} aria-label="Đến giờ" />
              {l.buoi === 'nhieu_ngay' && (
                <label className="flex items-center gap-1 text-sm">
                  <input type="number" inputMode="numeric" min={2} max={30} className="inp !w-16" value={l.soNgay} onChange={(e) => dat({ soNgay: Math.max(1, Number(e.target.value) || 1) })} /> ngày
                </label>
              )}
            </div>
          </section>

          {/* ----- Ai mời, dạy ở đâu ----- */}
          <section className="space-y-2">
            <span className="lbl">Người liên hệ</span>
            {ganDay.length > 0 && (
              <Hang>
                {ganDay.map((x) => (
                  <Chip key={x.ten} chon={l.lienHe === x.ten} onClick={() => chonLienHe(x.ten)}>
                    {x.ten}{x.doiTac && <span className="opacity-60"> · {x.doiTac}</span>}
                  </Chip>
                ))}
              </Hang>
            )}
            <div className="grid grid-cols-2 gap-2">
              <input className="inp" list="dl-lienhe" placeholder="Tên khác…" value={l.lienHe} onChange={(e) => dat({ lienHe: e.target.value })} onBlur={(e) => e.target.value && e.target.value !== lop.lienHe && chonLienHe(e.target.value)} />
              <input className="inp" list="dl-doitac" placeholder="Đối tác" value={l.doiTac} onChange={(e) => dat({ doiTac: e.target.value })} />
            </div>
            {goiYTruoc && <p className="text-xs text-teal-700">✓ {goiYTruoc}</p>}
          </section>

          <section className="space-y-2">
            <label className="block">
              <span className="lbl">Khách hàng (đơn vị được đào tạo) *</span>
              <input className="inp" list="dl-khach" enterKeyHint="next" autoCapitalize="words" value={l.khachHang} onChange={(e) => dat({ khachHang: e.target.value })} />
            </label>
            <Hang>
              <Chip chon={l.hinhThuc === 'truc_tiep'} onClick={() => dat({ hinhThuc: 'truc_tiep', ...(l.diaDiem === 'Online' ? { diaDiem: '' } : {}) })}>🏢 Trực tiếp</Chip>
              <Chip chon={l.hinhThuc === 'online'} onClick={() => dat({ hinhThuc: 'online', diaDiem: 'Online' })}>💻 Online</Chip>
              {l.hinhThuc === 'truc_tiep' && gy.diaDiem.filter((d) => d !== 'Online').slice(0, 5).map((d) => (
                <Chip key={d} chon={l.diaDiem === d} onClick={() => dat({ diaDiem: d })}>{d}</Chip>
              ))}
            </Hang>
            {l.hinhThuc === 'truc_tiep' && (
              <input className="inp" list="dl-diadiem" placeholder="Địa điểm (tỉnh / địa chỉ)" value={l.diaDiem} onChange={(e) => dat({ diaDiem: e.target.value })} />
            )}
          </section>

          {/* ----- Tiền ----- */}
          <section className="space-y-2">
            <span className="lbl">Thù lao</span>
            <Hang>
              {mucTien.map((m) => (
                <Chip key={m} chon={docTien(tien) === m} onClick={() => setTien(dinhDangTien(m))}>{trieu(m)}</Chip>
              ))}
            </Hang>
            <div className="flex items-center gap-2">
              <input
                className="inp !w-44"
                inputMode="decimal"
                placeholder="vd 1tr5, 1500000"
                value={tien}
                onChange={(e) => setTien(e.target.value)}
                onBlur={() => { const n = docTien(tien); if (n !== null) setTien(dinhDangTien(n)) }}
              />
              <span className="text-sm text-slate-500">đ</span>
              {!moi && (
                <label className="ml-auto flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-5 w-5" checked={l.thanhToan === 'da'} onChange={(e) => dat({ thanhToan: e.target.checked ? 'da' : 'chua', ngayTT: e.target.checked ? l.ngayTT || homNay() : '' })} />
                  Đã nhận tiền
                </label>
              )}
            </div>
            {l.thanhToan === 'da' && (
              <label className="flex items-center gap-2 text-sm">
                Ngày nhận <input type="date" className="inp !w-44" value={l.ngayTT} onChange={(e) => dat({ ngayTT: e.target.value })} />
              </label>
            )}
          </section>

          {/* ----- Ít dùng: gập lại khi thêm mới ----- */}
          {!chiTiet ? (
            <button className="text-sm text-teal-700" onClick={() => setChiTiet(true)}>+ Nội dung, ghi chú…</button>
          ) : (
            <section className="space-y-2">
              <label className="block">
                <span className="lbl">Nội dung / chủ đề</span>
                <input className="inp" value={l.noiDung} onChange={(e) => dat({ noiDung: e.target.value })} placeholder="vd: nhóm 3, làm việc trên cao…" />
              </label>
              <label className="block">
                <span className="lbl">Ghi chú</span>
                <textarea className="inp h-16" value={l.ghiChu} onChange={(e) => dat({ ghiChu: e.target.value })} />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" className="h-5 w-5" checked={l.huy} onChange={(e) => dat({ huy: e.target.checked })} /> Lớp bị hủy
              </label>
              {l.tinGoc && (
                <details className="text-xs text-slate-500">
                  <summary className="cursor-pointer">Tin nhắn gốc</summary>
                  <pre className="mt-1 whitespace-pre-wrap rounded bg-slate-50 p-2 font-sans">{l.tinGoc}</pre>
                </details>
              )}
            </section>
          )}

          {canhBao.map((c) => <p key={c} className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">⚠️ {c}</p>)}
        </div>

        <footer className="space-y-1 border-t border-slate-200 px-4 py-2" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
          {loi && <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">{loi}</p>}
          <div className="flex items-center gap-2">
            {!moi && <button className="btn-danger !py-2.5" onClick={() => void xoa()}>Xoá</button>}
            {l.eventId && <span className="text-xs text-slate-400">📅 có trên Google Calendar</span>}
            <button className="btn-primary ml-auto min-w-32 !py-2.5 !text-base" disabled={dangLuu} onClick={() => void luu()}>{dangLuu ? 'Đang lưu…' : 'Lưu'}</button>
          </div>
        </footer>
      </div>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { dossiersToCsv } from '../lib/csv'
import { fmtDate, today } from '../lib/dates'
import { sapXep, XEP_MAC_DINH, type CachXep, type KieuXep } from '../lib/status'
import { docLaiDiaChi, docLaiHoSoTrong, emptyDossier, filesToInvoices, laDiaChiCut, laHoSoTrong } from '../lib/dossierOps'
import { downloadBlob, useDossiers, useRuiRo, useSettings } from '../lib/hooks'
import { traHoaDon } from '../lib/ruiRo'
import { formatMoney } from '../lib/numberToWords'
import {
  firstInvoiceDate, nhanTrangThai, STATUS_COLOR, STATUS_LABEL, statusOf, suggestDnttDate, suggestToTrinhDate, totalOf, waitingDays, warningsOf,
  type StatusKey,
} from '../lib/status'
import { SuaNgay, SuaNguoiTT, SuaNoiDung, SuaTrangThai, useSuaNhanh } from './SuaNhanh'
import { dangLoc, demTag, hopKy, hopTrangThai, hopTuKhoa, LOC_MAC_DINH, locHoSo, namCoHoSo, nhomTheoThang, type BoLoc, type LocTrangThai } from '../lib/locHoSo'
import { KHONG_TAG, TAG_MAC_DINH } from '../lib/hashtag'
import { store } from '../lib/store'
import type { Dossier } from '../lib/types'
import FileDrop from './FileDrop'
import GanTagHangLoat from './GanTagHangLoat'
import NhapHoaDonCu from './NhapHoaDonCu'
import SuaNgayHangLoat from './SuaNgayHangLoat'
import { banDoThayThe } from '../lib/thayThe'
import { CHUA_RO_TINH, demTinh, tinhHoSo } from '../lib/tinh'
import { TagChips } from './TagChips'
import { bao, hoi } from '../lib/dialog'

// Ô trạng thái ở đầu trang (bỏ "Chưa có hóa đơn" theo yêu cầu — hồ sơ chưa có HĐ vẫn hiện ở bộ lọc "Tất cả")
const ORDER: StatusKey[] = ['choLamHs', 'choNop', 'choKt', 'daTt']

// Bộ lọc nhớ trên máy này cho lần mở sau (trừ ô tìm kiếm)
function docBoLoc(): BoLoc {
  try {
    return { ...LOC_MAC_DINH, ...JSON.parse(localStorage.getItem('hoadon-loc') ?? '{}'), q: '' }
  } catch {
    return LOC_MAC_DINH
  }
}

/** onOpen(id, ds): ds = thứ tự hồ sơ đang hiện, để màn hồ sơ có nút "‹ Trước / Sau ›". */
export default function DossierList({ onOpen }: { onOpen: (id: string, ds?: string[]) => void }) {
  const list = useDossiers()
  const settings = useSettings()
  const ruiRo = useRuiRo().bang
  const [loc, setLocState] = useState<BoLoc>(docBoLoc)
  const setLoc = (p: Partial<BoLoc>) =>
    setLocState((cu) => {
      const moi = { ...cu, ...p }
      try {
        const { q: _q, ...nho } = moi
        localStorage.setItem('hoadon-loc', JSON.stringify(nho))
      } catch {}
      return moi
    })
  const [nhapCu, setNhapCu] = useState(false)
  const [chon, setChon] = useState<Set<string>>(new Set()) // hồ sơ đang được chọn (để sửa / xóa hàng loạt)
  const [dangLam, setDangLam] = useState('') // tiến độ xóa / đọc lại
  const [suaNgay, setSuaNgay] = useState(false)
  const [ganTag, setGanTag] = useState(false)
  // cách xếp: mặc định ngày HĐ mới nhất trên cùng; nhớ lựa chọn cho lần mở sau (chỉ trên máy này)
  const [xep, setXepState] = useState<CachXep>(() => {
    try {
      return { ...XEP_MAC_DINH, ...JSON.parse(localStorage.getItem('hoadon-xep') ?? '{}') }
    } catch {
      return XEP_MAC_DINH
    }
  })
  const setXep = (c: CachXep) => {
    setXepState(c)
    try {
      localStorage.setItem('hoadon-xep', JSON.stringify(c))
    } catch {}
  }
  // bấm tiêu đề cột: cùng cột thì đảo chiều, cột khác thì xếp giảm dần
  const bamCot = (theo: KieuXep) => setXep(xep.theo === theo ? { theo, giam: !xep.giam } : { theo, giam: true })
  const muiTen = (theo: KieuXep) => (xep.theo === theo ? (xep.giam ? ' ▼' : ' ▲') : '')
  const [busy, setBusy] = useState(false)
  const oTim = useRef<HTMLInputElement>(null)
  // ô trống trên thanh menu (App.tsx) để gắn nút Xuất Excel / Nhập HĐ cũ / Hồ sơ mới
  const [slotMenu, setSlotMenu] = useState<HTMLElement | null>(null)
  useEffect(() => setSlotMenu(document.getElementById('cong-cu-trang')), [])

  // Phím "/" = nhảy vào ô tìm kiếm
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(t.tagName)) {
        e.preventDefault()
        oTim.current?.focus()
      }
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [])

  const thayThe = useMemo(() => banDoThayThe(list ?? []), [list])

  // Ô trạng thái đếm theo kỳ + tag + từ khoá đang lọc (không theo trạng thái — để bấm đổi trạng thái)
  const stats = useMemo(() => {
    const m = Object.fromEntries(ORDER.map((k) => [k, { n: 0, tien: 0 }])) as Record<StatusKey, { n: number; tien: number }>
    for (const d of locHoSo(list ?? [], { ...loc, trangThai: 'all' })) {
      const s = statusOf(d)
      if (!m[s]) continue // trạng thái không có ô (chưa có hóa đơn)
      m[s].n++
      m[s].tien += totalOf(d)
    }
    return m
  }, [list, loc])

  // Hàng tag đếm theo bộ lọc khác (không theo tag) — để bấm đổi tag
  const tagStats = useMemo(
    () => demTag((list ?? []).filter((d) => hopTrangThai(d, loc.trangThai) && hopKy(d, loc.nam, loc.thang) && hopTuKhoa(d, loc.q))),
    [list, loc],
  )
  const years = useMemo(() => namCoHoSo(list ?? []), [list])
  const dsTinh = useMemo(() => demTinh((list ?? []).flatMap((d) => d.invoices)), [list])

  const shown = useMemo(() => sapXep(locHoSo(list ?? [], loc), xep), [list, loc, xep])
  const tongShown = useMemo(() => shown.reduce((a, d) => a + totalOf(d), 0), [shown])
  // xếp theo ngày HĐ thì chia nhóm theo tháng, mỗi tháng có dòng cộng tiền
  const nhom = useMemo(() => (xep.theo === 'ngayHd' ? nhomTheoThang(shown) : [{ khoa: '*', nhan: '', ds: shown, tongTien: tongShown }]), [shown, xep.theo, tongShown])
  const moHoSo = (id: string) => onOpen(id, shown.map((d) => d.id))

  // Sửa nhanh ngay trên bảng (ô thả xuống) — dùng chung với Bảng kê ở trang Tổng hợp
  const { luu: luuNhanh, tagDangDung, dsNguoiTT } = useSuaNhanh(list, settings)

  async function createNew(files: File[] = []) {
    setBusy(true)
    try {
      const d = emptyDossier()
      // người đề nghị / nhiệm vụ: lấy theo hồ sơ gần nhất, chưa có thì lấy cái đầu danh sách
      d.nguoiDeNghi = list?.[0]?.nguoiDeNghi || settings.dsNguoiDeNghi[0] || ''
      d.nhiemVu = list?.[0]?.nhiemVu || settings.dsNhiemVu[0] || ''
      // đang lọc theo 1 việc thì hồ sơ mới gắn sẵn tag đó
      if (loc.tag && loc.tag !== KHONG_TAG) d.tags = [loc.tag]
      if (files.length) {
        const { invoices, errors, notes } = await filesToInvoices(files)
        d.invoices = invoices
        d.ngayToTrinh = suggestToTrinhDate(d, settings)
        const msg = [...notes, ...errors.map((e) => '⚠ ' + e)]
        if (msg.length) void bao(msg.join('\n'))
      }
      await store.saveDossier(d)
      onOpen(d.id)
    } finally {
      setBusy(false)
    }
  }

  async function quickSet(d: Dossier, field: 'ngayNopKeToan' | 'ngayKeToanTt') {
    await store.saveDossier({ ...d, [field]: today(), updatedAt: Date.now() })
  }

  const soTrong = (list ?? []).filter(laHoSoTrong).length
  const soDiaChiCut = (list ?? []).reduce((a, d) => a + d.invoices.filter(laDiaChiCut).length, 0)
  const daChon = (list ?? []).filter((d) => chon.has(d.id))

  async function xoaDaChon() {
    const ds = daChon
    const ok = await hoi(
      `Xóa HẲN ${ds.length} hồ sơ đã chọn cùng file hóa đơn đính kèm?
Tổng tiền: ${formatMoney(ds.reduce((a, d) => a + totalOf(d), 0))} đ

Không lấy lại được (trừ khi có bản sao lưu .zip).`,
      { okLabel: `Xóa ${ds.length} hồ sơ`, nguyHiem: true },
    )
    if (!ok) return
    let n = 0
    for (const d of ds) {
      setDangLam(`Đang xóa ${++n}/${ds.length}…`)
      await store.deleteDossier(d.id)
    }
    setChon(new Set())
    setDangLam('')
    void bao(`Đã xóa ${ds.length} hồ sơ.`)
  }

  async function docLai() {
    try {
      const kq = await docLaiHoSoTrong((x, t) => setDangLam(`Đang đọc lại ${x}/${t} hồ sơ…`))
      setDangLam('')
      const ok = kq.filter((k) => !k.loi)
      const loi = kq.filter((k) => k.loi)
      const trung = kq.filter((k) => k.trungVoi)
      const dong = [`Đã đọc lại ${ok.length}/${kq.length} hồ sơ · ${formatMoney(ok.reduce((a, k) => a + k.tongTien, 0))} đ`]
      if (trung.length) {
        dong.push(`⚠ ${trung.length} hồ sơ TRÙNG (cùng số + ngày + MST) với hồ sơ đã có — xem và xóa bớt: ${trung.map((k) => 'HĐ ' + k.soHd).join(', ')}`)
      }
      if (loi.length) dong.push(`⚠ Chưa đọc được ${loi.length}:`, ...loi.map((k) => `• ${k.tenFile}: ${k.loi}`))
      void bao(dong.join('\n'))
    } catch (e) {
      setDangLam('')
      void bao((e as Error).message)
    }
  }

  async function docLaiDc() {
    try {
      const { sua, tong } = await docLaiDiaChi((x, t) => setDangLam(`Đang đọc lại địa chỉ ${x}/${t} hóa đơn…`))
      setDangLam('')
      void bao(
        `Đã sửa địa chỉ ${sua}/${tong} hóa đơn.` +
          (sua < tong ? `\n${tong - sua} hóa đơn vẫn chưa ra tỉnh (file không ghi tỉnh / mẫu lạ) — mở hồ sơ để sửa ô "Địa chỉ" bằng tay.` : ''),
      )
    } catch (e) {
      setDangLam('')
      void bao((e as Error).message)
    }
  }

  const doiChon = (id: string, co: boolean) => {
    const n = new Set(chon)
    if (co) n.add(id)
    else n.delete(id)
    setChon(n)
  }

  if (nhapCu) return <NhapHoaDonCu onClose={() => setNhapCu(false)} onOpen={onOpen} />

  if (!list) return <p className="text-slate-500">Đang tải…</p>

  const nutNhanh = (d: Dossier, st: StatusKey) =>
    st === 'choNop' && !d.ngayNopKeToan ? (
      <button className="text-xs text-blue-600 hover:underline" onClick={() => quickSet(d, 'ngayNopKeToan')}>Đã nộp hôm nay</button>
    ) : st === 'choKt' && !d.ngayKeToanTt ? (
      <button className="text-xs text-blue-600 hover:underline" onClick={() => quickSet(d, 'ngayKeToanTt')}>Đã nhận tiền hôm nay</button>
    ) : null

  const nutThaoTac = (
    <>
      <button className="btn" onClick={() => downloadBlob(dossiersToCsv(shown), `So theo doi hoa don ${today()}.csv`)} title="Xuất các hồ sơ đang hiện ra file Excel (CSV)">
        ⬇ Xuất Excel
      </button>
      <button className="btn" onClick={() => setNhapCu(true)} title="Thả nhiều hóa đơn cũ vào kho, chỉ cần số tiền + tình trạng thanh toán">
        📥 Nhập HĐ cũ
      </button>
      <button className="btn-primary" onClick={() => createNew()} disabled={busy}>
        + Hồ sơ mới
      </button>
    </>
  )

  const noiDungHs = (d: Dossier) => d.noiDung || (d.hoSoCu ? d.invoices[0]?.tenNguoiBan : '') || <i className="text-slate-400">(chưa đặt nội dung)</i>

  return (
    <div className="space-y-4">
      {/* Thẻ tổng hợp theo trạng thái (đếm theo kỳ / việc / từ khoá đang lọc) */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {ORDER.map((k) => (
          <button
            key={k}
            onClick={() => setLoc({ trangThai: loc.trangThai === k ? 'chuaXong' : k })}
            className={`card !px-3 !py-2 text-left transition hover:border-blue-400 ${loc.trangThai === k ? 'ring-2 ring-blue-500' : ''}`}
          >
            <div className="truncate text-xs font-medium text-slate-500">{STATUS_LABEL[k]}</div>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-xl font-bold text-slate-800">{stats[k].n}</span>
              <span className="text-xs text-slate-500">{formatMoney(stats[k].tien)} đ</span>
            </div>
          </button>
        ))}
        {/* Ô thứ 5: thả file hóa đơn để tạo hồ sơ mới (rê chuột xem hướng dẫn) */}
        <FileDrop
          onFiles={(f) => createNew(f)}
          accept=".xml,.pdf,image/*"
          className="col-span-2 flex items-center justify-center !px-3 !py-2 md:col-span-1"
        >
          <span title="File XML / PDF hóa đơn điện tử được tự điền thông tin; ảnh chụp thì nhập tay. Chọn nhiều file cùng lúc = nhiều hóa đơn trong 1 hồ sơ.">
            {busy ? (
              <span className="text-slate-500">Đang đọc hóa đơn…</span>
            ) : (
              <>
                <b className="text-blue-700">📥 Thả file hóa đơn</b>
                <span className="block text-xs text-slate-500">hoặc bấm để chọn · tạo hồ sơ mới</span>
              </>
            )}
          </span>
        </FileDrop>
      </div>

      {/* Bộ lọc + hashtag + nút thao tác chung 1 khối, tự xuống dòng khi hẹp (máy tính thường 1–2 dòng) */}
      <div className="card flex flex-wrap items-center gap-2 !p-2.5">
          <div className="relative w-full sm:w-56">
            <input
              ref={oTim}
              className="inp pr-8"
              placeholder="Tìm nội dung, người bán, số HĐ… (phím /)"
              value={loc.q}
              onChange={(e) => setLoc({ q: e.target.value })}
              onKeyDown={(e) => e.key === 'Escape' && setLoc({ q: '' })}
            />
            {loc.q && (
              <button className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded px-1.5 text-slate-400 hover:text-slate-700" title="Xóa ô tìm" onClick={() => setLoc({ q: '' })}>
                ✕
              </button>
            )}
          </div>
          <select className="inp w-auto" value={loc.trangThai} onChange={(e) => setLoc({ trangThai: e.target.value as LocTrangThai })}>
            <option value="chuaXong">Chưa thanh toán xong</option>
            <option value="all">Tất cả trạng thái</option>
            <option value="cu">Hóa đơn cũ (nhập vào kho)</option>
            {ORDER.map((k) => (
              <option key={k} value={k}>
                {STATUS_LABEL[k]}
              </option>
            ))}
          </select>
          <select
            className="inp w-auto"
            title="Năm của ngày hóa đơn"
            value={loc.nam}
            onChange={(e) => setLoc({ nam: e.target.value === 'all' ? 'all' : Number(e.target.value), thang: 'all' })}
          >
            <option value="all">Mọi năm</option>
            {years.map((y) => <option key={y} value={y}>Năm {y}</option>)}
          </select>
          {loc.nam !== 'all' && (
            <select className="inp w-auto" value={loc.thang} onChange={(e) => setLoc({ thang: e.target.value === 'all' ? 'all' : Number(e.target.value) })}>
              <option value="all">Cả năm</option>
              {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>Tháng {i + 1}</option>)}
            </select>
          )}
          <select className="inp w-auto max-w-[11rem]" title="Tỉnh của người bán (theo địa chỉ trên hóa đơn)" value={loc.tinh ?? ''} onChange={(e) => setLoc({ tinh: e.target.value || null })}>
            <option value="">Mọi tỉnh</option>
            {dsTinh.map((t) => <option key={t.tinh} value={t.tinh}>{t.tinh} ({t.soHd})</option>)}
          </select>
          <select
            className="inp w-auto"
            title="Thứ tự hiển thị"
            value={`${xep.theo}-${xep.giam ? 'giam' : 'tang'}`}
            onChange={(e) => {
              const [theo, chieu] = e.target.value.split('-')
              setXep({ theo: theo as KieuXep, giam: chieu === 'giam' })
            }}
          >
            <option value="ngayHd-giam">Xếp: HĐ mới nhất</option>
            <option value="ngayHd-tang">Xếp: HĐ cũ nhất</option>
            <option value="tongTien-giam">Xếp: tiền nhiều nhất</option>
            <option value="tongTien-tang">Xếp: tiền ít nhất</option>
            <option value="capNhat-giam">Xếp: mới sửa</option>
          </select>

        {/* Lọc theo việc (hashtag): bấm để lọc, bấm lại để bỏ */}
        {tagStats.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 max-sm:w-full sm:flex-wrap sm:overflow-visible sm:pb-0 lg:border-l lg:border-slate-200 lg:pl-2">
            <button
              onClick={() => setLoc({ tag: null })}
              className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${!loc.tag ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              Mọi việc
            </button>
            {tagStats.map((t) => (
              <button
                key={t.ma}
                title={`${TAG_MAC_DINH.find((x) => x.ma === t.ma)?.ten ?? ''} · ${formatMoney(t.tongTien)} đ`.replace(/^ · /, '')}
                onClick={() => setLoc({ tag: loc.tag === t.ma ? null : t.ma })}
                className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${
                  loc.tag === t.ma ? 'border-indigo-600 bg-indigo-600 text-white' : t.ma === KHONG_TAG ? 'border-dashed border-slate-300 bg-white text-slate-500 hover:bg-slate-50' : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                }`}
              >
                {t.ma === KHONG_TAG ? t.ma : `#${t.ma}`} <span className="opacity-70">{t.soHoSo}</span>
              </button>
            ))}
          </div>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
          <span className="whitespace-nowrap text-slate-600">
            <b className="text-slate-800">{shown.length}</b> hồ sơ · <b className="text-slate-800">{formatMoney(tongShown)} đ</b>
          </span>
          {dangLoc(loc) && (
            <button className="text-xs text-blue-600 hover:underline" onClick={() => setLoc(LOC_MAC_DINH)}>
              ✕ Bỏ lọc
            </button>
          )}
          {/* điện thoại: nút nằm ở đây; máy tính: lên thanh menu trên cùng */}
          <div className="flex flex-wrap gap-2 sm:hidden">{nutThaoTac}</div>
          {slotMenu && createPortal(nutThaoTac, slotMenu)}
        </div>
      </div>

      {soTrong > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <span>
            ⚠ Có <b>{soTrong} hồ sơ chưa có số tiền</b> (0 đ) nhưng file hóa đơn đã đính kèm — đọc lại từ file để điền tự động, không cần tải lên lại.
          </span>
          <button className="btn-primary !py-1" disabled={!!dangLam} onClick={docLai}>
            ↻ Đọc lại từ file đính kèm
          </button>
          <button className="text-xs hover:underline" onClick={() => setChon(new Set((list ?? []).filter(laHoSoTrong).map((d) => d.id)))}>
            Chọn hết các hồ sơ trống
          </button>
        </div>
      )}

      {soDiaChiCut > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-700">
          <span>
            Có <b>{soDiaChiCut} hóa đơn chưa rõ tỉnh</b> mà có file đính kèm (địa chỉ có thể bị cụt do bộ đọc PDF cũ) — đọc lại địa chỉ từ file, các ô khác giữ nguyên.
          </span>
          <button className="btn !py-1" disabled={!!dangLam} onClick={docLaiDc}>
            ↻ Đọc lại địa chỉ
          </button>
        </div>
      )}

      {/* Thanh thao tác hàng loạt: ghim trên thanh tab dưới đáy (điện thoại) / dưới đầu trang (máy tính) khi cuộn */}
      {(chon.size > 0 || dangLam) && (
        <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 flex flex-wrap items-center gap-2 rounded-lg border border-blue-300 bg-blue-50/95 p-2.5 text-sm text-blue-900 shadow-md backdrop-blur sm:bottom-auto sm:top-[4.25rem]">
          {dangLam ? (
            <span className="font-medium">{dangLam}</span>
          ) : (
            <>
              <span>
                Đã chọn <b>{chon.size}</b> hồ sơ · {formatMoney(daChon.reduce((a, d) => a + totalOf(d), 0))} đ
              </span>
              <button className="text-xs hover:underline" onClick={() => setChon(new Set())}>
                Bỏ chọn
              </button>
              <div className="ml-auto flex flex-wrap gap-2">
                <button className="btn !py-1" onClick={() => setGanTag(true)}>
                  🏷 Gắn tag
                </button>
                <button className="btn !py-1" onClick={() => setSuaNgay(true)}>
                  📅 Sửa ngày
                </button>
                <button className="btn-danger !bg-red-600 !py-1 !text-white" onClick={xoaDaChon}>
                  🗑 Xóa {chon.size}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {suaNgay && <SuaNgayHangLoat ids={[...chon]} onClose={() => setSuaNgay(false)} />}
      {ganTag && <GanTagHangLoat ds={daChon} tatCa={list} onClose={() => setGanTag(false)} />}

      {shown.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-8 text-center text-sm text-slate-400">
          {list.length === 0 ? 'Chưa có hồ sơ nào. Kéo thả file hóa đơn vào ô phía trên để bắt đầu.' : (
            <>
              Không có hồ sơ khớp bộ lọc.{' '}
              <button className="text-blue-600 hover:underline" onClick={() => setLoc(LOC_MAC_DINH)}>Bỏ lọc</button>
            </>
          )}
        </div>
      )}

      {/* Điện thoại: mỗi hồ sơ một thẻ */}
      {shown.length > 0 && (
        <div className="space-y-3 md:hidden">
          <label className="flex items-center gap-2 px-1 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={shown.every((d) => chon.has(d.id))}
              onChange={(e) => setChon(e.target.checked ? new Set(shown.map((d) => d.id)) : new Set())}
            />
            Chọn tất cả {shown.length} hồ sơ đang hiện
          </label>
          {nhom.map((g) => (
            <div key={g.khoa} className="space-y-2">
              {g.nhan && (
                <div className="flex items-baseline justify-between px-1 text-xs font-semibold text-slate-500">
                  <span>{g.nhan} · {g.ds.length} hồ sơ</span>
                  <span>{formatMoney(g.tongTien)} đ</span>
                </div>
              )}
              {g.ds.map((d) => {
                const st = statusOf(d)
                const w = warningsOf(d, settings, thayThe, ruiRo)
                const wait = waitingDays(d)
                return (
                  <div key={d.id} className={`card !p-3 ${chon.has(d.id) ? 'ring-2 ring-blue-400' : ''}`} onClick={() => moHoSo(d.id)}>
                    <div className="flex items-start gap-2.5">
                      <input type="checkbox" className="mt-1" checked={chon.has(d.id)} onClick={(e) => e.stopPropagation()} onChange={(e) => doiChon(d.id, e.target.checked)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1 break-words text-sm font-medium text-slate-800">
                            {d.hoSoCu && <span className="mr-1.5 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">HĐ cũ</span>}
                            {noiDungHs(d)}
                          </div>
                          <div className="shrink-0 text-right text-sm font-bold text-slate-800">{formatMoney(totalOf(d))}</div>
                        </div>
                        <div className="mt-0.5 truncate text-xs text-slate-500">
                          {fmtDate(firstInvoiceDate(d)) || 'chưa có ngày'} · {d.invoices[0]?.tenNguoiBan || '—'}
                          {d.invoices.length > 1 && ` +${d.invoices.length - 1} HĐ`}
                          {d.nguoiDeNghi && ` · TT: ${d.nguoiDeNghi}`}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLOR[st]}`}>{nhanTrangThai(d, st)}</span>
                          {wait != null && wait > 0 && <span className="text-[11px] text-slate-400">chờ {wait} ngày</span>}
                          <TagChips tags={d.tags} />
                          {d.invoices.some((i) => traHoaDon(i, ruiRo)) && (
                            <span className="rounded bg-red-700 px-1.5 py-0.5 text-[10px] font-semibold text-white">⛔ DN rủi ro</span>
                          )}
                          <span className="ml-auto" onClick={(e) => e.stopPropagation()}>{nutNhanh(d, st)}</span>
                        </div>
                        {w.length > 0 && <div className="mt-1 truncate text-xs text-red-600">⚠ {w[0]}{w.length > 1 && ` (+${w.length - 1})`}</div>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* Máy tính: bảng */}
      {shown.length > 0 && (
        <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
          <table className="w-full text-sm">
            <thead className="whitespace-nowrap bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="w-8 px-3 py-2">
                  <input
                    type="checkbox"
                    title="Chọn tất cả hồ sơ đang hiển thị"
                    checked={shown.every((d) => chon.has(d.id))}
                    onChange={(e) => setChon(e.target.checked ? new Set(shown.map((d) => d.id)) : new Set())}
                  />
                </th>
                <th className="px-3 py-2">Nội dung</th>
                <th className="w-32 px-3 py-2">Hóa đơn</th>
                <th className="px-3 py-2" title="Tỉnh của người bán (theo địa chỉ trên hóa đơn)">Tỉnh</th>
                <th className="px-3 py-2" title="Người đề nghị thanh toán">Người TT</th>
                <th className="cursor-pointer select-none px-3 py-2 text-right hover:text-blue-700" title="Bấm để xếp theo tổng tiền" onClick={() => bamCot('tongTien')}>
                  Tổng tiền{muiTen('tongTien')}
                </th>
                <th className="cursor-pointer select-none px-3 py-2 hover:text-blue-700" title="Bấm để đảo chiều: mới nhất / cũ nhất" onClick={() => bamCot('ngayHd')}>
                  Ngày HĐ{muiTen('ngayHd')}
                </th>
                <th className="px-3 py-2">Tờ trình</th>
                <th className="px-3 py-2">ĐNTT</th>
                <th className="px-3 py-2">Nộp KT</th>
                <th className="px-3 py-2" title="Kế toán thanh toán">KT TT</th>
                <th className="px-3 py-2">Trạng thái</th>
              </tr>
            </thead>
            {nhom.map((g) => (
              <tbody key={g.khoa}>
                {g.nhan && (
                  <tr className="border-t border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                    <td className="px-3 py-1.5">
                      <input
                        type="checkbox"
                        title={`Chọn cả ${g.nhan.toLowerCase()}`}
                        checked={g.ds.every((d) => chon.has(d.id))}
                        onChange={(e) => {
                          const n = new Set(chon)
                          for (const d of g.ds) e.target.checked ? n.add(d.id) : n.delete(d.id)
                          setChon(n)
                        }}
                      />
                    </td>
                    <td className="px-3 py-1.5" colSpan={4}>{g.nhan} · {g.ds.length} hồ sơ</td>
                    <td className="px-3 py-1.5 text-right">{formatMoney(g.tongTien)}</td>
                    <td colSpan={6} />
                  </tr>
                )}
                {g.ds.map((d) => {
                  const st = statusOf(d)
                  const w = warningsOf(d, settings, thayThe, ruiRo)
                  const wait = waitingDays(d)
                  return (
                    <tr key={d.id} className={`group cursor-pointer border-t border-slate-100 [&>td]:align-top hover:bg-blue-50/50 ${chon.has(d.id) ? 'bg-blue-50' : ''}`} onClick={() => moHoSo(d.id)}>
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={chon.has(d.id)} onChange={(e) => doiChon(d.id, e.target.checked)} />
                      </td>
                      {/* Nội dung hiện đủ (thường 2–3 dòng), không cắt "…" */}
                      <td className="min-w-[16rem] max-w-md px-3 py-2">
                        <SuaNoiDung d={d} luu={luuNhanh} dangDung={tagDangDung}>
                          <span className="block whitespace-normal break-words font-medium leading-snug text-slate-800">
                            {d.hoSoCu && <span className="mr-1.5 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">HĐ cũ</span>}
                            <TagChips tags={d.tags} className="mr-1.5 align-middle" />{noiDungHs(d)}
                          </span>
                        </SuaNoiDung>
                        {w.length > 0 && <div className="truncate text-xs text-red-600" title={w.join('\n')}>⚠ {w[0]}{w.length > 1 && ` (+${w.length - 1})`}</div>}
                      </td>
                      {/* Gọn: số HĐ đầu (+ số HĐ còn lại), người bán 1 dòng; rê chuột xem đủ */}
                      <td
                        className="max-w-[8rem] px-3 py-2 text-xs text-slate-600"
                        title={d.invoices.map((i) => `HĐ ${i.soHd || '?'} — ${i.tenNguoiBan}`).join('\n')}
                      >
                        <div className="truncate">
                          {d.invoices.length === 0 ? '—' : d.invoices[0].soHd || '?'}
                          {d.invoices.length > 1 && <span className="text-slate-400"> +{d.invoices.length - 1}</span>}
                          {d.invoices.some((i) => traHoaDon(i, ruiRo)) && (
                            <span className="ml-1 rounded bg-red-700 px-1 py-px text-[10px] font-semibold text-white" title="Người bán nằm trong danh sách DN rủi ro về hóa đơn">⛔</span>
                          )}
                        </div>
                        <div className="truncate text-slate-400">{d.invoices[0]?.tenNguoiBan}</div>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600" title={d.invoices.map((i) => i.diaChiNguoiBan).filter(Boolean).join('\n')}>
                        {tinhHoSo(d).map((t) => <div key={t} className={`whitespace-nowrap ${t === CHUA_RO_TINH ? 'text-slate-300' : ''}`}>{t === CHUA_RO_TINH ? '—' : t}</div>)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-700">
                        <SuaNguoiTT d={d} luu={luuNhanh} ds={dsNguoiTT} />
                      </td>
                      <td className="px-3 py-2 text-right font-medium">{formatMoney(totalOf(d))}</td>
                      <td className="px-3 py-2">{fmtDate(firstInvoiceDate(d))}</td>
                      {/* Các mốc ngày: bấm để sửa; hồ sơ cũ không có tờ trình / ĐNTT */}
                      <td className="px-3 py-2">
                        {!d.hoSoCu && <SuaNgay d={d} luu={luuNhanh} truong="ngayToTrinh" so="soToTrinh" tieuDe="Tờ trình xin chủ trương" goiY={[`Lùi ${settings.soNgayToTrinhTruocHd} ngày LV trước HĐ`, suggestToTrinhDate(d, settings)]} />}
                      </td>
                      <td className="px-3 py-2">
                        {!d.hoSoCu && <SuaNgay d={d} luu={luuNhanh} truong="ngayDntt" so="soDntt" tieuDe="Đề nghị thanh toán" goiY={['Gợi ý', suggestDnttDate(d)]} />}
                      </td>
                      <td className="px-3 py-2">
                        <SuaNgay d={d} luu={luuNhanh} truong="ngayNopKeToan" tieuDe="Nộp kế toán" nutNhanh={st === 'choNop'} />
                      </td>
                      <td className="px-3 py-2">
                        <SuaNgay d={d} luu={luuNhanh} truong="ngayKeToanTt" tieuDe="Kế toán thanh toán" nutNhanh={st === 'choKt'} />
                      </td>
                      <td className="px-3 py-2">
                        <SuaTrangThai d={d} luu={luuNhanh} settings={settings} nhan={(k) => nhanTrangThai(d, k)}>
                          <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[st]}`}>{nhanTrangThai(d, st)} ▾</span>
                        </SuaTrangThai>
                        {wait != null && wait > 0 && <div className="mt-0.5 text-xs text-slate-400">chờ {wait} ngày</div>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            ))}
            <tfoot>
              <tr className="border-t-2 border-slate-300 font-semibold">
                <td />
                <td className="px-3 py-2" colSpan={4}>Cộng {shown.length} hồ sơ</td>
                <td className="px-3 py-2 text-right">{formatMoney(tongShown)}</td>
                <td colSpan={6} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

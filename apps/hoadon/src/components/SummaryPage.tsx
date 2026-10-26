import { useCallback, useMemo, useRef, useState } from 'react'
import { invoicesToCsv } from '../lib/csv'
import { fmtDate, today } from '../lib/dates'
import { downloadBlob, useDossiers, useRuiRo, useSettings } from '../lib/hooks'
import { formatMoney } from '../lib/numberToWords'
import { nhanTrangThai, STATUS_COLOR, waitingDays, warningsOf } from '../lib/status'
import { banDoThayThe } from '../lib/thayThe'
import { KHONG_TAG, TAG_MAC_DINH } from '../lib/hashtag'
import {
  avgDurations, byCo, byMonth, bySeller, byTag, byYear, coTag, flattenInvoices, hopHoaDon, khoaNguoiBan, LOC_TONG_HOP, topVaKhac, yearsOf,
  type BoLocTongHop, type InvoiceRow, type NhomTt,
} from '../lib/summary'
import BaoCaoNam from './BaoCaoNam'
import { BieuDoCotChong, BieuDoThanh, trieu } from './BieuDo'
import { CHUA_RO_TINH, demTinh, tinhCua } from '../lib/tinh'
import { SuaNguoiTT, SuaNoiDung, SuaTrangThai, useSuaNhanh } from './SuaNhanh'
import { TagChips } from './TagChips'

const money = (n: number) => (n ? formatMoney(n) : '—')

function Tile({ label, value, sub, tone = 'text-slate-800', onClick, chon }: { label: string; value: string; sub?: string; tone?: string; onClick?: () => void; chon?: boolean }) {
  const noiDung = (
    <>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-bold ${tone}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </>
  )
  if (!onClick) return <div className="card">{noiDung}</div>
  // ô bấm được: lọc theo tình trạng (bấm lại để bỏ)
  return (
    <button className={`card text-left hover:border-blue-300 ${chon ? 'ring-2 ring-blue-500' : ''}`} title={chon ? 'Bấm lại để bỏ lọc' : 'Bấm để lọc theo tình trạng này'} onClick={onClick}>
      {noiDung}
    </button>
  )
}

export default function SummaryPage({ onOpen }: { onOpen: (id: string) => void }) {
  const list = useDossiers()
  const settings = useSettings()
  const ruiRo = useRuiRo().bang
  const { luu, tagDangDung, dsNguoiTT } = useSuaNhanh(list, settings)
  const allRows = useMemo(() => flattenInvoices(list ?? []), [list])
  const years = useMemo(() => {
    const ys = yearsOf(allRows)
    const now = Number(today().slice(0, 4))
    return ys.includes(now) ? ys : [now, ...ys]
  }, [allRows])
  const [loc, datLoc] = useState<BoLocTongHop>(() => ({ ...LOC_TONG_HOP, nam: Number(today().slice(0, 4)) }))
  const setLoc = (p: Partial<BoLocTongHop>) => datLoc((l) => ({ ...l, ...p }))
  const { nam: year, thang: month } = loc
  const setYear = (nam: number | 'all') => setLoc({ nam, thang: 'all' })
  const setMonth = (thang: number | 'all') => setLoc({ thang })
  // Lọc theo người bán / việc: chọn ở bộ lọc, hoặc bấm vào thanh trong biểu đồ (bấm lại để bỏ)
  const [nguoiBan, setNguoiBan] = useState<string | null>(null)
  const [tag, setTag] = useState<string | null>(null)
  const dangLocTh = loc.q.trim() !== '' || loc.nhom !== 'all' || loc.nguoiTT != null || !!loc.tinh || month !== 'all' || !!nguoiBan || !!tag
  const boLoc = () => {
    setLoc({ q: '', nhom: 'all', nguoiTT: null, tinh: null, thang: 'all' })
    setNguoiBan(null)
    setTag(null)
  }
  const bamNhom = (k: NhomTt) => ({ chon: loc.nhom === k, onClick: () => setLoc({ nhom: loc.nhom === k ? 'all' : k }) })
  const bangKeRef = useRef<HTMLDivElement>(null)
  const [moBaoCao, setMoBaoCao] = useState(false)
  const dongBaoCao = useCallback(() => setMoBaoCao(false), [])

  // Hóa đơn hợp bộ lọc (kỳ, từ khoá, tình trạng, người TT) — CHƯA lọc người bán / việc: để 2 biểu đồ đó xếp hạng
  const rowsKy = useMemo(() => allRows.filter((r) => hopHoaDon(r, loc)), [allRows, loc])
  // người đề nghị có trong kỳ đang xem (cho ô chọn)
  const dsNguoiTTKy = useMemo(() => {
    const ky = allRows.filter((r) => hopHoaDon(r, { ...loc, q: '', nhom: 'all', nguoiTT: null }))
    return [...new Set(ky.map((r) => r.d.nguoiDeNghi.trim()))].sort((a, b) => (a ? b ? a.localeCompare(b, 'vi') : -1 : 1))
  }, [allRows, loc])
  // tỉnh có trong kỳ đang xem (kèm số HĐ)
  const dsTinh = useMemo(() => demTinh(allRows.filter((r) => hopHoaDon(r, { ...loc, q: '', tinh: null })).map((r) => r.inv)), [allRows, loc])
  const hopNb = (r: InvoiceRow) => !nguoiBan || khoaNguoiBan(r.inv) === nguoiBan
  const hopTag = (r: InvoiceRow) => !tag || coTag(r.d, tag)
  // Mỗi biểu đồ xếp hạng theo bộ lọc của biểu đồ KIA (không tự lọc chính nó) — để đổi lựa chọn dễ
  const rowsChoNguoiBan = useMemo(() => rowsKy.filter(hopTag), [rowsKy, tag]) // eslint-disable-line react-hooks/exhaustive-deps
  const rowsChoTag = useMemo(() => rowsKy.filter(hopNb), [rowsKy, nguoiBan]) // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useMemo(() => rowsKy.filter((r) => hopNb(r) && hopTag(r)), [rowsKy, nguoiBan, tag]) // eslint-disable-line react-hooks/exhaustive-deps
  // biểu đồ tháng / năm cũng chỉ tính người bán + tag đang chọn
  // (theo mọi bộ lọc trừ năm / tháng — biểu đồ tự chia theo tháng / năm)
  const allRowsNb = useMemo(
    () => allRows.filter((r) => hopHoaDon(r, { ...loc, nam: 'all' }) && hopNb(r) && hopTag(r)),
    [allRows, loc, nguoiBan, tag], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const tenNguoiBan = nguoiBan ? (allRows.find((r) => khoaNguoiBan(r.inv) === nguoiBan)?.inv.tenNguoiBan || nguoiBan) : ''
  const tagStats = useMemo(() => byTag(rowsChoTag), [rowsChoTag])
  const nhieuTag = rowsChoTag.some((r) => (r.d.tags?.length ?? 0) > 1)

  const cuonToiBangKe = () => setTimeout(() => bangKeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  function chonNguoiBan(khoa: string) {
    const bo = nguoiBan === khoa
    setNguoiBan(bo ? null : khoa)
    if (!bo) cuonToiBangKe()
  }
  function chonTag(ma: string) {
    const bo = tag === ma
    setTag(bo ? null : ma)
    if (!bo) cuonToiBangKe()
  }

  const totals = useMemo(() => {
    const t = { n: rows.length, tong: 0, daTt: 0, choKt: 0, chuaNop: 0, nChoKt: 0, nChuaNop: 0 }
    for (const r of rows) {
      const v = r.inv.tongTien || 0
      t.tong += v
      if (r.status === 'daTt') t.daTt += v
      else if (r.status === 'choKt') {
        t.choKt += v
        t.nChoKt++
      } else {
        t.chuaNop += v
        t.nChuaNop++
      }
    }
    return t
  }, [rows])

  const months = useMemo(() => (year === 'all' ? null : byMonth(allRowsNb, year)), [allRowsNb, year])
  const allSellers = useMemo(() => bySeller(rowsChoNguoiBan), [rowsChoNguoiBan])
  const sellers = allSellers.slice(0, 10)
  const years10 = useMemo(() => (year === 'all' ? byYear(allRowsNb) : null), [allRowsNb, year])
  const coHd = useMemo(() => byCo(rows, [2e6, settings.nguongTien, 10e6, 20e6].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b)), [rows, settings.nguongTien])
  const durations = useMemo(() => avgDurations([...new Set(rows.map((r) => r.d))]), [rows])

  // Việc cần xử lý: hồ sơ còn dở, có cảnh báo hoặc chờ lâu (không phụ thuộc bộ lọc)
  const todo = useMemo(() => {
    const thayThe = banDoThayThe(list ?? []) // lập 1 lần cho cả kho
    return (list ?? [])
      .map((d) => ({ d, w: warningsOf(d, settings, thayThe, ruiRo), wait: waitingDays(d) ?? 0 }))
      .filter((x) => x.w.length > 0 || x.wait > 7)
      .sort((a, b) => b.wait - a.wait)
  }, [list, settings, ruiRo])

  if (!list) return <p className="text-slate-500">Đang tải…</p>

  const kyLabel = year === 'all' ? 'tất cả các năm' : month === 'all' ? `năm ${year}` : `tháng ${month}/${year}`

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-2 text-lg font-semibold text-slate-800">Tổng hợp hóa đơn {kyLabel}</h2>
        <button className="btn ml-auto" title="Báo cáo tình hình thanh toán cả năm (không theo bộ lọc) — in hoặc lưu PDF gửi lãnh đạo" onClick={() => setMoBaoCao(true)}>
          📄 Báo cáo năm (PDF)
        </button>
      </div>

      {/* Bộ lọc chung cả trang (ô, biểu đồ, bảng kê) — cùng kiểu trang Hồ sơ thanh toán */}
      <div className="card flex flex-wrap items-center gap-2 !p-2.5">
        <div className="relative w-full sm:w-56">
          <input
            className="inp pr-8"
            placeholder="Tìm số HĐ, người bán, MST, nội dung…"
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
        <select className="inp w-auto" title="Năm của ngày hóa đơn" value={year} onChange={(e) => setYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
          {years.map((y) => <option key={y} value={y}>Năm {y}</option>)}
          <option value="all">Tất cả các năm</option>
        </select>
        {year !== 'all' && (
          <select className="inp w-auto" value={month} onChange={(e) => setMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
            <option value="all">Cả năm</option>
            {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>Tháng {i + 1}</option>)}
          </select>
        )}
        <select className="inp w-auto" title="Tình trạng thanh toán" value={loc.nhom} onChange={(e) => setLoc({ nhom: e.target.value as BoLocTongHop['nhom'] })}>
          <option value="all">Mọi tình trạng</option>
          <option value="daTt">Đã được thanh toán</option>
          <option value="choKt">Đã nộp, chờ kế toán</option>
          <option value="chuaNop">Chưa nộp kế toán</option>
        </select>
        <select className="inp w-auto" title="Người đề nghị thanh toán" value={loc.nguoiTT ?? '__tat_ca'} onChange={(e) => setLoc({ nguoiTT: e.target.value === '__tat_ca' ? null : e.target.value })}>
          <option value="__tat_ca">Mọi người TT</option>
          {[...new Set([...dsNguoiTTKy, ...(loc.nguoiTT != null ? [loc.nguoiTT] : [])])].map((n) => (
            <option key={n} value={n}>{n || '(chưa ghi người TT)'}</option>
          ))}
        </select>
        <select className="inp w-auto max-w-[11rem]" title="Tỉnh của người bán (theo địa chỉ trên hóa đơn)" value={loc.tinh ?? ''} onChange={(e) => setLoc({ tinh: e.target.value || null })}>
          <option value="">Mọi tỉnh</option>
          {loc.tinh && !dsTinh.some((t) => t.tinh === loc.tinh) && <option value={loc.tinh}>{loc.tinh}</option>}
          {dsTinh.map((t) => <option key={t.tinh} value={t.tinh}>{t.tinh} ({t.soHd})</option>)}
        </select>
        <select className="inp w-auto max-w-[14rem]" title="Người bán (xếp theo số tiền)" value={nguoiBan ?? ''} onChange={(e) => setNguoiBan(e.target.value || null)}>
          <option value="">Mọi người bán</option>
          {nguoiBan && !allSellers.some((s) => s.khoa === nguoiBan) && <option value={nguoiBan}>{tenNguoiBan}</option>}
          {allSellers.map((s) => <option key={s.khoa} value={s.khoa}>{s.ten} ({s.soHd})</option>)}
        </select>

        {/* Lọc theo việc (hashtag): bấm để lọc, bấm lại để bỏ */}
        {tagStats.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 max-sm:w-full sm:flex-wrap sm:overflow-visible sm:pb-0 lg:border-l lg:border-slate-200 lg:pl-2">
            <button
              onClick={() => setTag(null)}
              className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${!tag ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              Mọi việc
            </button>
            {tagStats.map((t) => (
              <button
                key={t.ma}
                title={`${TAG_MAC_DINH.find((x) => x.ma === t.ma)?.ten ?? ''} · ${formatMoney(t.tongTien)} đ`.replace(/^ · /, '')}
                onClick={() => setTag(tag === t.ma ? null : t.ma)}
                className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${
                  tag === t.ma ? 'border-indigo-600 bg-indigo-600 text-white' : t.ma === KHONG_TAG ? 'border-dashed border-slate-300 bg-white text-slate-500 hover:bg-slate-50' : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                }`}
              >
                {t.ma === KHONG_TAG ? t.ma : `#${t.ma}`} <span className="opacity-70">{t.soHd}</span>
              </button>
            ))}
          </div>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
          <span className="whitespace-nowrap text-slate-600">
            <b className="text-slate-800">{totals.n}</b> HĐ · <b className="text-slate-800">{formatMoney(totals.tong)} đ</b>
          </span>
          {dangLocTh && (
            <button className="text-xs text-blue-600 hover:underline" onClick={boLoc}>
              ✕ Bỏ lọc
            </button>
          )}
        </div>
      </div>
      {moBaoCao && (
        <BaoCaoNam list={list} settings={settings} namDau={year === 'all' ? Number(today().slice(0, 4)) : year} dsNam={years} onClose={dongBaoCao} />
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Tile label="Tổng hóa đơn" value={`${totals.n} HĐ`} sub={`${formatMoney(totals.tong)} đ`} />
        <Tile label="Đã được thanh toán" value={`${formatMoney(totals.daTt)} đ`} tone="text-emerald-700"
          sub={totals.tong ? `${Math.round((totals.daTt / totals.tong) * 100)}% số tiền` : undefined} {...bamNhom('daTt')} />
        <Tile label="Đã nộp, chờ kế toán" value={`${formatMoney(totals.choKt)} đ`} tone="text-blue-700" sub={`${totals.nChoKt} hóa đơn`} {...bamNhom('choKt')} />
        <Tile label="Chưa nộp kế toán" value={`${formatMoney(totals.chuaNop)} đ`} tone="text-orange-700" sub={`${totals.nChuaNop} hóa đơn`} {...bamNhom('chuaNop')} />
        <Tile
          label="Thời gian trung bình"
          value={durations.nopDenTt != null ? `${durations.nopDenTt} ngày` : '—'}
          sub={`từ nộp tới nhận tiền${durations.hdDenNop != null ? ` · HĐ→nộp: ${durations.hdDenNop} ngày` : ''}`}
        />
      </div>

      {todo.length > 0 && (
        <div className="card">
          <h3 className="mb-2 font-semibold text-slate-800">Cần xử lý ({todo.length})</h3>
          <div className="divide-y divide-slate-100">
            {todo.map(({ d, w, wait }) => (
              <button key={d.id} className="flex w-full items-start gap-3 py-1.5 text-left text-sm hover:bg-slate-50" onClick={() => onOpen(d.id)}>
                <span className="w-16 shrink-0 text-xs text-slate-400">{wait > 0 ? `chờ ${wait} ngày` : ''}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-slate-800">{d.noiDung || '(chưa đặt nội dung)'}</span>
                  {w.length > 0 && <span className="block text-xs text-red-600">⚠ {w.join(' · ')}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {years10 && (
          <div className="card">
            <h3 className="mb-2 font-semibold text-slate-800">Theo năm</h3>
            <BieuDoCotChong
              ds={years10.map((y) => ({ khoa: y.nam, nhan: String(y.nam), tieuDe: `Năm ${y.nam}`, soHd: y.soHd, daTt: y.daTt, choKt: y.choKt, chuaNop: y.chuaNop }))}
              onChon={(nam) => setYear(nam)}
            />
            <p className="mt-1 text-xs text-slate-400">Bấm vào một năm để xem chi tiết từng tháng.</p>
          </div>
        )}

        {months && (
          <div className="card overflow-x-auto">
            <h3 className="mb-2 font-semibold text-slate-800">Theo tháng — năm {year}</h3>
            <BieuDoCotChong
              ds={months.map((m) => ({ khoa: m.thang, nhan: `T${m.thang}`, tieuDe: `Tháng ${m.thang}/${year}`, soHd: m.soHd, daTt: m.daTt, choKt: m.choKt, chuaNop: m.chuaNop }))}
              chon={month === 'all' ? undefined : month}
              onChon={(t) => setMonth(month === t ? 'all' : t)}
            />
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-slate-500">Xem bảng số</summary>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="py-1">Tháng</th>
                  <th className="py-1 text-right">Số HĐ</th>
                  <th className="py-1 text-right">Tổng tiền</th>
                  <th className="py-1 text-right text-emerald-700">Đã TT</th>
                  <th className="py-1 text-right text-blue-700">Chờ KT</th>
                  <th className="py-1 text-right text-orange-700">Chưa nộp</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.thang}
                    className={`cursor-pointer border-t border-slate-100 hover:bg-blue-50/50 ${month === m.thang ? 'bg-blue-50' : ''} ${m.soHd ? '' : 'text-slate-300'}`}
                    onClick={() => setMonth(month === m.thang ? 'all' : m.thang)}>
                    <td className="py-1">Tháng {m.thang}</td>
                    <td className="py-1 text-right">{m.soHd || '—'}</td>
                    <td className="py-1 text-right font-medium">{money(m.tongTien)}</td>
                    <td className="py-1 text-right">{money(m.daTt)}</td>
                    <td className="py-1 text-right">{money(m.choKt)}</td>
                    <td className="py-1 text-right">{money(m.chuaNop)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-300 font-semibold">
                  <td className="py-1">Cả năm</td>
                  <td className="py-1 text-right">{months.reduce((a, m) => a + m.soHd, 0)}</td>
                  <td className="py-1 text-right">{money(months.reduce((a, m) => a + m.tongTien, 0))}</td>
                  <td className="py-1 text-right">{money(months.reduce((a, m) => a + m.daTt, 0))}</td>
                  <td className="py-1 text-right">{money(months.reduce((a, m) => a + m.choKt, 0))}</td>
                  <td className="py-1 text-right">{money(months.reduce((a, m) => a + m.chuaNop, 0))}</td>
                </tr>
              </tbody>
            </table>
            </details>
            <p className="mt-1 text-xs text-slate-400">Bấm vào một tháng để lọc bảng kê bên dưới (bấm lại để bỏ lọc).</p>
          </div>
        )}

        <div className="card overflow-x-auto">
          <h3 className="mb-2 font-semibold text-slate-800">Theo người bán ({kyLabel})</h3>
          {sellers.length === 0 ? (
            <p className="text-sm text-slate-400">Chưa có hóa đơn.</p>
          ) : (
            <>
            <BieuDoThanh
              ds={(() => {
                const { top, khac } = topVaKhac(allSellers, 10)
                return [
                  ...top.map((s) => ({ khoa: s.khoa, ten: s.ten, phu: s.mst ? `MST ${s.mst}` : undefined, giaTri: s.tongTien, ghiChu: `${s.soHd} HĐ` })),
                  ...(khac ? [{ khoa: '__khac', ten: `${khac.soNguoi} người bán khác`, giaTri: khac.tongTien, ghiChu: `${khac.soHd} HĐ`, mo: true }] : []),
                ]
              })()}
              chon={nguoiBan ?? undefined}
              onChon={chonNguoiBan}
            />
            <p className="mt-1 text-xs text-slate-400">Bấm vào một người bán để xem các hóa đơn của họ (bấm lại để bỏ lọc).</p>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-slate-500">Xem bảng số (10 người bán nhiều nhất)</summary>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="py-1">Người bán</th>
                  <th className="py-1 text-right">Số HĐ</th>
                  <th className="py-1 text-right">Tổng tiền</th>
                </tr>
              </thead>
              <tbody>
                {sellers.map((s) => (
                  <tr key={s.khoa} className={`cursor-pointer border-t border-slate-100 hover:bg-blue-50/50 ${nguoiBan === s.khoa ? 'bg-blue-50' : ''}`} onClick={() => chonNguoiBan(s.khoa)}>
                    <td className="py-1">
                      {s.ten}
                      {s.mst && <span className="block text-xs text-slate-400">MST {s.mst}</span>}
                    </td>
                    <td className="py-1 text-right">{s.soHd}</td>
                    <td className="py-1 text-right font-medium">{formatMoney(s.tongTien)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </details>
            </>
          )}
        </div>

        <div className="card">
          <h3 className="font-semibold text-slate-800">Theo việc — hashtag ({kyLabel})</h3>
          <p className="mb-2 text-xs text-slate-500">
            Gắn tag ở màn hình hồ sơ.{nhieuTag ? ' Hồ sơ nhiều tag được tính vào mỗi tag, nên cộng các dòng có thể lớn hơn tổng tiền.' : ''}
          </p>
          {tagStats.length === 0 ? (
            <p className="text-sm text-slate-400">Chưa có hóa đơn.</p>
          ) : (
            <>
              <BieuDoThanh
                ds={tagStats.map((t) => ({
                  khoa: t.ma,
                  ten: t.ma === KHONG_TAG ? t.ma : `#${t.ma}`,
                  phu: TAG_MAC_DINH.find((x) => x.ma === t.ma)?.ten,
                  giaTri: t.tongTien,
                  ghiChu: `${t.soHoSo} hồ sơ`,
                }))}
                chon={tag ?? undefined}
                onChon={chonTag}
              />
              <p className="mt-1 text-xs text-slate-400">Bấm vào một việc để xem các hóa đơn của việc đó (bấm lại để bỏ lọc).</p>
            </>
          )}
        </div>

        <div className="card">
          <h3 className="font-semibold text-slate-800">Theo cỡ hóa đơn ({kyLabel})</h3>
          <p className="mb-2 text-xs text-slate-500">
            Từ {trieu(settings.nguongTien)} trở lên: giấy ĐNTT phải in tài khoản người bán, dự trù {trieu(settings.duTruTuNguong)}.
          </p>
          {rows.length === 0 ? (
            <p className="text-sm text-slate-400">Chưa có hóa đơn.</p>
          ) : (
            <BieuDoThanh
              ds={coHd.map((c) => ({
                khoa: String(c.tu),
                ten: c.den == null ? `Từ ${trieu(c.tu)}` : c.tu === 0 ? `Dưới ${trieu(c.den)}` : `${trieu(c.tu)} – dưới ${trieu(c.den)}`,
                giaTri: c.tongTien,
                ghiChu: `${c.soHd} HĐ`,
              }))}
            />
          )}
        </div>
      </div>

      <div ref={bangKeRef} className="card scroll-mt-20 overflow-x-auto">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-slate-800">Bảng kê hóa đơn ({rows.length}){tag && <span className="font-normal text-slate-500"> — {tag === KHONG_TAG ? tag : `#${tag}`}</span>}{nguoiBan && <span className="font-normal text-slate-500"> — {tenNguoiBan}</span>}</h3>
          <button className="btn ml-auto" onClick={() => downloadBlob(invoicesToCsv(rows), `Bang ke hoa don ${kyLabel.replace(/\//g, '-')}${tag ? ` - ${tag === KHONG_TAG ? 'chua gan tag' : tag}` : ''}${nguoiBan ? ` - ${nguoiBan}` : ''}.csv`)}>
            ⬇ Xuất Excel
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="whitespace-nowrap bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-2 py-1.5">STT</th>
              <th className="px-2 py-1.5">Ngày HĐ</th>
              <th className="px-2 py-1.5">Ký hiệu / Số</th>
              <th className="px-2 py-1.5">Người bán</th>
              <th className="px-2 py-1.5" title="Tỉnh của người bán (theo địa chỉ trên hóa đơn)">Tỉnh</th>
              <th className="px-2 py-1.5 text-right">Tổng tiền</th>
              <th className="px-2 py-1.5">Nội dung</th>
              <th className="px-2 py-1.5" title="Người đề nghị thanh toán của hồ sơ">Người TT</th>
              <th className="px-2 py-1.5">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-2 py-6 text-center text-slate-400">Không có hóa đơn nào trong kỳ này.</td></tr>
            )}
            {/* Sửa nhanh nội dung / người TT / trạng thái: sửa theo HỒ SƠ — các dòng cùng hồ sơ đổi theo */}
            {rows.map((r, i) => (
              <tr key={r.inv.id} className="group cursor-pointer border-t border-slate-100 align-top hover:bg-blue-50/50" onClick={() => onOpen(r.d.id)}>
                <td className="px-2 py-1.5 text-slate-400">{i + 1}</td>
                <td className="whitespace-nowrap px-2 py-1.5">{fmtDate(r.inv.ngayHd)}</td>
                <td className="whitespace-nowrap px-2 py-1.5">{r.inv.kyHieu} / <b>{r.inv.soHd}</b></td>
                <td className="max-w-[14rem] px-2 py-1.5"><div className="line-clamp-2" title={r.inv.tenNguoiBan}>{r.inv.tenNguoiBan}</div></td>
                <td className="whitespace-nowrap px-2 py-1.5 text-xs text-slate-600" title={r.inv.diaChiNguoiBan}>
                  {tinhCua(r.inv) === CHUA_RO_TINH ? <span className="text-slate-300">—</span> : tinhCua(r.inv)}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-medium">{formatMoney(r.inv.tongTien)}</td>
                <td className="min-w-[16rem] max-w-md px-2 py-1.5">
                  <SuaNoiDung d={r.d} luu={luu} dangDung={tagDangDung}>
                    <span className="block whitespace-normal break-words leading-snug text-slate-700">
                      {r.d.invoices.length > 1 && (
                        <span className="mr-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500" title="Hồ sơ gồm nhiều hóa đơn — sửa ở đây là sửa cả hồ sơ">
                          HS {r.d.invoices.length} HĐ
                        </span>
                      )}
                      <TagChips tags={r.d.tags} className="mr-1 align-middle" />
                      {r.d.noiDung || <i className="text-slate-400">(chưa đặt nội dung)</i>}
                    </span>
                  </SuaNoiDung>
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-xs text-slate-700">
                  <SuaNguoiTT d={r.d} luu={luu} ds={dsNguoiTT} />
                </td>
                <td className="px-2 py-1.5">
                  <SuaTrangThai d={r.d} luu={luu} settings={settings} nhan={(k) => nhanTrangThai(r.d, k)}>
                    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[r.status]}`}>{nhanTrangThai(r.d, r.status)} ▾</span>
                  </SuaTrangThai>
                  {/* mốc ngày thay cho 2 cột Nộp KT / KT thanh toán */}
                  {(r.d.ngayKeToanTt || r.d.ngayNopKeToan) && (
                    <div className="mt-0.5 whitespace-nowrap text-[11px] text-slate-400">
                      {r.d.ngayKeToanTt ? `TT ${fmtDate(r.d.ngayKeToanTt)}` : `nộp KT ${fmtDate(r.d.ngayNopKeToan)}`}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {rows.length > 0 && (
              <tr className="border-t-2 border-slate-300 font-semibold">
                <td colSpan={5} className="px-2 py-1.5">Cộng</td>
                <td className="px-2 py-1.5 text-right">{formatMoney(totals.tong)}</td>
                <td colSpan={3} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

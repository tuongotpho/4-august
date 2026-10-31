// Mục "Hoá đơn điện tử XML" ở tab Kho hồ sơ: tải XML / ZIP lên là lưu kho luôn (chống trùng), danh sách đã lưu,
// mở xem như bản in (thay iTax Viewer — vốn không đọc được hoá đơn), tải lại file XML gốc.
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Kho } from '../core/kho'
import { tien } from '../core/nhan'
import { khoaCuaGoc, parseInvoice, TINH_CHAT_LQ, tienXem, type BenHoaDon, type ChuKy, type HoaDonXem } from '../core/xemHoaDon'
import { VungThaFile } from './chung'

export interface DongNapXml {
  ten: string
  kq: 'moi' | 'daCo' | 'loi'
  moTa: string
  khoa?: string
}

export interface BaoCaoNapXml {
  dong: DongNapXml[]
  dangNhap: boolean
  loiMay: number
}

const boDau = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
const ngayXep = (dmy: string) => dmy.split('/').reverse().join('')
const ngayIn = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}
const ngayGio = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s)
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : s
}
const HTTT: Record<string, string> = { TM: 'Tiền mặt', CK: 'Chuyển khoản', 'TM/CK': 'Tiền mặt / Chuyển khoản' }

function taiVe(ten: string, du: Uint8Array) {
  const url = URL.createObjectURL(new Blob([du as Uint8Array<ArrayBuffer>], { type: 'application/xml' }))
  const a = document.createElement('a')
  a.href = url
  a.download = ten
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function HoaDonXmlDN({ kho, mst, dangNhap, coFileGoc, onNap, layXml }: {
  kho: Kho
  mst: string
  dangNhap: boolean
  /** Hoá đơn này đã có file XML gốc trên mây chưa */
  coFileGoc: (khoa: string) => boolean
  onNap: (f: File[]) => Promise<BaoCaoNapXml>
  layXml: (khoa: string) => Promise<{ ten: string; du: Uint8Array } | null>
}) {
  const [dang, setDang] = useState(false)
  const [bc, setBc] = useState<BaoCaoNapXml | null>(null)
  const [xemDaCo, setXemDaCo] = useState(false)
  const [tim, setTim] = useState('')
  const [chieu, setChieu] = useState<'' | 'mua' | 'ban'>('')
  const [thang, setThang] = useState('')
  const [mo, setMo] = useState<string | null>(null)

  const ds = useMemo(() => Object.values(kho.goc?.[mst] ?? {})
    .filter((g) => g.nguon === 'xml')
    .map((g) => ({ g, khoa: khoaCuaGoc(g), ban: g.mstBan === mst }))
    .sort((a, b) => ngayXep(b.g.ngay).localeCompare(ngayXep(a.g.ngay)) || (Number(b.g.so) || 0) - (Number(a.g.so) || 0)), [kho, mst])
  const cacThang = useMemo(() => [...new Set(ds.map((x) => x.g.ngay.slice(3)))].filter(Boolean).sort((a, b) => ngayXep(b).localeCompare(ngayXep(a))), [ds])
  const loc = useMemo(() => {
    const tu = boDau(tim).split(/\s+/).filter(Boolean)
    return ds.filter((x) => {
      if (chieu && (chieu === 'ban') !== x.ban) return false
      if (thang && x.g.ngay.slice(3) !== thang) return false
      const chu = boDau([x.g.kyHieu, x.g.so, x.g.tenBan, x.g.mstBan, x.g.tenMua, x.g.mstMua, x.g.tenFile].join(' '))
      return tu.every((t) => chu.includes(t))
    })
  }, [ds, tim, chieu, thang])
  const cong = loc.reduce((a, x) => ({ v: a.v + x.g.chuaThue, t: a.t + x.g.thue, tong: a.tong + x.g.tong }), { v: 0, t: 0, tong: 0 })
  const viTri = mo ? loc.findIndex((x) => x.khoa === mo) : -1

  async function nap(f: File[]) {
    if (!f.length || dang) return
    setDang(true)
    setXemDaCo(false)
    try {
      setBc(await onNap(f))
    } finally {
      setDang(false)
    }
  }

  const dem = (kq: DongNapXml['kq']) => bc?.dong.filter((d) => d.kq === kq).length ?? 0
  return (
    <div className="space-y-3 text-sm">
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
        App đọc file XML hoá đơn, hiện như bản in và <b>cộng lại các con số</b> (dòng hàng, thuế, tổng tiền). App <b>KHÔNG kiểm chữ ký số</b> — muốn biết
        hoá đơn thật hay giả, tra trên <b>hoadondientu.gdt.gov.vn</b>.
      </p>
      <VungThaFile
        accept=".xml,.zip"
        onFiles={(f) => void nap(f)}
        nhan={
          <>
            <div className="font-medium">{dang ? 'Đang đọc và lưu…' : 'Kéo thả file hoá đơn XML vào đây, hoặc bấm để chọn'}</div>
            <div className="mt-1 text-slate-600">Một hay nhiều file <b>.xml</b>, hoặc nguyên gói <b>.zip</b> (kể cả gói của tiện ích tải hoá đơn hàng loạt). Hoá đơn đã có trong kho thì báo “đã có”, không ghi đè.</div>
          </>
        }
      />
      {!dangNhap && <p className="text-slate-500">Chưa đăng nhập: hoá đơn chỉ vào sổ trên máy này, file XML gốc chưa được lưu lên mây.</p>}

      {bc && (
        <div className="rounded-xl border border-slate-200 p-3">
          <p>
            <b className="text-emerald-700">{dem('moi')} hoá đơn mới{bc.dangNhap ? ' đã lưu vào kho' : ' đã vào sổ trên máy'}</b>
            {' · '}<b>{dem('daCo')} đã có</b> (không ghi đè)
            {' · '}<b className={dem('loi') ? 'text-red-700' : ''}>{dem('loi')} lỗi</b>
            {' '}— tổng {bc.dong.length} file.
          </p>
          <ul className="mt-2 space-y-1">
            {bc.dong.filter((d) => d.kq === 'loi').map((d, i) => (
              <li key={`l${i}`} className="rounded bg-red-50 px-2 py-1 text-red-800">⛔ <b>{d.ten}</b>: {d.moTa}</li>
            ))}
            {bc.dong.filter((d) => d.kq === 'moi').map((d, i) => (
              <li key={`m${i}`} className="text-slate-700">✅ {d.moTa}</li>
            ))}
          </ul>
          {dem('daCo') > 0 && (
            <>
              <button className="mt-1 text-emerald-700 underline" onClick={() => setXemDaCo(!xemDaCo)}>{xemDaCo ? 'Ẩn' : 'Xem'} {dem('daCo')} hoá đơn đã có</button>
              {xemDaCo && (
                <ul className="mt-1 space-y-0.5 text-slate-600">
                  {bc.dong.filter((d) => d.kq === 'daCo').map((d, i) => <li key={`d${i}`}>↺ {d.moTa}</li>)}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {ds.length === 0 ? (
        <p className="text-slate-500">Chưa có hoá đơn XML nào trong kho của công ty này.</p>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input value={tim} onChange={(e) => setTim(e.target.value)} placeholder="Tìm: tên, MST, ký hiệu, số…" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5" />
            <select value={chieu} onChange={(e) => setChieu(e.target.value as typeof chieu)} className="rounded-lg border border-slate-300 px-2 py-1.5">
              <option value="">Mua vào + bán ra</option>
              <option value="mua">Mua vào</option>
              <option value="ban">Bán ra</option>
            </select>
            <select value={thang} onChange={(e) => setThang(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5">
              <option value="">Mọi tháng</option>
              {cacThang.map((t) => <option key={t} value={t}>Tháng {t}</option>)}
            </select>
          </div>
          <p className="text-slate-600" data-tong-xml>
            {loc.length}/{ds.length} hoá đơn — trước thuế <b>{tien(cong.v)}</b> · thuế <b>{tien(cong.t)}</b> · tổng thanh toán <b>{tien(cong.tong)}</b> đ
          </p>
          <div className="max-h-[32rem] overflow-auto rounded-xl border border-slate-200">
            <table className="w-full">
              <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="p-2">Ngày</th>
                  <th className="p-2">Chiều</th>
                  <th className="p-2">Ký hiệu – số</th>
                  <th className="p-2">Đối tác</th>
                  <th className="hidden p-2 text-right sm:table-cell">Trước thuế</th>
                  <th className="hidden p-2 text-right sm:table-cell">Thuế</th>
                  <th className="p-2 text-right">Tổng</th>
                </tr>
              </thead>
              <tbody>
                {loc.map((x) => (
                  <tr key={x.khoa} onClick={() => setMo(x.khoa)} className="cursor-pointer border-t border-slate-100 hover:bg-emerald-50">
                    <td className="whitespace-nowrap p-2">{x.g.ngay}</td>
                    <td className="p-2">{x.ban ? 'Bán ra' : 'Mua vào'}</td>
                    <td className="whitespace-nowrap p-2">
                      {x.g.kyHieu}-{x.g.so}
                      {!x.g.mccqt && /^C/i.test(x.g.kyHieu) && <span title="Thiếu mã của cơ quan thuế" className="ml-1 text-red-600">⚠</span>}
                      {dangNhap && !coFileGoc(x.khoa) && <span title="Chưa có file XML gốc trên mây" className="ml-1 text-slate-400">☁̸</span>}
                    </td>
                    <td className="p-2">
                      <div className="line-clamp-2">{x.ban ? x.g.tenMua : x.g.tenBan}</div>
                      <div className="text-xs text-slate-500">{x.ban ? x.g.mstMua : x.g.mstBan}</div>
                    </td>
                    <td className="hidden p-2 text-right sm:table-cell">{tien(x.g.chuaThue)}</td>
                    <td className="hidden p-2 text-right sm:table-cell">{tien(x.g.thue)}</td>
                    <td className="p-2 text-right font-medium">{tien(x.g.tong)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">Bấm một dòng để xem bản hoá đơn. Danh sách gồm hoá đơn XML đã nạp (cả từ ô “Nạp toàn bộ hồ sơ thuế”).</p>
        </div>
      )}

      {mo && (
        <XemHoaDon
          khoa={mo}
          layXml={layXml}
          dong={() => setMo(null)}
          truoc={viTri > 0 ? () => setMo(loc[viTri - 1].khoa) : undefined}
          sau={viTri >= 0 && viTri < loc.length - 1 ? () => setMo(loc[viTri + 1].khoa) : undefined}
        />
      )}
    </div>
  )
}

/** Hộp xem một hoá đơn: tải file XML gốc (phiên này / mây), đọc, hiện như bản in */
function XemHoaDon({ khoa, layXml, dong, truoc, sau }: {
  khoa: string
  layXml: (khoa: string) => Promise<{ ten: string; du: Uint8Array } | null>
  dong: () => void
  truoc?: () => void
  sau?: () => void
}) {
  const [tt, setTt] = useState<{ khoa: string; tep?: { ten: string; du: Uint8Array } | null; inv?: HoaDonXem; loi?: string } | null>(null)
  useEffect(() => {
    let huy = false
    layXml(khoa).then(
      (tep) => {
        if (huy) return
        if (!tep) return setTt({ khoa, tep: null })
        try {
          setTt({ khoa, tep, inv: parseInvoice(new TextDecoder().decode(tep.du), tep.ten) })
        } catch (e) {
          setTt({ khoa, tep, loi: (e as Error).message })
        }
      },
      (e) => !huy && setTt({ khoa, loi: `Không tải được file từ mây: ${(e as Error).message}` }),
    )
    return () => {
      huy = true
    }
  }, [khoa, layXml])
  useEffect(() => {
    const phim = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dong()
      if (e.key === 'ArrowLeft' && truoc) truoc()
      if (e.key === 'ArrowRight' && sau) sau()
    }
    window.addEventListener('keydown', phim)
    return () => window.removeEventListener('keydown', phim)
  }, [dong, truoc, sau])
  const xong = tt?.khoa === khoa ? tt : null

  function inRa() {
    document.body.classList.add('in-hoa-don')
    const bo = () => {
      document.body.classList.remove('in-hoa-don')
      window.removeEventListener('afterprint', bo)
    }
    window.addEventListener('afterprint', bo)
    window.print()
  }

  return createPortal(
    <div className="hop-hoa-don fixed inset-0 z-50 overflow-auto bg-slate-900/50 p-2 sm:p-6" onClick={dong}>
      <div className="mx-auto max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <div className="khong-in mb-2 flex flex-wrap items-center gap-2 rounded-xl bg-white p-2">
          <button onClick={truoc} disabled={!truoc} className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40">‹ Trước</button>
          <button onClick={sau} disabled={!sau} className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40">Sau ›</button>
          <span className="flex-1" />
          {xong?.tep && <button onClick={() => taiVe(xong.tep!.ten, xong.tep!.du)} className="rounded-lg border border-emerald-600 px-3 py-1.5 text-emerald-700">⬇ Tải file XML gốc</button>}
          {xong?.inv && <button onClick={inRa} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-white">In / Lưu PDF</button>}
          <button onClick={dong} className="rounded-lg border border-slate-300 px-3 py-1.5">✕ Đóng</button>
        </div>
        {!xong ? (
          <div className="rounded-xl bg-white p-6 text-center text-slate-600">Đang mở hoá đơn…</div>
        ) : xong.loi ? (
          <div className="rounded-xl bg-white p-6 text-red-700">⛔ {xong.loi}</div>
        ) : !xong.inv ? (
          <div className="rounded-xl bg-white p-6 text-slate-700">
            Chưa có file XML gốc của hoá đơn này để xem bản in (hoá đơn nạp lúc chưa đăng nhập, hoặc nạp ở máy khác bằng bản app cũ). Đăng nhập rồi nạp lại file XML là xem được.
          </div>
        ) : (
          <>
            <div className="khong-in mb-2 space-y-1">
              {xong.inv.kiem.map((k, i) => (
                <div key={i} className={`rounded-lg px-3 py-2 text-sm ${k.muc === 'dat' ? 'bg-emerald-50 text-emerald-800' : k.muc === 'canhBao' ? 'bg-red-50 text-red-800' : 'bg-sky-50 text-sky-900'}`}>
                  {k.muc === 'dat' ? '✅ ' : k.muc === 'canhBao' ? '⚠️ ' : 'ℹ️ '}{k.noiDung}
                </div>
              ))}
              <div className="rounded-lg bg-white/90 px-3 py-2 text-xs text-slate-600">
                File: {xong.tep!.ten} · chuẩn XML {xong.inv.pban || '?'} · app chỉ hiển thị và cộng tiền, <b>không kiểm chữ ký số</b>.
              </div>
            </div>
            <BanInHoaDon inv={xong.inv} />
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

function DongBen({ ben, laBan, httt }: { ben: BenHoaDon | null; laBan: boolean; httt: string }) {
  if (!ben) return null
  const o = ben.o
  const dong: [string, string][] = [
    [laBan ? 'Đơn vị bán hàng' : 'Đơn vị mua hàng', o.Ten ?? ''],
    ['Họ tên người mua hàng', laBan ? '' : o.HVTNMHang ?? ''],
    ['Mã số thuế', o.MST ?? ''],
    ['Mã khách hàng', o.MKHang ?? ''],
    ['Mã ĐVQHNS', o.MDVQHNSach ?? ''],
    ['Địa chỉ', o.DChi ?? ''],
    ['Điện thoại', o.SDThoai ?? ''],
    ['Email', o.DCTDTu ?? ''],
    ['Số tài khoản', o.STKNHang ? `${o.STKNHang}${o.TNHang ? ` tại ${o.TNHang}` : ''}` : ''],
    ['Tên cửa hàng', o.TCHang ?? ''],
    ['Điểm kinh doanh', [o.TDDKDoanh, o.DCDDKDoanh].filter(Boolean).join(' – ')],
    ['Fax', o.Fax ?? ''],
    ['Website', o.Website ?? ''],
    ['Hình thức thanh toán', laBan ? '' : HTTT[httt] ?? httt],
  ]
  return (
    <div className="border-t border-dashed border-slate-300 py-2">
      {dong.filter((d) => d[1]).map(([k, v], i) => (
        <div key={k} className="flex gap-2">
          <span className="w-40 shrink-0 text-slate-500 sm:w-48">{k}:</span>
          <span className={i === 0 ? 'font-semibold uppercase' : ''}>{v}</span>
        </div>
      ))}
    </div>
  )
}

function Dau({ ky, nhan }: { ky: ChuKy | null; nhan: string }) {
  if (!ky) return <div className="inline-block rounded border border-dashed border-slate-400 px-3 py-2 text-slate-500">Không có chữ ký số</div>
  return (
    <div className="inline-block rounded border-2 border-red-600 px-3 py-2 text-left text-xs text-red-700">
      ✔ {nhan}<br />
      <b>Ký bởi:</b> {ky.ten || ky.chuThe || '(không rõ tên)'}<br />
      <b>Ký ngày:</b> {ngayGio(ky.luc)}
    </div>
  )
}

/** Bản thể hiện của hoá đơn (giống tờ in) */
export function BanInHoaDon({ inv }: { inv: HoaDonXem }) {
  const tsChung = inv.thueSuat.length === 1 ? inv.thueSuat[0].ts : ''
  const bangThue = inv.thueSuat.length > 1 || inv.thueSuat.some((t) => t.ts && !inv.dong.every((d) => d.ts === t.ts))
  const khac = [...inv.khacChung, ...inv.khacToan, ...(inv.ban?.khac ?? []), ...(inv.mua?.khac ?? [])]
  const lq = inv.lienQuan
  const tong: [string, number | null][] = [
    ['Cộng tiền hàng', inv.tongTruocThue],
    ...(inv.ckTM ? [['Chiết khấu thương mại', inv.ckTM] as [string, number]] : []),
    [`Tiền thuế GTGT${tsChung ? ` (${tsChung})` : ''}`, inv.tongThue],
    ...inv.phi.map((p) => [p.ten || 'Phí', p.tien] as [string, number | null]),
  ]
  return (
    <div className="ban-in-hd rounded-xl bg-white p-4 text-sm text-slate-900 shadow sm:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1 text-center">
          <h2 className="text-xl font-bold uppercase text-red-700">{inv.loai}</h2>
          <div className="italic text-slate-500">(Bản thể hiện của hoá đơn điện tử)</div>
          <div>Ngày {ngayIn(inv.ngay).replace(/\//g, ' / ')}</div>
        </div>
        <div className="sm:w-48">
          Mẫu số: <b>{inv.mau}</b><br />
          Ký hiệu: <b>{inv.kyHieu}</b><br />
          Số: <b className="text-red-700">{inv.so}</b>
        </div>
      </div>
      <div className="mt-2 text-center">
        {inv.mccqt ? <>Mã của cơ quan thuế: <b className="break-all">{inv.mccqt}</b></> : <i className="text-slate-500">(Hoá đơn không có mã của cơ quan thuế)</i>}
      </div>
      {lq && (
        <div className="mt-2 rounded bg-amber-50 px-2 py-1">
          <b>Hoá đơn liên quan ({TINH_CHAT_LQ[lq.tc] ?? 'liên quan'}):</b> mẫu {lq.mau}, ký hiệu {lq.kh}, số {lq.so}, ngày {ngayIn(lq.ngay)}{lq.gc ? ` — ${lq.gc}` : ''}
        </div>
      )}
      <div className="mt-3">
        <DongBen ben={inv.ban} laBan httt={inv.httt} />
        <DongBen ben={inv.mua} laBan={false} httt={inv.httt} />
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="bg-slate-100">
              {['STT', 'Tên hàng hoá, dịch vụ', 'ĐVT', 'Số lượng', 'Đơn giá', 'Chiết khấu', 'Thuế suất', 'Thành tiền'].map((h) => <th key={h} className="border border-slate-300 p-1">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {inv.dong.length ? inv.dong.map((d, i) => {
              const them = [...d.trung, ...d.khac].map((x) => `${x.k}: ${x.v}`).join(' · ')
              return (
                <tr key={i} className={d.tchat === '2' ? 'bg-emerald-50' : d.tchat === '3' ? 'bg-amber-50' : ''}>
                  <td className="border border-slate-300 p-1 text-center">{d.stt}</td>
                  <td className="border border-slate-300 p-1">
                    {d.ten}{d.tchat === '2' && <i> (khuyến mại)</i>}{d.tchat === '3' && <i> (chiết khấu)</i>}
                    {d.ma && <div className="text-xs text-slate-500">Mã: {d.ma}</div>}
                    {them && <div className="text-xs text-slate-500">{them}</div>}
                  </td>
                  <td className="border border-slate-300 p-1 text-center">{d.dvt}</td>
                  <td className="border border-slate-300 p-1 text-right">{tienXem(d.sl)}</td>
                  <td className="border border-slate-300 p-1 text-right">{tienXem(d.dg)}</td>
                  <td className="border border-slate-300 p-1 text-right">{d.stck ? `${tienXem(d.stck)}${d.tlck ? ` (${tienXem(d.tlck)}%)` : ''}` : ''}</td>
                  <td className="border border-slate-300 p-1 text-center">{d.ts}</td>
                  <td className="border border-slate-300 p-1 text-right">{tienXem(d.tien)}</td>
                </tr>
              )
            }) : (
              <tr><td colSpan={8} className="border border-slate-300 p-2 text-center italic">Không có dòng hàng</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {bangThue && (
        <table className="mt-2 ml-auto border-collapse text-xs sm:text-sm">
          <thead><tr className="bg-slate-100"><th className="border border-slate-300 p-1">Thuế suất</th><th className="border border-slate-300 p-1">Tiền hàng</th><th className="border border-slate-300 p-1">Tiền thuế</th></tr></thead>
          <tbody>
            {inv.thueSuat.map((t, i) => (
              <tr key={i}><td className="border border-slate-300 p-1 text-center">{t.ts}</td><td className="border border-slate-300 p-1 text-right">{tienXem(t.tien)}</td><td className="border border-slate-300 p-1 text-right">{tienXem(t.thue)}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-3 ml-auto grid max-w-md grid-cols-[1fr_auto] gap-x-4 gap-y-0.5">
        {tong.filter((r) => r[1] != null).map(([k, v]) => (
          <div key={k} className="contents"><div>{k}:</div><div className="text-right">{tienXem(v)}</div></div>
        ))}
        <div className="font-bold">Tổng tiền thanh toán:</div>
        <div className="text-right font-bold">{tienXem(inv.tong)}{inv.tienTe !== 'VND' ? ` ${inv.tienTe}` : ''}</div>
      </div>
      {inv.bangChu && <div className="mt-2 italic">Số tiền viết bằng chữ: {inv.bangChu}</div>}
      {khac.length > 0 && (
        <div className="mt-2 border-t border-dashed border-slate-300 pt-2 text-xs">
          {khac.map((x, i) => <div key={i}>{x.k}: <b>{x.v}</b></div>)}
        </div>
      )}
      <div className="mt-4 grid grid-cols-2 gap-4 text-center">
        <div><h4 className="mb-2 font-semibold">Người mua hàng</h4>{inv.kyMua ? <Dau ky={inv.kyMua} nhan="Người mua đã ký số" /> : <div className="text-slate-500">(Không bắt buộc ký)</div>}</div>
        <div><h4 className="mb-2 font-semibold">Người bán hàng</h4><Dau ky={inv.kyBan} nhan="Người bán đã ký số" /></div>
      </div>
      {inv.kyCqt && <div className="mt-3 text-center"><Dau ky={inv.kyCqt} nhan="Cơ quan thuế đã ký cấp mã" /></div>}
      {inv.mstTcgp && <div className="mt-3 text-center text-xs text-slate-500">MST tổ chức cung cấp giải pháp HĐĐT: {inv.mstTcgp}</div>}
      <div className="mt-4 border-t border-slate-200 pt-2 text-center text-xs text-slate-500">(C) August87 - 0982722036</div>
    </div>
  )
}

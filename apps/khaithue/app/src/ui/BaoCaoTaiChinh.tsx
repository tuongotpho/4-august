// Tab "Báo cáo tài chính":
//  - LapBaoCaoTaiChinh: lập bản nháp BCTC từ dữ liệu app (core/lapBctc.ts) theo mẫu TT200 / TT99 (2026+) / TT58 (doanh nghiệp siêu nhỏ, 2027+);
//    mỗi số bấm vào xem nguồn, chỗ thiếu dữ liệu nhập tay, không ép cho cân.
//  - BaoCaoTaiChinhDN: thả file XML BCTC đã nộp (tờ khai 402) -> xem 3 bảng + kết quả soát chéo (giai đoạn A, báo cáo 19–20).
import { Fragment, useMemo, useState } from 'react'
import type { Kho, ToKhaiKhac } from '../core/kho'
import { mauCua, soatBctc, type SoLieuBctc } from '../core/bctc'
import { cheDoGoiY, lapBctcTheoMau, nhanDienSieuNho, type CheDoBctc, type NguonSo, type NhapTayBctc } from '../core/lapBctc'
import type { GhiChuKiem } from '../core/xemHoaDon'
import { dienMauWord } from '../core/xuatWordBctc'
import { tenFileXmlBctc, xmlBctc } from '../core/xmlBctc'
import type { HoSoDN } from '../core/types'
import { VungThaFile } from './chung'
import { ItaxViewer } from './ItaxViewer'

const tien = (v: number | undefined) => (v == null ? '' : Math.round(v).toLocaleString('vi-VN'))
const ngayIn = (iso: string) => iso.split('-').reverse().join('/')

type Bang = 'cdkt' | 'kqkd' | 'lctt'

const MA_HTKK: Record<CheDoBctc, string> = {
  TT133: '683',
  TT58: '1280',
  TT99: '1281',
  TT200: '402',
}

const GIAI_THICH_MAU: Record<CheDoBctc, string> = {
  TT200: 'Thông tư 200/2014/TT-BTC — dùng cho BCTC năm 2025 trở về trước (như các năm đã nộp).',
  TT133: 'Thông tư 133/2016/TT-BTC — chế độ doanh nghiệp nhỏ và vừa (vẫn còn hiệu lực, TT99 không thay thế). Bắt buộc: B01a-DNN Báo cáo tình hình tài chính, B02-DNN, B09-DNN thuyết minh; gửi cơ quan thuế kèm F01-DNN bảng cân đối tài khoản. B03-DNN lưu chuyển tiền tệ không bắt buộc.',
  TT99: 'Thông tư 99/2025/TT-BTC (thay TT200) — áp dụng cho năm tài chính bắt đầu từ 01/01/2026: B01-DN Báo cáo tình hình tài chính, B02-DN, B03-DN.',
  TT58: 'Thông tư 58/2026/TT-BTC — doanh nghiệp siêu nhỏ, áp dụng cho năm tài chính bắt đầu từ 01/07/2026 (công ty theo năm dương lịch: từ năm 2027). Nộp thuế TNDN theo thu nhập: lập và nộp B01-DNSN + B02-DNSN trong 90 ngày.',
}

function DsKiem({ kiem }: { kiem: GhiChuKiem[] }) {
  return (
    <div className="space-y-1">
      {kiem.map((k, i) => (
        <div key={i} className={`rounded-lg px-3 py-2 ${k.muc === 'dat' ? 'bg-emerald-50 text-emerald-800' : k.muc === 'canhBao' ? 'bg-red-50 text-red-800' : 'bg-sky-50 text-sky-900'}`}>
          {k.muc === 'dat' ? '✅ ' : k.muc === 'canhBao' ? '⚠️ ' : 'ℹ️ '}{k.noiDung}
        </div>
      ))}
    </div>
  )
}

/** Ba (hoặc hai) bảng của một BCTC, theo đúng mẫu của chế độ; có nguồn thì bấm dòng để xem */
function BaBang({ b, nguon }: { b: SoLieuBctc; nguon?: Record<string, NguonSo> }) {
  const mau = mauCua(b.cheDo)
  const [bang, setBang] = useState<Bang>('cdkt')
  const coLctt = mau.coLcttVaThuyetMinh
  const tab = ([['cdkt', `${mau.tenB01} (B01)`], ['kqkd', 'Kết quả kinh doanh (B02)'], ...(coLctt ? [['lctt', 'Lưu chuyển tiền tệ (B03)']] : [])] as [Bang, string][])
  const dangXem: Bang = !coLctt && bang === 'lctt' ? 'cdkt' : bang
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {tab.map(([k, ten]) => (
          <button key={k} onClick={() => setBang(k)} className={`-mb-px rounded-t-lg border px-3 py-1.5 ${dangXem === k ? 'border-slate-200 border-b-white bg-white font-medium' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{ten}</button>
        ))}
      </div>
      {dangXem === 'cdkt' && <BangSo ten={mau.tenCdkt} a={b.cdkt.cuoi} b={b.cdkt.dau} cotA="Số cuối năm" cotB="Số đầu năm" tong={mau.dongTong} nguon={nguon} tienTo="cdkt" />}
      {dangXem === 'kqkd' && <BangSo ten={mau.tenKqkd} a={b.kqkd.nay} b={b.kqkd.truoc} cotA="Năm nay" cotB="Năm trước" tong={mau.dongTong} nguon={nguon} tienTo="kqkd" />}
      {dangXem === 'lctt' && (b.lctt ? (
        <BangSo
          ten={b.lctt.phuongPhap === 'trucTiep' ? mau.tenLctt : Object.keys(b.lctt.nay).map((m) => [m, `Chỉ tiêu mã ${m}`] as [string, string])}
          a={b.lctt.nay} b={b.lctt.truoc} cotA="Năm nay" cotB="Năm trước" tong={new Set(['20', '30', '40', '50', '70'])} nguon={nguon} tienTo="lctt"
        />
      ) : <p className="text-slate-500">Không có báo cáo lưu chuyển tiền tệ.</p>)}
      <p className="text-xs text-slate-500">Chỉ hiện dòng có số và các dòng tổng (mẫu cho phép bỏ dòng không có số nhưng không đánh lại mã).{nguon ? ' Bấm một dòng để xem số lấy từ đâu.' : ''}</p>
    </div>
  )
}

function BangSo({ ten, a, b, cotA, cotB, tong, nguon, tienTo }: {
  ten: [string, string][]; a: Record<string, number>; b: Record<string, number>; cotA: string; cotB: string; tong: Set<string>; nguon?: Record<string, NguonSo>; tienTo?: string
}) {
  const [mo, setMo] = useState<string | null>(null)
  const dong = ten.filter(([m]) => m.startsWith('#') || tong.has(m) || a[m] || b[m])
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full">
        <thead className="bg-slate-100 text-left text-xs uppercase text-slate-500">
          <tr><th className="w-14 p-2">Mã</th><th className="p-2">Chỉ tiêu</th><th className="p-2 text-right">{cotA}</th><th className="p-2 text-right">{cotB}</th></tr>
        </thead>
        <tbody>
          {dong.map(([m, t]) => {
            const n = nguon?.[`${tienTo}:${m}`]
            // Dòng tiêu đề nhóm của mẫu ("TÀI SẢN", "NGUỒN VỐN"): không mã, không số
            if (m.startsWith('#')) return <tr key={m} className="border-t border-slate-200 bg-slate-100/70"><td /><td colSpan={3} className="p-2 font-bold uppercase">{t}</td></tr>
            return (
              <Fragment key={m}>
                <tr onClick={() => n && setMo(mo === m ? null : m)} className={`border-t border-slate-100 ${tong.has(m) ? 'bg-slate-50 font-semibold' : ''} ${n ? 'cursor-pointer hover:bg-emerald-50' : ''}`}>
                  <td className="p-2 text-slate-500">{m}</td>
                  <td className="p-2">
                    {t}
                    {n?.nhapTay && <span className="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-normal text-violet-800">nhập tay</span>}
                    {n?.thieu && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-normal text-amber-800">thiếu dữ liệu</span>}
                    {n && <span className="ml-1 text-xs font-normal text-slate-400">{mo === m ? '▾' : 'ⓘ'}</span>}
                  </td>
                  <td className="whitespace-nowrap p-2 text-right">{tien(a[m] ?? 0)}</td>
                  <td className="whitespace-nowrap p-2 text-right text-slate-500">{tien(b[m] ?? 0)}</td>
                </tr>
                {n && mo === m && <tr className="bg-emerald-50/60"><td /><td colSpan={3} className="px-2 pb-2 text-sm text-slate-700">{n.moTa}</td></tr>}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Ô nhập số tiền: gõ "1.234.567" hay "1234567" đều được; để trống = không nhập */
function OSo({ nhan, giaTri, doi, goiY, donVi = 'đ' }: { nhan: string; giaTri: number | undefined; doi: (v: number | undefined) => void; goiY?: string; donVi?: string }) {
  // Đổi năm / công ty thì ô được dựng lại (key ở nơi dùng), nên chỉ cần lấy giá trị ban đầu
  const [chu, setChu] = useState(giaTri == null ? '' : giaTri.toLocaleString('vi-VN'))
  return (
    <label className="block text-sm">
      <span className="text-slate-600">{nhan}</span>
      <div className="mt-0.5 flex items-center gap-1">
        <input
          value={chu}
          inputMode="numeric"
          placeholder={goiY ?? 'chưa nhập'}
          onChange={(e) => setChu(e.target.value)}
          onBlur={() => {
            const s = chu.replace(/[^\d-]/g, '')
            doi(s === '' || s === '-' ? undefined : Number(s))
          }}
          className="w-full min-w-0 rounded-lg border border-slate-300 px-2 py-1.5 text-right"
        />
        <span className="text-xs text-slate-500">{donVi}</span>
      </div>
    </label>
  )
}

const khoaNhap = (mst: string, nam: number) => `bctc-nhap:${mst}:${nam}`
function docNhap(mst: string, nam: number): NhapTayBctc {
  try {
    return JSON.parse(localStorage.getItem(khoaNhap(mst, nam)) ?? '{}') as NhapTayBctc
  } catch {
    return {}
  }
}

/** Mẫu Word của Thông tư đã có trong app (public/mau/bctc) — điền số vào đúng ô, giữ nguyên khổ mẫu */
const MAU_WORD: Partial<Record<CheDoBctc, { tep: string; ten: string; bang: 'cdkt' | 'kqkd' }[]>> = {
  TT58: [{ tep: 'B01-DNSN.docx', ten: 'Mau-B01-DNSN', bang: 'cdkt' }, { tep: 'B02-DNSN.docx', ten: 'Mau-B02-DNSN', bang: 'kqkd' }],
}

async function xuatWord(b: SoLieuBctc, mau: CheDoBctc, hoSo: { tenNNT: string; dchiNNT: string; nguoiKy: string; mst: string }) {
  for (const m of MAU_WORD[mau] ?? []) {
    const r = await fetch(`mau/bctc/${m.tep}`)
    if (!r.ok) throw new Error(`Không tải được mẫu ${m.tep}`)
    const [cot1, cot2] = m.bang === 'cdkt' ? [b.cdkt.cuoi, b.cdkt.dau] : [b.kqkd.nay, b.kqkd.truoc]
    const { docx } = dienMauWord(new Uint8Array(await r.arrayBuffer()), cot1, cot2, {
      donVi: hoSo.tenNNT, diaChi: hoSo.dchiNNT, taiNgay: b.denNgay, nam: b.nam, nguoiDaiDien: hoSo.nguoiKy || undefined,
    })
    const url = URL.createObjectURL(new Blob([docx as Uint8Array<ArrayBuffer>], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${m.ten}-${b.nam}-${hoSo.mst}.docx`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }
}

/** Xuất file XML đúng khung HTKK 5.8.1: TT133=683, TT58=1280, TT99=1281, TT200=402 (chưa ký số) */
function xuatXml(b: SoLieuBctc, mau: CheDoBctc, hoSo: HoSoDN) {
  const homNay = new Date()
  const ngayLap = `${homNay.getFullYear()}-${String(homNay.getMonth() + 1).padStart(2, '0')}-${String(homNay.getDate()).padStart(2, '0')}`
  const xml = xmlBctc(mau, b, hoSo, ngayLap)
  const url = URL.createObjectURL(new Blob([xml], { type: 'application/xml;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = tenFileXmlBctc(mau, b, hoSo.mst)
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function LapBaoCaoTaiChinh({ kho, mst }: { kho: Kho; mst: string }) {
  const [homNay] = useState(() => new Date())
  const nayNam = homNay.getFullYear()
  const [nam, setNam] = useState(homNay.getMonth() < 3 ? nayNam - 1 : nayNam)
  const [mauChon, setMauChon] = useState<CheDoBctc | ''>('')
  const [cheDoXem, setCheDoXem] = useState<'bang' | 'itax'>('bang')
  // Số nhập tay theo công ty + năm: đổi năm thì đọc lại
  const [nhapTheo, setNhapTheo] = useState<{ khoa: string; nhap: NhapTayBctc }>(() => ({ khoa: khoaNhap(mst, nam), nhap: docNhap(mst, nam) }))
  const nhap = nhapTheo.khoa === khoaNhap(mst, nam) ? nhapTheo.nhap : docNhap(mst, nam)
  const setNhap = (x: NhapTayBctc) => setNhapTheo({ khoa: khoaNhap(mst, nam), nhap: x })
  const [xemGd, setXemGd] = useState(false)
  const datNhap = (x: Partial<NhapTayBctc>) => {
    const moi = { ...nhap, ...x }
    for (const k of Object.keys(moi) as (keyof NhapTayBctc)[]) if (moi[k] == null) delete moi[k]
    setNhap(moi)
    try {
      localStorage.setItem(khoaNhap(mst, nam), JSON.stringify(moi))
    } catch { /* trình duyệt chặn lưu: vẫn tính được, chỉ không nhớ */ }
  }
  const goiY = useMemo(() => cheDoGoiY(kho, mst, nam), [kho, mst, nam])
  const mau: CheDoBctc = mauChon || goiY
  const sieuNho = useMemo(() => nhanDienSieuNho(kho, mst, nam), [kho, mst, nam])
  const r = useMemo(() => lapBctcTheoMau(kho, mst, nam, mau, nhap), [kho, mst, nam, mau, nhap])
  // Bản nháp chưa có thuyết minh: bỏ lưu ý "file không có thuyết minh" (dành cho BCTC đã nộp), ghi chú riêng bên dưới
  const kiem = useMemo(() => soatBctc(r.bctc).filter((x) => !/thuyết minh báo cáo tài chính/.test(x.noiDung)), [r])
  const cacNam = Array.from({ length: nayNam - 2023 }, (_, i) => nayNam - i)
  const mauHopLe: CheDoBctc[] = nam >= 2026 ? ['TT133', 'TT58', 'TT99'] : ['TT200', 'TT133', 'TT58']

  const hoSoDN = useMemo((): HoSoDN => {
    return kho.congTy[mst]?.hoSo ?? {
      mst, tenNNT: `Công ty ${mst}`, dchiNNT: 'Trụ sở chính', phuongXa: '', maXaNNT: '',
      maTinhNNT: '101', tenTinhNNT: 'Hà Nội', dthoaiNNT: '', emailNNT: '',
      maCQTNoiNop: '10100', tenCQTNoiNop: 'Thuế cơ sở', nguoiKy: '',
    }
  }, [kho, mst])

  const ngayLapStr = useMemo(() => {
    return `${homNay.getFullYear()}-${String(homNay.getMonth() + 1).padStart(2, '0')}-${String(homNay.getDate()).padStart(2, '0')}`
  }, [homNay])

  const xmlHienTai = useMemo(() => {
    try {
      return xmlBctc(mau, r.bctc, hoSoDN, ngayLapStr)
    } catch (e) {
      console.warn('Lỗi tạo XML bản in BCTC:', e)
      return null
    }
  }, [mau, r.bctc, hoSoDN, ngayLapStr])

  return (
    <div className="space-y-4 text-sm">
      <div>
        <h3 className="text-lg font-semibold">🧮 Lập báo cáo tài chính (bản nháp từ dữ liệu app)</h3>
        <p className="text-slate-600">App tự tính từ hoá đơn, tờ khai, sao kê, sổ quỹ đã nạp; bấm từng dòng để xem số lấy từ đâu. <b>Không ép cho cân</b> — tài sản lệch nguồn vốn bao nhiêu báo đúng bấy nhiêu. Đây là bản nháp có căn cứ, người lập và người đại diện vẫn phải kiểm, ký.</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        {/* Cột trái: chọn năm, mẫu, nhập tay */}
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-slate-600">Năm tài chính</span>
              <select value={nam} onChange={(e) => (setNam(Number(e.target.value)), setMauChon(''))} className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5">
                {cacNam.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-slate-600">Mẫu báo cáo</span>
              <select value={mau} onChange={(e) => setMauChon(e.target.value as CheDoBctc)} className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5">
                {mauHopLe.map((m) => <option key={m} value={m}>{m === 'TT58' ? 'TT58 – DN siêu nhỏ' : m}{m === goiY ? ' (gợi ý)' : ''}</option>)}
              </select>
            </label>
          </div>
          <p className="rounded-lg bg-white px-2 py-1.5 text-xs text-slate-600">{GIAI_THICH_MAU[mau]}</p>
          {mau === 'TT58' && nam < 2027 && <p className="rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-900">⚠️ Năm {nam}: TT58 chỉ áp dụng cho năm tài chính bắt đầu từ 01/07/2026 — năm này thường chưa dùng được, xem để tham khảo.</p>}
          <p className={`rounded-lg px-2 py-1.5 text-xs ${sieuNho.sieuNho ? 'bg-emerald-50 text-emerald-900' : 'bg-white text-slate-600'}`}>
            {sieuNho.sieuNho ? '✅ Có vẻ là doanh nghiệp siêu nhỏ. ' : 'Chưa đủ căn cứ là doanh nghiệp siêu nhỏ. '}{sieuNho.giaiThich}
          </p>
          <div key={khoaNhap(mst, nam)} className="space-y-2 border-t border-slate-200 pt-2">
            <div className="font-medium">Số nhập tay (app không có dữ liệu)</div>
            <OSo nhan="Hàng tồn kho cuối năm (theo kiểm kê) *" giaTri={nhap.tonKhoCuoi} doi={(v) => datNhap({ tonKhoCuoi: v })} goiY="bắt buộc để tính giá vốn" />
            <OSo nhan="Tỷ lệ lương tính vào chi phí bán hàng" giaTri={nhap.tyLeLuongBanHang == null ? undefined : Math.round(nhap.tyLeLuongBanHang * 100)} doi={(v) => datNhap({ tyLeLuongBanHang: v == null ? undefined : Math.min(100, Math.max(0, v)) / 100 })} goiY="0 (cả vào quản lý)" donVi="%" />
            <OSo nhan="Chi phí không được trừ khi tính thuế TNDN" giaTri={nhap.chiPhiKhongTru} doi={(v) => datNhap({ chiPhiKhongTru: v })} goiY="0" />
            <OSo nhan="Vốn góp thêm trong năm" giaTri={nhap.vonGopTang} doi={(v) => datNhap({ vonGopTang: v })} goiY="tự lấy từ sao kê" />
            <OSo nhan="Doanh thu tài chính (lãi tiền gửi)" giaTri={nhap.doanhThuTaiChinh} doi={(v) => datNhap({ doanhThuTaiChinh: v })} goiY="tự lấy từ sao kê" />
            <p className="text-xs text-slate-500">Số nhập tay nhớ trên máy này theo công ty và năm.</p>
          </div>
        </div>

        {/* Cột phải: tình trạng + bảng */}
        <div className="min-w-0 space-y-3">
          <div className={`rounded-xl px-3 py-2 ${Math.abs(r.chenhLech) > 1 ? 'border border-red-200 bg-red-50 text-red-800' : 'border border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
            {Math.abs(r.chenhLech) > 1
              ? <>⚠️ <b>Tài sản lệch nguồn vốn {tien(r.chenhLech)} đ.</b> App không tự bù vào khoản nào. Thường do: thiếu sao kê / phiếu quỹ một số tháng, giao dịch chưa ghép hoá đơn, tồn kho chưa nhập, số đầu năm (BCTC năm trước) sai, hoặc chi phí không có hoá đơn.</>
              : <>✅ Tài sản = nguồn vốn = {tien(r.bctc.cdkt.cuoi[mauCua(r.bctc.cheDo).tongTaiSan])} đ.</>}
          </div>
          {r.thieu.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
              <div className="font-medium">Còn thiếu ({r.thieu.length})</div>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">{r.thieu.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          )}
          <DsKiem kiem={kiem} />
          {MAU_WORD[mau] ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => { const h = kho.congTy[mst]?.hoSo; if (h) xuatWord(r.bctc, mau, h).catch((e) => alert((e as Error).message)) }}
                className="rounded-lg bg-emerald-700 px-3 py-1.5 font-medium text-white"
              >⬇ Xuất Word đúng mẫu ({(MAU_WORD[mau] ?? []).map((m) => m.tep.replace('.docx', '')).join(' + ')})</button>
              <span className="text-xs text-slate-500">Điền số vào chính mẫu Word của Thông tư: đơn vị, địa chỉ, ngày, đơn vị tính, người đại diện; chữ ký để trống.</span>
            </div>
          ) : <p className="text-xs text-slate-500">Mẫu {mau}: chưa có file mẫu Word trong app — gửi mẫu Word (như đã gửi cho TT58) để xuất đúng mẫu.</p>}

          {/* Thanh chuyển chế độ xem & Xuất XML chuẩn HTKK */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-2">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setCheDoXem('bang')}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${cheDoXem === 'bang' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                📊 Bảng số liệu & Nguồn gốc
              </button>
              <button
                type="button"
                onClick={() => setCheDoXem('itax')}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors flex items-center gap-1 cursor-pointer ${cheDoXem === 'itax' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                📑 Bản in chuẩn iTax / HTKK
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { const h = kho.congTy[mst]?.hoSo; if (h) xuatXml(r.bctc, mau, h) }}
                className="rounded-lg border border-emerald-600 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center gap-1 cursor-pointer"
                title={`Xuất file XML chuẩn HTKK 5.8.1 (mẫu ${MA_HTKK[mau]})`}
              >
                ⬇ Xuất XML HTKK (mẫu {MA_HTKK[mau]})
              </button>
            </div>
          </div>

          {cheDoXem === 'itax' ? (
            xmlHienTai ? (
              <div className="rounded-xl border border-slate-300 overflow-hidden shadow-sm" style={{ minHeight: '600px' }}>
                <ItaxViewer xml={xmlHienTai} tenFile={tenFileXmlBctc(mau, r.bctc, mst)} />
              </div>
            ) : (
              <p className="text-xs text-red-600">Chưa tạo được bản in XML cho mẫu này.</p>
            )
          ) : (
            <>
              {mau !== 'TT58' && <p className="text-xs text-slate-500">Thuyết minh báo cáo tài chính (B09-DN) app chưa lập — người lập soạn riêng.</p>}
              <BaBang b={r.bctc} nguon={r.nguon} />
            </>
          )}
          {r.chuaPhanLoai.length > 0 && (
            <div className="rounded-xl border border-slate-200 p-3">
              <button className="text-emerald-700 underline" onClick={() => setXemGd(!xemGd)}>{xemGd ? 'Ẩn' : 'Xem'} {r.chuaPhanLoai.length} giao dịch ngân hàng chưa rõ loại</button>
              {xemGd && (
                <table className="mt-2 w-full text-xs">
                  <tbody>
                    {r.chuaPhanLoai.map((g, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="whitespace-nowrap p-1">{g.ngay}</td>
                        <td className="p-1">{g.noiDung}</td>
                        <td className="whitespace-nowrap p-1 text-right text-emerald-700">{g.vao ? `+${tien(g.vao)}` : ''}</td>
                        <td className="whitespace-nowrap p-1 text-right text-red-700">{g.ra ? `−${tien(g.ra)}` : ''}</td>
                        <td className="p-1 text-slate-500">tạm xếp mã {g.ma}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="mt-1 text-xs text-slate-500">Ghép các giao dịch này với hoá đơn ở tab 💳 Công nợ để xếp đúng dòng lưu chuyển tiền và công nợ.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function BaoCaoTaiChinhDN({ kho, mst, onFiles }: { kho: Kho; mst: string; onFiles: (f: File[]) => void }) {
  // Mỗi năm lấy bản mới nhất (bổ sung lần cao nhất)
  const ds = useMemo(() => {
    const theoNam = new Map<string, ToKhaiKhac & { bctc: SoLieuBctc }>()
    for (const t of Object.values(kho.toKhaiKhac?.[mst] ?? {})) {
      if (!t.bctc) continue
      const cu = theoNam.get(t.ky)
      if (!cu || t.soLan > cu.soLan) theoNam.set(t.ky, t as ToKhaiKhac & { bctc: SoLieuBctc })
    }
    return [...theoNam.values()].sort((a, b) => b.ky.localeCompare(a.ky))
  }, [kho, mst])
  const [chon, setChon] = useState<string | null>(null)
  const [cheDoXem, setCheDoXem] = useState<'bang' | 'itax'>('bang')
  const t = ds.find((x) => x.ky === chon) ?? ds[0]
  const kiem = useMemo(() => (t ? soatBctc(t.bctc) : []), [t])

  const xmlNop = useMemo(() => {
    if (!t) return null
    if (t.rawXml) return t.rawXml
    const hoSo = kho.congTy[mst]?.hoSo ?? {
      mst, tenNNT: `Công ty ${mst}`, dchiNNT: 'Trụ sở chính', phuongXa: '', maXaNNT: '',
      maTinhNNT: '101', tenTinhNNT: 'Hà Nội', dthoaiNNT: '', emailNNT: '',
      maCQTNoiNop: '10100', tenCQTNoiNop: 'Thuế cơ sở', nguoiKy: t.bctc.nguoiKy || '',
    }
    try {
      return xmlBctc(t.bctc.cheDo as CheDoBctc, t.bctc, hoSo, t.bctc.ngayLap)
    } catch {
      return null
    }
  }, [t, kho, mst])

  return (
    <div className="space-y-3 text-sm">
      <VungThaFile
        accept=".xml"
        onFiles={(f) => onFiles(f.filter((x) => /\.xml$/i.test(x.name)))}
        nhan={
          <>
            <div className="font-medium">Kéo thả file XML báo cáo tài chính đã nộp vào đây, hoặc bấm để chọn</div>
            <div className="mt-1 text-slate-600">File tờ khai BCTC theo TT200 (mẫu 402), TT133 (mẫu 683), TT99 (mẫu 1281) hoặc TT58 (mẫu 1280). App đọc các bảng, soát chéo và hiển thị bản in chuẩn form iTax Viewer. BCTC năm trước còn là số đầu năm cho phần lập ở trên.</div>
          </>
        }
      />
      {!t ? (
        <p className="text-slate-500">Chưa có báo cáo tài chính nào của công ty này. (BCTC nạp trước bản này cần thả lại file để app đọc số liệu.)</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {ds.length > 1 ? (
              <div className="flex flex-wrap gap-1.5">
                {ds.map((x) => (
                  <button key={x.ky} onClick={() => setChon(x.ky)} className={`rounded-full border px-3 py-1 text-xs cursor-pointer ${x.ky === t.ky ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-300 bg-white hover:border-emerald-500'}`}>
                    Năm {x.ky}
                  </button>
                ))}
              </div>
            ) : <div />}

            {/* Thanh chuyển chế độ xem */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setCheDoXem('bang')}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${cheDoXem === 'bang' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                📊 Bảng số liệu & Soát chéo
              </button>
              <button
                type="button"
                onClick={() => setCheDoXem('itax')}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors flex items-center gap-1 cursor-pointer ${cheDoXem === 'itax' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                📑 Bản in chuẩn iTax Viewer
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <b>BCTC năm {t.bctc.nam}</b> ({t.bctc.tuNgay} – {t.bctc.denNgay}) · chế độ {t.bctc.cheDo} · {t.loaiTKhai === 'B' ? `bổ sung lần ${t.soLan}` : 'chính thức'} · lập {ngayIn(t.bctc.ngayLap)}
            {t.bctc.nguoiKy && <> · ký: {t.bctc.nguoiKy}</>} · {t.bctc.daKiemToan ? 'đã kiểm toán' : 'chưa kiểm toán'}
          </div>

          {cheDoXem === 'itax' ? (
            xmlNop ? (
              <div className="rounded-xl border border-slate-300 overflow-hidden shadow-sm" style={{ minHeight: '600px' }}>
                <ItaxViewer xml={xmlNop} tenFile={t.tenFile} />
              </div>
            ) : (
              <p className="text-xs text-red-600">Chưa dựng được bản in chuẩn từ file này.</p>
            )
          ) : (
            <>
              <div data-soat-bctc>
                <DsKiem kiem={kiem} />
                <p className="mt-1 text-xs text-slate-500">App chỉ soát các con số trên báo cáo với nhau, chưa đối chiếu với hoá đơn, sao kê, sổ quỹ. Có cảnh báo thì xem lại sổ sách và cân nhắc nộp báo cáo bổ sung.</p>
              </div>
              <BaBang b={t.bctc} />
              <p className="text-xs text-slate-500">Số cuối năm {t.bctc.nam} là số đầu năm {Number(t.bctc.nam) + 1} khi lập báo cáo năm sau.</p>
            </>
          )}
        </>
      )}
    </div>
  )
}

// Tab "Lô hàng": ghép hoá đơn mua + cước + bán thành lô, xem tấn / lãi gộp, đính kèm giấy tờ chứng minh hàng thật
import { Fragment, useMemo, useRef, useState } from 'react'
import { tien } from '../core/nhan'
import { TEN_NHOM } from '../core/hoaDonGoc'
import { CHENH_CAN, goiYLo, TEN_GIAY_TO, type GiayTo, type KetQuaLo, type LoaiGiayTo, type LoHang, type TongHopLo } from '../core/loHang'
import { DanhSachCanhBao } from './chung'

type DongCho = TongHopLo['chuaVaoLo'][number]

const tan = (n: number | null) => (n === null ? '—' : `${n.toLocaleString('vi-VN', { maximumFractionDigits: 3 })} tấn`)
const homNay = () => new Date().toISOString().slice(0, 10)
const maMoi = () => `lo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

export interface ThaoTacLo {
  luu: (lo: LoHang) => Promise<void> | void
  xoa: (lo: LoHang) => Promise<void> | void
  /** null = chưa đăng nhập: chỉ ghi nhận tên giấy tờ, không lưu được file */
  taiGiayTo: ((lo: LoHang, loai: LoaiGiayTo, f: File) => Promise<GiayTo>) | null
  xoaGiayTo: (g: GiayTo) => Promise<void> | void
  moGiayTo: (g: GiayTo) => void
}

function ChonHoaDon({ ds, chon, setChon }: { ds: DongCho[]; chon: Set<string>; setChon: (s: Set<string>) => void }) {
  const [loc, setLoc] = useState('')
  const hien = ds.filter((h) => !loc || `${h.kh}-${h.so} ${h.ng} ${h.ten}`.toLowerCase().includes(loc.toLowerCase())).slice(0, 200)
  const dao = (k: string) => {
    const s = new Set(chon)
    if (s.has(k)) s.delete(k)
    else s.add(k)
    setChon(s)
  }
  return (
    <div>
      <input className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" placeholder="Lọc: số hoá đơn, tháng (vd /03/2025), tên đối tác…" value={loc} onChange={(e) => setLoc(e.target.value)} />
      <div className="max-h-72 overflow-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
            <tr><th className="p-1" /><th className="p-1">Loại</th><th className="p-1">Hoá đơn</th><th className="p-1">Ngày</th><th className="p-1">Đối tác</th><th className="p-1 text-right">Tấn</th><th className="p-1 text-right">Chưa thuế</th></tr>
          </thead>
          <tbody>
            {hien.map((h) => (
              <tr key={h.khoa} className={`cursor-pointer border-t border-slate-100 ${chon.has(h.khoa) ? 'bg-emerald-50' : ''}`} onClick={() => dao(h.khoa)}>
                <td className="p-1"><input type="checkbox" readOnly checked={chon.has(h.khoa)} /></td>
                <td className="p-1">{TEN_NHOM[h.nhom]}</td>
                <td className="p-1">{h.kh}-{h.so}</td>
                <td className="p-1">{h.ng}</td>
                <td className="p-1">{h.ten}</td>
                <td className="p-1 text-right">{h.tan === null ? '?' : h.tan.toLocaleString('vi-VN')}</td>
                <td className="p-1 text-right">{tien(h.v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-xs text-slate-500">Đã chọn {chon.size} hoá đơn. Tấn "?" = chưa có file gốc XML/PDF (gõ tay số tấn của lô nếu cần).</p>
    </div>
  )
}

function SoTay({ nhan, giaTri, doi }: { nhan: string; giaTri?: number; doi: (v?: number) => void }) {
  return (
    <label className="text-sm">
      {nhan}{' '}
      <input
        type="number" step="0.001" min="0" className="w-28 rounded border border-slate-300 px-2 py-1"
        value={giaTri ?? ''} placeholder="theo HĐ"
        onChange={(e) => doi(e.target.value === '' ? undefined : Number(e.target.value))}
      />
    </label>
  )
}

function ChiTietLo({ k, cho, tt, dangNhap }: { k: KetQuaLo; cho: DongCho[]; tt: ThaoTacLo; dangNhap: boolean }) {
  const lo = k.lo
  const [them, setThem] = useState(false)
  const [chon, setChon] = useState<Set<string>>(new Set())
  const [loaiGiay, setLoaiGiay] = useState<LoaiGiayTo>(k.giayToThieu[0] ?? 'phieuCan')
  const [dangTai, setDangTai] = useState(false)
  const [loi, setLoi] = useState('')
  const tepRef = useRef<HTMLInputElement>(null)
  const luu = (l: LoHang) => void Promise.resolve(tt.luu(l)).catch((e) => setLoi((e as Error).message))
  return (
    <div className="space-y-3 border-t border-slate-200 bg-slate-50 p-3 text-sm">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div>Giá vốn: <b>{tien(k.giaVon)}</b></div>
        <div>Cước xe: <b>{tien(k.cuoc)}</b></div>
        <div>Chi phí khác: <b>{tien(k.chiPhiKhac)}</b></div>
        <div>Doanh thu: <b>{tien(k.doanhThu)}</b></div>
        <div>Thuế đầu vào: {tien(k.thueDauVao)}</div>
        <div>Thuế đầu ra: {tien(k.thueDauRa)}</div>
        <div className={k.laiGop < 0 ? 'text-red-700' : 'text-emerald-700'}>Lãi gộp: <b>{tien(k.laiGop)}</b></div>
      </div>
      <div className="flex flex-wrap gap-4">
        <SoTay nhan="Tấn mua (gõ tay)" giaTri={lo.tanTay?.mua} doi={(v) => luu({ ...lo, tanTay: { ...lo.tanTay, mua: v } })} />
        <SoTay nhan="Tấn bán (gõ tay)" giaTri={lo.tanTay?.ban} doi={(v) => luu({ ...lo, tanTay: { ...lo.tanTay, ban: v } })} />
      </div>
      <table className="w-full">
        <thead className="text-left text-slate-500"><tr><th>Loại</th><th>Hoá đơn</th><th>Ngày</th><th>Đối tác</th><th className="text-right">Tấn</th><th className="text-right">Chưa thuế</th><th /></tr></thead>
        <tbody>
          {k.hoaDon.map((h) => (
            <tr key={h.khoa} className={`border-t border-slate-200 ${h.conHieuLuc ? '' : 'text-red-700 line-through'}`}>
              <td>{TEN_NHOM[h.nhom]}</td><td>{h.kh}-{h.so}</td><td>{h.ng}</td><td>{h.ten}</td>
              <td className="text-right">{h.tan === null ? '?' : h.tan.toLocaleString('vi-VN')}</td><td className="text-right">{tien(h.v)}</td>
              <td className="text-right"><button className="text-red-700 underline" onClick={() => luu({ ...lo, hoaDon: lo.hoaDon.filter((x) => x !== h.khoa) })}>bỏ</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="text-emerald-700 underline" onClick={() => setThem(!them)}>{them ? 'Đóng' : '+ Thêm hoá đơn vào lô'}</button>
      {them && (
        <div className="space-y-2">
          <ChonHoaDon ds={cho} chon={chon} setChon={setChon} />
          <button disabled={!chon.size} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-white disabled:bg-slate-300" onClick={() => { luu({ ...lo, hoaDon: [...lo.hoaDon, ...chon] }); setChon(new Set()); setThem(false) }}>Thêm {chon.size} hoá đơn</button>
        </div>
      )}

      <div>
        <p className="font-semibold">Giấy tờ chứng minh hàng thật</p>
        {k.giayToThieu.length > 0 && <p className="text-amber-800">🟡 Còn thiếu: {k.giayToThieu.map((l) => TEN_GIAY_TO[l]).join(', ')}</p>}
        <ul className="ml-4 list-disc">
          {lo.giayTo.map((g, i) => (
            <li key={i}>
              {TEN_GIAY_TO[g.loai]}: {g.duongDan ? <button className="text-emerald-700 underline" onClick={() => tt.moGiayTo(g)}>{g.ten}</button> : <span>{g.ten} (chỉ ghi tên)</span>}{' '}
              <button className="text-red-700 underline" onClick={() => { void tt.xoaGiayTo(g); luu({ ...lo, giayTo: lo.giayTo.filter((_, j) => j !== i) }) }}>xoá</button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select className="rounded border border-slate-300 px-2 py-1" value={loaiGiay} onChange={(e) => setLoaiGiay(e.target.value as LoaiGiayTo)}>
            {(Object.keys(TEN_GIAY_TO) as LoaiGiayTo[]).map((l) => <option key={l} value={l}>{TEN_GIAY_TO[l]}</option>)}
          </select>
          <input ref={tepRef} type="file" multiple className="hidden" onChange={async (e) => {
            const fs = [...(e.target.files ?? [])]
            e.target.value = ''
            if (!fs.length) return
            setDangTai(true)
            setLoi('')
            try {
              const moi: GiayTo[] = []
              for (const f of fs) moi.push(tt.taiGiayTo ? await tt.taiGiayTo(lo, loaiGiay, f) : { loai: loaiGiay, ten: f.name, duongDan: '', kichThuoc: f.size })
              luu({ ...lo, giayTo: [...lo.giayTo, ...moi] })
            } catch (er) {
              setLoi(`Không tải lên được: ${(er as Error).message}`)
            } finally {
              setDangTai(false)
            }
          }} />
          <button disabled={dangTai} className="rounded-lg border border-emerald-600 px-3 py-1 text-emerald-700 disabled:opacity-50" onClick={() => tepRef.current?.click()}>{dangTai ? 'Đang tải lên…' : 'Đính kèm file (ảnh / PDF)'}</button>
          {!dangNhap && <span className="text-xs text-slate-500">Chưa đăng nhập: chỉ ghi nhận tên file, không lưu file lên mây.</span>}
        </div>
      </div>
      {loi && <p className="text-red-700">{loi}</p>}
      <button className="text-red-700 underline" onClick={() => { if (confirm(`Xoá lô "${lo.ten}" và mọi giấy tờ đã tải lên của lô? Không hoàn tác được. (Hoá đơn không bị xoá.)`)) void tt.xoa(lo) }}>Xoá lô này</button>
    </div>
  )
}

export function LoHangDN({ t, tt, dangNhap }: { t: TongHopLo; tt: ThaoTacLo; dangNhap: boolean }) {
  const [moLo, setMoLo] = useState<string | null>(null)
  const [tao, setTao] = useState(false)
  const [ten, setTen] = useState('')
  const [chon, setChon] = useState<Set<string>>(new Set())
  const goiY = useMemo(() => goiYLo(t), [t])
  const tongLai = t.lo.reduce((s, k) => s + k.laiGop, 0)
  const taoLo = (tenLo: string, hoaDon: string[]) => tt.luu({ id: maMoi(), ten: tenLo, ngayTao: homNay(), ghiChu: '', hoaDon, giayTo: [] })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span>{t.lo.length} lô · lãi gộp cộng dồn <b className={tongLai < 0 ? 'text-red-700' : 'text-emerald-700'}>{tien(tongLai)} đ</b></span>
        <span className="text-slate-500">{t.chuaVaoLo.length} hoá đơn chưa vào lô</span>
        <button className="ml-auto rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white" onClick={() => setTao(!tao)}>{tao ? 'Đóng' : '+ Tạo lô mới'}</button>
      </div>

      {t.theoNam.length > 0 && (
        <table className="text-sm">
          <thead className="text-left text-slate-500"><tr><th className="pr-4">Năm</th><th className="pr-4">Tấn mua (viên nén)</th><th className="pr-4">Tấn bán</th><th>Hoá đơn chưa có file gốc</th></tr></thead>
          <tbody>
            {t.theoNam.map((y) => (
              <tr key={y.nam}>
                <td className="pr-4">{y.nam}</td><td className="pr-4">{tan(y.tanMua)}</td>
                <td className={`pr-4 ${!y.hoaDonThieuGoc && y.tanBan - y.tanMua > y.tanMua * CHENH_CAN ? 'font-bold text-red-700' : y.tanBan > y.tanMua ? 'text-amber-700' : ''}`}>{tan(y.tanBan)}</td>
                <td>{y.hoaDonThieuGoc || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {t.canhBao.length > 0 && <DanhSachCanhBao ds={t.canhBao} />}

      {tao && (
        <div className="space-y-2 rounded-xl border border-emerald-300 p-3">
          <input className="w-full rounded-lg border border-slate-300 px-3 py-1.5" placeholder="Tên lô (vd: Lô 15/03 – Bảo Khánh Linh → Rentech)" value={ten} onChange={(e) => setTen(e.target.value)} />
          <ChonHoaDon ds={t.chuaVaoLo} chon={chon} setChon={setChon} />
          <button disabled={!ten.trim() || !chon.size} className="rounded-lg bg-emerald-600 px-4 py-2 text-white disabled:bg-slate-300"
            onClick={() => { void taoLo(ten.trim(), [...chon]); setTen(''); setChon(new Set()); setTao(false) }}>
            Tạo lô với {chon.size} hoá đơn
          </button>
        </div>
      )}

      {goiY.length > 0 && (
        <details className="rounded-xl border border-slate-200 p-3 text-sm">
          <summary className="cursor-pointer font-medium">💡 Gợi ý ghép lô ({goiY.length}) — hoá đơn bán + hoá đơn mua / cước trong 7 ngày trước đó</summary>
          <ul className="mt-2 space-y-2">
            {goiY.slice(0, 30).map((g) => (
              <li key={g.ban.khoa} className="rounded-lg bg-slate-50 p-2">
                Bán {g.ban.kh}-{g.ban.so} ngày {g.ban.ng} cho {g.ban.ten} ({tan(g.ban.tan)}) ← mua {g.mua.map((m) => `${m.kh}-${m.so} (${tan(m.tan)})`).join(', ')}
                {g.cuoc.length > 0 && <> · cước {g.cuoc.map((c) => `${c.kh}-${c.so}`).join(', ')}</>}{' '}
                <button className="text-emerald-700 underline" onClick={() => void taoLo(`Lô ${g.ban.ng} – ${g.ban.ten}`, [g.ban.khoa, ...g.mua.map((m) => m.khoa), ...g.cuoc.map((c) => c.khoa)])}>Tạo lô này</button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr><th className="p-2">Lô</th><th className="p-2">Ngày</th><th className="p-2">NCC → Bên mua</th><th className="p-2">Tấn mua / bán</th><th className="p-2 text-right">Lãi gộp</th><th className="p-2">Giấy tờ</th></tr>
          </thead>
          <tbody>
            {t.lo.map((k) => (
              <Fragment key={k.lo.id}>
                <tr className="cursor-pointer border-t border-slate-100 hover:bg-slate-50" onClick={() => setMoLo(moLo === k.lo.id ? null : k.lo.id)}>
                  <td className="p-2 font-medium">{moLo === k.lo.id ? '▾' : '▸'} {k.lo.ten}</td>
                  <td className="p-2">{k.tuNgay}{k.denNgay !== k.tuNgay && ` – ${k.denNgay}`}</td>
                  <td className="p-2">{k.nhaCungCap.join(', ') || '—'} → {k.benMua.join(', ') || '—'}</td>
                  <td className={`p-2 ${k.chenhTan !== null && k.chenhTan > (k.tanMua ?? 0) * CHENH_CAN ? 'font-bold text-red-700' : k.chenhTan !== null && k.chenhTan > 0 ? 'text-amber-700' : ''}`}>{tan(k.tanMua)} / {tan(k.tanBan)}</td>
                  <td className={`p-2 text-right ${k.laiGop < 0 ? 'text-red-700' : ''}`}>{tien(k.laiGop)}</td>
                  <td className="p-2">{k.giayToThieu.length ? <span className="text-amber-700">🟡 thiếu {k.giayToThieu.length}</span> : <span className="text-emerald-700">✅ đủ</span>}</td>
                </tr>
                {moLo === k.lo.id && (
                  <tr><td colSpan={6}><ChiTietLo k={k} cho={t.chuaVaoLo} tt={tt} dangNhap={dangNhap} /></td></tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {!t.lo.length && <p className="p-3 text-sm text-slate-500">Chưa có lô nào. Bấm "+ Tạo lô mới" hoặc dùng gợi ý ghép lô ở trên.</p>}
      </div>
    </div>
  )
}

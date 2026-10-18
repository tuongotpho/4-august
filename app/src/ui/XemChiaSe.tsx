// Màn hình CHỈ XEM cho người được chia sẻ (vd giám đốc): đọc hồ sơ của chủ trên mây bằng luật "người xem",
// hiện Tổng quan / Lô hàng / Công nợ; mọi nút sửa bị khoá (luật Firestore cũng chặn ghi).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { gopTuMay, khoTrong, type Kho } from '../core/kho'
import { canhBaoGoc, tongHopGoc } from '../core/hoaDonGoc'
import { tongHopLo } from '../core/loHang'
import { tinhCongNo } from '../core/saoKe'
import { tinhDoiSoat, tinhDoiTac, tinhTongQuan } from '../core/tongQuan'
import { taiDuLieuMay, type ChiaSe } from '../may/dongBo'
import { TongQuanDN } from './TongQuan'
import { LoHangDN, type ThaoTacLo } from './LoHang'
import { CongNoDN, type ThaoTacSaoKe } from './CongNo'

const KHONG_DUOC = () => {
  throw new Error('Chế độ chỉ xem')
}
const LO_CHI_XEM: ThaoTacLo = { luu: KHONG_DUOC, xoa: KHONG_DUOC, taiGiayTo: null, xoaGiayTo: KHONG_DUOC, moGiayTo: () => alert('Giấy tờ chỉ chủ hồ sơ mở được.') }
const SK_CHI_XEM: ThaoTacSaoKe = { napFile: async () => 'Chế độ chỉ xem', xoa: KHONG_DUOC, ghepTay: KHONG_DUOC }

export function XemChiaSe({ cs, onDong }: { cs: ChiaSe; onDong: () => void }) {
  const [kho, setKho] = useState<Kho | null>(null)
  const [loi, setLoi] = useState('')
  const [tab, setTab] = useState<'tongQuan' | 'loHang' | 'congNo'>('tongQuan')
  const [chon, setChon] = useState<string | null>(null)
  useEffect(() => {
    taiDuLieuMay(cs.chuUid)
      .then((du) => setKho(gopTuMay(khoTrong(), du.congTy, du.toKhai, du.chungTu,
        Object.entries(du.tepHoaDon).flatMap(([mst, ds]) => ds.map((d) => ({ mst, hd: d.hd ?? [], phu: d.phu, goc: d.goc }))), du.loHang, du.saoKe)))
      .catch((e) => setLoi((e as Error).message))
  }, [cs.chuUid])
  const mst = chon ?? kho?.chon ?? null
  const hoSo = (mst && kho?.congTy[mst]?.hoSo) || null
  const goc = useMemo(() => (kho && mst ? tongHopGoc(kho, mst) : null), [kho, mst])
  const tq = useMemo(() => {
    if (!kho || !mst) return null
    const t = tinhTongQuan(kho, mst)
    return goc ? { ...t, canhBao: [...canhBaoGoc(goc), ...t.canhBao] } : t
  }, [kho, mst, goc])
  const doiSoat = useMemo(() => (kho && mst ? tinhDoiSoat(kho, mst) : []), [kho, mst])
  const layDoiTac = useCallback((nam: number | null) => tinhDoiTac(kho ?? khoTrong(), mst ?? '', nam), [kho, mst])
  const loTong = useMemo(() => (kho && mst ? tongHopLo(kho, mst, Object.values(kho.loHang?.[mst] ?? {})) : null), [kho, mst])
  const dsSaoKe = useMemo(() => Object.values((kho && mst && kho.saoKe?.[mst]) || {}), [kho, mst])
  const congNo = useMemo(() => (kho && mst ? tinhCongNo(kho, mst, dsSaoKe) : null), [kho, mst, dsSaoKe])

  return (
    <section className="space-y-4 rounded-2xl border-2 border-sky-300 bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">👔 Đang xem hồ sơ của {cs.chuTen || cs.chuEmail}</h2>
        <span className="rounded-full bg-sky-100 px-3 py-1 text-sm text-sky-900">CHỈ XEM — không sửa được</span>
        <button className="ml-auto text-emerald-700 underline" onClick={onDong}>← Về hồ sơ của tôi</button>
      </div>
      {loi && <p className="text-red-700">⚠️ Không tải được: {loi} (chủ hồ sơ có thể đã bỏ quyền xem)</p>}
      {!kho && !loi && <p className="text-slate-500">Đang tải hồ sơ…</p>}
      {kho && (
        <>
          <nav className="flex flex-wrap gap-2">
            {([['tongQuan', '📊 Tổng quan'], ['loHang', '📦 Lô hàng'], ['congNo', '💳 Công nợ']] as const).map(([k, ten]) => (
              <button key={k} onClick={() => setTab(k)} className={`rounded-xl px-4 py-2 font-medium ${tab === k ? 'bg-sky-700 text-white' : 'bg-slate-50 text-slate-700'}`}>{ten}</button>
            ))}
            {Object.keys(kho.congTy).length > 1 && (
              <select className="ml-auto rounded-lg border border-slate-300 px-2 py-1" value={mst ?? ''} onChange={(e) => setChon(e.target.value)}>
                {Object.values(kho.congTy).map((c) => <option key={c.hoSo.mst} value={c.hoSo.mst}>{c.hoSo.tenNNT || c.hoSo.mst}</option>)}
              </select>
            )}
          </nav>
          {!hoSo || !tq ? <p className="text-slate-500">Hồ sơ chưa có công ty nào.</p> : (
            <>
              {tab === 'tongQuan' && <TongQuanDN tq={tq} tenCty={hoSo.tenNNT} onMoQuy={() => undefined} layDoiTac={layDoiTac} doiSoat={doiSoat} ruiRo={null} goc={goc} trangThaiRuiRo="loi:Mục soi DN rủi ro chỉ chủ hồ sơ xem được (danh sách nằm ở app hoá đơn của chủ)." />}
              {tab === 'loHang' && loTong && <fieldset disabled><LoHangDN t={loTong} tt={LO_CHI_XEM} dangNhap /></fieldset>}
              {tab === 'congNo' && congNo && <fieldset disabled><CongNoDN k={congNo} dsSaoKe={dsSaoKe} tt={SK_CHI_XEM} /></fieldset>}
            </>
          )}
        </>
      )}
    </section>
  )
}

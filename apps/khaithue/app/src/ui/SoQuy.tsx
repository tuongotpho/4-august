// Sổ quỹ tiền mặt: tồn đầu, lập phiếu thu/chi (gắn hoá đơn), sổ quỹ có tồn luỹ kế, cảnh báo.
// Chứng từ theo TT133: lập phiếu từ sao kê (giám đốc kiêm thủ quỹ), in phiếu 01-TT/02-TT, xuất sổ S07-DNN / S08-DNN.
import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { tien } from '../core/nhan'
import { lapSoQuy, phieuTuHoaDon, soPhieuMoi, TEN_NHOM_PHIEU, type CaiDatQuy, type NhomPhieu, type PhieuQuy, type SoQuy } from '../core/soQuy'
import { bangS07, bangS08, goiYPhieuTuSaoKe, htmlPhieu, loaiGhep, NGUOI_KY_TRONG, soDuTruoc, tonDauToiThieu, type GoiYPhieu, type NguoiKyQuy } from '../core/chungTuQuy'
import { boGiaoDichTrung, type KetQuaCongNo, type SaoKe } from '../core/saoKe'
import type { Kho } from '../core/kho'
import type { HoSoDN } from '../core/types'
import { DanhSachCanhBao } from './chung'

export interface ThaoTacQuy {
  luuPhieu: (p: PhieuQuy) => Promise<void> | void
  xoaPhieu: (p: PhieuQuy) => Promise<void> | void
  luuTonDau: (cd: CaiDatQuy) => Promise<void> | void
}

const homNay = () => new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
const hopLeNgay = (s: string) => /^\d{2}\/\d{2}\/\d{4}$/.test(s)
const maMoi = () => `pq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
const isoKy = (k: string) => k.split('/').reverse().join('')

/** Kỳ xem: '' = tất cả, 'MM/yyyy' = tháng, 'Qn/yyyy' = quý, 'yyyy' = năm -> [từ, đến] dd/MM/yyyy */
function khoangKy(ky: string): [string, string] {
  if (!ky) return ['', '']
  const q = /^Q(\d)\/(\d{4})$/.exec(ky)
  if (q) {
    const dau = (Number(q[1]) - 1) * 3 + 1
    const cuoi = dau + 2
    return [`01/${String(dau).padStart(2, '0')}/${q[2]}`, `${[31, 30, 30, 31][Number(q[1]) - 1]}/${String(cuoi).padStart(2, '0')}/${q[2]}`]
  }
  if (/^\d{4}$/.test(ky)) return [`01/01/${ky}`, `31/12/${ky}`]
  return [`01/${ky}`, `31/${ky}`]
}
const tenKy = (ky: string) => (!ky ? 'Tất cả' : ky.startsWith('Q') ? `Quý ${ky.slice(1)}` : /^\d{4}$/.test(ky) ? `Năm ${ky}` : `Tháng ${ky}`)

/** Ghi bảng ra file Excel (số định dạng #,##0) */
function taiExcel(ten: string, sheets: { ten: string; bang: (string | number | null)[][] }[]) {
  const wb = XLSX.utils.book_new()
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.bang)
    for (const [o, c] of Object.entries(ws)) if (!o.startsWith('!') && (c as XLSX.CellObject).t === 'n') (c as XLSX.CellObject).z = '#,##0'
    ws['!cols'] = [12, 14, 10, 10, 50, 14, 14, 16, 26].map((wch) => ({ wch }))
    XLSX.utils.book_append_sheet(wb, ws, s.ten.slice(0, 31))
  }
  XLSX.writeFile(wb, ten)
}

function moTrangIn(html: string) {
  const w = window.open('', '_blank')
  if (!w) return alert('Trình duyệt chặn cửa sổ mới — cho phép popup để in phiếu.')
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 400)
}

export function SoQuyDN({ kho, mst, quy, tt, hoSo, dsSaoKe, congNo }: { kho: Kho; mst: string; quy: SoQuy; tt: ThaoTacQuy; hoSo: HoSoDN | null; dsSaoKe: SaoKe[]; congNo: KetQuaCongNo | null }) {
  const [ky, setKy] = useState('') // '' | MM/yyyy | Qn/yyyy | yyyy
  const [sua, setSua] = useState<PhieuQuy | null>(null)
  const [tonDau, setTonDau] = useState({ tien: String(quy.caiDat.tonDau || ''), ngay: quy.caiDat.ngayTonDau })
  const [loi, setLoi] = useState('')
  const nguoiKy = quy.caiDat.nguoiKy ?? NGUOI_KY_TRONG
  const [kyNhap, setKyNhap] = useState<NguoiKyQuy | null>(null) // đang sửa người ký
  const [goiY, setGoiY] = useState<GoiYPhieu | null>(null)
  const [dangLuu, setDangLuu] = useState('')
  const khoang = khoangKy(ky)
  const k = useMemo(() => lapSoQuy(kho, mst, quy, khoang[0], khoang[1]), [kho, mst, quy, khoang[0], khoang[1]]) // eslint-disable-line react-hooks/exhaustive-deps
  const toanBo = useMemo(() => lapSoQuy(kho, mst, quy), [kho, mst, quy])
  const canTonDau = tonDauToiThieu(toanBo)
  // Kỳ chọn được: tháng có phiếu + quý/năm có phiếu hoặc có sao kê
  const cacKy = useMemo(() => {
    const ngay = [...Object.values(quy.phieu).map((p) => p.ngay), ...dsSaoKe.flatMap((s) => s.giaoDich.map((g) => g.ngay))]
    const nam = [...new Set(ngay.map((n) => n.slice(6)))].sort().reverse()
    const quyKy = [...new Set(ngay.map((n) => `Q${Math.ceil(Number(n.slice(3, 5)) / 3)}/${n.slice(6)}`))].sort((a, b) => (b.slice(3) + b[1]).localeCompare(a.slice(3) + a[1]))
    const thang = [...new Set(Object.values(quy.phieu).map((p) => p.ngay.slice(3)))].sort((a, b) => isoKy(b).localeCompare(isoKy(a)))
    return { nam, quyKy, thang }
  }, [quy, dsSaoKe])
  // Hoá đơn còn nợ để gắn phiếu (mới nhất trước)
  const hoaDon = useMemo(() => Object.entries(kho.hoaDon?.[mst] ?? {})
    .filter(([, g]) => !/bị thay thế|xóa bỏ|xoá bỏ|hủy bỏ|huỷ bỏ/i.test(g.tt ?? ''))
    .map(([khoa, g]) => ({ khoa, g, conLai: g.v + g.t - (k.daTraTheoHoaDon[khoa] ?? 0) }))
    .filter((x) => x.conLai > 1)
    .sort((a, b) => b.g.ng.split('/').reverse().join('').localeCompare(a.g.ng.split('/').reverse().join(''))), [kho, mst, k])

  const moi = (loai: 'thu' | 'chi') => setSua({ id: maMoi(), loai, so: soPhieuMoi(quy, loai, homNay()), ngay: homNay(), soTien: 0, nhom: loai === 'thu' ? 'banHang' : 'muaHang', noiDung: '', doiTac: '', hoaDon: [] })
  const luu = async () => {
    if (!sua) return
    if (!hopLeNgay(sua.ngay)) return setLoi('Ngày dạng dd/MM/yyyy')
    if (!(sua.soTien > 0)) return setLoi('Số tiền phải lớn hơn 0')
    setLoi('')
    try {
      await tt.luuPhieu(sua)
      setSua(null)
    } catch (e) {
      setLoi((e as Error).message)
    }
  }
  const lapTuSaoKe = async () => {
    if (!goiY) return
    let n = 0
    try {
      for (const p of goiY.phieu) {
        setDangLuu(`Đang lưu ${++n}/${goiY.phieu.length}…`)
        await tt.luuPhieu(p)
      }
      setDangLuu(`✅ Đã lập ${goiY.phieu.length} phiếu.`)
      setGoiY(null)
    } catch (e) {
      setDangLuu(`⚠️ Dừng ở phiếu ${n}: ${(e as Error).message}`)
    }
  }
  const ngayKy = khoang[1] || homNay()
  const xuatS07 = () => taiExcel(`S07-DNN So quy tien mat ${tenKy(ky)}.xlsx`.replace(/\//g, '-'), [{ ten: 'S07-DNN', bang: bangS07(k, hoSo, nguoiKy, tenKy(ky), ngayKy) }])
  const xuatS08 = () => {
    const ghep = loaiGhep(congNo)
    const ds = boGiaoDichTrung(dsSaoKe).ds.filter((s) => !khoang[0] || s.giaoDich.some((g) => isoKy(g.ngay) >= isoKy(khoang[0]) && isoKy(g.ngay) <= isoKy(khoang[1])))
    if (!ds.length) return alert('Chưa có sao kê ngân hàng trong kỳ này.')
    const sheets = ds.map((s, i) => {
      const du = soDuTruoc(s, khoang[0])
      return { ten: `${s.soTaiKhoan || 'TK'}-${i + 1}`, bang: bangS08(s, du ?? 0, ghep, hoSo, nguoiKy, khoang[0], khoang[1], ngayKy).bang }
    })
    taiExcel(`S08-DNN So tien gui ngan hang ${tenKy(ky)}.xlsx`.replace(/\//g, '-'), sheets)
  }

  return (
    <div className="space-y-3 text-sm">
      {/* Người ký + thủ quỹ */}
      <div className="rounded-xl border border-slate-200 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">Người ký chứng từ:</span>
          {nguoiKy.thuQuy || nguoiKy.giamDoc
            ? <span>Giám đốc <b>{nguoiKy.giamDoc || '—'}</b> · Thủ quỹ <b>{nguoiKy.thuQuy || '—'}</b> · Kế toán <b>{nguoiKy.keToanTruong || '—'}</b> · Người lập <b>{nguoiKy.nguoiLap || '—'}</b>{nguoiKy.nhanDien.length > 0 && <span className="text-slate-500"> · nhận diện thủ quỹ trên sao kê: {nguoiKy.nhanDien.join(', ')}</span>}</span>
            : <span className="text-amber-700">chưa khai — cần để in phiếu và lập phiếu từ sao kê</span>}
          <button className="ml-auto text-emerald-700 underline" onClick={() => setKyNhap(kyNhap ? null : { ...nguoiKy })}>{kyNhap ? 'đóng' : 'sửa'}</button>
        </div>
        {kyNhap && (
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {([['giamDoc', 'Giám đốc'], ['thuQuy', 'Thủ quỹ'], ['keToanTruong', 'Kế toán trưởng / phụ trách kế toán'], ['nguoiLap', 'Người lập phiếu']] as const).map(([f, nh]) => (
              <label key={f}>{nh} <input className="w-full rounded border border-slate-300 px-2 py-1" value={kyNhap[f]} onChange={(e) => setKyNhap({ ...kyNhap, [f]: e.target.value })} /></label>
            ))}
            <label className="md:col-span-2">Tên / số tài khoản của thủ quỹ như trên sao kê (cách nhau dấu phẩy, không dấu cũng được)
              <input className="w-full rounded border border-slate-300 px-2 py-1" placeholder="NGUYEN VAN A, 0123456789" value={kyNhap.nhanDien.join(', ')} onChange={(e) => setKyNhap({ ...kyNhap, nhanDien: e.target.value.split(',').map((x) => x.trim()) })} />
            </label>
            <p className="text-xs text-slate-500 md:col-span-2">Giám đốc kiêm thủ quỹ: tiền công ty chuyển cho thủ quỹ = rút tiền gửi về quỹ (phiếu thu, Nợ 1111/Có 1121); thủ quỹ chuyển vào công ty = nộp tiền mặt vào ngân hàng (phiếu chi, Nợ 1121/Có 1111). Người làm kế toán không được kiêm thủ quỹ (Luật Kế toán).</p>
            <button className="w-fit rounded-lg bg-emerald-600 px-4 py-1.5 text-white" onClick={() => {
              void tt.luuTonDau({ ...quy.caiDat, nguoiKy: { ...kyNhap, nhanDien: kyNhap.nhanDien.filter(Boolean) } })
              setKyNhap(null)
            }}>Lưu người ký</button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label>Tồn quỹ đầu kỳ <input className="w-36 rounded border border-slate-300 px-2 py-1" inputMode="numeric" value={tonDau.tien} onChange={(e) => setTonDau({ ...tonDau, tien: e.target.value.replace(/\D/g, '') })} /></label>
        <label>tính tới ngày <input className="w-28 rounded border border-slate-300 px-2 py-1" placeholder="dd/MM/yyyy" value={tonDau.ngay} onChange={(e) => setTonDau({ ...tonDau, ngay: e.target.value })} /></label>
        <button className="rounded-lg border border-emerald-600 px-3 py-1 text-emerald-700" onClick={() => void tt.luuTonDau({ ...quy.caiDat, tonDau: Number(tonDau.tien) || 0, ngayTonDau: hopLeNgay(tonDau.ngay) ? tonDau.ngay : '' })}>Lưu tồn đầu</button>
        <span className="ml-auto flex gap-2">
          <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-white" onClick={() => moi('thu')}>+ Phiếu thu</button>
          <button className="rounded-lg bg-amber-600 px-3 py-1.5 text-white" onClick={() => moi('chi')}>+ Phiếu chi</button>
        </span>
      </div>
      {canTonDau > quy.caiDat.tonDau && (
        <p className="rounded-lg bg-amber-50 p-2 text-amber-800">⚠️ Với các phiếu hiện có, tồn quỹ đầu kỳ phải ít nhất <b>{tien(canTonDau)} đ</b> thì quỹ mới không bị âm ngày nào. Lấy số tồn quỹ thật trên sổ cũ (biên bản kiểm kê quỹ) — thiếu thì là còn phiếu thu chưa lập.</p>
      )}

      {sua && (
        <div className="space-y-2 rounded-xl border border-emerald-300 p-3">
          <p className="font-semibold">{sua.loai === 'thu' ? 'Phiếu thu' : 'Phiếu chi'} {sua.so}</p>
          <div className="grid gap-2 md:grid-cols-3">
            <label>Số phiếu <input className="w-full rounded border border-slate-300 px-2 py-1" value={sua.so} onChange={(e) => setSua({ ...sua, so: e.target.value })} /></label>
            <label>Ngày <input className="w-full rounded border border-slate-300 px-2 py-1" value={sua.ngay} onChange={(e) => setSua({ ...sua, ngay: e.target.value })} /></label>
            <label>Số tiền <input className="w-full rounded border border-slate-300 px-2 py-1" inputMode="numeric" value={sua.soTien || ''} onChange={(e) => setSua({ ...sua, soTien: Number(e.target.value.replace(/\D/g, '')) || 0 })} /></label>
            <label>Nhóm <select className="w-full rounded border border-slate-300 px-2 py-1" value={sua.nhom} onChange={(e) => setSua({ ...sua, nhom: e.target.value as NhomPhieu })}>
              {(Object.keys(TEN_NHOM_PHIEU) as NhomPhieu[]).map((n) => <option key={n} value={n}>{TEN_NHOM_PHIEU[n]}</option>)}
            </select></label>
            <label>{sua.loai === 'thu' ? 'Người nộp' : 'Người nhận'} <input className="w-full rounded border border-slate-300 px-2 py-1" value={sua.doiTac} onChange={(e) => setSua({ ...sua, doiTac: e.target.value })} /></label>
            <label>Nội dung <input className="w-full rounded border border-slate-300 px-2 py-1" value={sua.noiDung} onChange={(e) => setSua({ ...sua, noiDung: e.target.value })} /></label>
            <label>TK Nợ <input className="w-full rounded border border-slate-300 px-2 py-1" placeholder={sua.loai === 'thu' ? '1111' : 'tự đoán theo nhóm'} value={sua.tkNo ?? ''} onChange={(e) => setSua({ ...sua, tkNo: e.target.value })} /></label>
            <label>TK Có <input className="w-full rounded border border-slate-300 px-2 py-1" placeholder={sua.loai === 'chi' ? '1111' : 'tự đoán theo nhóm'} value={sua.tkCo ?? ''} onChange={(e) => setSua({ ...sua, tkCo: e.target.value })} /></label>
            <label>Kèm theo (chứng từ gốc) <input className="w-full rounded border border-slate-300 px-2 py-1" value={sua.kemTheo ?? ''} onChange={(e) => setSua({ ...sua, kemTheo: e.target.value })} /></label>
          </div>
          <label className="block">Gắn hoá đơn (thanh toán bằng tiền mặt){' '}
            <select className="max-w-full rounded border border-slate-300 px-2 py-1" value="" onChange={(e) => {
              const g = e.target.value
              if (!g) return
              const goiYHD = phieuTuHoaDon(kho, mst, g, quy, sua.ngay)
              const conLai = hoaDon.find((x) => x.khoa === g)?.conLai ?? 0
              setSua({ ...sua, hoaDon: [...new Set([...sua.hoaDon, g])], soTien: sua.soTien || conLai, doiTac: sua.doiTac || goiYHD?.doiTac || '', noiDung: sua.noiDung || goiYHD?.noiDung || '', nhom: goiYHD?.nhom ?? sua.nhom })
            }}>
              <option value="">— chọn hoá đơn —</option>
              {hoaDon.filter((x) => (sua.loai === 'thu' ? x.g.l === 'ban' : x.g.l === 'mua')).slice(0, 300).map((x) => (
                <option key={x.khoa} value={x.khoa}>{x.g.kh}-{x.g.so} {x.g.ng} {x.g.ten.slice(0, 30)} — còn {tien(x.conLai)}</option>
              ))}
            </select>
          </label>
          {sua.hoaDon.length > 0 && (
            <p>Đã gắn: {sua.hoaDon.map((x) => x.split('|').slice(2).join('-')).join(', ')}{' '}
              <button className="text-red-700 underline" onClick={() => setSua({ ...sua, hoaDon: [] })}>bỏ gắn</button></p>
          )}
          <div className="flex gap-2">
            <button className="rounded-lg bg-emerald-600 px-4 py-1.5 text-white" onClick={() => void luu()}>Lưu phiếu</button>
            <button className="rounded-lg border border-slate-300 px-4 py-1.5" onClick={() => setSua(null)}>Huỷ</button>
          </div>
          {loi && <p className="text-red-700">⚠️ {loi}</p>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select className="rounded border border-slate-300 px-2 py-1" value={ky} onChange={(e) => { setKy(e.target.value); setGoiY(null) }}>
          <option value="">Tất cả</option>
          {cacKy.nam.map((n) => <option key={n} value={n}>Năm {n}</option>)}
          {cacKy.quyKy.map((q) => <option key={q} value={q}>Quý {q.slice(1)}</option>)}
          {cacKy.thang.map((t) => <option key={t} value={t}>Tháng {t}</option>)}
        </select>
        <button disabled={!dsSaoKe.length} className="rounded-lg bg-sky-700 px-3 py-1.5 text-white disabled:bg-slate-300" title={dsSaoKe.length ? '' : 'Nạp sao kê ở phần trên trước'}
          onClick={() => {
            if (!nguoiKy.nhanDien.length) return alert('Khai "Tên / số tài khoản của thủ quỹ như trên sao kê" ở ô Người ký trước.')
            setDangLuu('')
            setGoiY(goiYPhieuTuSaoKe(dsSaoKe, quy, nguoiKy, khoang[0], khoang[1], maMoi))
          }}>Lập phiếu từ sao kê ({tenKy(ky)})</button>
        <button disabled={!k.dong.length} className="rounded-lg border border-slate-400 px-3 py-1.5 disabled:opacity-40" onClick={() => moTrangIn(htmlPhieu(k.dong.map((d) => quy.phieu[d.id]), hoSo, nguoiKy))}>🖨 In {k.dong.length} phiếu</button>
        <button className="rounded-lg border border-slate-400 px-3 py-1.5" onClick={xuatS07}>⬇ Sổ quỹ S07-DNN</button>
        <button disabled={!dsSaoKe.length} className="rounded-lg border border-slate-400 px-3 py-1.5 disabled:opacity-40" onClick={xuatS08}>⬇ Sổ tiền gửi S08-DNN</button>
        {dangLuu && <span>{dangLuu}</span>}
      </div>

      {goiY && (
        <div className="space-y-2 rounded-xl border border-sky-300 bg-sky-50 p-3">
          {goiY.phieu.length === 0
            ? <p>Không có giao dịch mới với thủ quỹ trong {tenKy(ky).toLowerCase()}{goiY.daCo ? ` (${goiY.daCo} giao dịch đã có phiếu từ trước)` : ''}.</p>
            : <>
              <p>Sẽ lập <b>{goiY.phieu.filter((p) => p.loai === 'thu').length} phiếu thu</b> (rút tiền gửi về quỹ, {tien(goiY.phieu.filter((p) => p.loai === 'thu').reduce((s, p) => s + p.soTien, 0))} đ) và <b>{goiY.phieu.filter((p) => p.loai === 'chi').length} phiếu chi</b> (nộp tiền mặt vào ngân hàng, {tien(goiY.phieu.filter((p) => p.loai === 'chi').reduce((s, p) => s + p.soTien, 0))} đ){goiY.daCo ? `; bỏ qua ${goiY.daCo} giao dịch đã có phiếu` : ''}.</p>
              {goiY.canXem.length > 0 && (
                <div className="rounded-lg bg-amber-50 p-2 text-amber-900">
                  <p className="font-semibold">⚠️ {goiY.canXem.length} phiếu cần xem lại sau khi lập:</p>
                  <ul className="ml-4 list-disc">{goiY.canXem.map((x) => <li key={x.phieu.id}>{x.phieu.so} ngày {x.phieu.ngay} — {tien(x.phieu.soTien)} đ: {x.lyDo}</li>)}</ul>
                </div>
              )}
              <div className="flex gap-2">
                <button className="rounded-lg bg-sky-700 px-4 py-1.5 text-white" onClick={() => void lapTuSaoKe()}>Lập {goiY.phieu.length} phiếu</button>
                <button className="rounded-lg border border-slate-300 px-4 py-1.5" onClick={() => setGoiY(null)}>Thôi</button>
              </div>
            </>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <span>{tenKy(ky)}: Tồn đầu <b>{tien(k.tonDau)}</b> · Thu <b className="text-emerald-700">{tien(k.tongThu)}</b> · Chi <b className="text-amber-700">{tien(k.tongChi)}</b> · Tồn cuối <b className={k.tonCuoi < 0 ? 'text-red-700' : ''}>{tien(k.tonCuoi)}</b> đ</span>
      </div>
      {k.canhBao.length > 0 && <DanhSachCanhBao ds={k.canhBao} />}
      <div className="max-h-[28rem] overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
            <tr><th className="p-1">Ngày</th><th className="p-1">Số phiếu</th><th className="p-1">Nội dung</th><th className="p-1">Đối tác</th><th className="p-1 text-right">Thu</th><th className="p-1 text-right">Chi</th><th className="p-1 text-right">Tồn</th><th /></tr>
          </thead>
          <tbody>
            {k.dong.map((d) => (
              <tr key={d.id} className="border-t border-slate-100">
                <td className="p-1">{d.ngay}</td>
                <td className="p-1">{d.so}</td>
                <td className="p-1">{d.noiDung || TEN_NHOM_PHIEU[d.nhom]}{d.hoaDon.length > 0 && <span className="text-slate-400"> · HĐ {d.hoaDon.map((x) => x.split('|').slice(2).join('-')).join(', ')}</span>}</td>
                <td className="p-1">{d.doiTac}</td>
                <td className="p-1 text-right">{d.thu ? tien(d.thu) : ''}</td>
                <td className="p-1 text-right">{d.chi ? tien(d.chi) : ''}</td>
                <td className={`p-1 text-right ${d.ton < 0 ? 'text-red-700' : ''}`}>{tien(d.ton)}</td>
                <td className="p-1 text-right whitespace-nowrap">
                  <button className="text-slate-700 underline" onClick={() => moTrangIn(htmlPhieu([quy.phieu[d.id]], hoSo, nguoiKy))}>in</button>{' '}
                  <button className="text-emerald-700 underline" onClick={() => setSua(quy.phieu[d.id])}>sửa</button>{' '}
                  <button className="text-red-700 underline" onClick={() => { if (confirm(`Xoá phiếu ${d.so}?`)) void tt.xoaPhieu(quy.phieu[d.id]) }}>xoá</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!k.dong.length && <p className="p-2 text-slate-500">Chưa có phiếu thu / chi nào{ky && ` trong ${tenKy(ky).toLowerCase()}`}.</p>}
      </div>
    </div>
  )
}

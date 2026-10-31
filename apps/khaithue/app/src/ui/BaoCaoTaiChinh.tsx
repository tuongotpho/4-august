// Mục "Báo cáo tài chính" ở tab Kho hồ sơ: thả file XML BCTC đã nộp (tờ khai 402) -> xem 3 bảng + kết quả soát chéo.
// Giai đoạn A (báo cáo 19): chỉ đọc và soát. Số đọc được lưu kèm tờ khai (ToKhaiKhac.bctc), nạp qua đường nạp chung của app.
import { useMemo, useState } from 'react'
import type { Kho, ToKhaiKhac } from '../core/kho'
import { DONG_TONG, soatBctc, TEN_CDKT, TEN_KQKD, TEN_LCTT_TRUC_TIEP, type SoLieuBctc } from '../core/bctc'
import { VungThaFile } from './chung'

const tien = (v: number | undefined) => (v == null ? '' : v.toLocaleString('vi-VN'))
const ngayIn = (iso: string) => iso.split('-').reverse().join('/')

type Bang = 'cdkt' | 'kqkd' | 'lctt'

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
  const [bang, setBang] = useState<Bang>('cdkt')
  const t = ds.find((x) => x.ky === chon) ?? ds[0]
  const kiem = useMemo(() => (t ? soatBctc(t.bctc) : []), [t])

  return (
    <div className="space-y-3 text-sm">
      <VungThaFile
        accept=".xml"
        onFiles={(f) => onFiles(f.filter((x) => /\.xml$/i.test(x.name)))}
        nhan={
          <>
            <div className="font-medium">Kéo thả file XML báo cáo tài chính đã nộp vào đây, hoặc bấm để chọn</div>
            <div className="mt-1 text-slate-600">File tờ khai <b>402 – BCTC theo TT200</b> (xuất từ HTKK hoặc tải lại trên thuedientu). App đọc 3 bảng và <b>soát chéo</b>: lợi nhuận vào vốn chủ, vốn góp trong lưu chuyển tiền, tiền thu – tiền trả so với doanh thu, hàng mua…</div>
          </>
        }
      />
      {!t ? (
        <p className="text-slate-500">Chưa có báo cáo tài chính nào của công ty này. (BCTC nạp trước bản này cần thả lại file để app đọc số liệu.)</p>
      ) : (
        <>
          {ds.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {ds.map((x) => (
                <button key={x.ky} onClick={() => setChon(x.ky)} className={`rounded-full border px-3 py-1 text-xs ${x.ky === t.ky ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-300 bg-white hover:border-emerald-500'}`}>
                  Năm {x.ky}
                </button>
              ))}
            </div>
          )}
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <b>BCTC năm {t.bctc.nam}</b> ({t.bctc.tuNgay} – {t.bctc.denNgay}) · chế độ {t.bctc.cheDo} · {t.loaiTKhai === 'B' ? `bổ sung lần ${t.soLan}` : 'chính thức'} · lập {ngayIn(t.bctc.ngayLap)}
            {t.bctc.nguoiKy && <> · ký: {t.bctc.nguoiKy}</>} · {t.bctc.daKiemToan ? 'đã kiểm toán' : 'chưa kiểm toán'}
          </div>

          <div className="space-y-1" data-soat-bctc>
            {kiem.map((k, i) => (
              <div key={i} className={`rounded-lg px-3 py-2 ${k.muc === 'dat' ? 'bg-emerald-50 text-emerald-800' : k.muc === 'canhBao' ? 'bg-red-50 text-red-800' : 'bg-sky-50 text-sky-900'}`}>
                {k.muc === 'dat' ? '✅ ' : k.muc === 'canhBao' ? '⚠️ ' : 'ℹ️ '}{k.noiDung}
              </div>
            ))}
            <p className="text-xs text-slate-500">App chỉ soát các con số trên báo cáo với nhau, chưa đối chiếu với hoá đơn, sao kê, sổ quỹ. Có cảnh báo thì xem lại sổ sách và cân nhắc nộp báo cáo bổ sung.</p>
          </div>

          <div className="flex gap-1 border-b border-slate-200">
            {([['cdkt', 'Cân đối kế toán (B01)'], ['kqkd', 'Kết quả kinh doanh (B02)'], ['lctt', 'Lưu chuyển tiền tệ (B03)']] as [Bang, string][]).map(([k, ten]) => (
              <button key={k} onClick={() => setBang(k)} className={`-mb-px rounded-t-lg border px-3 py-1.5 ${bang === k ? 'border-slate-200 border-b-white bg-white font-medium' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{ten}</button>
            ))}
          </div>
          {bang === 'cdkt' && <BangSo ten={TEN_CDKT} a={t.bctc.cdkt.cuoi} b={t.bctc.cdkt.dau} cotA="Cuối năm" cotB="Đầu năm" />}
          {bang === 'kqkd' && <BangSo ten={TEN_KQKD} a={t.bctc.kqkd.nay} b={t.bctc.kqkd.truoc} cotA="Năm nay" cotB="Năm trước" />}
          {bang === 'lctt' && (t.bctc.lctt ? (
            <BangSo
              ten={t.bctc.lctt.phuongPhap === 'trucTiep' ? TEN_LCTT_TRUC_TIEP : Object.keys(t.bctc.lctt.nay).map((m) => [m, `Chỉ tiêu mã ${m}`] as [string, string])}
              a={t.bctc.lctt.nay} b={t.bctc.lctt.truoc} cotA="Năm nay" cotB="Năm trước" tongLctt
            />
          ) : <p className="text-slate-500">File không có báo cáo lưu chuyển tiền tệ.</p>)}
          <p className="text-xs text-slate-500">Chỉ hiện dòng có số (khác 0) và các dòng tổng. Số cuối năm {t.bctc.nam} là số đầu năm {Number(t.bctc.nam) + 1} khi lập báo cáo năm sau.</p>
        </>
      )}
    </div>
  )
}

function BangSo({ ten, a, b, cotA, cotB, tongLctt }: { ten: [string, string][]; a: Record<string, number>; b: Record<string, number>; cotA: string; cotB: string; tongLctt?: boolean }) {
  const tong = tongLctt ? new Set(['20', '30', '40', '50', '70']) : DONG_TONG
  const dong = ten.filter(([m]) => tong.has(m) || a[m] || b[m])
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full">
        <thead className="bg-slate-100 text-left text-xs uppercase text-slate-500">
          <tr><th className="w-14 p-2">Mã</th><th className="p-2">Chỉ tiêu</th><th className="p-2 text-right">{cotA}</th><th className="p-2 text-right">{cotB}</th></tr>
        </thead>
        <tbody>
          {dong.map(([m, t]) => (
            <tr key={m} className={`border-t border-slate-100 ${tong.has(m) ? 'bg-slate-50 font-semibold' : ''}`}>
              <td className="p-2 text-slate-500">{m}</td>
              <td className="p-2">{t}</td>
              <td className="whitespace-nowrap p-2 text-right">{tien(a[m] ?? 0)}</td>
              <td className="whitespace-nowrap p-2 text-right text-slate-500">{tien(b[m] ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

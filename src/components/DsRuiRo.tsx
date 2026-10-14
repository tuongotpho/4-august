import { useMemo, useState } from 'react'
import { fmtDate } from '../lib/dates'
import { bao, hoi } from '../lib/dialog'
import { useRuiRo } from '../lib/hooks'
import { bangRuiRo, gopDsRuiRo, moTaDong, traHoaDon, traMst } from '../lib/ruiRo'
import { store } from '../lib/store'
import FileDrop from './FileDrop'

const ruiRoExcel = () => import('../lib/ruiRoExcel') // pizzip: chỉ tải khi nạp file Excel

const TOI_DA = 200 // danh sách có thể tới hàng chục nghìn dòng: vẽ hết thì trang Cài đặt gõ phím trễ cả giây

const ngayGio = (ms: number) => new Date(ms).toLocaleDateString('vi-VN')

/**
 * Cài đặt → danh sách DN rủi ro về hóa đơn (file Excel cơ quan thuế gửi hằng tháng).
 * Nạp file tháng mới = GỘP vào danh sách cũ. Nạp xong dò luôn các hóa đơn đã có trong kho.
 */
export default function DsRuiRo() {
  const { ds, bang } = useRuiRo()
  const [busy, setBusy] = useState(false)
  const [mst, setMst] = useState('')
  const [loc, setLoc] = useState('')
  const [moBang, setMoBang] = useState(false)

  async function nap(files: File[]) {
    setBusy(true)
    try {
      let gop = ds
      let them = 0
      for (const f of files) {
        const moi = (await ruiRoExcel()).docDsRuiRo(await f.arrayBuffer(), f.name)
        them += moi.dong.length
        gop = gopDsRuiRo(gop, moi)
      }
      if (!gop) return
      await store.saveDsRuiRo(gop)
      // dò ngay các hóa đơn đã có trong kho
      const b = bangRuiRo(gop)
      const trung = (await store.listDossiers()).flatMap((d) =>
        d.invoices.filter((i) => traHoaDon(i, b)).map((i) => `• HĐ ${i.soHd || '?'} ngày ${fmtDate(i.ngayHd)} — ${i.tenNguoiBan} (${i.mstNguoiBan})`),
      )
      void bao(
        `Đã nạp ${them} dòng. Danh sách hiện có ${b.size} mã số thuế.\n\n` +
          (trung.length
            ? `⛔ ${trung.length} hóa đơn trong kho có người bán nằm trong danh sách:\n${trung.join('\n')}`
            : '✓ Không hóa đơn nào trong kho có người bán nằm trong danh sách.'),
      )
    } catch (e) {
      void bao('Không đọc được file: ' + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function xoa() {
    if (!(await hoi('Xóa toàn bộ danh sách DN rủi ro đã nạp? App sẽ thôi cảnh báo cho tới khi nạp lại.', { okLabel: 'Xóa', nguyHiem: true }))) return
    await store.saveDsRuiRo(null)
  }

  const kq = mst.trim() ? traMst(mst, bang) : undefined
  const kw = loc.trim().toLowerCase()
  const dong = useMemo(
    () => (moBang ? (ds?.dong ?? []).filter((d) => !kw || d.mst.includes(kw) || d.ten.toLowerCase().includes(kw)) : []),
    [ds, kw, moBang],
  )

  return (
    <div className="card space-y-3 lg:col-span-2">
      <h2 className="font-semibold text-slate-800">Danh sách DN rủi ro về hóa đơn (cơ quan thuế)</h2>
      <p className="text-sm text-slate-600">
        Nạp file Excel cơ quan thuế gửi hằng tháng (ví dụ <i>PHỤ LỤC QR HDRR THANG 09.2026.xlsx</i>). Người bán trên hóa đơn có MST nằm trong
        danh sách — kể cả chi nhánh <code>MST-xxx</code> của DN đó — sẽ bị cảnh báo đỏ và phải xác nhận khi xuất Word. Nạp file tháng sau được{' '}
        <b>gộp thêm</b> vào danh sách cũ.
      </p>

      {ds ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-sm">
          Đang có <b>{bang.size}</b> mã số thuế ({ds.dong.length} dòng), nạp từ:
          <ul className="mt-1 text-xs text-slate-600">
            {ds.cacFile.map((f) => (
              <li key={f.ten + f.napLuc}>
                • {f.ten || '(không tên)'} — {f.soDong} dòng, nạp ngày {ngayGio(f.napLuc)}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-amber-700">Chưa nạp danh sách — app chưa kiểm tra được đơn vị phát hành hóa đơn.</p>
      )}

      <FileDrop onFiles={nap} accept=".xlsx,.xlsm">
        {busy ? 'Đang đọc…' : 'Kéo thả file Excel danh sách DN rủi ro (.xlsx / .xlsm — chọn được nhiều file một lúc) vào đây'}
      </FileDrop>

      {ds && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-slate-600">Tra nhanh MST:</label>
            <input className="inp max-w-xs" placeholder="0101234567" value={mst} onChange={(e) => setMst(e.target.value)} />
            {mst.trim() &&
              (kq ? (
                <span className="text-sm font-semibold text-red-700">
                  ⛔ CÓ trong danh sách{kq.quaDonViChuQuan ? ` (chi nhánh của DN ${kq.mst})` : ''}
                </span>
              ) : (
                <span className="text-sm text-emerald-700">✓ Không có trong danh sách</span>
              ))}
          </div>
          {kq && (
            <ul className="text-xs text-red-800">
              {kq.dong.map((d, k) => (
                <li key={k}>
                  • <b>{d.ten}</b>: {moTaDong(d, ds.nhom)}
                </li>
              ))}
            </ul>
          )}

          <details onToggle={(e) => setMoBang(e.currentTarget.open)}>
            <summary className="cursor-pointer text-sm text-slate-600">Xem cả danh sách ({ds.dong.length} dòng)</summary>
            {moBang && (
              <>
                <input className="inp mt-2 max-w-xs" placeholder="Lọc theo MST / tên…" value={loc} onChange={(e) => setLoc(e.target.value)} />
                <div className="mt-2 max-h-96 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-100 text-left text-slate-600">
                      <tr>
                        <th className="px-2 py-1">MST</th>
                        <th className="px-2 py-1">Tên doanh nghiệp</th>
                        <th className="px-2 py-1">Phụ lục</th>
                        <th className="px-2 py-1">Công văn</th>
                        <th className="px-2 py-1">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dong.slice(0, TOI_DA).map((d, k) => (
                        <tr key={k} className="border-t border-slate-100">
                          <td className="px-2 py-1 font-mono">{d.mst}</td>
                          <td className="px-2 py-1">{d.ten}</td>
                          <td className="px-2 py-1" title={ds.nhom[d.nhom]?.moTa}>{ds.nhom[d.nhom]?.sheet}</td>
                          <td className="px-2 py-1">
                            {d.soCv} {d.ngayCv && `(${fmtDate(d.ngayCv)})`}
                          </td>
                          <td className="px-2 py-1">
                            {d.trangThai} {d.ngayChuyen && `từ ${fmtDate(d.ngayChuyen)}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {dong.length > TOI_DA && (
                  <p className="mt-1 text-xs text-slate-500">
                    Đang hiện {TOI_DA} / {dong.length} dòng — gõ MST hoặc tên vào ô lọc để tìm.
                  </p>
                )}
              </>
            )}
          </details>
          <button className="text-xs text-red-600 hover:underline" onClick={() => void xoa()}>
            Xóa danh sách đã nạp
          </button>
        </>
      )}
    </div>
  )
}

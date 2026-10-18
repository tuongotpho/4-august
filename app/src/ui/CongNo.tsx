// Tab "Công nợ": nạp sao kê ngân hàng, app ghép giao dịch với hoá đơn -> phải thu / phải trả, HĐ mua ≥ 5 triệu chưa chuyển khoản
import { useRef, useState } from 'react'
import { tien } from '../core/nhan'
import type { KetQuaCongNo, SaoKe } from '../core/saoKe'
import { DanhSachCanhBao } from './chung'

export interface ThaoTacSaoKe {
  napFile: (ds: File[]) => Promise<string>
  xoa: (sk: SaoKe) => Promise<void> | void
  ghepTay: (sk: SaoKe, gdId: string, khoaHD: string[]) => Promise<void> | void
}

export function CongNoDN({ k, dsSaoKe, tt }: { k: KetQuaCongNo; dsSaoKe: SaoKe[]; tt: ThaoTacSaoKe }) {
  const tepRef = useRef<HTMLInputElement>(null)
  const [thongBao, setThongBao] = useState('')
  const [dang, setDang] = useState(false)
  const [xemHet, setXemHet] = useState(false)
  const conNo = k.hoaDon.filter((h) => h.tong - h.daTra > 1)
  const theoTen = new Map(dsSaoKe.map((s) => [s.tenFile, s]))

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <input ref={tepRef} type="file" multiple accept=".xlsx,.xls,.csv" className="hidden" onChange={async (e) => {
          const fs = [...(e.target.files ?? [])]
          e.target.value = ''
          if (!fs.length) return
          setDang(true)
          setThongBao(await tt.napFile(fs).catch((er) => `⚠️ ${(er as Error).message}`))
          setDang(false)
        }} />
        <button disabled={dang} className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white disabled:bg-slate-300" onClick={() => tepRef.current?.click()}>
          {dang ? 'Đang đọc…' : 'Nạp sao kê ngân hàng (Excel / CSV)'}
        </button>
        {thongBao && <span>{thongBao}</span>}
      </div>
      <p className="text-xs text-slate-500">
        Tải sao kê tài khoản công ty trên Internet Banking dạng Excel/CSV. App tự dò cột (ngày, ghi nợ/ghi có hoặc số tiền, nội dung) và ghép với hoá đơn theo số tiền thanh toán,
        MST/tên đối tác trong nội dung chuyển khoản, ngày. Ghép sai thì gán tay ở bảng "Giao dịch chưa ghép". Mỗi ngân hàng một mẫu: mẫu nào app chưa đọc được, gửi 1 file để bổ sung.
      </p>

      {dsSaoKe.length > 0 && (
        <ul className="ml-4 list-disc">
          {dsSaoKe.map((s) => (
            <li key={s.id}>
              {s.tenFile} — {s.nganHang || 'ngân hàng ?'} {s.soTaiKhoan && `TK ${s.soTaiKhoan}`}, {s.tuNgay} → {s.denNgay}, {s.giaoDich.length} giao dịch{' '}
              <button className="text-red-700 underline" onClick={() => { if (confirm(`Xoá sao kê "${s.tenFile}" (và phần gán tay)?`)) void tt.xoa(s) }}>xoá</button>
            </li>
          ))}
        </ul>
      )}

      {dsSaoKe.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-slate-200 p-3">Giao dịch: <b>{k.soGiaoDich}</b><br />đã ghép {k.daGhep}</div>
            <div className="rounded-lg border border-slate-200 p-3">Phải thu: <b>{tien(k.phaiThu)} đ</b></div>
            <div className="rounded-lg border border-slate-200 p-3">Phải trả: <b>{tien(k.phaiTra)} đ</b></div>
            <div className={`rounded-lg border p-3 ${k.muaChuaChuyenKhoan.length ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}>HĐ mua ≥ 5tr chưa chuyển khoản: <b>{k.muaChuaChuyenKhoan.length}</b></div>
          </div>
          <p className="text-xs text-slate-500">Công nợ tính trên mọi hoá đơn còn hiệu lực trong sổ; hoá đơn ngoài khoảng ngày của sao kê sẽ hiện là "còn nợ" cho tới khi nạp sao kê kỳ đó.</p>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="p-2">Đối tác</th><th className="p-2">Chiều</th><th className="p-2 text-right">Tiền hoá đơn</th><th className="p-2 text-right">Đã thanh toán</th><th className="p-2 text-right">Còn nợ</th></tr></thead>
              <tbody>
                {k.doiTac.filter((d) => d.conNo > 1).map((d) => (
                  <tr key={`${d.l}|${d.mst}|${d.ten}`} className="border-t border-slate-100">
                    <td className="p-2">{d.ten} <span className="text-slate-400">{d.mst}</span></td>
                    <td className="p-2">{d.l === 'ban' ? 'Phải thu' : 'Phải trả'}</td>
                    <td className="p-2 text-right">{tien(d.tongHoaDon)}</td>
                    <td className="p-2 text-right">{tien(d.daThanhToan)}</td>
                    <td className="p-2 text-right font-medium">{tien(d.conNo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {k.canhBao.length > 0 && <DanhSachCanhBao ds={k.canhBao.slice(0, xemHet ? undefined : 10)} />}
          {k.canhBao.length > 10 && <button className="text-emerald-700 underline" onClick={() => setXemHet(!xemHet)}>{xemHet ? 'Thu gọn' : `Xem hết ${k.canhBao.length}`}</button>}

          {k.chuaGhep.length > 0 && (
            <div>
              <p className="font-semibold">Giao dịch chưa ghép được ({k.chuaGhep.length})</p>
              <div className="max-h-96 overflow-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-slate-50 text-left text-slate-500"><tr><th className="p-1">Ngày</th><th className="p-1 text-right">Vào</th><th className="p-1 text-right">Ra</th><th className="p-1">Nội dung</th><th className="p-1">Gán cho hoá đơn</th></tr></thead>
                  <tbody>
                    {k.chuaGhep.slice(0, 300).map(({ saoKe, gd }) => {
                      const sk = theoTen.get(saoKe)!
                      const cung = conNo.filter((h) => (gd.vao ? h.l === 'ban' : h.l === 'mua'))
                      return (
                        <tr key={`${saoKe}-${gd.id}`} className="border-t border-slate-100">
                          <td className="p-1">{gd.ngay}</td>
                          <td className="p-1 text-right">{gd.vao ? tien(gd.vao) : ''}</td>
                          <td className="p-1 text-right">{gd.ra ? tien(gd.ra) : ''}</td>
                          <td className="p-1">{gd.noiDung}{gd.doiUng && <span className="text-slate-400"> · {gd.doiUng}</span>}</td>
                          <td className="p-1">
                            <select className="max-w-xs rounded border border-slate-300 px-1 py-0.5" defaultValue="" onChange={(e) => {
                              const v = e.target.value
                              if (v) void tt.ghepTay(sk, gd.id, v === '-' ? [] : [v])
                            }}>
                              <option value="">— chọn —</option>
                              <option value="-">Không liên quan hoá đơn (phí, nội bộ…)</option>
                              {cung.map((h) => <option key={h.khoa} value={h.khoa}>{h.kh}-{h.so} {h.ng} {h.ten.slice(0, 30)} — còn {tien(h.tong - h.daTra)}</option>)}
                            </select>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

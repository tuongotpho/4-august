import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { lapBaoCaoNam, TEN_NHOM_TT, tenViec, type NhomTt } from '../lib/baoCaoNam'
import { fmtDate, today } from '../lib/dates'
import { formatMoney } from '../lib/numberToWords'
import { nhanTrangThai } from '../lib/status'
import type { Dossier, Settings } from '../lib/types'
import { BieuDoCotChong } from './BieuDo'

const tien = (n: number) => (n ? formatMoney(n) : '—')
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—')

// kiểu bảng in: kẻ ô mảnh, chữ nhỏ vừa A4
const bang = 'w-full border-collapse text-[12px] [&_td]:border [&_td]:border-slate-400 [&_td]:px-1.5 [&_td]:py-0.5 [&_th]:border [&_th]:border-slate-400 [&_th]:bg-slate-100 [&_th]:px-1.5 [&_th]:py-1 [&_th]:font-semibold [&_th]:whitespace-nowrap [&_tr]:break-inside-avoid'
const phai = 'text-right whitespace-nowrap'

function Muc({ so, ten, children }: { so: string; ten: string; children: React.ReactNode }) {
  return (
    // bảng dài được ngắt trang; chỉ giữ tiêu đề mục không đứng trơ cuối trang
    <section className="mt-5">
      <h2 className="mb-1.5 break-after-avoid text-[14px] font-bold uppercase">{so}. {ten}</h2>
      {children}
    </section>
  )
}

/**
 * Báo cáo tình hình thanh toán hóa đơn theo năm — xem trên màn hình như trang A4,
 * bấm "In / Lưu PDF" dùng hộp in của trình duyệt (chọn "Lưu dưới dạng PDF").
 */
export default function BaoCaoNam({ list, settings, namDau, dsNam, onClose }: { list: Dossier[]; settings: Settings; namDau: number; dsNam: number[]; onClose: () => void }) {
  const [nam, setNam] = useState(namDau)
  const [kemBangKe, setKemBangKe] = useState(false)
  const bc = useMemo(() => lapBaoCaoNam(list, nam, settings.canhBaoChoKtSauNgay), [list, nam, settings.canhBaoChoKtSauNgay])
  const t = today()

  // khi in chỉ in khung báo cáo (CSS @media print trong index.css)
  useEffect(() => {
    document.body.classList.add('in-bao-cao')
    const phim = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', phim)
    return () => {
      document.body.classList.remove('in-bao-cao')
      removeEventListener('keydown', phim)
    }
  }, [onClose])

  function inRa() {
    const cu = document.title
    document.title = `Bao cao thanh toan hoa don nam ${nam}` // tên file PDF gợi ý
    print()
    document.title = cu
  }

  const conLai = bc.tong.tongTien - bc.theoNhom.daTt.tongTien

  return createPortal(
    <div className="bao-cao-in fixed inset-0 z-50 flex flex-col bg-slate-700/70">
      <div className="khong-in flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
        <span className="font-semibold text-slate-800">Báo cáo năm</span>
        <select className="inp w-auto" value={nam} onChange={(e) => setNam(Number(e.target.value))}>
          {dsNam.map((y) => <option key={y} value={y}>Năm {y}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-slate-700">
          <input type="checkbox" checked={kemBangKe} onChange={(e) => setKemBangKe(e.target.checked)} /> Kèm phụ lục bảng kê hóa đơn
        </label>
        <span className="ml-auto" />
        <span className="hidden text-xs text-slate-500 md:inline">Hộp in mở ra → chọn máy in "Lưu dưới dạng PDF"</span>
        <button className="btn-primary" onClick={inRa}>🖨 In / Lưu PDF</button>
        <button className="btn" onClick={onClose}>Đóng</button>
      </div>

      <div className="vung-cuon flex-1 overflow-auto p-4">
        <div className="trang mx-auto w-[210mm] max-w-full bg-white px-[18mm] py-[15mm] font-['Times_New_Roman',Times,serif] text-[13px] leading-snug text-black shadow-xl">
          {/* Đầu văn bản */}
          <div className="flex items-start justify-between gap-4 text-center text-[12px]">
            <div>
              {settings.donViCapTren && <div className="uppercase">{settings.donViCapTren}</div>}
              {settings.donVi && <div className="font-bold uppercase">{settings.donVi}</div>}
              {settings.boPhan && <div className="font-bold">{settings.boPhan}</div>}
            </div>
            <div className="italic">{settings.diaDanh || ''}, ngày {t.slice(8, 10)} tháng {t.slice(5, 7)} năm {t.slice(0, 4)}</div>
          </div>
          <h1 className="mt-6 text-center text-[16px] font-bold uppercase">Báo cáo tình hình thanh toán hóa đơn năm {nam}</h1>
          <p className="text-center text-[12px] italic">
            (Số liệu tính đến ngày {fmtDate(t)}{nam < Number(t.slice(0, 4)) ? '' : ', năm chưa kết thúc'})
          </p>

          <Muc so="I" ten="Tổng quan">
            <table className={bang}>
              <thead>
                <tr><th className="text-left">Nội dung</th><th className={phai}>Số hồ sơ</th><th className={phai}>Số HĐ</th><th className={phai}>Số tiền (đồng)</th><th className={phai}>Tỷ lệ</th></tr>
              </thead>
              <tbody>
                {(Object.keys(TEN_NHOM_TT) as NhomTt[]).map((k) => (
                  <tr key={k}>
                    <td>{TEN_NHOM_TT[k]}</td>
                    <td className={phai}>{bc.theoNhom[k].soHoSo}</td>
                    <td className={phai}>{bc.theoNhom[k].soHd}</td>
                    <td className={phai}>{tien(bc.theoNhom[k].tongTien)}</td>
                    <td className={phai}>{pct(bc.theoNhom[k].tongTien, bc.tong.tongTien)}</td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td>Cộng</td><td className={phai}>{bc.tong.soHoSo}</td><td className={phai}>{bc.tong.soHd}</td><td className={phai}>{tien(bc.tong.tongTien)}</td><td className={phai}>100%</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-1 text-[11px] italic">Ghi chú: một hồ sơ có thể gồm nhiều hóa đơn; trạng thái tính theo hồ sơ. Còn chưa thanh toán: {tien(conLai)} đồng.</p>
            <div className="mt-2 font-semibold">Nhận xét:</div>
            <ul className="list-disc pl-5">
              {bc.nhanXet.map((x) => <li key={x}>{x}</li>)}
            </ul>
          </Muc>

          {bc.tong.soHd > 0 && (
            <>
              <Muc so="II" ten="Theo tháng">
                <div className="break-inside-avoid">
                  <BieuDoCotChong
                    ds={bc.thang.map((m) => ({ khoa: m.thang, nhan: `T${m.thang}`, tieuDe: `Tháng ${m.thang}/${nam}`, soHd: m.soHd, daTt: m.daTt, choKt: m.choKt, chuaNop: m.chuaNop }))}
                  />
                </div>
                <table className={`${bang} mt-2`}>
                  <thead>
                    <tr><th className="text-left">Tháng</th><th className={phai}>Số HĐ</th><th className={phai}>Tổng tiền</th><th className={phai}>Đã TT</th><th className={phai}>Chờ KT</th><th className={phai}>Chưa nộp</th></tr>
                  </thead>
                  <tbody>
                    {bc.thang.map((m) => (
                      <tr key={m.thang}>
                        <td>Tháng {m.thang}</td><td className={phai}>{m.soHd || '—'}</td><td className={phai}>{tien(m.tongTien)}</td>
                        <td className={phai}>{tien(m.daTt)}</td><td className={phai}>{tien(m.choKt)}</td><td className={phai}>{tien(m.chuaNop)}</td>
                      </tr>
                    ))}
                    <tr className="font-bold">
                      <td>Cả năm</td><td className={phai}>{bc.tong.soHd}</td><td className={phai}>{tien(bc.tong.tongTien)}</td>
                      <td className={phai}>{tien(bc.theoNhom.daTt.tongTien)}</td><td className={phai}>{tien(bc.theoNhom.choKt.tongTien)}</td><td className={phai}>{tien(bc.theoNhom.chuaNop.tongTien)}</td>
                    </tr>
                  </tbody>
                </table>
              </Muc>

              <Muc so="III" ten="Theo công việc">
                <table className={bang}>
                  <thead>
                    <tr><th className="text-left">Công việc (hashtag)</th><th className={phai}>Số hồ sơ</th><th className={phai}>Số HĐ</th><th className={phai}>Số tiền (đồng)</th><th className={phai}>Tỷ lệ</th></tr>
                  </thead>
                  <tbody>
                    {bc.theoViec.map((v) => (
                      <tr key={v.ma}>
                        <td>{tenViec(v.ma)}</td><td className={phai}>{v.soHoSo}</td><td className={phai}>{v.soHd}</td><td className={phai}>{tien(v.tongTien)}</td><td className={phai}>{pct(v.tongTien, bc.tong.tongTien)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {bc.nhieuTag && <p className="mt-1 text-[11px] italic">Hồ sơ gắn nhiều việc được tính vào mỗi việc, nên cộng các dòng có thể lớn hơn tổng.</p>}
              </Muc>

              <Muc so="IV" ten="Theo người đề nghị thanh toán">
                <table className={bang}>
                  <thead>
                    <tr><th className="text-left">Người đề nghị</th><th className={phai}>Số hồ sơ</th><th className={phai}>Số HĐ</th><th className={phai}>Số tiền (đồng)</th><th className={phai}>Đã TT</th><th className={phai}>Tỷ lệ đã TT</th></tr>
                  </thead>
                  <tbody>
                    {bc.theoNguoiTT.map((n) => (
                      <tr key={n.ten}>
                        <td>{n.ten}</td><td className={phai}>{n.soHoSo}</td><td className={phai}>{n.soHd}</td><td className={phai}>{tien(n.tongTien)}</td><td className={phai}>{tien(n.daTt)}</td><td className={phai}>{pct(n.daTt, n.tongTien)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Muc>

              <Muc so="V" ten="Người bán nhiều nhất">
                <table className={bang}>
                  <thead>
                    <tr><th className="w-8">STT</th><th className="text-left">Người bán</th><th className="text-left">MST</th><th className={phai}>Số HĐ</th><th className={phai}>Số tiền (đồng)</th></tr>
                  </thead>
                  <tbody>
                    {bc.nguoiBan.top.map((s, i) => (
                      <tr key={s.khoa}>
                        <td className="text-center">{i + 1}</td><td>{s.ten}</td><td className="whitespace-nowrap">{s.mst}</td><td className={phai}>{s.soHd}</td><td className={phai}>{tien(s.tongTien)}</td>
                      </tr>
                    ))}
                    {bc.nguoiBan.khac && (
                      <tr className="italic">
                        <td /><td colSpan={2}>{bc.nguoiBan.khac.soNguoi} người bán khác</td><td className={phai}>{bc.nguoiBan.khac.soHd}</td><td className={phai}>{tien(bc.nguoiBan.khac.tongTien)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </Muc>

              <Muc so="VI" ten={`Hồ sơ chưa được thanh toán (${bc.tonDong.length})`}>
                {bc.tonDong.length === 0 ? (
                  <p>Không còn hồ sơ nào chưa được thanh toán.</p>
                ) : (
                  <table className={bang}>
                    <thead>
                      <tr><th className="w-8">STT</th><th className="text-left">Nội dung</th><th className="text-left">Người đề nghị</th><th className={phai}>Số tiền (đồng)</th><th className="text-left">Đang ở bước</th><th className={phai}>Đã chờ</th></tr>
                    </thead>
                    <tbody>
                      {bc.tonDong.map((x, i) => (
                        <tr key={x.d.id}>
                          <td className="text-center">{i + 1}</td>
                          <td>{x.d.noiDung || x.d.invoices[0]?.tenNguoiBan || '(chưa đặt nội dung)'}</td>
                          <td className="whitespace-nowrap">{x.d.nguoiDeNghi}</td>
                          <td className={phai}>{tien(x.tongTien)}</td>
                          <td>{nhanTrangThai(x.d, x.trangThai)}</td>
                          <td className={phai}>{x.cho != null && x.cho > 0 ? `${x.cho} ngày` : ''}</td>
                        </tr>
                      ))}
                      <tr className="font-bold">
                        <td /><td colSpan={2}>Cộng</td><td className={phai}>{tien(bc.tonDong.reduce((a, x) => a + x.tongTien, 0))}</td><td colSpan={2} />
                      </tr>
                    </tbody>
                  </table>
                )}
              </Muc>
            </>
          )}

          {/* Ký */}
          <div className="mt-8 flex justify-end break-inside-avoid">
            <div className="w-64 text-center">
              <div className="font-bold uppercase">Người lập</div>
              <div className="h-20" />
              <div className="font-bold">{settings.hoTen}</div>
            </div>
          </div>

          {kemBangKe && bc.rows.length > 0 && (
            <section className="mt-8 break-before-page">
              <h2 className="mb-1.5 text-center text-[14px] font-bold uppercase">Phụ lục: Bảng kê hóa đơn năm {nam}</h2>
              <table className={bang}>
                <thead>
                  <tr><th className="w-8">STT</th><th>Ngày HĐ</th><th>Số HĐ</th><th className="text-left">Người bán</th><th className={phai}>Số tiền</th><th className="text-left">Nội dung</th><th className="text-left">Trạng thái</th></tr>
                </thead>
                <tbody>
                  {[...bc.rows].reverse().map((r, i) => (
                    <tr key={r.inv.id}>
                      <td className="text-center">{i + 1}</td>
                      <td className="whitespace-nowrap">{fmtDate(r.inv.ngayHd)}</td>
                      <td className="whitespace-nowrap">{r.inv.soHd}</td>
                      <td>{r.inv.tenNguoiBan}</td>
                      <td className={phai}>{tien(r.inv.tongTien)}</td>
                      <td>{r.d.noiDung}</td>
                      <td className="whitespace-nowrap">{nhanTrangThai(r.d, r.status)}{r.d.ngayKeToanTt ? ` ${fmtDate(r.d.ngayKeToanTt)}` : ''}</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td /><td colSpan={3}>Cộng {bc.rows.length} hóa đơn</td><td className={phai}>{tien(bc.tong.tongTien)}</td><td colSpan={2} />
                  </tr>
                </tbody>
              </table>
            </section>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

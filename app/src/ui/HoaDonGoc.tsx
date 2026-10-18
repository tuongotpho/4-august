// Mục "Hoá đơn gốc" trên Tổng quan: file XML/PDF từng hoá đơn so với danh sách cổng thuế, rơ-le kiểm tra, số tấn theo quý
import { useState } from 'react'
import { tenKy } from '../core/kho'
import { tien } from '../core/nhan'
import type { TongHopGoc } from '../core/hoaDonGoc'
import { DanhSachCanhBao } from './chung'

const soLuong = (r: Record<string, number>) => Object.entries(r).map(([dvt, sl]) => `${sl.toLocaleString('vi-VN', { maximumFractionDigits: 3 })} ${dvt}`).join(' + ') || '—'

export function HoaDonGocDN({ t }: { t: TongHopGoc }) {
  const [xemThieu, setXemThieu] = useState(false)
  const [xemKiem, setXemKiem] = useState(false)
  const sk = t.soKhop
  if (!t.soGoc) {
    return (
      <p className="text-sm text-slate-600">
        Chưa có file hoá đơn gốc nào. Kéo cả thư mục (hoặc gói ZIP) chứa hoá đơn <b>XML hoặc PDF</b> vào ô nạp ở trên: app đọc dòng hàng (tên hàng, số tấn, đơn giá),
        kiểm mã cơ quan thuế, chữ ký, và chỉ ra hoá đơn nào trên cổng thuế còn thiếu file gốc.
      </p>
    )
  }
  const soLoi = t.kiemTra.filter((c) => c.muc === 'loi').length
  return (
    <div className="space-y-4 text-sm">
      <p className="text-slate-600">
        {t.soGoc} file gốc ({t.soXml} XML, {t.soPdf} PDF). So với danh sách cổng thuế ({sk.soExcel} hoá đơn còn hiệu lực):{' '}
        <b className="text-emerald-700">{sk.soCoGoc} đã có file gốc</b>
        {sk.lechTien.length > 0 && <>, <b className="text-red-700">{sk.lechTien.length} lệch tiền</b></>}
        , <b className={sk.thieuGoc.length ? 'text-amber-700' : ''}>{sk.thieuGoc.length} chưa có file gốc</b>
        {sk.khongCoTrongExcel.length > 0 && <>, {sk.khongCoTrongExcel.length} file gốc không thấy trong danh sách cổng thuế</>}.
      </p>

      {t.theoQuy.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="p-2">Quý</th>
                <th className="p-2">Mua viên nén / gỗ</th>
                <th className="p-2 text-right">Tiền mua hàng</th>
                <th className="p-2 text-right">Tiền vận chuyển</th>
                <th className="p-2 text-right">Chi phí khác</th>
                <th className="p-2">Bán ra</th>
                <th className="p-2 text-right">Doanh thu</th>
              </tr>
            </thead>
            <tbody>
              {t.theoQuy.map((q) => (
                <tr key={q.khoa} className="border-t border-slate-100">
                  <td className="p-2">{tenKy(q.khoa)}</td>
                  <td className="p-2">{soLuong(q.muaVienNen)}</td>
                  <td className="p-2 text-right">{tien(q.tienMuaVienNen)}</td>
                  <td className="p-2 text-right">{tien(q.tienVanChuyen)}</td>
                  <td className="p-2 text-right">{tien(q.tienKhac)}</td>
                  <td className="p-2">{soLuong(q.banRa)}</td>
                  <td className="p-2 text-right">{tien(q.tienBan)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-slate-500">Chỉ tính các hoá đơn đã có file gốc (số liệu tờ khai vẫn lấy từ danh sách cổng thuế). Phân loại theo từ khoá trong tên hàng.</p>
        </div>
      )}

      {sk.lechTien.length > 0 && (
        <div>
          <p className="font-semibold text-red-700">Lệch tiền giữa file gốc và danh sách cổng thuế</p>
          <ul className="ml-4 list-disc">
            {sk.lechTien.map((x) => (
              <li key={`${x.kh}-${x.so}`}>
                {x.kh}-{x.so} ({x.tenFile}): gốc {tien(x.gocV)} / {tien(x.gocT)} — cổng thuế {tien(x.excelV)} / {tien(x.excelT)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {sk.thieuGoc.length > 0 && (
        <div>
          <button className="text-emerald-700 underline" onClick={() => setXemThieu(!xemThieu)}>
            {xemThieu ? 'Ẩn' : 'Xem'} {sk.thieuGoc.length} hoá đơn chưa có file gốc
          </button>
          {xemThieu && (
            <div className="mt-2 max-h-80 overflow-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="p-1">Chiều</th>
                    <th className="p-1">Hoá đơn</th>
                    <th className="p-1">Ngày</th>
                    <th className="p-1">Đối tác</th>
                    <th className="p-1 text-right">Chưa thuế</th>
                    <th className="p-1 text-right">Thuế</th>
                  </tr>
                </thead>
                <tbody>
                  {sk.thieuGoc.map((x) => (
                    <tr key={`${x.l}-${x.kh}-${x.so}`} className="border-t border-slate-100">
                      <td className="p-1">{x.l === 'mua' ? 'Mua vào' : 'Bán ra'}</td>
                      <td className="p-1">{x.kh}-{x.so}</td>
                      <td className="p-1">{x.ng}</td>
                      <td className="p-1">{x.ten}</td>
                      <td className="p-1 text-right">{tien(x.v)}</td>
                      <td className="p-1 text-right">{tien(x.t)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {sk.khongCoTrongExcel.length > 0 && (
        <p className="text-slate-600">
          File gốc không thấy trong danh sách cổng thuế (Excel tải thiếu tháng, hoặc hoá đơn nháp / đơn vị khác):{' '}
          {sk.khongCoTrongExcel.map((x) => `${x.kh}-${x.so} (${x.tenFile})`).join('; ')}
        </p>
      )}

      <div>
        <button className="text-emerald-700 underline" onClick={() => setXemKiem(!xemKiem)}>
          {xemKiem ? 'Ẩn' : 'Xem'} kết quả kiểm tra từng hoá đơn ({soLoi} lỗi, {t.kiemTra.length - soLoi} chú ý)
        </button>
        {xemKiem && (t.kiemTra.length ? <DanhSachCanhBao ds={t.kiemTra} /> : <p className="text-emerald-700">✅ Không có gì bất thường.</p>)}
        <p className="mt-1 text-xs text-slate-500">
          Kiểm: mã của cơ quan thuế (XML), chữ ký số người bán (XML), ngày ký so với ngày lập, hoá đơn thay thế/điều chỉnh, thuế suất lạ hoặc nhiều thuế suất,
          cộng dòng hàng so với tổng, hoá đơn mua từ 5 triệu (từ 01/07/2025 phải chuyển khoản mới được khấu trừ). Không kiểm được chữ ký có đúng về mật mã hay không.
        </p>
      </div>
    </div>
  )
}

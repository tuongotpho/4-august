import { useState } from 'react'
import { goiMayChu } from '../lib/hooks'
import { chuanLop, dinhDangTien, ngayVN, thu, type LopGiang } from '../lib/model'

/** Dán tin nhắn Zalo ngay trên web: máy chủ (AI) đọc ra lớp, anh xem lại rồi mở từng lớp để lưu */
export default function DanTin({ onMo, onDong }: { onMo: (l: LopGiang) => void; onDong: () => void }) {
  const [tin, setTin] = useState('')
  const [kq, setKq] = useState<{ lop: LopGiang[]; luuY: string[] } | null>(null)
  const [loi, setLoi] = useState('')
  const [dangDoc, setDangDoc] = useState(false)

  async function doc() {
    setLoi('')
    setDangDoc(true)
    try {
      const r = await goiMayChu<{ lop: LopGiang[]; luuY: string[]; traLoi: string }>('/ai/trich', { tin })
      if (!r.lop.length) setLoi(r.traLoi || 'Không thấy lịch giảng nào trong tin nhắn.')
      const lop = r.lop.map((l) => chuanLop({ ...l, nguon: 'web' }))
      // một lớp: mở thẳng ô sửa để soát rồi Lưu (đỡ một lần chạm trên điện thoại)
      if (lop.length === 1 && !r.luuY[0]) return onMo(lop[0])
      setKq({ lop, luuY: r.luuY })
    } catch (e) {
      setLoi((e as Error).message)
    } finally {
      setDangDoc(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onDong()}>
      <div className="card min-h-full w-full max-w-xl space-y-3 !rounded-none sm:min-h-0 sm:!rounded-lg">
        <h2 className="text-lg font-semibold text-slate-800">📋 Dán tin nhắn — tự điền lịch</h2>
        <textarea
          className="inp h-40"
          value={tin}
          onChange={(e) => setTin(e.target.value)}
          placeholder={'Dán tin nhắn Zalo của đối tác vào đây, vd:\n"Thứ 5 tuần sau 12/11 em nhờ anh giảng ATLĐ cho Cty ABC ở Hải Dương, 8h–11h, thù lao 1tr5 nhé"'}
        />
        <div className="flex flex-wrap gap-2">
          {'clipboard' in navigator && 'readText' in navigator.clipboard && (
            <button className="btn !py-2" onClick={() => void navigator.clipboard.readText().then((t) => t && setTin(t), () => setLoi('Trình duyệt không cho đọc bộ nhớ tạm — giữ ngón tay vào ô trên rồi chọn Dán.'))}>
              📋 Dán từ bộ nhớ
            </button>
          )}
          <button className="btn-primary !py-2" disabled={dangDoc || tin.trim().length < 5} onClick={() => void doc()}>{dangDoc ? 'AI đang đọc…' : 'Đọc tin nhắn'}</button>
          <button className="btn" onClick={onDong}>Đóng</button>
        </div>
        {loi && <p className="rounded bg-amber-50 px-2 py-1 text-sm text-amber-800">{loi}</p>}
        {kq && kq.lop.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">Đọc được {kq.lop.length} lớp — bấm để xem lại và lưu:</p>
            {kq.lop.map((l, i) => (
              <button key={l.id} className="w-full rounded-md border border-slate-200 p-2 text-left text-sm hover:bg-slate-50" onClick={() => onMo(l)}>
                <b>{thu(l.ngay)} {ngayVN(l.ngay)}</b> {l.gioBD && `${l.gioBD}–${l.gioKT}`} · {l.khachHang || '(chưa rõ khách hàng)'}
                <span className="block text-xs text-slate-500">{[l.doiTac, l.lienHe, l.diaDiem, l.chiPhi !== null && `${dinhDangTien(l.chiPhi)} đ`].filter(Boolean).join(' · ')}</span>
                {kq.luuY[i] && <span className="block text-xs text-amber-700">⚠️ {kq.luuY[i]}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

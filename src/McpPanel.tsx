// Mục "Kết nối AI" trong Cài đặt: địa chỉ máy chủ MCP, các máy đã được cho phép (thu hồi được),
// nhật ký mọi lần AI ghi dữ liệu.

import { useEffect, useState } from 'react'
import { Icon } from './icons'
import { mcpUrl, theoDoiNhatKy, theoDoiPhien, thuHoiPhien, uidHienTai, type DongNhatKyAi, type PhienAi } from './mcpConnect'
import { copyText, useApp } from './ui'

const ngayGio = (ms?: number) => (ms ? new Date(ms).toLocaleString('vi-VN', { hour12: false }) : '—')

export default function McpPanel() {
  const { toast } = useApp()
  const [phien, setPhien] = useState<PhienAi[]>([])
  const [nhatKy, setNhatKy] = useState<DongNhatKyAi[]>([])
  const [loi, setLoi] = useState('')

  useEffect(() => {
    const uid = uidHienTai()
    if (!uid) return
    const baoLoi = (e: Error) => setLoi(/permission/i.test(e.message) ? 'Chưa đọc được phiên / nhật ký AI: luật Firestore mới chưa được deploy.' : e.message)
    const h1 = theoDoiPhien(uid, setPhien, baoLoi)
    const h2 = theoDoiNhatKy(setNhatKy, baoLoi)
    return () => (h1(), h2())
  }, [])

  const thuHoi = async (p: PhienAi) => {
    if (!confirm(`Thu hồi quyền của "${p.tenMay}"? Lần gọi tới của máy đó sẽ bị từ chối.`)) return
    await thuHoiPhien(p.id).catch((e) => setLoi(e.message))
    toast('Đã thu hồi')
  }

  const url = mcpUrl()
  return (
    <section className="space-y-3 border-t border-slate-100 pt-4">
      <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900">
        <Icon name="message" className="h-4 w-4" /> Kết nối AI (Claude, Codex…)
      </h4>
      <p className="text-xs text-slate-600">Cho trợ lý AI hỏi sổ ("tuần này ai sắp lấy hàng?", "ai đang nợ?") và lên đơn bằng tài khoản của anh. Thêm địa chỉ này làm "custom connector":</p>
      <button
        onClick={async () => (await copyText(url)) && toast('Đã chép địa chỉ')}
        className="flex w-full cursor-pointer items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-left font-mono text-xs break-all text-slate-800"
      >
        <span className="flex-1">{url}</span>
        <Icon name="copy" className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
      <p className="text-xs text-slate-500">Lần đầu, trình duyệt mở trang "Cho phép AI" — đăng nhập Google của chủ shop là xong.</p>
      {loi && <div className="rounded-xl bg-amber-50 p-2.5 text-xs text-amber-900">{loi}</div>}

      <div>
        <div className="mb-1 text-xs font-bold text-slate-700">Máy đã cho phép ({phien.length})</div>
        {phien.length === 0 ? (
          <p className="text-xs text-slate-500">Chưa có máy nào.</p>
        ) : (
          phien.map((p) => (
            <div key={p.id} className="flex items-center gap-2 border-b border-slate-100 py-2 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{p.tenMay}</div>
                <div className="text-[11px] text-slate-500">
                  {p.ungDung} · cho phép {ngayGio(p.taoLuc)} · dùng gần nhất {ngayGio(p.dungLuc)}
                </div>
              </div>
              <button onClick={() => thuHoi(p)} className="cursor-pointer rounded-lg px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50">
                Thu hồi
              </button>
            </div>
          ))
        )}
      </div>

      <div>
        <div className="mb-1 text-xs font-bold text-slate-700">Nhật ký AI ghi dữ liệu (30 lần gần nhất)</div>
        {nhatKy.length === 0 ? (
          <p className="text-xs text-slate-500">Chưa có lần ghi nào.</p>
        ) : (
          <ul className="space-y-1.5">
            {nhatKy.map((d) => (
              <li key={d.id} className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs">
                <div className="text-slate-500">
                  {ngayGio(d.luc)} · {d.tenMay} · <span className="font-mono">{d.congCu}</span>
                </div>
                <div>
                  <b>{d.tenDoiTuong}</b> — {d.tomTat}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

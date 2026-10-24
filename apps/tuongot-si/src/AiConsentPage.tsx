// Trang "Cho phép AI truy cập" (/ket-noi-ai). Máy chủ MCP chuyển chủ shop tới đây khi một ứng dụng AI
// (Claude, Codex…) xin kết nối. Đăng nhập Google, bấm cho phép; trang gửi mã làm mới của một phiên đăng nhập
// RIÊNG cho máy chủ (chính tên miền này) rồi quay về ứng dụng AI.

import { useEffect, useState } from 'react'
import { Icon } from './icons'
import { dangNhapGoogleChoAi, mayChuChoPhep } from './mcpConnect'
import { COPYRIGHT } from './ui'

interface YeuCau {
  ungDung: string
  noiNhan: string
}

export default function AiConsentPage() {
  const q = new URLSearchParams(location.search)
  const yc = q.get('yc') ?? ''
  const mayChu = mayChuChoPhep(q.get('may'))
  const [yeuCau, setYeuCau] = useState<YeuCau | null>(null)
  const [loi, setLoi] = useState('')
  const [tenMay, setTenMay] = useState('')
  const [dangChay, setDangChay] = useState(false)
  const [xong, setXong] = useState(false)

  useEffect(() => {
    if (!yc) return setLoi('Thiếu yêu cầu kết nối — hãy bắt đầu từ ứng dụng AI.')
    fetch(`${mayChu}/oauth/yeu-cau?${new URLSearchParams({ yc })}`)
      .then(async (r) => {
        const j = await r.json()
        if (!r.ok) throw new Error(j.loi || 'Yêu cầu không hợp lệ')
        setYeuCau(j)
        setTenMay(j.ungDung)
      })
      .catch((e) => setLoi(e instanceof TypeError || !e.message ? 'Không liên lạc được máy chủ kết nối AI — thử lại sau ít phút.' : e.message))
  }, [yc, mayChu])

  const choPhep = async () => {
    setDangChay(true)
    setLoi('')
    try {
      let phien
      try {
        phien = await dangNhapGoogleChoAi()
      } catch {
        throw new Error('Đăng nhập Google không thành công (cửa sổ bị chặn hoặc đã đóng).')
      }
      const r = await fetch(`${mayChu}/oauth/cho-phep`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yeuCau: yc, maLamMoi: phien.maLamMoi, tenMay }),
      })
      const j = await r.json()
      await phien.dangXuat()
      if (!r.ok) throw new Error(/permission|403/i.test(j.loi ?? '') ? 'Tài khoản này không có quyền mở sổ bán buôn.' : j.loi || 'Không cấp được quyền')
      setXong(true)
      location.href = j.chuyenToi
    } catch (err) {
      setLoi(err instanceof TypeError ? 'Không liên lạc được máy chủ kết nối AI — thử lại sau ít phút.' : (err as Error).message)
      setDangChay(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-red-800 to-red-950 p-4">
      <div className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-red-50 text-red-700">
            <Icon name="chili" className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">Cho phép AI mở sổ bán buôn?</h1>
        </div>

        {yeuCau && (
          <>
            <p className="text-slate-700">
              <b>{yeuCau.ungDung}</b> <span className="text-sm text-slate-500">(trả về {yeuCau.noiNhan})</span> xin quyền làm việc thay tài khoản chủ shop:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>Xem khách, đơn hàng, công nợ, tồn kho, thống kê, dự đoán khách mua lại</li>
              <li>Lên đơn, ghi thu nợ, nhập hàng, thêm khách, sửa giá</li>
            </ul>
            <p className="flex gap-2 text-xs text-slate-500">
              <Icon name="check" className="h-4 w-4 shrink-0 text-emerald-600" />
              AI không xoá được gì. Mọi lần ghi vào nhật ký; thu hồi quyền máy này bất cứ lúc nào ở Cài đặt → Kết nối AI.
            </p>
          </>
        )}

        {loi && <div className="rounded-xl border-l-4 border-red-500 bg-red-50 p-3 text-sm text-red-700">{loi}</div>}

        {yeuCau && !xong && (
          <div className="space-y-3">
            <label className="block text-sm text-slate-600">
              Tên máy này (để nhận ra khi thu hồi)
              <input maxLength={60} value={tenMay} onChange={(e) => setTenMay(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-base text-slate-900" />
            </label>
            <button
              onClick={choPhep}
              disabled={dangChay}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-red-700 py-3.5 font-bold text-white disabled:opacity-60"
            >
              {dangChay ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Icon name="login" className="h-5 w-5" />}
              Đăng nhập Google và cho phép
            </button>
          </div>
        )}

        {xong && <p className="text-sm text-emerald-700">Xong — đang quay lại ứng dụng AI. Có thể đóng trang này.</p>}
        {!yeuCau && !loi && <p className="text-sm text-slate-500">Đang kiểm tra yêu cầu…</p>}
        <p className="pt-2 text-center text-xs text-slate-400">{COPYRIGHT}</p>
      </div>
    </div>
  )
}

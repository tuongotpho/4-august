import { useState } from 'react'

/**
 * Kết nối bot Telegram: anh gửi PDF hóa đơn cho bot -> máy chủ (Vercel, mcp/telegram.ts) tự tạo hồ sơ mới.
 * Máy chủ làm việc bằng quyền của chính tài khoản này (giống "Kết nối AI"), thu hồi ở mục "Quyền của AI".
 * Mã bot (HOADON_TELE_TOKEN) chỉ nằm trên Vercel — trang này không bao giờ thấy nó.
 */
const MAY_CHU = import.meta.env.VITE_MAY_CHU_URL || (location.hostname.endsWith('vercel.app') ? location.origin : 'https://hoadon-npsc.vercel.app')

async function goi<T>(duong: string, than: Record<string, string>): Promise<T> {
  const { auth } = await import('../lib/firebase')
  const maLamMoi = auth.currentUser?.refreshToken
  if (!maLamMoi) throw new Error('Chưa đăng nhập')
  const r = await fetch(`${MAY_CHU}${duong}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...than, maLamMoi }) })
  const j = (await r.json().catch(() => ({}))) as T & { loi?: string }
  if (!r.ok) throw new Error(j.loi || `Máy chủ trả lỗi ${r.status}`)
  return j
}

export default function KetNoiTelegram() {
  const [bot, setBot] = useState('')
  const [chat, setChat] = useState('')
  const [ve, setVe] = useState('')
  const [dangChay, setDangChay] = useState(false)
  const [loi, setLoi] = useState('')
  const [daChep, setDaChep] = useState(false)

  async function lam(fn: () => Promise<void>) {
    setLoi('')
    setDangChay(true)
    try {
      await fn()
    } catch (e) {
      setLoi((e as Error).message)
    } finally {
      setDangChay(false)
    }
  }

  return (
    <details className="text-sm text-slate-600 lg:col-span-2">
      <summary className="cursor-pointer select-none text-xs text-slate-400 hover:text-slate-600">
        Telegram — gửi PDF hóa đơn cho bot, tự tạo hồ sơ mới
      </summary>
      <div className="card mt-2 space-y-3">
        {loi && <p className="text-xs text-red-700">⚠️ {loi}</p>}
        <div>
          <p className="font-medium text-slate-700">Bước 1 — Bật bot</p>
          <p className="text-xs text-slate-500">Cần sẵn biến <code>HOADON_TELE_TOKEN</code> (mã bot từ @BotFather) trên Vercel.</p>
          <button className="btn mt-1 !py-1 !text-xs" disabled={dangChay} onClick={() => void lam(async () => setBot((await goi<{ bot: string }>('/telegram/bat', {})).bot))}>
            Bật bot
          </button>
          {bot && (
            <p className="mt-1 text-xs">
              ✅ Bot <b>@{bot}</b> đã sẵn sàng. Mở{' '}
              <a className="text-blue-700 underline" href={`https://t.me/${bot}`} target="_blank" rel="noreferrer">t.me/{bot}</a>, bấm <b>Start</b> — bot gửi lại <b>Mã Telegram</b> của anh.
            </p>
          )}
        </div>
        <div>
          <p className="font-medium text-slate-700">Bước 2 — Tạo vé kết nối</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <input className="inp w-48" inputMode="numeric" placeholder="Mã Telegram (dãy số)" value={chat} onChange={(e) => setChat(e.target.value.replace(/\D/g, ''))} />
            <button className="btn !py-1 !text-xs" disabled={dangChay || !chat} onClick={() => void lam(async () => setVe((await goi<{ ve: string }>('/telegram/ghep', { chat })).ve))}>
              Tạo vé
            </button>
          </div>
          {ve && (
            <div className="mt-2 space-y-1 text-xs">
              <textarea readOnly className="inp h-20 w-full font-mono !text-[11px]" value={ve} onFocus={(e) => e.target.select()} />
              <button className="btn !py-1 !text-xs" onClick={() => void navigator.clipboard.writeText(ve).then(() => setDaChep(true))}>
                {daChep ? '✓ Đã chép' : 'Chép vé'}
              </button>
              <p className="text-slate-500">
                Dán vé vào Vercel → dự án hoadon-npsc → Settings → Environment Variables, tên <code>HOADON_TELE_VE</code>, rồi Redeploy.
                Xong thì gửi thử một PDF cho bot. Vé đã được mã hoá; muốn ngắt bot thì thu hồi "Bot Telegram" ở mục Quyền của AI bên dưới.
              </p>
            </div>
          )}
        </div>
      </div>
    </details>
  )
}

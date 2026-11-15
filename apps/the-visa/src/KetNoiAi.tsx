// Kết nối AI (MCP): trang cho phép (khi AI xin quyền) + mục quản lý các máy đã kết nối.
import { useCallback, useEffect, useState } from 'react'
import { ngayVN } from '../shared/thongKe'

// Máy chủ AI ở cùng tên miền với app: dưới cổng chung …/the-visa/ (Firebase app-by-lethanh.web.app) hay chạy riêng
export const DIA_CHI_MCP = location.pathname.startsWith('/the-visa/') ? `${location.origin}/the-visa/mcp` : `${location.origin}/mcp`
type LayVe = () => Promise<string>

interface Phien { id: string; email: string; tenMay: string; ungDung: string; noiNhan: string; taoLuc: string }
interface DongNhatKy { luc: string; tenMay: string; congCu: string; moTa: string }

const gio = (iso: string) => `${ngayVN(iso.slice(0, 10))} ${new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`

/** Trang hiện khi URL có ?ket-noi-ai=<yêu cầu> (máy chủ MCP chuyển sang đây) */
export function ChoPhepAi({ yeuCau, layVe, email }: { yeuCau: string; layVe: LayVe; email: string }) {
  const [tt, setTt] = useState<{ ungDung: string; noiNhan: string } | null>(null)
  const [tenMay, setTenMay] = useState('')
  const [loi, setLoi] = useState('')
  const [dang, setDang] = useState(false)
  useEffect(() => {
    fetch(`oauth/yeu-cau?yc=${encodeURIComponent(yeuCau)}`).then(async (r) => {
      const d = await r.json()
      if (!r.ok) throw new Error(d.loi ?? 'Yêu cầu không hợp lệ')
      setTt(d); setTenMay(d.ungDung)
    }).catch((e) => setLoi(e.message))
  }, [yeuCau])

  async function choPhep() {
    setDang(true); setLoi('')
    try {
      const r = await fetch('oauth/cho-phep', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${await layVe()}` },
        body: JSON.stringify({ yeuCau, tenMay }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.loi ?? 'Không cấp được quyền')
      location.href = d.chuyenToi
    } catch (e) { setLoi((e as Error).message); setDang(false) }
  }
  const huy = () => { history.replaceState(null, '', location.pathname); location.reload() }

  return (
    <div className="giua">
      <div className="card" style={{ maxWidth: 460, textAlign: 'left' }}>
        <h1 style={{ fontSize: 20 }}>Cho phép AI xem chi tiêu thẻ?</h1>
        {tt ? (
          <>
            <p><b>{tt.ungDung}</b> <span className="sub">(trả về {tt.noiNhan})</span> xin quyền thay mặt <b>{email}</b>:</p>
            <ul>
              <li>Xem các kỳ sao kê, giao dịch, thống kê năm, nhận xét</li>
              <li>Đổi nhóm một giao dịch khi anh/chị bảo (đổi lại được)</li>
            </ul>
            <p className="sub">AI không tải sao kê lên, không xoá được kỳ nào. Mọi lần ghi được ghi nhật ký; thu hồi quyền máy này bất cứ lúc nào ở tab <b>Kết nối AI</b>.</p>
            <label className="sub">Tên máy này (để nhận ra khi thu hồi)<br />
              <input type="text" value={tenMay} maxLength={60} onChange={(e) => setTenMay(e.target.value)} style={{ width: '100%' }} />
            </label>
            <div className="bar">
              <button className="nut" disabled={dang} onClick={choPhep}>{dang ? 'Đang cấp quyền…' : 'Cho phép'}</button>
              <button className="nut phu" disabled={dang} onClick={huy}>Không</button>
            </div>
          </>
        ) : !loi && <p className="sub">Đang kiểm yêu cầu…</p>}
        {loi && <div className="loi">{loi}</div>}
      </div>
    </div>
  )
}

/** Tab "Kết nối AI" */
export function QuanLyKetNoi({ layVe }: { layVe: LayVe | null }) {
  const [phien, setPhien] = useState<Phien[] | null>(null)
  const [nhatKy, setNhatKy] = useState<DongNhatKy[]>([])
  const [loi, setLoi] = useState('')
  const tai = useCallback(async () => {
    if (!layVe) return
    try {
      const r = await fetch('api/mcp-phien', { headers: { authorization: `Bearer ${await layVe()}` } })
      const d = await r.json()
      if (!r.ok) throw new Error(d.loi)
      setPhien(d.phien); setNhatKy(d.nhatKy); setLoi('')
    } catch (e) { setLoi((e as Error).message) }
  }, [layVe])
  useEffect(() => { tai() }, [tai])

  async function thuHoi(p: Phien) {
    if (!layVe || !confirm(`Thu hồi quyền của "${p.tenMay}"? Máy đó sẽ phải kết nối lại.`)) return
    await fetch(`api/mcp-phien?id=${p.id}`, { method: 'DELETE', headers: { authorization: `Bearer ${await layVe()}` } })
    tai()
  }

  const mcpJson = JSON.stringify({ mcpServers: { 'the-visa': { type: 'http', url: DIA_CHI_MCP } } }, null, 2)
  return (
    <>
      <div className="card">
        <h2>Kết nối AI (MCP)</h2>
        <p>Cho Claude / Codex hỏi chi tiêu bằng lời, ví dụ <i>"tháng này đổ xăng hết bao nhiêu?"</i>. AI chỉ <b>xem</b> và <b>đổi nhóm</b> giao dịch; không tải sao kê, không xoá được.</p>
        <p className="sub" style={{ marginBottom: 4 }}>Địa chỉ máy chủ:</p>
        <code style={{ userSelect: 'all' }}>{DIA_CHI_MCP}</code>
        <p className="sub" style={{ margin: '12px 0 4px' }}>Claude trong app máy tính: thêm file <code>.mcp.json</code> vào thư mục dự án, mở phiên mới, gõ <code>/mcp</code> → chọn <b>the-visa</b> → Authenticate.</p>
        <pre style={{ background: 'var(--chip)', padding: 10, borderRadius: 8, overflowX: 'auto', fontSize: 12.5 }}>{mcpJson}</pre>
        <p className="sub">claude.ai (web / điện thoại): Settings → Connectors → Add custom connector → dán địa chỉ trên.</p>
      </div>
      {loi && <div className="loi">{loi}</div>}
      <div className="card" style={{ marginTop: 14 }}>
        <h2>Máy đang được phép</h2>
        {!layVe ? <p className="sub">Chế độ thử trên máy: không có kết nối AI.</p> : !phien ? <p className="sub">Đang tải…</p> : !phien.length ? <p className="sub">Chưa có máy nào.</p> : (
          <table>
            <thead><tr><th>Tên máy</th><th>Ứng dụng</th><th>Cho phép lúc</th><th /></tr></thead>
            <tbody>{phien.map((p) => (
              <tr key={p.id}><td>{p.tenMay}</td><td>{p.ungDung}<div className="tag">{p.noiNhan} · {p.email}</div></td><td>{gio(p.taoLuc)}</td>
                <td><button className="chip" onClick={() => thuHoi(p)}>Thu hồi</button></td></tr>
            ))}</tbody>
          </table>
        )}
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <h2>Nhật ký AI ghi dữ liệu</h2>
        {!nhatKy.length ? <p className="sub">Chưa có lần ghi nào.</p> : (
          <div className="tbl"><table>
            <thead><tr><th>Lúc</th><th>Máy</th><th>Việc</th></tr></thead>
            <tbody>{nhatKy.map((d, i) => <tr key={i}><td>{gio(d.luc)}</td><td>{d.tenMay}</td><td>{d.moTa}</td></tr>)}</tbody>
          </table></div>
        )}
      </div>
    </>
  )
}

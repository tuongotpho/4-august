import { useEffect, useState } from 'react'
import maScript from '../../apps-script/Lich.gs?raw'
import { QUA_CONG } from '../lib/cong'
import { APP_URL, dongBoNen, goiMayChu, luuNhieuLop, taiFile, useCaiDat } from '../lib/hooks'
import { khoaNgauNhien, thuKetNoi } from '../lib/lichGoogle'
import { boDau, chuanLop, homNay, ngayVN, type CaiDat, type LopGiang } from '../lib/model'
import type { KetQuaNhap } from '../lib/nhapExcel'
import { store, type DongNhatKy, type PhienMay } from '../lib/store'

export default function CaiDatPage({ ds }: { ds: LopGiang[] }) {
  const cd = useCaiDat()
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <NhapExcel ds={ds} cd={cd} />
      <LichGoogle ds={ds} cd={cd} />
      <Telegram />
      <KetNoiAI />
      <GopTen ds={ds} cd={cd} />
      <SaoLuu ds={ds} />
      {/* Qua cổng chung: tài khoản, đăng xuất ở trang chủ */}
      {!QUA_CONG && <TaiKhoan />}
    </div>
  )
}

function Khung({ tieuDe, children }: { tieuDe: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-2 text-sm text-slate-700">
      <h3 className="font-semibold text-slate-800">{tieuDe}</h3>
      {children}
    </section>
  )
}

// ---------------- Nhập Excel ----------------

function NhapExcel({ ds, cd }: { ds: LopGiang[]; cd: CaiDat }) {
  const [kq, setKq] = useState<KetQuaNhap | null>(null)
  const [loi, setLoi] = useState('')
  const [xong, setXong] = useState('')

  async function doc(f: File) {
    setLoi('')
    setXong('')
    try {
      const { nhapExcel } = await import('../lib/nhapExcel')
      setKq(nhapExcel(await f.arrayBuffer(), cd, ds))
    } catch (e) {
      setLoi((e as Error).message)
    }
  }

  async function nhap() {
    if (!kq) return
    await luuNhieuLop(kq.lop)
    await store.luuCaiDat({ ...cd, biDanhDoiTac: { ...kq.biDanh, ...cd.biDanhDoiTac } })
    setXong(`✅ Đã nhập ${kq.lop.length} lớp.${kq.lop.some((l) => l.canDongBo) ? ' Lớp sắp tới sẽ được đẩy lên Google Calendar khi bật đồng bộ.' : ''}`)
    setKq(null)
  }

  return (
    <Khung tieuDe="📥 Nhập file Excel">
      <p className="text-xs text-slate-500">
        Nên dùng file đã làm sạch <code>ATLD_sach.xlsx</code> (một sheet LichGiang, app đọc thẳng từng cột). Vẫn nhận file AppSheet cũ (AT_2023…AT_2026):
        app tự dò cột, chuẩn hóa tên, bỏ việc NPSC / gia đình và dòng trùng. Nhập lại nhiều lần được — lớp đã có không bị ghi đè.
      </p>
      <input type="file" accept=".xlsx" onChange={(e) => e.target.files?.[0] && void doc(e.target.files[0])} />
      {loi && <p className="text-red-700">⚠️ {loi}</p>}
      {xong && <p className="text-emerald-700">{xong}</p>}
      {kq && (
        <div className="space-y-2 rounded border border-slate-200 p-2">
          <p>
            Sẽ nhập <b>{kq.lop.length} lớp</b>
            {' ('}
            {Object.entries(kq.lop.reduce<Record<string, number>>((m, l) => ((m[l.ngay.slice(0, 4)] = (m[l.ngay.slice(0, 4)] ?? 0) + 1), m), {}))
              .map(([n, c]) => `${n}: ${c}`)
              .join(', ')}
            {')'}, bỏ qua {kq.boQua.length} dòng.
          </p>
          {kq.canXem.length > 0 && (
            <details open>
              <summary className="cursor-pointer font-medium text-amber-800">Nên xem lại sau khi nhập ({kq.canXem.length})</summary>
              <ul className="ml-4 list-disc text-xs">
                {kq.canXem.map((x, i) => <li key={i}>{ngayVN(x.lop.ngay)} · {x.lop.khachHang}: {x.lyDo}</li>)}
              </ul>
            </details>
          )}
          <details>
            <summary className="cursor-pointer text-slate-600">Dòng bỏ qua ({kq.boQua.length})</summary>
            <ul className="ml-4 max-h-48 list-disc overflow-y-auto text-xs">
              {kq.boQua.map((b, i) => <li key={i}>{b.sheet}{b.dong ? ` dòng ${b.dong}` : ''} · {b.moTa}: {b.lyDo}</li>)}
            </ul>
          </details>
          <button className="btn-primary" disabled={!kq.lop.length} onClick={() => void nhap()}>Nhập {kq.lop.length} lớp</button>
        </div>
      )}
    </Khung>
  )
}

// ---------------- Google Calendar ----------------

function LichGoogle({ ds, cd }: { ds: LopGiang[]; cd: CaiDat }) {
  const [url, setUrl] = useState(cd.lich.url)
  const [tb, setTb] = useState('')
  const [dangChay, setDangChay] = useState(false)
  const [daChep, setDaChep] = useState(false)
  useEffect(() => setUrl(cd.lich.url), [cd.lich.url])

  const khoa = cd.lich.khoa
  useEffect(() => {
    // tạo khóa bí mật một lần, cất trong cài đặt (chỉ tài khoản anh đọc được)
    if (!khoa) void store.getCaiDat().then((c) => (c.lich.khoa ? undefined : store.luuCaiDat({ ...c, lich: { ...c.lich, khoa: khoaNgauNhien() } })))
  }, [khoa])
  const script = maScript.replace('DAN_KHOA_TU_APP_VAO_DAY', khoa || '(đang tạo khóa…)')
  const choDongBo = ds.filter((l) => l.canDongBo && !l.huy).length

  async function lam(fn: () => Promise<string>) {
    setDangChay(true)
    setTb('')
    try {
      setTb(await fn())
    } catch (e) {
      setTb('⚠️ ' + (e as Error).message)
    } finally {
      setDangChay(false)
    }
  }

  return (
    <Khung tieuDe="📅 Đồng bộ Google Calendar">
      <p className="text-xs text-slate-500">
        Mỗi lớp thêm / sửa (trên web hay qua bot Telegram) tự hiện trên Google Calendar của anh. Dùng một Apps Script nhỏ chạy bằng tài khoản Google của anh —
        cài một lần:
      </p>
      <ol className="ml-4 list-decimal space-y-1 text-xs">
        <li>
          Mở <a className="text-teal-700 underline" href="https://script.google.com/home/projects/create" target="_blank" rel="noreferrer">script.google.com → Dự án mới</a>,
          xoá hết, dán đoạn mã dưới (đã điền sẵn khóa riêng của anh).{' '}
          <button className="btn !py-0 !text-xs" disabled={!khoa} onClick={() => void navigator.clipboard.writeText(script).then(() => setDaChep(true))}>{daChep ? '✓ Đã chép' : 'Chép mã'}</button>
        </li>
        <li>Bấm <b>Triển khai → Triển khai mới</b> → loại <b>Ứng dụng web</b>; Thực thi: <b>Tôi</b>; Quyền truy cập: <b>Bất kỳ ai</b> → Triển khai → cho phép truy cập Lịch.</li>
        <li>Chép <b>URL ứng dụng web</b> (đuôi <code>/exec</code>) dán vào ô dưới → Thử kết nối.</li>
      </ol>
      <details className="text-xs">
        <summary className="cursor-pointer text-slate-500">Xem mã Apps Script</summary>
        <pre className="mt-1 max-h-48 overflow-auto rounded bg-slate-50 p-2 text-[11px]">{script}</pre>
      </details>
      <input className="inp" placeholder="https://script.google.com/macros/s/…/exec" value={url} onChange={(e) => setUrl(e.target.value.trim())} />
      <div className="flex flex-wrap gap-2">
        <button
          className="btn"
          disabled={dangChay || !url}
          onClick={() => void lam(async () => {
            const kq = await thuKetNoi({ ...cd.lich, url })
            await store.luuCaiDat({ ...cd, lich: { ...cd.lich, url, bat: true } })
            return `✅ Kết nối được lịch "${kq.ten}". Đã bật đồng bộ.`
          })}
        >
          Thử kết nối &amp; bật
        </button>
        {cd.lich.bat && (
          <>
            <button className="btn" disabled={dangChay} onClick={() => void lam(async () => `✅ Đã đẩy ${await dongBoNen()} lớp lên lịch.`)}>
              Đồng bộ ngay ({choDongBo} lớp chờ)
            </button>
            <button className="btn" disabled={dangChay} onClick={() => void lam(async () => {
              const hn = homNay()
              const sapToi = ds.filter((l) => !l.huy && l.ngay >= hn && !l.eventId)
              await luuNhieuLop(sapToi.map((l) => ({ ...l, canDongBo: true })))
              return `✅ Đã đẩy ${await dongBoNen()} lớp sắp tới lên lịch.`
            })}>
              Đẩy mọi lớp sắp tới
            </button>
            <button className="btn" onClick={() => void store.luuCaiDat({ ...cd, lich: { ...cd.lich, bat: false } })}>Tắt</button>
          </>
        )}
      </div>
      <p className="text-xs text-slate-500">
        Trạng thái: {cd.lich.bat ? <b className="text-emerald-700">đang bật</b> : <b>chưa bật</b>}. Lớp sắp tới nhập từ Excel: script tự nhận lại sự kiện AppSheet đã tạo
        (cùng ngày, tiêu đề có tên khách hàng) nên không bị trùng.
      </p>
      {tb && <p className="text-xs">{tb}</p>}
    </Khung>
  )
}

// ---------------- Telegram ----------------

function Telegram() {
  const [bot, setBot] = useState('')
  const [chat, setChat] = useState('')
  const [ve, setVe] = useState('')
  const [loi, setLoi] = useState('')
  const [dangChay, setDangChay] = useState(false)
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
    <Khung tieuDe="🤖 Bot Telegram — dán tin nhắn, tự điền lịch">
      <p className="text-xs text-slate-500">
        Chép tin nhắn của đối tác trên Zalo → dán vào bot. Bot (AI) đọc ngày, giờ, khách hàng, địa điểm, thù lao → tạo lớp và báo lại; bấm nút để sửa / hủy.
        Nhắn <i>"đã nhận tiền Cty ABC"</i> để đánh dấu thanh toán; lệnh <code>/tuan</code>, <code>/congno</code>.
      </p>
      {loi && <p className="text-xs text-red-700">⚠️ {loi}</p>}
      <div>
        <p className="font-medium">Bước 1 — Bật bot</p>
        <p className="text-xs text-slate-500">Cần sẵn biến <code>ATLD_TELE_TOKEN</code> (mã bot từ @BotFather) trên Vercel.</p>
        <button className="btn mt-1 !py-1 !text-xs" disabled={dangChay} onClick={() => void lam(async () => setBot((await goiMayChu<{ bot: string }>('/telegram/bat', {})).bot))}>Bật bot</button>
        {bot && (
          <p className="mt-1 text-xs">
            ✅ Bot <b>@{bot}</b> sẵn sàng. Mở <a className="text-teal-700 underline" href={`https://t.me/${bot}`} target="_blank" rel="noreferrer">t.me/{bot}</a>, bấm <b>Start</b> — bot gửi lại <b>mã Telegram</b> của anh.
          </p>
        )}
      </div>
      <div>
        <p className="font-medium">Bước 2 — Tạo vé kết nối</p>
        <div className="mt-1 flex flex-wrap gap-2">
          <input className="inp !w-48" inputMode="numeric" placeholder="Mã Telegram (dãy số)" value={chat} onChange={(e) => setChat(e.target.value.replace(/\D/g, ''))} />
          <button className="btn !py-1 !text-xs" disabled={dangChay || !chat} onClick={() => void lam(async () => { setVe((await goiMayChu<{ ve: string }>('/telegram/ghep', { chat })).ve) })}>Tạo vé</button>
        </div>
        {ve && (
          <div className="mt-2 space-y-1 text-xs">
            <textarea readOnly className="inp h-20 font-mono !text-[11px]" value={ve} onFocus={(e) => e.target.select()} />
            <button className="btn !py-1 !text-xs" onClick={() => void navigator.clipboard.writeText(ve).then(() => setDaChep(true))}>{daChep ? '✓ Đã chép' : 'Chép vé'}</button>
            <p className="text-slate-500">Dán vé vào Vercel → Settings → Environment Variables, tên <code>ATLD_TELE_VE</code>, rồi Redeploy. Xong gửi thử một tin cho bot.</p>
          </div>
        )}
      </div>
    </Khung>
  )
}

// ---------------- Kết nối AI (MCP) ----------------

function KetNoiAI() {
  const diaChi = `${APP_URL}/mcp`
  const [phien, setPhien] = useState<PhienMay[]>([])
  const [nhatKy, setNhatKy] = useState<DongNhatKy[]>([])
  const [daChep, setDaChep] = useState('')
  const tai = () => {
    store.listPhien().then(setPhien, () => setPhien([]))
    store.listNhatKy(20).then(setNhatKy, () => setNhatKy([]))
  }
  useEffect(tai, [])
  const chep = (s: string) => void navigator.clipboard.writeText(s).then(() => setDaChep(s))
  const lenhCli = `claude mcp add --transport http lich-giang ${diaChi}`
  const json = JSON.stringify({ mcpServers: { 'lich-giang': { type: 'http', url: diaChi } } }, null, 1)

  return (
    <Khung tieuDe="🧠 Kết nối AI (MCP) — hỏi Claude về lịch giảng">
      <p className="text-xs text-slate-500">
        Cho Claude đọc và sửa lịch giảng bằng lời: <i>"tuần sau dạy những đâu?"</i>, <i>"quý 3 TIEC trả bao nhiêu?"</i>,
        <i>"thêm lớp Cty ABC thứ 5 chiều, 1tr5, chị Ngọc Anh"</i>, <i>"ESC trả tiền 2 lớp tháng 9 rồi"</i>. Claude làm bằng quyền của chính tài khoản Google anh.
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded bg-slate-100 px-2 py-1 text-xs">{diaChi}</code>
        <button className="btn !py-1 !text-xs" onClick={() => chep(diaChi)}>{daChep === diaChi ? '✓ Đã chép' : 'Chép'}</button>
      </div>
      <ul className="ml-4 list-disc space-y-1 text-xs">
        <li><b>claude.ai / app Claude (máy tính, điện thoại):</b> Cài đặt → Connectors → Add custom connector → dán địa chỉ trên → Connect → đăng nhập Google, bấm Cho phép.</li>
        <li>
          <b>Claude Code dòng lệnh:</b> <code className="break-all">{lenhCli}</code>{' '}
          <button className="text-teal-700 underline" onClick={() => chep(lenhCli)}>{daChep === lenhCli ? '✓' : 'chép'}</button>
        </li>
        <li>
          <b>Claude Code trong app Claude:</b> thêm vào <code>.mcp.json</code> của thư mục dự án rồi gõ <code>/mcp</code> → lich-giang → Authenticate.{' '}
          <button className="text-teal-700 underline" onClick={() => chep(json)}>{daChep === json ? '✓ đã chép' : 'chép nội dung'}</button>
        </li>
      </ul>
      <div>
        <div className="flex items-center justify-between">
          <p className="font-medium">Máy đang được phép (AI, bot Telegram)</p>
          <button className="text-xs text-teal-700" onClick={tai}>↻ tải lại</button>
        </div>
        {phien.length === 0 && <p className="text-xs text-slate-400">Chưa có máy nào.</p>}
        {phien.map((p) => (
          <div key={p.id} className="flex items-center gap-2 py-0.5 text-xs">
            <span className="flex-1">{p.tenMay}{p.ungDung && p.ungDung !== p.tenMay ? ` (${p.ungDung})` : ''} · {p.noiNhan} · {new Date(p.taoLuc).toLocaleDateString('vi-VN')}</span>
            <button className="btn-danger !py-0 !text-xs" onClick={() => void store.thuHoiPhien(p.id).then(tai)}>Thu hồi</button>
          </div>
        ))}
      </div>
      {nhatKy.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-slate-600">Nhật ký AI / bot ghi ({nhatKy.length} lần gần nhất)</summary>
          <ul className="mt-1 space-y-0.5">
            {nhatKy.map((d) => (
              <li key={d.id}><span className="text-slate-400">{new Date(d.luc).toLocaleString('vi-VN')}</span> · {d.tenMay} · <b>{d.congCu}</b> {d.moTa}</li>
            ))}
          </ul>
        </details>
      )}
    </Khung>
  )
}

// ---------------- Gộp tên ----------------

function GopTen({ ds, cd }: { ds: LopGiang[]; cd: CaiDat }) {
  const [loai, setLoai] = useState<'doiTac' | 'lienHe'>('doiTac')
  const [tu, setTu] = useState('')
  const [thanh, setThanh] = useState('')
  const [tb, setTb] = useState('')
  const dem = new Map<string, number>()
  for (const l of ds) if (l[loai]) dem.set(l[loai], (dem.get(l[loai]) ?? 0) + 1)
  const cac = [...dem.entries()].sort((a, b) => a[0].localeCompare(b[0], 'vi'))

  async function gop() {
    const can = ds.filter((l) => l[loai] === tu)
    if (!tu || !thanh.trim() || !can.length) return
    if (!confirm(`Đổi "${tu}" thành "${thanh.trim()}" ở ${can.length} lớp?`)) return
    await luuNhieuLop(can.map((l) => ({ ...l, [loai]: thanh.trim() })), true)
    // nhớ để lần sau nhập Excel / bot đọc ra tên cũ cũng tự đổi
    if (loai === 'doiTac') await store.luuCaiDat({ ...cd, biDanhDoiTac: { ...cd.biDanhDoiTac, [boDau(tu)]: thanh.trim() } })
    setTb(`✅ Đã đổi ${can.length} lớp.`)
    setTu('')
    setThanh('')
  }

  return (
    <Khung tieuDe="🔤 Gộp / đổi tên đối tác, người liên hệ">
      <p className="text-xs text-slate-500">Cùng một đơn vị mà ghi nhiều kiểu (vd "Ch Nhung" / "Nhung") thì gộp lại để công nợ, tổng hợp tính đúng.</p>
      <div className="flex flex-wrap gap-2">
        <select className="inp !w-40" value={loai} onChange={(e) => { setLoai(e.target.value as 'doiTac' | 'lienHe'); setTu('') }}>
          <option value="doiTac">Đối tác</option>
          <option value="lienHe">Người liên hệ</option>
        </select>
        <select className="inp !w-48" value={tu} onChange={(e) => setTu(e.target.value)}>
          <option value="">— tên cần đổi —</option>
          {cac.map(([k, n]) => <option key={k} value={k}>{k} ({n})</option>)}
        </select>
        <input className="inp !w-48" list={`gop-${loai}`} placeholder="đổi thành…" value={thanh} onChange={(e) => setThanh(e.target.value)} />
        <datalist id={`gop-${loai}`}>{cac.map(([k]) => <option key={k} value={k} />)}</datalist>
        <button className="btn" disabled={!tu || !thanh.trim()} onClick={() => void gop()}>Đổi</button>
      </div>
      {tb && <p className="text-xs">{tb}</p>}
    </Khung>
  )
}

function TaiKhoan() {
  const [email, setEmail] = useState('')
  useEffect(() => void import('../lib/firebase').then((f) => setEmail(f.auth.currentUser?.email ?? '')), [])
  return (
    <Khung tieuDe="👤 Tài khoản">
      <p>Đang đăng nhập: <b>{email}</b></p>
      <p className="text-xs text-slate-500">Điện thoại: mở trang bằng Chrome / Safari → menu → <b>Thêm vào màn hình chính</b> để dùng như một app.</p>
      <button className="btn" onClick={() => void import('../lib/firebase').then((f) => f.dangXuat())}>Đăng xuất</button>
    </Khung>
  )
}

// ---------------- Sao lưu ----------------

function SaoLuu({ ds }: { ds: LopGiang[] }) {
  const [tb, setTb] = useState('')
  async function nap(f: File) {
    const j = JSON.parse(await f.text()) as { lop?: LopGiang[] }
    if (!Array.isArray(j.lop)) return setTb('⚠️ File không phải bản sao lưu của app')
    const co = new Set(ds.map((l) => l.id))
    const moi = j.lop.filter((l) => l.id && !co.has(l.id)).map((l) => chuanLop(l))
    if (!confirm(`Nạp ${moi.length} lớp chưa có (bỏ qua ${j.lop.length - moi.length} lớp đã có)?`)) return
    await luuNhieuLop(moi)
    setTb(`✅ Đã nạp ${moi.length} lớp.`)
  }
  return (
    <Khung tieuDe="💾 Sao lưu">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn" onClick={() => taiFile(JSON.stringify({ phienBan: 1, luc: new Date().toISOString(), lop: ds }, null, 1), `sao-luu-lich-giang-${homNay()}.json`, 'application/json')}>
          ⬇ Tải bản sao lưu ({ds.length} lớp)
        </button>
        <label className="btn cursor-pointer">
          ⬆ Nạp bản sao lưu
          <input type="file" accept=".json" className="hidden" onChange={(e) => e.target.files?.[0] && void nap(e.target.files[0])} />
        </label>
      </div>
      {tb && <p className="text-xs">{tb}</p>}
    </Khung>
  )
}

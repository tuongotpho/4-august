import { useEffect, useRef, useState } from 'react'
import { fmtDate } from '../lib/dates'
import { store } from '../lib/store'
import { boThanhPhanCu, themVao, timBo, tomTat, type BoThanhPhan } from '../lib/thanhPhan'
import type { ThanhPhan } from '../lib/types'

interface Props {
  value: ThanhPhan[]
  onChange: (v: ThanhPhan[]) => void
  currentId: string
  goiYDonVi?: string[]
}

/** Bảng thành phần tham gia: đơn vị + số người. */
export default function ThanhPhanEditor({ value, onChange, currentId, goiYDonVi = [] }: Props) {
  const tong = value.reduce((a, t) => a + (t.soNguoi || 0), 0)
  const setRow = (i: number, patch: Partial<ThanhPhan>) => onChange(value.map((t, j) => (j === i ? { ...t, ...patch } : t)))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= value.length) return
    const next = [...value]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-3">
        <span className="text-sm text-slate-600">
          {value.length} đơn vị · tổng <b>{tong}</b> người
        </span>
        <LayBoCu dangCo={value} currentId={currentId} onChon={onChange} />
      </div>
      {value.length > 0 ? (
        <div className="mb-0.5 flex gap-1.5 pl-6 text-[11px] text-slate-400">
          <span className="flex-1">Đơn vị</span>
          <span className="w-[13.5rem]">Số lượng</span>
        </div>
      ) : (
        <p className="rounded bg-slate-50 p-2 text-xs text-slate-500">Chưa có đơn vị nào. Bấm "+ Thêm đơn vị" hoặc "Lấy theo hồ sơ cũ".</p>
      )}
      <div className="space-y-1">
        {value.map((t, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="w-5 text-right text-xs text-slate-400">{i + 1}</span>
            <input className="inp" list="ds-don-vi" placeholder="Đơn vị" value={t.donVi} onChange={(e) => setRow(i, { donVi: e.target.value })} />
            <input
              className="inp w-20 text-right"
              type="number"
              min={0}
              value={t.soNguoi || ''}
              onChange={(e) => setRow(i, { soNguoi: Number(e.target.value) })}
            />
            <span className="text-xs text-slate-500">người</span>
            <button className="px-1 text-slate-400 hover:text-slate-700" onClick={() => move(i, -1)} title="Lên">↑</button>
            <button className="px-1 text-slate-400 hover:text-slate-700" onClick={() => move(i, 1)} title="Xuống">↓</button>
            <button className="px-1 text-slate-400 hover:text-red-600" onClick={() => onChange(value.filter((_, j) => j !== i))} title="Xóa">
              ✕
            </button>
          </div>
        ))}
      </div>
      <datalist id="ds-don-vi">
        {goiYDonVi.map((x) => <option key={x} value={x} />)}
      </datalist>
      <button className="mt-1.5 text-xs text-blue-600 hover:underline" onClick={() => onChange([...value, { donVi: '', soNguoi: 1 }])}>
        + Thêm đơn vị
      </button>
    </div>
  )
}

/** Ô "Lấy theo hồ sơ cũ ▾": các bộ thành phần đã dùng (không lặp), tìm được; chọn để thay thế hoặc thêm vào. */
function LayBoCu({ dangCo, currentId, onChon }: { dangCo: ThanhPhan[]; currentId: string; onChon: (v: ThanhPhan[]) => void }) {
  const [ds, setDs] = useState<BoThanhPhan[] | null>(null) // null = đang đóng
  const [q, setQ] = useState('')
  const khung = useRef<HTMLDivElement>(null)
  const dong = () => setDs(null)

  useEffect(() => {
    if (!ds) return
    const phim = (e: KeyboardEvent) => e.key === 'Escape' && dong()
    const bam = (e: MouseEvent) => !khung.current?.contains(e.target as Node) && dong()
    addEventListener('keydown', phim)
    addEventListener('mousedown', bam)
    return () => {
      removeEventListener('keydown', phim)
      removeEventListener('mousedown', bam)
    }
  }, [ds])

  async function mo() {
    if (ds) return dong()
    setQ('')
    setDs(boThanhPhanCu(await store.listDossiers(), currentId))
  }
  const chon = (bo: BoThanhPhan, them: boolean) => {
    onChon(them ? themVao(dangCo, bo.thanhPhan) : bo.thanhPhan.map((t) => ({ ...t })))
    dong()
  }
  const hien = ds ? timBo(ds, q) : []
  const nut = 'rounded border px-2 py-0.5 text-xs font-medium'

  return (
    <div ref={khung} className="relative ml-auto">
      <button className="text-xs text-blue-600 hover:underline" onClick={mo}>
        ↺ Lấy theo hồ sơ cũ ▾
      </button>
      {ds && (
        <div className="absolute right-0 top-6 z-30 w-[26rem] max-w-[calc(100vw-3rem)] rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
          <input autoFocus className="inp mb-2" placeholder="Tìm đơn vị / nội dung hồ sơ (không cần dấu)…" value={q} onChange={(e) => setQ(e.target.value)} />
          {ds.length === 0 ? (
            <p className="p-2 text-xs text-slate-500">Chưa có hồ sơ nào khác có thành phần tham gia.</p>
          ) : hien.length === 0 ? (
            <p className="p-2 text-xs text-slate-500">Không có bộ nào khớp "{q}".</p>
          ) : (
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {hien.map((b) => (
                <div key={b.khoa} className="rounded-md border border-slate-100 p-2 hover:bg-slate-50">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-slate-800">
                        {tomTat(b.thanhPhan)} <span className="text-slate-400">· {b.tongNguoi} người</span>
                      </div>
                      <div className="truncate text-[11px] text-slate-400" title={b.hoSo.noiDung}>
                        {fmtDate(b.hoSo.ngay)} · {b.hoSo.noiDung || '(chưa đặt nội dung)'}{b.soLan > 1 && ` · dùng ${b.soLan} lần`}
                      </div>
                    </div>
                    {dangCo.length === 0 ? (
                      <button className={`${nut} border-blue-300 text-blue-700 hover:bg-blue-50`} onClick={() => chon(b, false)}>Chọn</button>
                    ) : (
                      <div className="flex shrink-0 gap-1">
                        <button className={`${nut} border-slate-300 text-slate-700 hover:bg-white`} title="Bỏ danh sách đang có, thay bằng bộ này" onClick={() => chon(b, false)}>Thay</button>
                        <button className={`${nut} border-blue-300 text-blue-700 hover:bg-blue-50`} title="Giữ danh sách đang có, thêm các đơn vị chưa có" onClick={() => chon(b, true)}>+ Thêm</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

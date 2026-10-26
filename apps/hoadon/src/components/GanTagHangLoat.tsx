import { useMemo, useState } from 'react'
import { chuanTag, tatCaTag } from '../lib/hashtag'
import { doiTag } from '../lib/locHoSo'
import { store } from '../lib/store'
import type { Dossier } from '../lib/types'

/** Hộp gắn / bỏ hashtag cho nhiều hồ sơ đã tick chọn — để phân loại khoản chi theo việc cho nhanh. */
export default function GanTagHangLoat({ ds, tatCa, onClose }: { ds: Dossier[]; tatCa: Dossier[]; onClose: () => void }) {
  const [them, setThem] = useState<string[]>([])
  const [bo, setBo] = useState<string[]>([])
  const [moi, setMoi] = useState('')
  const [dangLuu, setDangLuu] = useState('')

  const goiY = useMemo(() => tatCaTag(tatCa.map((d) => d.tags ?? [])), [tatCa])
  // tag đang có trong các hồ sơ đã chọn: bao nhiêu hồ sơ có
  const dangCo = useMemo(() => {
    const m = new Map<string, number>()
    for (const d of ds) for (const t of d.tags ?? []) m.set(t, (m.get(t) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [ds])

  const bat = (xs: string[], t: string) => (xs.includes(t) ? xs.filter((x) => x !== t) : [...xs, t])
  const themMoi = () => {
    const m = chuanTag(moi)
    if (m && !them.includes(m)) setThem([...them, m])
    setMoi('')
  }

  const doi = ds.map((d) => [d, doiTag(d, them, bo)] as const).filter(([a, b]) => a !== b)

  async function apDung() {
    let n = 0
    for (const [, d] of doi) {
      setDangLuu(`Đang lưu ${++n}/${doi.length}…`)
      await store.saveDossier({ ...d, updatedAt: Date.now() })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-xl bg-white p-5 shadow-xl sm:rounded-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-1 text-lg font-semibold text-slate-800">🏷 Gắn hashtag cho {ds.length} hồ sơ đã chọn</h3>
        <p className="mb-3 text-xs text-slate-500">Bấm tag để chọn. Tag thêm vào được giữ nguyên các tag cũ của hồ sơ.</p>

        <div className="lbl">Thêm tag</div>
        <div className="flex flex-wrap gap-1.5">
          {goiY.map((t) => (
            <button key={t.ma} type="button" title={t.ten} onClick={() => { setThem(bat(them, t.ma)); setBo(bo.filter((x) => x !== t.ma)) }}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${them.includes(t.ma) ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}>
              {them.includes(t.ma) ? '✓ ' : '+ '}#{t.ma}
            </button>
          ))}
          {them.filter((t) => !goiY.some((g) => g.ma === t)).map((t) => (
            <button key={t} type="button" onClick={() => setThem(them.filter((x) => x !== t))} className="rounded-full border border-indigo-600 bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white">
              ✓ #{t}
            </button>
          ))}
          <input className="inp w-36 !py-1 text-xs" placeholder="tag mới… (Enter)" value={moi} onChange={(e) => setMoi(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); themMoi() } }} onBlur={() => moi.trim() && themMoi()} />
        </div>

        {dangCo.length > 0 && (
          <>
            <div className="lbl mt-4">Bỏ tag đang có</div>
            <div className="flex flex-wrap gap-1.5">
              {dangCo.map(([t, n]) => (
                <button key={t} type="button" onClick={() => { setBo(bat(bo, t)); setThem(them.filter((x) => x !== t)) }}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${bo.includes(t) ? 'border-red-600 bg-red-600 text-white line-through' : 'border-slate-300 bg-white text-slate-700 hover:bg-red-50'}`}>
                  #{t} <span className="opacity-70">({n})</span>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm">
          Sẽ đổi <b>{doi.length}</b> / {ds.length} hồ sơ.
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn" onClick={onClose} disabled={!!dangLuu}>Hủy</button>
          <button className="btn-primary" onClick={apDung} disabled={!doi.length || !!dangLuu}>
            {dangLuu || `Áp dụng cho ${doi.length} hồ sơ`}
          </button>
        </div>
      </div>
    </div>
  )
}

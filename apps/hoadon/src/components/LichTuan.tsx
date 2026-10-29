import { useEffect, useRef, useState } from 'react'
import { fmtDate, today } from '../lib/dates'
import { downloadBlob } from '../lib/hooks'
import { dongLichTuan, taoDocxLichTuan, thongTinMacDinh, thuCua, type DongLich, type ThongTinLich } from '../lib/lichTuan'
import type { Dossier, Settings } from '../lib/types'

// Địa điểm gõ tay nhớ trên máy này theo id hồ sơ (hồ sơ không có trường địa điểm — không đổi cấu trúc dữ liệu)
const KHOA_DIA_DIEM = 'hoadon-lich-dia-diem'
function docDiaDiem(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KHOA_DIA_DIEM) ?? '{}')
  } catch {
    return {}
  }
}
function nhoDiaDiem(dong: DongLich[]) {
  try {
    const m = docDiaDiem()
    for (const d of dong) m[d.id] = d.diaDiem
    localStorage.setItem(KHOA_DIA_DIEM, JSON.stringify(m))
  } catch {}
}

// Trang A4 ngang rộng hơn khung (màn nhỏ) thì bị cắt mép trái -> thu nhỏ cả trang cho vừa bề ngang
function vuaKhung(box: HTMLElement) {
  const trang = box.querySelector<HTMLElement>('section.docx')
  if (!trang) return
  box.style.zoom = ''
  const rong = trang.offsetWidth + 60 // + lề 30px hai bên của khung xám
  box.style.zoom = String(Math.min(1, box.clientWidth / rong))
}

/** Hộp xem trước + xuất file Word đăng ký lịch công tác tuần từ các hồ sơ đã tick chọn. */
export default function LichTuan({ ds, settings, onClose }: { ds: Dossier[]; settings: Settings; onClose: () => void }) {
  const [dong, setDong] = useState<DongLich[]>(() => dongLichTuan(ds, docDiaDiem()))
  const [tt, setTt] = useState<ThongTinLich>(() => thongTinMacDinh(settings, dongLichTuan(ds)))
  const [loi, setLoi] = useState('')
  const box = useRef<HTMLDivElement>(null)

  const sua = (i: number, p: Partial<DongLich>) => setDong(dong.map((d, j) => (j === i ? { ...d, ...p } : d)))
  const boDong = (i: number) => setDong(dong.filter((_, j) => j !== i))

  // Dựng lại bản xem trước từ đúng file Word sẽ xuất (chờ ngừng gõ một chút)
  useEffect(() => {
    let huy = false
    const t = setTimeout(async () => {
      try {
        const { renderAsync } = await import('docx-preview')
        if (huy || !box.current) return
        const blob = taoDocxLichTuan(dong, tt)
        box.current.innerHTML = ''
        await renderAsync(blob, box.current, undefined, { inWrapper: true, breakPages: true, ignoreLastRenderedPageBreak: true })
        vuaKhung(box.current)
        setLoi('')
      } catch (e) {
        if (!huy) setLoi((e as Error).message)
      }
    }, 300)
    return () => {
      huy = true
      clearTimeout(t)
    }
  }, [dong, tt])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const onResize = () => box.current && vuaKhung(box.current)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [onClose])

  function xuat() {
    nhoDiaDiem(dong)
    const ngays = dong.map((d) => d.ngay).filter(Boolean).sort()
    downloadBlob(taoDocxLichTuan(dong, tt), `Dang ky lich tuan ${(ngays[0] || today()).split('-').reverse().join('-')}.docx`)
  }

  const oTt = (k: keyof ThongTinLich, nhan: string, rong = '') => (
    <label className={`block ${rong}`}>
      <span className="lbl">{nhan}</span>
      <input className="inp" value={tt[k]} onChange={(e) => setTt({ ...tt, [k]: e.target.value })} />
    </label>
  )

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/60 p-0 sm:p-3 md:p-6" onClick={onClose}>
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden bg-white shadow-xl sm:rounded-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2">
          <span className="font-semibold text-slate-800">📅 Đăng ký lịch tuần · {dong.length} buổi</span>
          <span className="ml-auto" />
          <button className="btn-primary" onClick={xuat} disabled={!dong.length}>
            ⬇ Xuất file Word
          </button>
          <button className="btn" onClick={onClose}>
            Đóng
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {/* Sửa trước khi xuất: chỉ dùng cho file này, không ghi vào hồ sơ (riêng địa điểm được nhớ cho lần sau) */}
          <div className="space-y-3 border-b border-slate-200 p-4">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {oTt('donVi', 'Đơn vị')}
              {oTt('boPhan', 'Bộ phận')}
              {oTt('tieuDe', 'Tiêu đề')}
              {oTt('tieuDePhu', 'Khoảng thời gian')}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th className="w-40 px-1 py-1">Ngày</th>
                    <th className="px-1 py-1">Nội dung làm việc</th>
                    <th className="px-1 py-1">Thành phần làm việc</th>
                    <th className="w-48 px-1 py-1">Địa điểm</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {dong.map((d, i) => (
                    <tr key={d.id} className="align-top">
                      <td className="px-1 py-1">
                        <input type="date" className="inp" value={d.ngay} onChange={(e) => sua(i, { ngay: e.target.value })} />
                        <div className="mt-0.5 text-xs text-slate-500">{d.ngay ? `${thuCua(d.ngay)} ${fmtDate(d.ngay)}` : 'chưa có ngày'}</div>
                      </td>
                      <td className="px-1 py-1">
                        <textarea className="inp" rows={2} value={d.noiDung} onChange={(e) => sua(i, { noiDung: e.target.value })} />
                      </td>
                      <td className="px-1 py-1">
                        <textarea className="inp" rows={2} value={d.thanhPhan} placeholder="Chưa có thành phần trong hồ sơ" onChange={(e) => sua(i, { thanhPhan: e.target.value })} />
                      </td>
                      <td className="px-1 py-1">
                        <textarea className="inp" rows={2} value={d.diaDiem} placeholder="Ví dụ: Phòng họp NPC" onChange={(e) => sua(i, { diaDiem: e.target.value })} />
                      </td>
                      <td className="px-1 py-1">
                        <button className="rounded px-1.5 py-1 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Bỏ dòng này khỏi lịch" onClick={() => boDong(i)}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">
              Sửa ở đây chỉ áp dụng cho file xuất ra, không đổi hồ sơ. Địa điểm mặc định = đơn vị đến làm việc; địa điểm đã gõ được nhớ trên máy này cho lần sau.
            </p>
          </div>

          <style>{`.lich-tuan .docx-wrapper section.docx, .lich-tuan .docx-wrapper section.docx * { font-family: 'Times New Roman', Times, serif !important; }`}</style>
          <div className="lich-tuan relative bg-slate-200">
            {loi && <div className="m-6 rounded bg-red-50 p-3 text-sm text-red-700">Không dựng được bản xem trước: {loi}</div>}
            <div ref={box} />
          </div>
        </div>
        <div className="border-t border-slate-200 px-4 py-1.5 text-[11px] text-slate-500">
          Bản xem trước dựng từ đúng file Word sẽ xuất (A4 ngang); phông chữ, ngắt trang có thể lệch đôi chút so với Word.
        </div>
      </div>
    </div>
  )
}

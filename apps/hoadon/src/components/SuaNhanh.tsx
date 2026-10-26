import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { fmtDate, today } from '../lib/dates'
import { bao, hoi } from '../lib/dialog'
import { rememberOption } from '../lib/hooks'
import { STATUS_COLOR, statusOf } from '../lib/status'
import { store } from '../lib/store'
import { datTrangThai, trangThaiChonDuoc } from '../lib/suaNhanh'
import type { Dossier, Settings } from '../lib/types'
import { TagEditor } from './TagChips'

/**
 * Ô sửa nhanh ngay trên bảng danh sách hồ sơ: bấm vào ô -> hộp nhỏ thả xuống ngay dưới ô.
 * Hộp gắn vào <body> (vị trí cố định theo ô) để không bị khung cuộn ngang của bảng cắt mất.
 */
export type Luu = (d: Dossier, p: Partial<Dossier>) => Promise<void>

/** Dùng chung cho trang Hồ sơ và Bảng kê: hàm lưu + gợi ý tag + danh sách người đề nghị. */
export function useSuaNhanh(list: Dossier[] | null | undefined, settings: Settings) {
  // lưu thẳng, danh sách tự cập nhật qua subscribe
  const luu: Luu = useCallback(async (d, p) => {
    try {
      await store.saveDossier({ ...d, ...p, updatedAt: Date.now() })
    } catch (e) {
      void bao('Chưa lưu được: ' + (e as Error).message)
    }
  }, [])
  const tagDangDung = useMemo(() => (list ?? []).map((d) => d.tags ?? []), [list])
  // người đề nghị: danh sách trong Cài đặt + tên đã dùng ở các hồ sơ
  const dsNguoiTT = useMemo(
    () => [...new Set([...settings.dsNguoiDeNghi, ...(list ?? []).map((d) => d.nguoiDeNghi.trim())].filter(Boolean))],
    [settings.dsNguoiDeNghi, list],
  )
  return { luu, tagDangDung, dsNguoiTT }
}

function OSua({ hien, rong = 256, tieuDe, children }: { hien: ReactNode; rong?: number; tieuDe: string; children: (dong: () => void) => ReactNode }) {
  const [vt, setVt] = useState<{ top: number; left: number } | null>(null)
  const nut = useRef<HTMLButtonElement>(null)
  const hop = useRef<HTMLDivElement>(null)
  const dong = () => setVt(null)

  // không đủ chỗ phía dưới thì mở lên trên
  useLayoutEffect(() => {
    if (!vt || !hop.current || !nut.current) return
    const r = nut.current.getBoundingClientRect()
    const h = hop.current.offsetHeight
    if (vt.top < r.bottom) return // đã lật lên rồi — không lật nữa (ô nằm sát/ngoài đáy màn hình sẽ lặp vô hạn)
    if (vt.top + h > innerHeight - 8 && r.top - h - 4 > 8) setVt({ ...vt, top: r.top - h - 4 })
  }, [vt])

  useEffect(() => {
    if (!vt) return
    const phim = (e: KeyboardEvent) => e.key === 'Escape' && dong()
    // cuộn trang (không phải cuộn bên trong hộp) thì đóng, khỏi lệch vị trí
    const cuon = (e: Event) => !hop.current?.contains(e.target as Node) && dong()
    addEventListener('keydown', phim)
    addEventListener('scroll', cuon, true)
    return () => {
      removeEventListener('keydown', phim)
      removeEventListener('scroll', cuon, true)
    }
  }, [vt])

  return (
    <>
      <button
        ref={nut}
        type="button"
        title={`Sửa nhanh: ${tieuDe}`}
        className={`-mx-1 block max-w-full rounded px-1 py-0.5 text-left hover:bg-white hover:ring-1 hover:ring-blue-300 ${vt ? 'bg-white ring-2 ring-blue-500' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          if (vt) return dong()
          const r = e.currentTarget.getBoundingClientRect()
          setVt({ top: r.bottom + 4, left: Math.max(8, Math.min(r.left, innerWidth - rong - 8)) })
        }}
      >
        {hien}
      </button>
      {vt &&
        createPortal(
          // portal vẫn lan sự kiện lên cây React -> chặn, kẻo bấm ra ngoài để đóng lại mở luôn hồ sơ của dòng
          <div className="fixed inset-0 z-50" onClick={(e) => { e.stopPropagation(); dong() }}>
            <div
              ref={hop}
              className="fixed space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-xl"
              style={{ top: vt.top, left: vt.left, width: rong }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-xs font-semibold text-slate-500">{tieuDe}</div>
              {children(dong)}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

/** Ô chữ: gõ xong bấm Enter hoặc bấm ra ngoài là lưu. */
function OChu({ giaTri, luu, placeholder, nhieuDong }: { giaTri: string; luu: (v: string) => void; placeholder?: string; nhieuDong?: boolean }) {
  const [v, setV] = useState(giaTri)
  useEffect(() => setV(giaTri), [giaTri])
  const xong = () => v !== giaTri && luu(v.trim())
  const chung = {
    className: 'inp',
    value: v,
    placeholder,
    onChange: (e: { target: { value: string } }) => setV(e.target.value),
    onBlur: xong,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        xong()
      }
    },
  }
  return nhieuDong ? <textarea rows={3} autoFocus {...chung} /> : <input {...chung} />
}

const nutPhu = 'rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50'

/** Nội dung công việc + hashtag. */
export function SuaNoiDung({ d, luu, dangDung, children }: { d: Dossier; luu: Luu; dangDung: string[][]; children: ReactNode }) {
  return (
    <OSua tieuDe="Nội dung công việc & hashtag" rong={384} hien={children}>
      {() => (
        <>
          <OChu nhieuDong giaTri={d.noiDung} luu={(v) => luu(d, { noiDung: v })} placeholder="Ví dụ: Làm việc với Công ty Điện lực … về …" />
          <TagEditor value={d.tags ?? []} onChange={(v) => luu(d, { tags: v })} noiDung={d.noiDung} dangDung={dangDung} />
          <p className="text-[11px] text-slate-400">Enter = lưu · Shift+Enter = xuống dòng · Esc = đóng</p>
        </>
      )}
    </OSua>
  )
}

/** Người đề nghị thanh toán: chọn trong danh sách hoặc gõ tên mới (tên mới được nhớ vào Cài đặt). */
export function SuaNguoiTT({ d, luu, ds }: { d: Dossier; luu: Luu; ds: string[] }) {
  return (
    <OSua tieuDe="Người đề nghị thanh toán" hien={d.nguoiDeNghi || <span className="text-slate-300 group-hover:text-blue-500">＋ chọn</span>}>
      {(dong) => (
        <>
          <div className="max-h-56 space-y-0.5 overflow-y-auto">
            {ds.map((x) => (
              <button
                key={x}
                className={`block w-full rounded px-2 py-1 text-left hover:bg-blue-50 ${x === d.nguoiDeNghi ? 'bg-blue-50 font-medium text-blue-800' : ''}`}
                onClick={() => {
                  void luu(d, { nguoiDeNghi: x })
                  dong()
                }}
              >
                {x === d.nguoiDeNghi ? '✓ ' : ''}
                {x}
              </button>
            ))}
          </div>
          <OChu
            giaTri=""
            placeholder="Tên khác… (Enter)"
            luu={(v) => {
              if (!v) return
              void luu(d, { nguoiDeNghi: v })
              void rememberOption('dsNguoiDeNghi', v)
              dong()
            }}
          />
          {d.nguoiDeNghi && (
            <button className="text-xs text-slate-400 hover:text-red-600" onClick={() => { void luu(d, { nguoiDeNghi: '' }); dong() }}>
              Bỏ chọn
            </button>
          )}
        </>
      )}
    </OSua>
  )
}

type TruongNgay = 'ngayToTrinh' | 'ngayDntt' | 'ngayNopKeToan' | 'ngayKeToanTt'

/** Một mốc ngày (+ số văn bản với tờ trình / ĐNTT). nutNhanh: nút "✓ Hôm nay" hiện sẵn ngoài ô khi đang tới bước đó. */
export function SuaNgay({ d, luu, truong, so, tieuDe, goiY, nutNhanh }: {
  d: Dossier
  luu: Luu
  truong: TruongNgay
  so?: 'soToTrinh' | 'soDntt'
  tieuDe: string
  goiY?: [string, string] // [nhãn, ngày]
  nutNhanh?: boolean
}) {
  const v = d[truong]
  if (!v && nutNhanh) {
    return (
      <button className="whitespace-nowrap rounded px-1 text-[11px] font-medium text-blue-600 hover:bg-blue-50" title={`${tieuDe}: hôm nay`} onClick={(e) => { e.stopPropagation(); void luu(d, { [truong]: today() }) }}>
        ✓ Hôm nay
      </button>
    )
  }
  return (
    <OSua
      tieuDe={tieuDe}
      hien={
        v ? (
          <span className="whitespace-nowrap">
            {fmtDate(v)}
            {so && d[so] && <span className="block max-w-[6rem] truncate text-[11px] text-slate-400">số {d[so]}</span>}
          </span>
        ) : (
          <span className="text-slate-300 group-hover:text-blue-500">＋</span>
        )
      }
    >
      {(dong) => (
        <>
          <input type="date" className="inp" value={v} onChange={(e) => luu(d, { [truong]: e.target.value })} />
          {so && <OChu giaTri={d[so]} luu={(x) => luu(d, { [so]: x })} placeholder="Số văn bản" />}
          <div className="flex flex-wrap gap-1.5">
            <button className={nutPhu} onClick={() => { void luu(d, { [truong]: today() }); dong() }}>Hôm nay</button>
            {goiY?.[1] && <button className={nutPhu} onClick={() => { void luu(d, { [truong]: goiY[1] }); dong() }}>{goiY[0]}</button>}
            {v && <button className={`${nutPhu} ml-auto text-red-600`} onClick={() => { void luu(d, { [truong]: '' }); dong() }}>Xóa ngày</button>}
          </div>
        </>
      )}
    </OSua>
  )
}

/** Trạng thái: chọn bước -> app điền / xoá các ngày tương ứng (xoá ngày đã có thì hỏi lại). */
export function SuaTrangThai({ d, luu, settings, nhan, children }: { d: Dossier; luu: Luu; settings: Settings; nhan: (st: ReturnType<typeof statusOf>) => string; children: ReactNode }) {
  const st = statusOf(d)
  return (
    <OSua tieuDe="Chuyển trạng thái" rong={240} hien={children}>
      {(dong) => (
        <>
          {trangThaiChonDuoc(d).map((k) => (
            <button
              key={k}
              className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-slate-50"
              onClick={async () => {
                dong()
                const { moi, xoa } = datTrangThai(d, k, settings)
                if (moi === d) return
                if (xoa.length && !(await hoi(`Chuyển về "${nhan(k)}" sẽ XÓA ${xoa.join(', ')} của hồ sơ này. Tiếp tục?`, { okLabel: 'Chuyển', nguyHiem: true }))) return
                try {
                  await luu(d, moi)
                } catch (e) {
                  void bao((e as Error).message)
                }
              }}
            >
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[k]}`}>{nhan(k)}</span>
              {k === st && <span className="ml-auto text-xs text-slate-400">đang ở đây</span>}
            </button>
          ))}
          <p className="text-[11px] text-slate-400">Ngày còn trống sẽ được điền ngày gợi ý (hôm nay / theo ngày HĐ).</p>
        </>
      )}
    </OSua>
  )
}

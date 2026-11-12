import { dinhDangTien, ngayVN, TEN_TRANG_THAI, tenLop, thu, trangThai, type LopGiang, type TrangThai } from '../lib/model'

export const MAU_TRANG_THAI: Record<TrangThai, string> = {
  huy: 'bg-slate-100 text-slate-400 line-through',
  cong_viec: 'bg-violet-100 text-violet-800',
  sap_toi: 'bg-sky-100 text-sky-800',
  cho_tien: 'bg-amber-100 text-amber-800',
  thieu_thu_lao: 'bg-red-100 text-red-700',
  xong: 'bg-emerald-100 text-emerald-800',
}

/** Viền trái theo trạng thái (thẻ lớp trong ngày) */
export const VIEN_TRANG_THAI: Record<TrangThai, string> = {
  huy: 'border-l-slate-300',
  cong_viec: 'border-l-violet-500',
  sap_toi: 'border-l-sky-500',
  cho_tien: 'border-l-amber-500',
  thieu_thu_lao: 'border-l-red-500',
  xong: 'border-l-emerald-500',
}

export function NhanTrangThai({ l }: { l: LopGiang }) {
  const tt = trangThai(l)
  return <span className={`chip ${MAU_TRANG_THAI[tt]}`}>{TEN_TRANG_THAI[tt]}</span>
}

/** Một dòng lớp gọn (dùng ở "Sắp tới", công nợ, ngày được chọn) */
export function DongLop({ l, onMo, coNgay = true }: { l: LopGiang; onMo: (l: LopGiang) => void; coNgay?: boolean }) {
  return (
    <button className="flex w-full items-start gap-3 rounded-md px-2 py-1.5 text-left hover:bg-slate-50" onClick={() => onMo(l)}>
      {coNgay && (
        <span className="w-16 shrink-0 text-center">
          <span className="block text-xs text-slate-500">{thu(l.ngay)}</span>
          <span className="block font-semibold text-slate-800">{ngayVN(l.ngay, false)}</span>
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-slate-800">
          {l.congViec ? '💼 ' : l.hinhThuc === 'online' && '💻 '}
          {tenLop(l)}
        </span>
        <span className="block truncate text-xs text-slate-500">
          {[l.gioBD && `${l.gioBD}–${l.gioKT}`, l.doiTac, l.lienHe, l.diaDiem].filter(Boolean).join(' · ')}
        </span>
      </span>
      <span className="shrink-0 text-right">
        {!l.congViec && <span className="block text-sm text-slate-700">{dinhDangTien(l.chiPhi)}</span>}
        <NhanTrangThai l={l} />
      </span>
    </button>
  )
}

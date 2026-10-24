import { useEffect, useMemo, useState } from 'react'
import { dongBoLop, xoaSuKien } from './lichGoogle'
import { CAI_DAT_MAC_DINH, type CaiDat, type LopGiang } from './model'
import { store } from './store'
import { goiY, sapXepTheoNgay, type GoiY } from './tinh'

export function useLop(): LopGiang[] | null {
  const [ds, setDs] = useState<LopGiang[] | null>(null)
  useEffect(() => {
    const tai = () => store.listLop().then((x) => setDs([...x].sort(sapXepTheoNgay)))
    const huy = store.subscribe(tai) // nghe trước rồi mới tải: lần đầu dùng luôn bản onSnapshot
    tai()
    return huy
  }, [])
  return ds
}

export function useCaiDat(): CaiDat {
  const [c, setC] = useState<CaiDat>(CAI_DAT_MAC_DINH)
  useEffect(() => {
    const tai = () => store.getCaiDat().then(setC)
    const huy = store.subscribe(tai)
    tai()
    return huy
  }, [])
  return c
}

export function useGoiY(ds: LopGiang[] | null): GoiY {
  return useMemo(() => goiY(ds ?? []), [ds])
}

/** Địa chỉ gốc của app (link mở lớp trong Google Calendar, địa chỉ Kết nối AI). Mở qua cổng app-by-lethanh thì vẫn là quanly-at. */
export const APP_URL =
  typeof location === 'undefined' ? '' : location.hostname === 'app-by-lethanh.vercel.app' ? 'https://quanly-at.vercel.app' : location.origin

/** Địa chỉ máy chủ (bot, AI): đường dẫn tương đối — qua cổng app-by-lethanh/lich-giang/ vẫn tới đúng máy chủ.
 *  Chạy thử trên máy: vite chuyển /ai, /telegram sang máy chủ local (vite.config.ts) */
export const MAY_CHU = import.meta.env.VITE_MAY_CHU_URL || '.'

/** Lỗi đồng bộ lịch gần nhất (hiện ở thanh trên cùng) */
let loiLich = ''
const ngheLoi = new Set<(s: string) => void>()
export function useLoiLich() {
  const [s, setS] = useState(loiLich)
  useEffect(() => {
    ngheLoi.add(setS)
    return () => void ngheLoi.delete(setS)
  }, [])
  return s
}
function baoLoiLich(s: string) {
  loiLich = s
  ngheLoi.forEach((f) => f(s))
}

/**
 * Lưu một lớp rồi (nếu đã bật) đẩy lên Google Calendar ở nền.
 * Lỗi lịch không làm hỏng việc lưu: lớp giữ canDongBo=true để lần sau đẩy lại.
 */
export async function luuLop(l: LopGiang, thayDoiLich = true) {
  const moi = { ...l, suaLuc: Date.now(), canDongBo: l.canDongBo || thayDoiLich }
  await store.luuLop(moi)
  void dongBoNen([moi])
}

export async function luuNhieuLop(ds: LopGiang[], thayDoiLich = false) {
  const moi = ds.map((l) => ({ ...l, suaLuc: Date.now(), canDongBo: l.canDongBo || thayDoiLich }))
  await store.luuNhieuLop(moi)
  if (thayDoiLich) void dongBoNen(moi)
}

export async function xoaLop(l: LopGiang) {
  const cd = await store.getCaiDat()
  try {
    await xoaSuKien(cd, l.eventId)
  } catch (e) {
    baoLoiLich(`Đã xoá lớp nhưng chưa xoá được sự kiện trên Google Calendar: ${(e as Error).message}`)
  }
  await store.xoaLop(l.id)
}

let dangDongBo = false
export async function dongBoNen(ds?: LopGiang[]): Promise<number> {
  const cd = await store.getCaiDat()
  if (!cd.lich.bat || !cd.lich.url) return 0
  if (dangDongBo && !ds) return 0
  dangDongBo = true
  let n = 0
  try {
    const can = (ds ?? (await store.listLop())).filter((l) => l.canDongBo)
    for (const l of can) {
      const moi = await dongBoLop(cd, l, APP_URL)
      // đọc lại bản mới nhất: người dùng có thể vừa sửa tiếp trong lúc chờ
      const hienTai = (await store.listLop()).find((x) => x.id === l.id)
      if (hienTai && hienTai.suaLuc > l.suaLuc) continue
      await store.luuLop({ ...(hienTai ?? l), eventId: moi.eventId, canDongBo: false })
      n++
    }
    baoLoiLich('')
  } catch (e) {
    baoLoiLich((e as Error).message)
  } finally {
    dangDongBo = false
  }
  return n
}

export function taiFile(noiDung: BlobPart, ten: string, kieu = 'text/plain') {
  const url = URL.createObjectURL(new Blob([noiDung], { type: kieu }))
  const a = document.createElement('a')
  a.href = url
  a.download = ten
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

/** Gọi máy chủ bằng quyền của chính người đang đăng nhập (mã làm mới Firebase) */
export async function goiMayChu<T>(duong: string, than: Record<string, unknown>): Promise<T> {
  const { auth } = await import('./firebase')
  const maLamMoi = auth.currentUser?.refreshToken
  if (!maLamMoi) throw new Error('Chưa đăng nhập')
  const r = await fetch(`${MAY_CHU}${duong}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...than, maLamMoi }) })
  const j = (await r.json().catch(() => ({}))) as T & { loi?: string }
  if (!r.ok) throw new Error(j.loi || `Máy chủ trả lỗi ${r.status}`)
  return j
}

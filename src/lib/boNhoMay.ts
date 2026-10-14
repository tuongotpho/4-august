/**
 * Bộ nhớ đệm trên máy (IndexedDB) cho dữ liệu lớn, ít đổi — hiện chỉ dùng cho danh sách DN rủi ro (~300 KB nén):
 * mở lại trang không phải tải lại nếu danh sách chưa đổi. Mọi lỗi (trình duyệt ẩn danh, chặn bộ nhớ…) -> coi như chưa cất.
 */

const DB = 'hoadon-bo-nho'
const KHO = 'kho'

function moDb(): Promise<IDBDatabase> {
  return new Promise((ok, loi) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(KHO)
    r.onsuccess = () => ok(r.result)
    r.onerror = () => loi(r.error)
  })
}

async function lam<T>(kieu: IDBTransactionMode, viec: (k: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await moDb()
  try {
    return await new Promise<T>((ok, loi) => {
      const r = viec(db.transaction(KHO, kieu).objectStore(KHO))
      r.onsuccess = () => ok(r.result as T)
      r.onerror = () => loi(r.error)
    })
  } finally {
    db.close()
  }
}

export async function docBoNho<T>(khoa: string): Promise<T | undefined> {
  try {
    if (typeof indexedDB === 'undefined') return undefined
    return await lam<T | undefined>('readonly', (k) => k.get(khoa))
  } catch {
    return undefined
  }
}

export async function ghiBoNho(khoa: string, gt: unknown): Promise<void> {
  try {
    if (typeof indexedDB === 'undefined') return
    await lam('readwrite', (k) => (gt === undefined ? k.delete(khoa) : k.put(gt, khoa)))
  } catch {
    // không cất được thì lần sau tải lại — không sao
  }
}

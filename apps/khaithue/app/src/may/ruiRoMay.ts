// Đọc danh sách DN rủi ro về hoá đơn mà người dùng đã nạp ở app hoá đơn đỏ (hoadon-npsc.vercel.app → Cài đặt).
// Bên đó cất: gs://hoadon-npsc/users/{uid}/ruiRo/ds.json.gz — luật phân quyền chỉ cho chính tài khoản đó đọc.
// App này chỉ ĐỌC, không ghi gì sang kho bên đó.

import { getBytes, ref } from 'firebase/storage'
import { giaiNenDs, type DsRuiRo } from '../core/ruiRo'
import { luuTruHoaDon } from './firebase'

export const DUONG_DAN_RUI_RO = (uid: string) => `users/${uid}/ruiRo/ds.json.gz`

/** null = tài khoản này chưa nạp danh sách nào bên app hoá đơn */
export async function taiDsRuiRo(uid: string): Promise<DsRuiRo | null> {
  try {
    return await giaiNenDs(new Uint8Array(await getBytes(ref(luuTruHoaDon, DUONG_DAN_RUI_RO(uid)))))
  } catch (e) {
    if ((e as { code?: string }).code === 'storage/object-not-found') return null
    throw e
  }
}

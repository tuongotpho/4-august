// Kiểm LUẬT PHÂN QUYỀN Firestore + Storage trên máy giả lập (emulator).
// Chạy: npm run test:quyen   (cần Java + firebase-tools)

import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-khaithue',
    firestore: { rules: readFileSync('../firebase/firestore.rules', 'utf8'), host: '127.0.0.1', port: Number(process.env.CONG_FIRESTORE_GIA_LAP) || 8080 },
    storage: { rules: readFileSync('../firebase/storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
  })
})
afterAll(async () => env?.cleanup())
beforeEach(async () => {
  await env.clearFirestore()
  await env.clearStorage()
})

const HO_SO = { hoSo: { mst: '0100000000', tenNNT: 'Cty A' } }

describe('Firestore: mỗi người chỉ thấy vùng của mình', () => {
  it('chủ đọc / ghi được hồ sơ của mình', async () => {
    const db = env.authenticatedContext('anh').firestore()
    await assertSucceeds(setDoc(doc(db, 'nguoiDung/anh/congTy/0100000000'), HO_SO))
    await assertSucceeds(getDoc(doc(db, 'nguoiDung/anh/congTy/0100000000')))
  })
  it('người khác KHÔNG đọc, KHÔNG ghi được', async () => {
    await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'nguoiDung/anh/congTy/0100000000'), HO_SO) })
    const la = env.authenticatedContext('nguoi-la').firestore()
    await assertFails(getDoc(doc(la, 'nguoiDung/anh/congTy/0100000000')))
    await assertFails(setDoc(doc(la, 'nguoiDung/anh/congTy/0100000000'), HO_SO))
  })
  it('XOÁ: chủ xoá được; người khác KHÔNG xoá được', async () => {
    await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'nguoiDung/anh/congTy/0100000000'), HO_SO) })
    await assertFails(deleteDoc(doc(env.authenticatedContext('nguoi-la').firestore(), 'nguoiDung/anh/congTy/0100000000')))
    await assertSucceeds(deleteDoc(doc(env.authenticatedContext('anh').firestore(), 'nguoiDung/anh/congTy/0100000000')))
  })
  it('chưa đăng nhập: cấm hết', async () => {
    const an = env.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(an, 'nguoiDung/anh/congTy/0100000000')))
    await assertFails(setDoc(doc(an, 'nguoiDung/anh/x/y'), { a: 1 }))
  })
  it('ngoài vùng nguoiDung: cấm hết, kể cả đã đăng nhập', async () => {
    const db = env.authenticatedContext('anh').firestore()
    await assertFails(setDoc(doc(db, 'chung/abc'), { a: 1 }))
  })
})

describe('Firestore: giám đốc CHỈ XEM (chủ thêm email)', () => {
  const GD = { email: 'giamdoc@vidu.vn', email_verified: true }
  const coSan = async () => env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'nguoiDung/anh/congTy/0100000000'), HO_SO)
    await setDoc(doc(c.firestore(), 'nguoiDung/anh/congTy/0100000000/loHang/lo1'), { ten: 'Lô 1' })
    await setDoc(doc(c.firestore(), 'nguoiDung/anh/phienAI/p1'), { tenMay: 'máy' })
  })
  it('chưa được thêm: không đọc được', async () => {
    await coSan()
    await assertFails(getDoc(doc(env.authenticatedContext('gd', GD).firestore(), 'nguoiDung/anh/congTy/0100000000')))
  })
  it('được thêm: ĐỌC được hồ sơ công ty (kể cả liệt kê, lô hàng); KHÔNG ghi / xoá; KHÔNG đọc phiên AI', async () => {
    await coSan()
    await assertSucceeds(setDoc(doc(env.authenticatedContext('anh').firestore(), 'nguoiDung/anh/nguoiXem/giamdoc@vidu.vn'), { them: 1 }))
    const gd = env.authenticatedContext('gd', GD).firestore()
    await assertSucceeds(getDoc(doc(gd, 'nguoiDung/anh/congTy/0100000000')))
    await assertSucceeds(getDocs(collection(gd, 'nguoiDung/anh/congTy')))
    await assertSucceeds(getDocs(collection(gd, 'nguoiDung/anh/congTy/0100000000/loHang')))
    await assertFails(setDoc(doc(gd, 'nguoiDung/anh/congTy/0100000000'), HO_SO))
    await assertFails(setDoc(doc(gd, 'nguoiDung/anh/congTy/0100000000/loHang/lo2'), { ten: 'x' }))
    await assertFails(deleteDoc(doc(gd, 'nguoiDung/anh/congTy/0100000000')))
    await assertFails(getDoc(doc(gd, 'nguoiDung/anh/phienAI/p1')))
    await assertFails(getDoc(doc(gd, 'nguoiDung/anh/nguoiXem/giamdoc@vidu.vn'))) // không tự xem / sửa danh sách người xem
    await assertFails(setDoc(doc(gd, 'nguoiDung/anh/nguoiXem/nguoi-khac@vidu.vn'), { them: 1 }))
  })
  it('email chưa xác minh / email khác: không đọc được dù trùng tên', async () => {
    await coSan()
    await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'nguoiDung/anh/nguoiXem/giamdoc@vidu.vn'), { them: 1 }) })
    await assertFails(getDoc(doc(env.authenticatedContext('gd', { email: 'giamdoc@vidu.vn', email_verified: false }).firestore(), 'nguoiDung/anh/congTy/0100000000')))
    await assertFails(getDoc(doc(env.authenticatedContext('x', { email: 'khac@vidu.vn', email_verified: true }).firestore(), 'nguoiDung/anh/congTy/0100000000')))
  })
  it('lời mời: chỉ chủ ghi / xoá (đúng uid của mình); chỉ đúng email đọc', async () => {
    const chu = env.authenticatedContext('anh').firestore()
    await assertSucceeds(setDoc(doc(chu, 'chiaSe/giamdoc@vidu.vn/tu/anh'), { chuUid: 'anh', chuEmail: 'anh@vidu.vn' }))
    await assertFails(setDoc(doc(chu, 'chiaSe/giamdoc@vidu.vn/tu/nguoi-khac'), { chuUid: 'nguoi-khac' })) // mạo danh chủ khác
    await assertFails(setDoc(doc(env.authenticatedContext('la').firestore(), 'chiaSe/giamdoc@vidu.vn/tu/anh'), { chuUid: 'anh' }))
    await assertSucceeds(getDocs(collection(env.authenticatedContext('gd', GD).firestore(), 'chiaSe/giamdoc@vidu.vn/tu')))
    await assertFails(getDocs(collection(env.authenticatedContext('x', { email: 'khac@vidu.vn', email_verified: true }).firestore(), 'chiaSe/giamdoc@vidu.vn/tu')))
    await assertFails(deleteDoc(doc(env.authenticatedContext('gd', GD).firestore(), 'chiaSe/giamdoc@vidu.vn/tu/anh')))
    await assertSucceeds(deleteDoc(doc(chu, 'chiaSe/giamdoc@vidu.vn/tu/anh')))
  })
})

describe('Storage: file tờ khai / hoá đơn', () => {
  const tep = new TextEncoder().encode('<xml/>')
  it('chủ tải lên và tải về được', async () => {
    const st = env.authenticatedContext('anh').storage()
    await assertSucceeds(uploadBytes(ref(st, 'nguoiDung/anh/0100000000/toKhai/a.xml'), tep))
    await assertSucceeds(getBytes(ref(st, 'nguoiDung/anh/0100000000/toKhai/a.xml')))
  })
  it('người khác KHÔNG tải về / ghi đè được', async () => {
    await assertSucceeds(uploadBytes(ref(env.authenticatedContext('anh').storage(), 'nguoiDung/anh/0100000000/toKhai/a.xml'), tep))
    const la = env.authenticatedContext('nguoi-la').storage()
    await assertFails(getBytes(ref(la, 'nguoiDung/anh/0100000000/toKhai/a.xml')))
    await assertFails(uploadBytes(ref(la, 'nguoiDung/anh/0100000000/toKhai/a.xml'), tep))
  })
  it('XOÁ file: người khác không xoá được, chủ xoá được', async () => {
    const duong = 'nguoiDung/anh/0100000000/hoaDon/x.xlsx'
    await assertSucceeds(uploadBytes(ref(env.authenticatedContext('anh').storage(), duong), tep))
    await assertFails(deleteObject(ref(env.authenticatedContext('nguoi-la').storage(), duong)))
    await assertSucceeds(deleteObject(ref(env.authenticatedContext('anh').storage(), duong)))
  })
  it('chưa đăng nhập: cấm', async () => {
    await assertFails(uploadBytes(ref(env.unauthenticatedContext().storage(), 'nguoiDung/anh/x.xml'), tep))
  })
  it('file từ 10 MB trở lên: chặn', async () => {
    const to = new Uint8Array(10 * 1024 * 1024 + 1)
    await assertFails(uploadBytes(ref(env.authenticatedContext('anh').storage(), 'nguoiDung/anh/to.xlsx'), to))
  })
})

describe('Hoá đơn điện tử XML (tải lên là lưu kho): file gốc + bản tóm tắt', () => {
  const XML = new TextEncoder().encode('﻿<HDon><DLHDon/></HDon>')
  const FILE = 'nguoiDung/anh/0100000000/hoaDon/abc/1-C26TAA-17.xml'
  const BAN_GHI = 'nguoiDung/anh/congTy/0100000000/tepHoaDon/abc'
  const TOM_TAT = { ten: '1-C26TAA-17.xml', ky: '2026-Q4', soBan: 0, soMua: 1, duongDan: FILE, khoaHD: '0109999991|1|C26TAA|17', goc: { nguon: 'xml', mstBan: '0109999991', mstMua: '0100000000', kyHieu: 'C26TAA', so: '17', tong: 21_600_000 } }
  const GD = { email: 'giamdoc@vidu.vn', email_verified: true }
  it('chủ: lưu file XML nguyên văn + bản tóm tắt, đọc lại được', async () => {
    const chu = env.authenticatedContext('anh')
    await assertSucceeds(uploadBytes(ref(chu.storage(), FILE), XML, { contentType: 'application/xml' }))
    await assertSucceeds(setDoc(doc(chu.firestore(), BAN_GHI), TOM_TAT))
    await assertSucceeds(getBytes(ref(chu.storage(), FILE)))
    await assertSucceeds(getDocs(collection(chu.firestore(), 'nguoiDung/anh/congTy/0100000000/tepHoaDon')))
  })
  it('người lạ: không đọc, không ghi, không xoá file hoá đơn / bản tóm tắt của người khác', async () => {
    const chu = env.authenticatedContext('anh')
    await uploadBytes(ref(chu.storage(), FILE), XML)
    await setDoc(doc(chu.firestore(), BAN_GHI), TOM_TAT)
    const la = env.authenticatedContext('nguoi-la')
    await assertFails(getBytes(ref(la.storage(), FILE)))
    await assertFails(uploadBytes(ref(la.storage(), FILE), XML))
    await assertFails(deleteObject(ref(la.storage(), FILE)))
    await assertFails(getDoc(doc(la.firestore(), BAN_GHI)))
    await assertFails(setDoc(doc(la.firestore(), BAN_GHI), TOM_TAT))
    await assertFails(getBytes(ref(env.unauthenticatedContext().storage(), FILE)))
  })
  it('giám đốc chỉ xem: đọc được bản tóm tắt, KHÔNG ghi; không tải được file gốc trên Storage', async () => {
    const chu = env.authenticatedContext('anh')
    await uploadBytes(ref(chu.storage(), FILE), XML)
    await env.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), BAN_GHI), TOM_TAT)
      await setDoc(doc(c.firestore(), 'nguoiDung/anh/nguoiXem/giamdoc@vidu.vn'), { them: 1 })
    })
    const gd = env.authenticatedContext('gd', GD)
    await assertSucceeds(getDoc(doc(gd.firestore(), BAN_GHI)))
    await assertFails(setDoc(doc(gd.firestore(), BAN_GHI), { ...TOM_TAT, goc: { ...TOM_TAT.goc, tong: 1 } }))
    await assertFails(getBytes(ref(gd.storage(), FILE)))
  })
})

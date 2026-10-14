import {
  collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, setDoc, Timestamp, writeBatch, type Firestore, type Unsubscribe,
} from 'firebase/firestore'
import { CAI_DAT_MAC_DINH, chuanLop, type CaiDat, type LopGiang } from '../model'
import type { DataStore, PhienMay } from './DataStore'

/** Firestore, database "atld" (dự án app-from-ai dùng chung với app khác). Mọi thứ dưới users/{uid}/… */
export class FirebaseStore implements DataStore {
  private db: Firestore
  private uid: string
  private nghe = new Set<() => void>()
  private unsubs: Unsubscribe[] = []
  // bản onSnapshot gửi về: đang nghe thì đọc từ đây, khỏi đọc lại Firestore
  private lop: LopGiang[] | null = null
  private caiDat: CaiDat | null = null

  constructor(db: Firestore, uid: string) {
    this.db = db
    this.uid = uid
  }

  private col(ten: string) {
    return collection(this.db, 'users', this.uid, ten)
  }

  private batDauNghe() {
    if (this.unsubs.length) return
    const bao = () => this.nghe.forEach((f) => f())
    this.unsubs.push(
      onSnapshot(this.col('lop'), (s) => {
        this.lop = s.docs.map((d) => chuanLop({ ...(d.data() as LopGiang), id: d.id }))
        bao()
      }, () => (this.lop = null)),
      onSnapshot(doc(this.db, 'users', this.uid, 'meta', 'caiDat'), (s) => {
        this.caiDat = docCaiDat(s.data())
        bao()
      }, () => (this.caiDat = null)),
    )
  }

  async listLop() {
    if (this.lop) return this.lop
    const s = await getDocs(this.col('lop'))
    return s.docs.map((d) => chuanLop({ ...(d.data() as LopGiang), id: d.id }))
  }

  async luuLop(l: LopGiang) {
    await setDoc(doc(this.col('lop'), l.id), sach(l))
  }

  async luuNhieuLop(ds: LopGiang[]) {
    // Firestore cho tối đa 500 thao tác một lần
    for (let i = 0; i < ds.length; i += 400) {
      const b = writeBatch(this.db)
      for (const l of ds.slice(i, i + 400)) b.set(doc(this.col('lop'), l.id), sach(l))
      await b.commit()
    }
  }

  async xoaLop(id: string) {
    await deleteDoc(doc(this.col('lop'), id))
  }

  async getCaiDat() {
    if (this.caiDat) return this.caiDat
    return docCaiDat((await getDoc(doc(this.db, 'users', this.uid, 'meta', 'caiDat'))).data())
  }

  async luuCaiDat(c: CaiDat) {
    await setDoc(doc(this.db, 'users', this.uid, 'meta', 'caiDat'), c)
  }

  async listPhien(): Promise<PhienMay[]> {
    const s = await getDocs(this.col('phien'))
    return s.docs
      .map((d) => {
        const x = d.data()
        const t = x.taoLuc
        return { id: d.id, tenMay: String(x.tenMay ?? ''), noiNhan: String(x.noiNhan ?? ''), taoLuc: t instanceof Timestamp ? t.toMillis() : Date.parse(String(t)) || 0 }
      })
      .sort((a, b) => b.taoLuc - a.taoLuc)
  }

  async thuHoiPhien(id: string) {
    await deleteDoc(doc(this.col('phien'), id))
  }

  subscribe(cb: () => void) {
    this.nghe.add(cb)
    this.batDauNghe()
    return () => {
      this.nghe.delete(cb)
    }
  }
}

function docCaiDat(x: unknown): CaiDat {
  const c = (x ?? {}) as Partial<CaiDat>
  return { ...CAI_DAT_MAC_DINH, ...c, biDanhDoiTac: { ...(c.biDanhDoiTac ?? {}) }, lich: { ...CAI_DAT_MAC_DINH.lich, ...(c.lich ?? {}) } }
}

/** Firestore không nhận undefined */
const sach = (l: LopGiang) => JSON.parse(JSON.stringify(l)) as LopGiang

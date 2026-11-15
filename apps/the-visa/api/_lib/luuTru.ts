// Nơi cất file của máy chủ, hai kiểu (chọn bằng biến VISA_KHO):
//   (mặc định) Vercel Blob, chế độ RIÊNG TƯ — chạy trên Vercel, cần BLOB_READ_WRITE_TOKEN
//   'firebase'  Cloud Storage của project app-from-ai (bucket VISA_BUCKET, mọi file dưới the-visa/) — chạy trên Firebase Functions.
//              Máy chủ đọc ghi bằng quyền của chính nó (firebase-admin); luật Storage của bucket không mở đường the-visa/
//              cho trình duyệt nên chỉ máy chủ thấy được — riêng tư như Blob.
// firebase-admin do Firebase Functions cung cấp sẵn (hosting/functions của 4.August) nên không thêm vào package.json ở đây.
import { del, get, list, put } from '@vercel/blob'

export interface LuuTru {
  docChu(duong: string): Promise<string | null>
  docLuong(duong: string): Promise<ReadableStream | null>
  ghi(duong: string, du: string | Buffer, loai: string, tuyChon?: { khongGhiDe?: boolean; duoiNgauNhien?: boolean }): Promise<void>
  ds(tienTo: string, toiDa?: number): Promise<string[]>
  xoa(duong: string[]): Promise<void>
}

const blob: LuuTru = {
  async docChu(duong) {
    const r = await get(duong, { access: 'private', useCache: false })
    return r && r.statusCode === 200 ? new Response(r.stream).text() : null
  },
  async docLuong(duong) {
    const r = await get(duong, { access: 'private', useCache: false })
    return r && r.statusCode === 200 ? r.stream : null
  },
  async ghi(duong, du, loai, t = {}) {
    await put(duong, du, { access: 'private', addRandomSuffix: !!t.duoiNgauNhien, allowOverwrite: !t.khongGhiDe && !t.duoiNgauNhien, contentType: loai })
  },
  async ds(tienTo, toiDa = Infinity) {
    const kq: string[] = []
    let cursor: string | undefined
    do {
      const r = await list({ prefix: tienTo, cursor })
      kq.push(...r.blobs.map((b) => b.pathname))
      cursor = r.hasMore && kq.length < toiDa ? r.cursor : undefined
    } while (cursor)
    return kq
  },
  async xoa(duong) {
    await del(duong)
  },
}

const GOC_FIREBASE = 'the-visa/'

function firebase(tenBucket: string): LuuTru {
  type Bucket = {
    file(p: string): {
      download(): Promise<[Buffer]>
      save(d: string | Buffer, o: object): Promise<void>
      delete(o?: object): Promise<void>
      exists(): Promise<[boolean]>
      createReadStream(): NodeJS.ReadableStream
    }
    getFiles(o: object): Promise<[{ name: string }[]]>
  }
  let bucket: Promise<Bucket> | null = null
  const layBucket = () =>
    (bucket ??= (async () => {
      const app = (await import('firebase-admin/app' as string)) as { getApps(): unknown[]; initializeApp(): unknown }
      if (!app.getApps().length) app.initializeApp()
      const { getStorage } = (await import('firebase-admin/storage' as string)) as { getStorage(): { bucket(t: string): Bucket } }
      return getStorage().bucket(tenBucket)
    })())
  const khongCo = (e: unknown) => (e as { code?: number }).code === 404
  return {
    async docChu(duong) {
      try {
        return (await (await layBucket()).file(GOC_FIREBASE + duong).download())[0].toString('utf8')
      } catch (e) {
        if (khongCo(e)) return null
        throw e
      }
    },
    async docLuong(duong) {
      const f = (await layBucket()).file(GOC_FIREBASE + duong)
      if (!(await f.exists())[0]) return null
      const { Readable } = await import('node:stream')
      return Readable.toWeb(f.createReadStream() as import('node:stream').Readable) as ReadableStream
    },
    async ghi(duong, du, loai, t = {}) {
      const ten = t.duoiNgauNhien ? duong.replace(/(\.[a-z]+)?$/, (m) => `-${Math.random().toString(36).slice(2, 10)}${m}`) : duong
      await (await layBucket()).file(GOC_FIREBASE + ten).save(du, {
        contentType: loai,
        resumable: false,
        ...(t.khongGhiDe ? { preconditionOpts: { ifGenerationMatch: 0 } } : {}),
      })
    },
    async ds(tienTo, toiDa = Infinity) {
      const [tep] = await (await layBucket()).getFiles({ prefix: GOC_FIREBASE + tienTo, autoPaginate: true })
      const kq = tep.map((f) => f.name.slice(GOC_FIREBASE.length)).sort()
      return Number.isFinite(toiDa) ? kq.slice(-toiDa) : kq
    },
    async xoa(duong) {
      const b = await layBucket()
      await Promise.all(duong.map((p) => b.file(GOC_FIREBASE + p).delete({ ignoreNotFound: true })))
    },
  }
}

let daChon: LuuTru | null = null
export const luuTru = (): LuuTru =>
  (daChon ??= process.env.VISA_KHO === 'firebase' ? firebase(process.env.VISA_BUCKET || 'hoadon-npsc') : blob)

// Nói chuyện với Firebase (project app-from-ai, database riêng `tuongot-sale`) qua REST, bằng QUYỀN CỦA
// CHÍNH NGƯỜI DÙNG (mã đăng nhập của họ). Máy chủ không có chìa khoá tổng (service account):
// luật firestore.rules vẫn canh cửa y như khi chủ shop mở web app.
//
// Dùng REST thay vì thư viện firebase (bản trình duyệt) vì máy chủ chỉ có "mã làm mới" (refresh token)
// của người dùng, thư viện không cho đăng nhập bằng mã đó.
// (Chép từ máy chủ MCP Sáng kiến NPSC, đổi project + database.)

/** Thông số web app — khoá web lấy từ biến môi trường (cùng biến VITE_* web dùng khi build trên Vercel) */
export const FIREBASE_WEB = {
  projectId: 'app-from-ai',
  databaseId: 'tuongot-sale',
}

export interface CauHinhFirebase {
  apiKey: string
  projectId: string
  databaseId: string
  auth: string // gốc securetoken
  firestore: string
  /** Gửi kèm làm Referer (phòng khi khoá web bị giới hạn theo tên miền) */
  referer: string
}

type Env = Record<string, string | undefined>

export function cauHinhFirebase(env: Env = process.env): CauHinhFirebase {
  const referer = env.TUONGOT_FIREBASE_REFERER || 'https://tuongot-si.vercel.app/'
  const w = FIREBASE_WEB
  return { apiKey: env.VITE_FIREBASE_API_KEY ?? '', projectId: env.VITE_FIREBASE_PROJECT_ID || w.projectId, databaseId: env.TUONGOT_DATABASE_ID || w.databaseId, auth: 'https://securetoken.googleapis.com', firestore: 'https://firestore.googleapis.com', referer }
}

export class LoiFirebase extends Error {
  trangThai: number
  constructor(trangThai: number, thongDiep: string) {
    super(thongDiep)
    this.trangThai = trangThai
  }
}

async function goi(url: string, init: RequestInit, cfg: CauHinhFirebase): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set('Referer', cfg.referer)
  const r = await fetch(url, { ...init, headers })
  if (!r.ok && r.status !== 404) {
    const chu = await r.text().catch(() => '')
    throw new LoiFirebase(r.status, `Firebase từ chối (${r.status}): ${chu.slice(0, 300)}`)
  }
  return r
}

/** Đọc phần thân (payload) của mã JWT Firebase — mã vừa lấy thẳng từ Google nên không cần kiểm chữ ký */
function thanJwt(jwt: string): Record<string, unknown> {
  try {
    return JSON.parse(Buffer.from(jwt.split('.')[1] ?? '', 'base64url').toString('utf8')) as Record<string, unknown>
  } catch {
    return {}
  }
}

export interface MaTruyCap { idToken: string; uid: string; email: string; hetHan: number }

/** Đổi mã làm mới lấy mã truy cập (sống 1 giờ) + uid. Mã làm mới sai/bị thu hồi -> lỗi 400. */
export async function doiMa(cfg: CauHinhFirebase, maLamMoi: string): Promise<MaTruyCap> {
  const r = await goi(`${cfg.auth}/v1/token?key=${cfg.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: maLamMoi }),
  }, cfg)
  if (!r.ok) throw new LoiFirebase(r.status, 'Không đổi được mã đăng nhập')
  const j = (await r.json()) as { id_token: string; user_id: string; expires_in: string }
  const email = thanJwt(j.id_token).email
  return { idToken: j.id_token, uid: j.user_id, email: typeof email === 'string' ? email : '', hetHan: Date.now() + (Number(j.expires_in) - 60) * 1000 }
}

// ---------------- Firestore: đổi qua lại giữa giá trị JS và dạng REST ----------------

type GiaTriRest = Record<string, unknown>

export function maHoa(v: unknown): GiaTriRest {
  if (v === null) return { nullValue: null }
  if (v instanceof Date) return { timestampValue: v.toISOString() }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return Number.isSafeInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (typeof v === 'string') return { stringValue: v }
  if (Array.isArray(v)) return { arrayValue: v.length ? { values: v.filter((x) => x !== undefined).map(maHoa) } : {} }
  if (typeof v === 'object') return { mapValue: { fields: maHoaTruong(v as Record<string, unknown>) } }
  throw new Error(`Không lưu được kiểu ${typeof v}`)
}

/** Bỏ ô undefined (giống ignoreUndefinedProperties) */
export function maHoaTruong(o: Record<string, unknown>): Record<string, GiaTriRest> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => [k, maHoa(v)]))
}

export function giaiMa(v: GiaTriRest): unknown {
  if ('nullValue' in v) return null
  if ('booleanValue' in v) return v.booleanValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return Number(v.doubleValue)
  if ('stringValue' in v) return v.stringValue
  if ('timestampValue' in v) return v.timestampValue
  if ('arrayValue' in v) return ((v.arrayValue as { values?: GiaTriRest[] }).values ?? []).map(giaiMa)
  if ('mapValue' in v) return giaiMaTruong((v.mapValue as { fields?: Record<string, GiaTriRest> }).fields ?? {})
  if ('referenceValue' in v) return v.referenceValue
  if ('bytesValue' in v) return v.bytesValue
  if ('geoPointValue' in v) return v.geoPointValue
  return null
}

export function giaiMaTruong(f: Record<string, GiaTriRest>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(f).map(([k, v]) => [k, giaiMa(v)]))
}

/** Tên trường trong updateMask: tên lạ (có dấu, khoảng trắng...) phải bọc dấu ` */
const tenTruong = (k: string) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(k) ? k : `\`${k.replace(/[`\\]/g, '\\$&')}\``)

/** Một điều kiện lọc của truy vấn (where) */
export interface DieuKien {
  truong: string
  phep: 'EQUAL' | 'ARRAY_CONTAINS' | 'IN'
  giaTri: unknown
}

/** Đọc/ghi Firestore. Có idToken = bằng quyền người dùng; không có = như khách chưa đăng nhập. */
export class FirebaseNguoiDung {
  cfg: CauHinhFirebase
  uid: string
  email: string
  private idToken: string
  constructor(cfg: CauHinhFirebase, uid = '', idToken = '', email = '') {
    this.cfg = cfg
    this.uid = uid
    this.email = email
    this.idToken = idToken
  }

  private get goc() {
    return `${this.cfg.firestore}/v1/projects/${this.cfg.projectId}/databases/${this.cfg.databaseId}/documents`
  }
  private get xacThuc(): Record<string, string> {
    return this.idToken ? { Authorization: `Bearer ${this.idToken}` } : {}
  }
  private duongDan(p: string) {
    return p.split('/').map(encodeURIComponent).join('/')
  }

  async docTaiLieu<T = Record<string, unknown>>(p: string): Promise<(T & { id: string }) | null> {
    const r = await goi(`${this.goc}/${this.duongDan(p)}`, { headers: this.xacThuc }, this.cfg)
    if (r.status === 404) return null
    const j = (await r.json()) as { fields?: Record<string, GiaTriRest> }
    return { id: decodeURIComponent(p.split('/').pop()!), ...(giaiMaTruong(j.fields ?? {}) as T) }
  }

  /** Mọi tài liệu trong một bộ sưu tập: [{ id, ...dữ liệu }]. chiLay = chỉ tải các trường này (nhẹ hơn). */
  async docBoSuuTap<T = Record<string, unknown>>(p: string, chiLay?: string[]): Promise<(T & { id: string })[]> {
    const kq: (T & { id: string })[] = []
    const mask = chiLay?.length ? chiLay.map((f) => `&mask.fieldPaths=${encodeURIComponent(tenTruong(f))}`).join('') : ''
    let trang = ''
    do {
      const r = await goi(`${this.goc}/${this.duongDan(p)}?pageSize=300${mask}${trang ? `&pageToken=${encodeURIComponent(trang)}` : ''}`, { headers: this.xacThuc }, this.cfg)
      if (r.status === 404) return kq
      const j = (await r.json()) as { documents?: { name: string; fields?: Record<string, GiaTriRest> }[]; nextPageToken?: string }
      for (const d of j.documents ?? []) kq.push({ id: decodeURIComponent(d.name.split('/').pop()!), ...(giaiMaTruong(d.fields ?? {}) as T) })
      trang = j.nextPageToken ?? ''
    } while (trang)
    return kq
  }

  /**
   * Ghi tài liệu.
   *  - thayThe: ghi đè cả tài liệu (giống set)
   *  - capNhat: chỉ các ô truyền vào, tài liệu phải có sẵn (giống update) — null = ghi null như web app.
   *    xoaTruong: các ô xoá hẳn (giống FieldValue.delete())
   */
  async ghi(p: string, du: Record<string, unknown>, cach: 'thayThe' | 'capNhat' = 'thayThe', xoaTruong: string[] = []) {
    const q = new URLSearchParams()
    if (cach === 'capNhat') {
      for (const k of [...Object.keys(du).filter((k) => du[k] !== undefined), ...xoaTruong]) q.append('updateMask.fieldPaths', tenTruong(k))
      q.set('currentDocument.exists', 'true')
    }
    const r = await goi(`${this.goc}/${this.duongDan(p)}${q.size ? `?${q}` : ''}`, {
      method: 'PATCH',
      headers: { ...this.xacThuc, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: maHoaTruong(du) }),
    }, this.cfg)
    if (r.status === 404) throw new LoiFirebase(404, `Không có tài liệu ${p}`)
  }

  /** Thêm tài liệu mới với mã tự sinh (giống collection.add) — trả về mã */
  async them(boSuuTap: string, du: Record<string, unknown>): Promise<string> {
    const r = await goi(`${this.goc}/${this.duongDan(boSuuTap)}`, {
      method: 'POST',
      headers: { ...this.xacThuc, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: maHoaTruong(du) }),
    }, this.cfg)
    const j = (await r.json()) as { name: string }
    return decodeURIComponent(j.name.split('/').pop()!)
  }

  /**
   * Truy vấn có điều kiện (giống collection.where(...).get()). Cần khi luật chỉ cho đọc phần của mình
   * (vd Cán bộ quản lý chỉ đọc dự án được phân công): luật Firestore từ chối truy vấn không ràng buộc.
   */
  async truyVan<T = Record<string, unknown>>(boSuuTap: string, dieuKien: DieuKien[]): Promise<(T & { id: string })[]> {
    const loc = dieuKien.map((d) => ({ fieldFilter: { field: { fieldPath: tenTruong(d.truong) }, op: d.phep, value: maHoa(d.giaTri) } }))
    const where = loc.length === 0 ? undefined : loc.length === 1 ? loc[0] : { compositeFilter: { op: 'AND', filters: loc } }
    const r = await goi(`${this.goc}:runQuery`, {
      method: 'POST',
      headers: { ...this.xacThuc, 'Content-Type': 'application/json' },
      body: JSON.stringify({ structuredQuery: { from: [{ collectionId: boSuuTap }], ...(where ? { where } : {}) } }),
    }, this.cfg)
    const j = (await r.json()) as { document?: { name: string; fields?: Record<string, GiaTriRest> } }[]
    return j.filter((x) => x.document).map((x) => ({ id: decodeURIComponent(x.document!.name.split('/').pop()!), ...(giaiMaTruong(x.document!.fields ?? {}) as T) }))
  }

  /**
   * Cập nhật theo đường dẫn lồng nhau (giống update({ 'milestones.ky_hd': ... })): chỉ đụng đúng ô đó,
   * hai người sửa hai ô khác nhau không đè nhau. Giá trị undefined = xoá ô (FieldValue.delete()).
   */
  async capNhatDuongDan(p: string, thay: Record<string, unknown>) {
    const than: Record<string, unknown> = {}
    const q = new URLSearchParams({ 'currentDocument.exists': 'true' })
    for (const [duong, v] of Object.entries(thay)) {
      const phan = duong.split('.')
      q.append('updateMask.fieldPaths', phan.map(tenTruong).join('.'))
      if (v === undefined) continue
      let o = than
      for (const k of phan.slice(0, -1)) o = (o[k] ??= {}) as Record<string, unknown>
      o[phan[phan.length - 1]] = v
    }
    const r = await goi(`${this.goc}/${this.duongDan(p)}?${q}`, {
      method: 'PATCH',
      headers: { ...this.xacThuc, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: maHoaTruong(than) }),
    }, this.cfg)
    if (r.status === 404) throw new LoiFirebase(404, `Không có tài liệu ${p}`)
  }

  async xoa(p: string) {
    await goi(`${this.goc}/${this.duongDan(p)}`, { method: 'DELETE', headers: this.xacThuc }, this.cfg)
  }
}

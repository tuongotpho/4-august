/**
 * Phần tính toán thuần (không đụng giao diện / Firebase) — có test ở logic.test.ts.
 * Mọi số tiền là đồng, số nguyên.
 */
import type { AppData, Customer, Order, OrderItem, Product, Purchase } from './types'

// ---------- Định dạng ----------

export const money = (n: number) => Math.round(n).toLocaleString('vi-VN') + 'đ'
export const num = (n: number) => Math.round(n).toLocaleString('vi-VN')

/** Rút gọn kiểu 1,2tr / 850k cho nhãn biểu đồ */
export function short(n: number): string {
  const a = Math.abs(n)
  if (a >= 1e9) return (n / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' tỷ'
  if (a >= 1e6) return (n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + 'tr'
  if (a >= 1e3) return Math.round(n / 1e3) + 'k'
  return String(Math.round(n))
}

/** Tìm kiếm không dấu: "ba hoa" khớp "Bà Hoa" */
export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()

export const pad = (n: number, w = 2) => String(n).padStart(w, '0')

/** Ngày hôm nay theo giờ máy, dạng yyyy-mm-dd */
export function today(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export const invoiceNo = (no: number) => 'HĐ' + pad(no, 4)

/** Số ngày từ a tới b (yyyy-mm-dd), b sau a thì dương */
export function daysBetween(a: string, b: string): number {
  const ta = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))
  const tb = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10))
  return Math.round((tb - ta) / 86400000)
}

export function addDays(iso: string, n: number): string {
  const t = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) + n * 86400000)
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

export const monthOf = (iso: string) => iso.slice(0, 7)
export const fmtMonth = (ym: string) => `T${+ym.slice(5, 7)}/${ym.slice(2, 4)}`

/** n tháng gần nhất kết thúc ở tháng `end` (yyyy-mm), cũ → mới */
export function lastMonths(end: string, n: number): string[] {
  let y = +end.slice(0, 4)
  let m = +end.slice(5, 7)
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    out.unshift(`${y}-${pad(m)}`)
    if (--m === 0) (m = 12), y--
  }
  return out
}

// ---------- Đơn hàng ----------

export const orderQty = (o: Order) => o.items.reduce((s, i) => s + i.qty, 0)
export const orderSubtotal = (o: Order) => o.items.reduce((s, i) => s + i.qty * i.price, 0)
export const orderTotal = (o: Order) => Math.max(0, orderSubtotal(o) - (o.discount || 0))
export const orderCost = (o: Order) => o.items.reduce((s, i) => s + i.qty * i.cost, 0)
export const orderProfit = (o: Order) => orderTotal(o) - orderCost(o)
/** Phần còn thiếu của riêng đơn này (âm = khách trả dư, trừ vào nợ cũ) */
export const orderDue = (o: Order) => orderTotal(o) - (o.paid || 0)

export const nextOrderNo = (orders: Order[]) => orders.reduce((m, o) => Math.max(m, o.no || 0), 0) + 1

/** Sắp đơn theo ngày rồi theo lúc tạo — cũ trước */
export const byDateAsc = <T extends { date: string; createdAt: number }>(a: T, b: T) =>
  a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1

// ---------- Công nợ ----------

/** Nợ hiện tại của từng khách = Σ(tiền đơn − trả ngay) − Σ(tiền thu nợ). Dương = khách còn nợ. */
export function debtByCustomer(d: Pick<AppData, 'orders' | 'receipts'>): Map<string, number> {
  const m = new Map<string, number>()
  for (const o of d.orders) m.set(o.customerId, (m.get(o.customerId) ?? 0) + orderDue(o))
  for (const r of d.receipts) m.set(r.customerId, (m.get(r.customerId) ?? 0) - r.amount)
  return m
}

/**
 * Nợ cũ của khách TRƯỚC một đơn (dùng in lên hoá đơn).
 * Tính mọi đơn + khoản thu nợ xảy ra trước đơn đó (cùng ngày thì xét thời điểm tạo).
 */
export function debtBefore(d: Pick<AppData, 'orders' | 'receipts'>, order: Order): number {
  const before = (x: { date: string; createdAt: number }) =>
    x.date < order.date || (x.date === order.date && x.createdAt < order.createdAt)
  let s = 0
  for (const o of d.orders) if (o.customerId === order.customerId && o.id !== order.id && before(o)) s += orderDue(o)
  for (const r of d.receipts) if (r.customerId === order.customerId && before(r)) s -= r.amount
  return s
}

/** Trừ `credit` (tiền đã thu, trả dư) vào các đơn cũ nhất trước; trả về đơn còn nợ và số còn lại */
function allocate(orders: Order[], credit: number): { order: Order; left: number }[] {
  const out: { order: Order; left: number }[] = []
  for (const o of [...orders].sort(byDateAsc)) {
    const due = orderDue(o)
    if (due <= 0) continue
    const used = Math.min(credit, due)
    credit -= used
    if (due - used > 0) out.push({ order: o, left: due - used })
  }
  return out
}
const overpaid = (orders: Order[]) => orders.reduce((s, o) => s + Math.max(0, -orderDue(o)), 0)

/**
 * Các đơn cũ còn nợ tạo nên nợ cũ trước `order` — tiền khách đã thu (phiếu thu, trả dư) trừ vào đơn cũ nhất trước.
 * Dùng in bảng "các đợt còn nợ" trên hoá đơn kèm nợ cũ cho khách dễ nhớ.
 */
export function oldDebtOrders(d: Pick<AppData, 'orders' | 'receipts'>, order: Order): { order: Order; left: number }[] {
  const before = (x: { date: string; createdAt: number }) =>
    x.date < order.date || (x.date === order.date && x.createdAt < order.createdAt)
  const olds = d.orders.filter((o) => o.customerId === order.customerId && o.id !== order.id && before(o))
  let credit = overpaid(olds)
  for (const r of d.receipts) if (r.customerId === order.customerId && before(r)) credit += r.amount
  return allocate(olds, credit)
}

/**
 * Số tiền CÒN NỢ thật của từng đơn (id → còn nợ) — mọi khoản thu nợ, trả dư của khách trừ vào đơn cũ nhất trước.
 * Đơn không có trong bảng = đã trả đủ. Dùng tô nổi các đơn còn nợ.
 */
export function openOrderDebts(d: Pick<AppData, 'orders' | 'receipts'>): Map<string, number> {
  const byCust = new Map<string, Order[]>()
  for (const o of d.orders) byCust.set(o.customerId, [...(byCust.get(o.customerId) ?? []), o])
  const paid = new Map<string, number>()
  for (const r of d.receipts) paid.set(r.customerId, (paid.get(r.customerId) ?? 0) + r.amount)
  const m = new Map<string, number>()
  for (const [c, os] of byCust) for (const x of allocate(os, overpaid(os) + (paid.get(c) ?? 0))) m.set(x.order.id, x.left)
  return m
}

// ---------- Kho ----------

export interface StockRow {
  product: Product
  inQty: number
  soldQty: number
  stock: number
  low: boolean
}

export function stockRows(d: Pick<AppData, 'products' | 'orders' | 'stockIns'> & { purchases?: Purchase[] }): StockRow[] {
  const inQ = new Map<string, number>()
  const sold = new Map<string, number>()
  for (const s of d.stockIns) inQ.set(s.productId, (inQ.get(s.productId) ?? 0) + s.qty)
  for (const p of d.purchases ?? []) for (const i of p.items) inQ.set(i.productId, (inQ.get(i.productId) ?? 0) + i.qty)
  for (const o of d.orders) for (const i of o.items) sold.set(i.productId, (sold.get(i.productId) ?? 0) + i.qty)
  return [...d.products]
    .sort((a, b) => a.order - b.order)
    .map((p) => {
      const inQty = inQ.get(p.id) ?? 0
      const soldQty = sold.get(p.id) ?? 0
      const stock = inQty - soldQty
      return { product: p, inQty, soldQty, stock, low: stock <= p.lowStock }
    })
}

/** Tồn sổ sách từng loại hàng tính đến hết ngày `date` (nhập − bán, gồm cả ngày đó) */
export function stockAsOf(d: Pick<AppData, 'orders' | 'stockIns'> & { purchases?: Purchase[] }, date: string): Map<string, number> {
  const m = new Map<string, number>()
  const add = (pid: string, q: number) => m.set(pid, (m.get(pid) ?? 0) + q)
  for (const s of d.stockIns) if (s.date <= date) add(s.productId, s.qty)
  for (const p of d.purchases ?? []) if (p.date <= date) for (const i of p.items) add(i.productId, i.qty)
  for (const o of d.orders) if (o.date <= date) for (const i of o.items) add(i.productId, -i.qty)
  return m
}

/** Ghi chú đánh dấu các đơn / phiếu do chốt sổ cuối năm tạo ra */
export const closingNote = (year: number) => `Chốt sổ ${year}`

// ---------- Phiếu nhập / người bán ----------

export const purchaseNo = (no: number) => 'PN' + pad(no, 4)
export const purchaseQty = (p: Purchase) => p.items.reduce((s, i) => s + i.qty, 0)
export const purchaseTotal = (p: Purchase) => p.items.reduce((s, i) => s + i.qty * i.unitCost, 0)
/** Mình còn nợ người bán của riêng phiếu này */
export const purchaseDue = (p: Purchase) => purchaseTotal(p) - (p.paid || 0)
export const nextPurchaseNo = (ps: Purchase[]) => ps.reduce((m, p) => Math.max(m, p.no || 0), 0) + 1

/** Mình đang nợ từng người bán (dương = còn phải trả) */
export function debtBySupplier(ps: Purchase[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const p of ps) if (p.supplierId) m.set(p.supplierId, (m.get(p.supplierId) ?? 0) + purchaseDue(p))
  return m
}

/** Nợ người bán TRƯỚC một phiếu (in lên phiếu nhập) */
export function supplierDebtBefore(ps: Purchase[], p: Purchase): number {
  if (!p.supplierId) return 0
  let s = 0
  for (const x of ps)
    if (x.supplierId === p.supplierId && x.id !== p.id && (x.date < p.date || (x.date === p.date && x.createdAt < p.createdAt))) s += purchaseDue(x)
  return s
}

/** Giá vốn mới nhất của một loại hàng theo lần nhập gần nhất (lần nhập lẻ cũ hoặc phiếu nhập); không có thì undefined */
export function latestCost(d: Pick<AppData, 'stockIns'> & { purchases?: Purchase[] }, productId: string): number | undefined {
  let best: { date: string; createdAt: number; cost: number } | undefined
  const xet = (date: string, createdAt: number, cost: number) => {
    if (!best || date > best.date || (date === best.date && createdAt > best.createdAt)) best = { date, createdAt, cost }
  }
  for (const s of d.stockIns) if (s.productId === productId) xet(s.date, s.createdAt, s.unitCost)
  for (const p of d.purchases ?? []) for (const i of p.items) if (i.productId === productId) xet(p.date, p.createdAt, i.unitCost)
  return best?.cost
}

/**
 * Giá vốn của một loại hàng TẠI NGÀY BÁN: lấy lần nhập gần nhất trước/đúng ngày đó.
 * Bán trước cả lần nhập đầu tiên (thiếu phiếu tồn đầu kỳ) thì lấy lần nhập sớm nhất. Chưa nhập lần nào → undefined.
 * Nhờ vậy đơn ghi lùi ngày không bị lấy giá vốn của phiếu nhập mới hơn.
 */
export function costAt(d: Pick<AppData, 'stockIns'> & { purchases?: Purchase[] }, productId: string, date: string): number | undefined {
  const lan: { date: string; createdAt: number; cost: number }[] = []
  for (const s of d.stockIns) if (s.productId === productId) lan.push({ date: s.date, createdAt: s.createdAt, cost: s.unitCost })
  for (const p of d.purchases ?? []) for (const i of p.items) if (i.productId === productId) lan.push({ date: p.date, createdAt: p.createdAt, cost: i.unitCost })
  if (!lan.length) return undefined
  lan.sort(byDateAsc)
  const truoc = lan.filter((x) => x.date <= date)
  return (truoc.length ? truoc[truoc.length - 1] : lan[0]).cost
}

/** Cảnh báo giá bán bất thường trước khi lưu đơn (gõ thiếu số 0, bán dưới giá vốn) */
export function priceWarnings(items: Pick<OrderItem, 'name' | 'qty' | 'price' | 'cost'>[]): string[] {
  const out: string[] = []
  for (const i of items) {
    if (i.qty <= 0) continue
    if (i.price < 1000) out.push(`${i.name}: giá ${i.price.toLocaleString('vi-VN')}đ/chai — gõ thiếu số 0?`)
    else if (i.cost > 0 && i.price < i.cost) out.push(`${i.name}: bán ${i.price.toLocaleString('vi-VN')}đ thấp hơn giá vốn ${i.cost.toLocaleString('vi-VN')}đ`)
  }
  return out
}

/** Các đơn có giá vốn khác với giá vốn tại ngày bán (do nhập đơn lùi ngày) — kèm lãi cũ / lãi mới để tính lại */
export function costFixes(d: Pick<AppData, 'orders' | 'stockIns'> & { purchases?: Purchase[] }): { order: Order; fixed: Order; before: number; after: number }[] {
  const out: { order: Order; fixed: Order; before: number; after: number }[] = []
  for (const o of d.orders) {
    let doi = false
    const items = o.items.map((i) => {
      const c = costAt(d, i.productId, o.date)
      if (c === undefined || c === i.cost) return i
      doi = true
      return { ...i, cost: c }
    })
    if (!doi) continue
    const fixed = { ...o, items }
    out.push({ order: o, fixed, before: orderProfit(o), after: orderProfit(fixed) })
  }
  return out.sort((a, b) => byDateAsc(a.order, b.order))
}

// ---------- Thống kê ----------

export interface MonthStat {
  month: string
  revenue: number
  profit: number
  qty: number
  orders: number
}

export interface YearStat {
  year: string
  revenue: number
  profit: number
  qty: number
  orders: number
}

/** Các năm có đơn, từ năm đầu tiên tới năm `last` (gồm năm trống ở giữa), cũ → mới */
export function yearsOf(orders: Order[], last: string): string[] {
  const first = orders.reduce((m, o) => (o.date.slice(0, 4) < m ? o.date.slice(0, 4) : m), last)
  const out: string[] = []
  for (let y = +first; y <= +last; y++) out.push(String(y))
  return out
}

export function yearStats(orders: Order[], years: string[]): YearStat[] {
  const map = new Map(years.map((y) => [y, { year: y, revenue: 0, profit: 0, qty: 0, orders: 0 }]))
  for (const o of orders) {
    const s = map.get(o.date.slice(0, 4))
    if (!s) continue
    s.revenue += orderTotal(o)
    s.profit += orderProfit(o)
    s.qty += orderQty(o)
    s.orders++
  }
  return years.map((y) => map.get(y)!)
}

export function monthStats(orders: Order[], months: string[]): MonthStat[] {
  const map = new Map(months.map((m) => [m, { month: m, revenue: 0, profit: 0, qty: 0, orders: 0 }]))
  for (const o of orders) {
    const s = map.get(monthOf(o.date))
    if (!s) continue
    s.revenue += orderTotal(o)
    s.profit += orderProfit(o)
    s.qty += orderQty(o)
    s.orders++
  }
  return months.map((m) => map.get(m)!)
}

/** Số chai theo từng loại hàng trong danh sách đơn */
export function qtyByProduct(orders: Order[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const o of orders) for (const i of o.items) m.set(i.productId, (m.get(i.productId) ?? 0) + i.qty)
  return m
}

// ---------- Dự đoán lần mua tới ----------

export type PredictStatus = 'overdue' | 'soon' | 'later' | 'unknown'

export interface Prediction {
  customer: Customer
  orders: number
  lastDate?: string
  /** Khoảng cách điển hình giữa 2 lần mua (ngày) — trung vị các lần gần nhất */
  cycle?: number
  nextDate?: string
  /** Còn bao nhiêu ngày tới hạn (âm = đã quá) */
  daysLeft?: number
  status: PredictStatus
  /** Lượng chai trung bình mỗi lần (để chuẩn bị hàng) */
  avgQty: number
  /** Trung bình theo từng loại: productId → số chai */
  avgByProduct: Map<string, number>
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const n = s.length
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2
}

/** Số ngày coi là "sắp mua" (ước lượng còn ≤ ngần này ngày) */
export const SOON_DAYS = 3

/**
 * Dự đoán khi nào khách mua lại, chỉ dựa trên lịch sử thật của khách đó:
 *  - Cần ít nhất 2 ngày mua khác nhau, ít hơn thì báo "chưa đủ dữ liệu" (không đoán bừa).
 *  - Chu kỳ = trung vị khoảng cách giữa tối đa 6 lần mua gần nhất (ít bị lệch bởi 1 lần bất thường).
 *  - Nhiều đơn cùng một ngày tính là một lần mua.
 */
export function predict(customer: Customer, orders: Order[], now: string): Prediction {
  const mine = orders.filter((o) => o.customerId === customer.id)
  const days = [...new Set(mine.map((o) => o.date))].sort()
  const qtyTotal = mine.reduce((s, o) => s + orderQty(o), 0)
  const visits = days.length || 1
  const byProd = qtyByProduct(mine)
  const avgByProduct = new Map([...byProd].map(([k, v]) => [k, v / visits]))
  const base = { customer, orders: mine.length, avgQty: mine.length ? qtyTotal / visits : 0, avgByProduct }
  if (days.length < 2) return { ...base, lastDate: days[0], status: 'unknown' }

  const recent = days.slice(-7)
  const gaps = recent.slice(1).map((d, i) => daysBetween(recent[i], d))
  const cycle = Math.max(1, Math.round(median(gaps)))
  const lastDate = days[days.length - 1]
  const nextDate = addDays(lastDate, cycle)
  const daysLeft = daysBetween(now, nextDate)
  const status: PredictStatus = daysLeft < 0 ? 'overdue' : daysLeft <= SOON_DAYS ? 'soon' : 'later'
  return { ...base, lastDate, cycle, nextDate, daysLeft, status }
}

export function predictAll(d: Pick<AppData, 'customers' | 'orders'>, now: string): Prediction[] {
  const rank: Record<PredictStatus, number> = { overdue: 0, soon: 1, later: 2, unknown: 3 }
  return d.customers
    .filter((c) => !c.inactive)
    .map((c) => predict(c, d.orders, now))
    .sort((a, b) => rank[a.status] - rank[b.status] || (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999))
}

// ---------- Mã QR chuyển khoản (chuẩn VietQR / EMVCo) ----------

/** CRC-16/CCITT-FALSE (poly 0x1021, khởi tạo 0xFFFF) — chuẩn EMVCo dùng cho trường 63 */
export function crc16(s: string): string {
  let crc = 0xffff
  for (const b of new TextEncoder().encode(s)) {
    crc ^= b << 8
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

const tlv = (id: string, v: string) => id + pad(v.length) + v

/** Bỏ dấu tiếng Việt, chỉ giữ chữ/số/khoảng trắng/gạch ngang — app ngân hàng đọc nội dung CK ổn định hơn */
export function asciiNote(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, (c) => (c === 'đ' ? 'd' : 'D'))
    .replace(/[^A-Za-z0-9 -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50)
}

/**
 * Chuỗi nội dung QR chuyển khoản nhanh 24/7 (Napas) — mở app ngân hàng quét là tự điền
 * ngân hàng, số tài khoản, số tiền, nội dung. amount = 0 thì để khách tự nhập số tiền.
 */
export function vietQrPayload(bin: string, account: string, amount: number, note: string): string {
  const merchant = tlv('00', 'A000000727') + tlv('01', tlv('00', bin) + tlv('01', account)) + tlv('02', 'QRIBFTTA')
  const amt = Math.round(amount)
  const cleanNote = asciiNote(note)
  let s =
    tlv('00', '01') +
    tlv('01', amt > 0 ? '12' : '11') +
    tlv('38', merchant) +
    tlv('53', '704') +
    (amt > 0 ? tlv('54', String(amt)) : '') +
    tlv('58', 'VN') +
    (cleanNote ? tlv('62', tlv('08', cleanNote)) : '')
  s += '6304'
  return s + crc16(s)
}

/**
 * Vẽ ảnh (PNG) để gửi qua Zalo/Messenger. Hai loại, dùng chung một khung giấy:
 *  - Hoá đơn bán: shop → khách, mã QR là tài khoản của SHOP (khách quét trả tiền cho mình).
 *  - Phiếu nhập: người bán → shop, mã QR là tài khoản của NGƯỜI BÁN (mình quét trả tiền cho họ).
 * Quét bằng app ngân hàng là tự điền ngân hàng, số tài khoản, số tiền, nội dung.
 */
import QRCode from 'qrcode'
import { fmtDate, invoiceNo, money, num, orderSubtotal, orderTotal, purchaseNo, purchaseTotal, vietQrPayload } from './logic'
import type { Customer, Order, Purchase, Settings, Supplier } from './types'

const FONT = '"Be Vietnam Pro", -apple-system, "Segoe UI", Roboto, sans-serif'
const f = (w: number | string, px: number) => `${w} ${px}px ${FONT}`

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Cắt chữ cho vừa chiều rộng, thêm … */
function fit(ctx: CanvasRenderingContext2D, s: string, w: number): string {
  if (ctx.measureText(s).width <= w) return s
  let t = s
  while (t.length > 1 && ctx.measureText(t + '…').width > w) t = t.slice(0, -1)
  return t + '…'
}

interface Tone {
  from: string
  to: string
  sub: string
  tableBg: string
  tableInk: string
  line: string
  border: string
  accent: string
}
const DO: Tone = { from: '#b91c1c', to: '#7f1d1d', sub: '#fecaca', tableBg: '#fee2e2', tableInk: '#7f1d1d', line: '#f1e5e5', border: '#fca5a5', accent: '#b91c1c' }
const XANH: Tone = { from: '#0f766e', to: '#134e4a', sub: '#ccfbf1', tableBg: '#ccfbf1', tableInk: '#134e4a', line: '#e2efed', border: '#5eead4', accent: '#0f766e' }

interface Giay {
  tone: Tone
  shopName: string
  shopContact: string
  title: string
  soVaNgay: string
  benLabel: string
  benName: string
  benLine: string
  colPrice: string
  rows: { name: string; qty: number; price: number }[]
  /** Các dòng tổng (nhãn, giá trị, kiểu) — dòng "chính" in đậm */
  sums: { label: string; value: string; bold?: boolean; green?: boolean }[]
  due: number
  dueLabel: string
  doneLabel: string
  bank?: { bin: string; bankName: string; account: string; holder: string; title: string }
  qrNote: string
  footer: string
}

async function veGiay(g: Giay): Promise<HTMLCanvasElement> {
  try {
    await Promise.all([document.fonts.load(f(400, 20)), document.fonts.load(f(700, 20)), document.fonts.load(f(800, 20))])
  } catch {
    /* không tải được phông thì dùng phông máy */
  }
  const { tone: T } = g
  const W = 1080
  const PAD = 56
  const headerH = 230
  const custH = 150
  const tableH = 70 + g.rows.length * 66
  const sumH = g.sums.length * 50 + 150
  const bankH = g.bank ? 420 : 0
  const footH = 120
  const H = headerH + custH + tableH + sumH + bankH + footH

  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#fffdf9'
  ctx.fillRect(0, 0, W, H)

  // ---- Đầu giấy ----
  const grad = ctx.createLinearGradient(0, 0, W, headerH)
  grad.addColorStop(0, T.from)
  grad.addColorStop(1, T.to)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, headerH)
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  for (let i = 0; i < 6; i++) {
    ctx.beginPath()
    ctx.arc(W - 80 + i * 10, -40 + i * 30, 120 + i * 40, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'left'
  ctx.font = f(800, 52)
  ctx.fillText(fit(ctx, '🌶 ' + (g.shopName || 'Tương ớt'), W - PAD * 2), PAD, 92)
  ctx.font = f(500, 24)
  ctx.fillStyle = T.sub
  if (g.shopContact) ctx.fillText(fit(ctx, g.shopContact, W - PAD * 2), PAD, 136)
  ctx.fillStyle = '#fff'
  ctx.font = f(800, 30)
  ctx.fillText(g.title, PAD, 196)
  ctx.textAlign = 'right'
  ctx.font = f(600, 26)
  ctx.fillText(g.soVaNgay, W - PAD, 196)

  // ---- Bên kia (khách / người bán) ----
  let y = headerH + 56
  ctx.textAlign = 'left'
  ctx.fillStyle = '#64748b'
  ctx.font = f(500, 22)
  ctx.fillText(g.benLabel, PAD, y)
  y += 42
  ctx.fillStyle = '#0f172a'
  ctx.font = f(800, 34)
  ctx.fillText(fit(ctx, g.benName, W - PAD * 2), PAD, y)
  y += 36
  ctx.fillStyle = '#475569'
  ctx.font = f(400, 22)
  if (g.benLine) ctx.fillText(fit(ctx, g.benLine, W - PAD * 2), PAD, y)
  y = headerH + custH

  // ---- Bảng hàng ----
  const colQty = 600
  const colPrice = 800
  const colAmt = W - PAD
  roundRect(ctx, PAD - 16, y, W - PAD * 2 + 32, 56, 14)
  ctx.fillStyle = T.tableBg
  ctx.fill()
  ctx.fillStyle = T.tableInk
  ctx.font = f(700, 22)
  ctx.textAlign = 'left'
  ctx.fillText('Mặt hàng', PAD, y + 37)
  ctx.textAlign = 'right'
  ctx.fillText('SL', colQty, y + 37)
  ctx.fillText(g.colPrice, colPrice, y + 37)
  ctx.fillText('Thành tiền', colAmt, y + 37)
  y += 56
  for (const it of g.rows) {
    y += 46
    ctx.fillStyle = '#0f172a'
    ctx.textAlign = 'left'
    ctx.font = f(600, 26)
    ctx.fillText(fit(ctx, it.name, colQty - PAD - 120), PAD, y)
    ctx.textAlign = 'right'
    ctx.font = f(700, 26)
    ctx.fillText(num(it.qty), colQty, y)
    ctx.font = f(400, 24)
    ctx.fillStyle = '#334155'
    ctx.fillText(num(it.price), colPrice, y)
    ctx.font = f(700, 26)
    ctx.fillStyle = '#0f172a'
    ctx.fillText(num(it.qty * it.price), colAmt, y)
    y += 20
    ctx.strokeStyle = T.line
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(PAD, y)
    ctx.lineTo(W - PAD, y)
    ctx.stroke()
  }
  y += 14

  // ---- Tổng ----
  for (const l of g.sums) {
    y += 50
    ctx.textAlign = 'left'
    ctx.fillStyle = '#475569'
    ctx.font = f(l.bold ? 700 : 500, 26)
    ctx.fillText(l.label, 520, y)
    ctx.textAlign = 'right'
    ctx.fillStyle = l.green ? '#047857' : '#0f172a'
    ctx.font = f(l.bold ? 800 : 600, 26)
    ctx.fillText(l.value, W - PAD, y)
  }
  y += 30
  roundRect(ctx, 500, y, W - PAD - 500 + 16, 72, 18)
  ctx.fillStyle = g.due > 0 ? T.accent : '#047857'
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'left'
  ctx.font = f(700, 26)
  ctx.fillText(g.due > 0 ? g.dueLabel : g.doneLabel, 524, y + 46)
  ctx.textAlign = 'right'
  ctx.font = f(800, 34)
  ctx.fillText(g.due > 0 ? money(g.due) : '✓', W - PAD, y + 48)
  y += 72 + 30

  // ---- Chuyển khoản + QR ----
  if (g.bank) {
    const b = g.bank
    y += 10
    const boxH = 390
    roundRect(ctx, PAD - 16, y, W - PAD * 2 + 32, boxH, 28)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.strokeStyle = T.border
    ctx.lineWidth = 3
    ctx.stroke()
    const qrSize = 330
    const qrX = PAD + 14
    const qrY = y + 30
    const qrCanvas = document.createElement('canvas')
    await QRCode.toCanvas(qrCanvas, vietQrPayload(b.bin, b.account, g.due, g.qrNote), {
      width: qrSize,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#111827', light: '#ffffff' },
    })
    ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize)
    const tx = qrX + qrSize + 40
    const tw = W - PAD - tx
    let ty = y + 70
    ctx.textAlign = 'left'
    ctx.fillStyle = T.accent
    ctx.font = f(800, 28)
    ctx.fillText(fit(ctx, b.title, tw), tx, ty)
    const row = (label: string, value: string, big = false) => {
      ty += big ? 62 : 54
      ctx.fillStyle = '#64748b'
      ctx.font = f(500, 20)
      ctx.fillText(label, tx, ty - (big ? 30 : 26))
      ctx.fillStyle = '#0f172a'
      ctx.font = f(big ? 800 : 700, big ? 36 : 26)
      ctx.fillText(fit(ctx, value, tw), tx, ty + 6)
    }
    row('Ngân hàng', b.bankName || 'MB Bank')
    row('Số tài khoản', b.account, true)
    row('Chủ tài khoản', b.holder)
    if (g.due > 0) row('Số tiền · Nội dung', `${money(g.due)} · ${g.qrNote}`)
  }

  // ---- Chân ----
  ctx.textAlign = 'center'
  ctx.fillStyle = T.tableInk
  ctx.font = f('italic 500', 24)
  if (g.footer) ctx.fillText(fit(ctx, g.footer, W - PAD * 2), W / 2, H - 56)
  return c
}

const lienHe = (s: Settings) => [s.shopPhone && '☎ ' + s.shopPhone, s.shopAddress].filter(Boolean).join('   ·   ')

// ================= Hoá đơn bán =================

export interface InvoiceParams {
  order: Order
  customer?: Customer
  settings: Settings
  /** Nợ cũ trước đơn này (dương = còn nợ, âm = khách đang trả dư) */
  oldDebt: number
  /** In dòng nợ cũ lên hoá đơn và cộng vào số phải trả */
  showDebt: boolean
}

/** Số khách phải trả theo hoá đơn này */
export function amountToPay(p: Pick<InvoiceParams, 'order' | 'oldDebt' | 'showDebt'>): number {
  return Math.max(0, orderTotal(p.order) - (p.order.paid || 0) + (p.showDebt ? p.oldDebt : 0))
}

/** Nội dung CK: ngày mua (ddmmyyyy) - tên khách CK Tuong ot. Tên dài thì cắt bớt để vừa 50 ký tự ngân hàng cho phép. */
export const transferNote = (order: Order, customer?: Customer) => {
  const [y, m, d] = order.date.split('-')
  const name = (customer?.name ?? '').trim().slice(0, 27).trim()
  return `${d}${m}${y} - ${name ? name + ' ' : ''}CK Tuong ot`
}

export function drawInvoice(p: InvoiceParams): Promise<HTMLCanvasElement> {
  const { order, customer, settings: s, oldDebt, showDebt } = p
  const paid = order.paid || 0
  const sums: Giay['sums'] = []
  if (order.discount) {
    sums.push({ label: 'Tiền hàng', value: money(orderSubtotal(order)) })
    sums.push({ label: 'Giảm giá', value: '− ' + money(order.discount), green: true })
  }
  sums.push({ label: 'Tổng đơn này', value: money(orderTotal(order)), bold: true })
  if (showDebt && oldDebt) sums.push({ label: oldDebt > 0 ? 'Nợ cũ' : 'Trả dư lần trước', value: (oldDebt > 0 ? '+ ' : '− ') + money(Math.abs(oldDebt)) })
  if (paid) sums.push({ label: 'Đã trả', value: '− ' + money(paid), green: true })
  return veGiay({
    tone: DO,
    shopName: s.shopName,
    shopContact: lienHe(s),
    title: 'HOÁ ĐƠN BÁN HÀNG',
    soVaNgay: `${invoiceNo(order.no)}  ·  ${fmtDate(order.date)}`,
    benLabel: 'Khách hàng',
    benName: customer?.name ?? '(khách lẻ)',
    benLine: [customer?.phone && '☎ ' + customer.phone, customer?.address].filter(Boolean).join('   ·   '),
    colPrice: 'Đơn giá',
    rows: order.items.filter((i) => i.qty > 0).map((i) => ({ name: i.name, qty: i.qty, price: i.price })),
    sums,
    due: amountToPay(p),
    dueLabel: 'CÒN PHẢI TRẢ',
    doneLabel: 'ĐÃ THANH TOÁN ĐỦ',
    bank: s.bankBin && s.bankAccount ? { bin: s.bankBin, bankName: s.bankName, account: s.bankAccount, holder: s.accountName, title: 'QUÉT MÃ ĐỂ CHUYỂN KHOẢN' } : undefined,
    qrNote: transferNote(order, customer),
    footer: s.invoiceNote,
  })
}

// ================= Phiếu nhập =================

export interface PurchaseParams {
  purchase: Purchase
  supplier?: Supplier
  settings: Settings
  /** Mình còn nợ người bán từ các phiếu trước */
  oldDebt: number
  showDebt: boolean
}

/** Số mình phải trả người bán theo phiếu này */
export function purchaseAmountToPay(p: Pick<PurchaseParams, 'purchase' | 'oldDebt' | 'showDebt'>): number {
  return Math.max(0, purchaseTotal(p.purchase) - (p.purchase.paid || 0) + (p.showDebt ? p.oldDebt : 0))
}

/** Nội dung chuyển khoản cho người bán: số phiếu + tên shop (để họ biết ai trả) */
export const purchaseTransferNote = (pu: Purchase, s: Settings) => `${purchaseNo(pu.no)} ${s.shopName}`.trim()

export function drawPurchase(p: PurchaseParams): Promise<HTMLCanvasElement> {
  const { purchase: pu, supplier: nb, settings: s, oldDebt, showDebt } = p
  const paid = pu.paid || 0
  const sums: Giay['sums'] = [{ label: 'Tổng phiếu này', value: money(purchaseTotal(pu)), bold: true }]
  if (showDebt && oldDebt) sums.push({ label: oldDebt > 0 ? 'Còn nợ lần trước' : 'Trả dư lần trước', value: (oldDebt > 0 ? '+ ' : '− ') + money(Math.abs(oldDebt)) })
  if (paid) sums.push({ label: 'Đã trả', value: '− ' + money(paid), green: true })
  return veGiay({
    tone: XANH,
    shopName: s.shopName,
    shopContact: lienHe(s),
    title: 'PHIẾU NHẬP HÀNG',
    soVaNgay: `${purchaseNo(pu.no)}  ·  ${fmtDate(pu.date)}`,
    benLabel: 'Người bán',
    benName: nb?.name ?? '(chưa ghi người bán)',
    benLine: [nb?.phone && '☎ ' + nb.phone, nb && `${nb.bankName} ${nb.bankAccount}`].filter(Boolean).join('   ·   '),
    colPrice: 'Giá nhập',
    rows: pu.items.filter((i) => i.qty > 0).map((i) => ({ name: i.name, qty: i.qty, price: i.unitCost })),
    sums,
    due: purchaseAmountToPay(p),
    dueLabel: 'CÒN PHẢI TRẢ',
    doneLabel: 'ĐÃ TRẢ ĐỦ',
    bank: nb?.bankBin && nb.bankAccount ? { bin: nb.bankBin, bankName: nb.bankName, account: nb.bankAccount, holder: nb.accountName, title: 'QUÉT MÃ ĐỂ TRẢ NGƯỜI BÁN' } : undefined,
    qrNote: purchaseTransferNote(pu, s),
    footer: pu.note ? 'Ghi chú: ' + pu.note : '',
  })
}

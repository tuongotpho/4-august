/**
 * Vẽ ảnh hoá đơn (PNG) để gửi khách qua Zalo/Messenger:
 * thông tin shop · khách · bảng hàng · tổng tiền · nợ cũ · còn phải trả · khối chuyển khoản có mã QR
 * (quét bằng app ngân hàng là tự điền MB 938118, số tiền, nội dung).
 */
import QRCode from 'qrcode'
import { fmtDate, invoiceNo, money, num, orderSubtotal, orderTotal, vietQrPayload } from './logic'
import type { Customer, Order, Settings } from './types'

export interface InvoiceParams {
  order: Order
  customer?: Customer
  settings: Settings
  /** Nợ cũ trước đơn này (dương = còn nợ, âm = khách đang trả dư) */
  oldDebt: number
  /** In dòng nợ cũ lên hoá đơn và cộng vào số phải trả */
  showDebt: boolean
}

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

/** Số khách phải trả theo hoá đơn này */
export function amountToPay(p: Pick<InvoiceParams, 'order' | 'oldDebt' | 'showDebt'>): number {
  return Math.max(0, orderTotal(p.order) - (p.order.paid || 0) + (p.showDebt ? p.oldDebt : 0))
}

export const transferNote = (order: Order, customer?: Customer) =>
  `${invoiceNo(order.no)} ${customer?.name ?? ''}`.trim()

export async function drawInvoice(p: InvoiceParams): Promise<HTMLCanvasElement> {
  const { order, customer, settings: s, oldDebt, showDebt } = p
  try {
    await Promise.all([document.fonts.load(f(400, 20)), document.fonts.load(f(700, 20)), document.fonts.load(f(800, 20))])
  } catch {
    /* không tải được phông thì dùng phông máy */
  }

  const W = 1080
  const PAD = 56
  const items = order.items.filter((i) => i.qty > 0)
  const subtotal = orderSubtotal(order)
  const total = orderTotal(order)
  const paid = order.paid || 0
  const due = amountToPay(p)
  const hasBank = !!(s.bankBin && s.bankAccount)

  // Tính chiều cao trước để vẽ đúng một lần
  const headerH = 230
  const custH = 150
  const tableH = 70 + items.length * 66
  const sumLines = 1 + (order.discount ? 2 : 0) + (showDebt && oldDebt ? 1 : 0) + (paid ? 1 : 0)
  const sumH = sumLines * 50 + 150
  const bankH = hasBank ? 420 : 0
  const footH = 120
  const H = headerH + custH + tableH + sumH + bankH + footH

  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  ctx.textBaseline = 'alphabetic'

  // Nền giấy
  ctx.fillStyle = '#fffdf9'
  ctx.fillRect(0, 0, W, H)

  // ---- Đầu hoá đơn: dải đỏ ớt ----
  const g = ctx.createLinearGradient(0, 0, W, headerH)
  g.addColorStop(0, '#b91c1c')
  g.addColorStop(1, '#7f1d1d')
  ctx.fillStyle = g
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
  ctx.fillText(fit(ctx, '🌶 ' + (s.shopName || 'Tương ớt'), W - PAD * 2), PAD, 92)
  ctx.font = f(500, 24)
  ctx.fillStyle = '#fecaca'
  const contact = [s.shopPhone && '☎ ' + s.shopPhone, s.shopAddress].filter(Boolean).join('   ·   ')
  if (contact) ctx.fillText(fit(ctx, contact, W - PAD * 2), PAD, 136)

  ctx.fillStyle = '#fff'
  ctx.font = f(800, 30)
  ctx.fillText('HOÁ ĐƠN BÁN HÀNG', PAD, 196)
  ctx.textAlign = 'right'
  ctx.font = f(600, 26)
  ctx.fillText(`${invoiceNo(order.no)}  ·  ${fmtDate(order.date)}`, W - PAD, 196)

  // ---- Khách hàng ----
  let y = headerH + 56
  ctx.textAlign = 'left'
  ctx.fillStyle = '#64748b'
  ctx.font = f(500, 22)
  ctx.fillText('Khách hàng', PAD, y)
  y += 42
  ctx.fillStyle = '#0f172a'
  ctx.font = f(800, 34)
  ctx.fillText(fit(ctx, customer?.name ?? '(khách lẻ)', W - PAD * 2), PAD, y)
  y += 36
  ctx.fillStyle = '#475569'
  ctx.font = f(400, 22)
  const cLine = [customer?.phone && '☎ ' + customer.phone, customer?.address].filter(Boolean).join('   ·   ')
  if (cLine) ctx.fillText(fit(ctx, cLine, W - PAD * 2), PAD, y)
  y = headerH + custH

  // ---- Bảng hàng ----
  const colQty = 600
  const colPrice = 800
  const colAmt = W - PAD
  roundRect(ctx, PAD - 16, y, W - PAD * 2 + 32, 56, 14)
  ctx.fillStyle = '#fee2e2'
  ctx.fill()
  ctx.fillStyle = '#7f1d1d'
  ctx.font = f(700, 22)
  ctx.textAlign = 'left'
  ctx.fillText('Mặt hàng', PAD, y + 37)
  ctx.textAlign = 'right'
  ctx.fillText('SL', colQty, y + 37)
  ctx.fillText('Đơn giá', colPrice, y + 37)
  ctx.fillText('Thành tiền', colAmt, y + 37)
  y += 56
  for (const it of items) {
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
    ctx.strokeStyle = '#f1e5e5'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(PAD, y)
    ctx.lineTo(W - PAD, y)
    ctx.stroke()
  }
  y += 14

  // ---- Tổng ----
  const line = (label: string, value: string, opt: { bold?: boolean; color?: string } = {}) => {
    y += 50
    ctx.textAlign = 'left'
    ctx.fillStyle = '#475569'
    ctx.font = f(opt.bold ? 700 : 500, 26)
    ctx.fillText(label, 520, y)
    ctx.textAlign = 'right'
    ctx.fillStyle = opt.color ?? '#0f172a'
    ctx.font = f(opt.bold ? 800 : 600, 26)
    ctx.fillText(value, W - PAD, y)
  }
  if (order.discount) {
    line('Tiền hàng', money(subtotal))
    line('Giảm giá', '− ' + money(order.discount), { color: '#047857' })
  }
  line('Tổng đơn này', money(total), { bold: true })
  if (showDebt && oldDebt) line(oldDebt > 0 ? 'Nợ cũ' : 'Trả dư lần trước', (oldDebt > 0 ? '+ ' : '− ') + money(Math.abs(oldDebt)))
  if (paid) line('Đã trả', '− ' + money(paid), { color: '#047857' })

  y += 30
  roundRect(ctx, 500, y, W - PAD - 500 + 16, 72, 18)
  ctx.fillStyle = due > 0 ? '#b91c1c' : '#047857'
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'left'
  ctx.font = f(700, 26)
  ctx.fillText(due > 0 ? 'CÒN PHẢI TRẢ' : 'ĐÃ THANH TOÁN ĐỦ', 524, y + 46)
  ctx.textAlign = 'right'
  ctx.font = f(800, 34)
  if (due > 0) ctx.fillText(money(due), W - PAD, y + 48)
  else ctx.fillText('✓', W - PAD, y + 48)
  y += 72 + 30

  // ---- Chuyển khoản + QR ----
  if (hasBank) {
    y += 10
    const boxH = 390
    roundRect(ctx, PAD - 16, y, W - PAD * 2 + 32, boxH, 28)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.strokeStyle = '#fca5a5'
    ctx.lineWidth = 3
    ctx.stroke()

    const qrSize = 330
    const qrX = PAD + 14
    const qrY = y + 30
    const qrCanvas = document.createElement('canvas')
    const note = transferNote(order, customer)
    await QRCode.toCanvas(qrCanvas, vietQrPayload(s.bankBin, s.bankAccount, due, note), {
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
    ctx.fillStyle = '#b91c1c'
    ctx.font = f(800, 28)
    ctx.fillText('QUÉT MÃ ĐỂ CHUYỂN KHOẢN', tx, ty)
    const row = (label: string, value: string, big = false) => {
      ty += big ? 62 : 54
      ctx.fillStyle = '#64748b'
      ctx.font = f(500, 20)
      ctx.fillText(label, tx, ty - (big ? 30 : 26))
      ctx.fillStyle = '#0f172a'
      ctx.font = f(big ? 800 : 700, big ? 36 : 26)
      ctx.fillText(fit(ctx, value, tw), tx, ty + 6)
    }
    row('Ngân hàng', s.bankName || 'MB Bank')
    row('Số tài khoản', s.bankAccount, true)
    row('Chủ tài khoản', s.accountName)
    if (due > 0) row('Số tiền · Nội dung', `${money(due)} · ${note}`)
    y += boxH + 20
  }

  // ---- Chân ----
  ctx.textAlign = 'center'
  ctx.fillStyle = '#7f1d1d'
  ctx.font = f('italic 500', 24)
  if (s.invoiceNote) ctx.fillText(fit(ctx, s.invoiceNote, W - PAD * 2), W / 2, H - 56)

  return c
}

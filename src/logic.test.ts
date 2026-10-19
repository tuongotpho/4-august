import { describe, expect, it } from 'vitest'
import {
  addDays,
  asciiNote,
  crc16,
  daysBetween,
  debtBefore,
  debtByCustomer,
  debtBySupplier,
  latestCost,
  nextPurchaseNo,
  purchaseDue,
  purchaseNo,
  purchaseTotal,
  supplierDebtBefore,
  lastMonths,
  monthStats,
  nextOrderNo,
  oldDebtOrders,
  openOrderDebts,
  stockAsOf,
  yearStats,
  yearsOf,
  orderProfit,
  orderTotal,
  predict,
  stockRows,
  vietQrPayload,
} from './logic'
import type { Customer, Order, Product, Purchase, Receipt, StockIn } from './types'

const P1: Product = { id: 'p1', name: 'Chai 1 lít', price: 50000, cost: 30000, lowStock: 10, order: 1 }
const P5: Product = { id: 'p5', name: 'Chai 500ml', price: 30000, cost: 18000, lowStock: 10, order: 2 }

let t = 0
const order = (o: Partial<Order> & { date: string; customerId?: string }): Order => ({
  id: 'o' + ++t,
  no: t,
  customerId: 'c1',
  items: [{ productId: 'p1', name: 'Chai 1 lít', qty: 10, price: 50000, cost: 30000 }],
  discount: 0,
  paid: 0,
  createdAt: t,
  ...o,
})
const receipt = (r: Partial<Receipt> & { date: string; amount: number }): Receipt => ({
  id: 'r' + ++t,
  customerId: 'c1',
  createdAt: t,
  ...r,
})
const C1: Customer = { id: 'c1', name: 'Quán Bà Hoa', createdAt: 0 }

describe('ngày tháng', () => {
  it('đếm ngày, cộng ngày qua tháng/năm', () => {
    expect(daysBetween('2026-01-30', '2026-02-02')).toBe(3)
    expect(addDays('2026-12-30', 5)).toBe('2027-01-04')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })
  it('lấy n tháng gần nhất qua năm', () => {
    expect(lastMonths('2026-02', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })
})

describe('tiền đơn hàng', () => {
  it('tổng, giảm giá, lãi', () => {
    const o = order({
      date: '2026-10-01',
      items: [
        { productId: 'p1', name: '1L', qty: 10, price: 50000, cost: 30000 },
        { productId: 'p5', name: '500', qty: 4, price: 30000, cost: 18000 },
      ],
      discount: 20000,
    })
    expect(orderTotal(o)).toBe(600000)
    expect(orderProfit(o)).toBe(600000 - 300000 - 72000)
  })
  it('số hoá đơn kế tiếp', () => {
    expect(nextOrderNo([])).toBe(1)
    expect(nextOrderNo([order({ date: '2026-01-01', no: 7 }), order({ date: '2026-01-02', no: 3 })])).toBe(8)
  })
})

describe('công nợ', () => {
  it('nợ = tiền đơn − trả ngay − thu nợ', () => {
    const orders = [order({ date: '2026-10-01', paid: 200000 }), order({ date: '2026-10-05', paid: 500000 })]
    const receipts = [receipt({ date: '2026-10-03', amount: 100000 })]
    expect(debtByCustomer({ orders, receipts }).get('c1')).toBe(300000 - 100000 + 0)
  })
  it('nợ cũ trước một đơn chỉ tính những gì xảy ra trước đó', () => {
    const o1 = order({ date: '2026-10-01', paid: 0 }) // nợ 500k
    const r1 = receipt({ date: '2026-10-02', amount: 200000 })
    const o2 = order({ date: '2026-10-03', paid: 0 })
    const o3 = order({ date: '2026-10-09', paid: 0 }) // sau o2 → không tính
    const d = { orders: [o1, o2, o3], receipts: [r1] }
    expect(debtBefore(d, o2)).toBe(300000)
    expect(debtBefore(d, o1)).toBe(0)
  })
  it('các đợt cũ còn nợ: tiền thu trừ vào đơn cũ nhất trước, tổng khớp nợ cũ', () => {
    const o1 = order({ date: '2026-10-01', paid: 0 }) // nợ 500k
    const o2 = order({ date: '2026-10-03', paid: 100000 }) // nợ 400k
    const r1 = receipt({ date: '2026-10-04', amount: 600000 }) // trả hết o1, 100k vào o2
    const o3 = order({ date: '2026-10-05', paid: 0 })
    const o4 = order({ date: '2026-10-09', paid: 0 })
    const d = { orders: [o4, o3, o2, o1], receipts: [r1] }
    const rows = oldDebtOrders(d, o4)
    expect(rows.map((r) => [r.order.id, r.left])).toEqual([
      [o2.id, 300000],
      [o3.id, 500000],
    ])
    expect(rows.reduce((s, r) => s + r.left, 0)).toBe(debtBefore(d, o4))
  })
  it('khách khác không lẫn vào', () => {
    const orders = [order({ date: '2026-10-01' }), order({ date: '2026-10-01', customerId: 'c2', paid: 500000 })]
    const m = debtByCustomer({ orders, receipts: [] })
    expect(m.get('c1')).toBe(500000)
    expect(m.get('c2')).toBe(0)
  })
})

describe('tồn kho', () => {
  it('tồn = nhập − bán, báo sắp hết', () => {
    const stockIns: StockIn[] = [
      { id: 's1', productId: 'p1', date: '2026-10-01', qty: 50, unitCost: 30000, createdAt: 1 },
      { id: 's2', productId: 'p5', date: '2026-10-01', qty: 100, unitCost: 18000, createdAt: 2 },
    ]
    const orders = [order({ date: '2026-10-02' }), order({ date: '2026-10-03', items: [{ productId: 'p1', name: '', qty: 35, price: 1, cost: 1 }] })]
    const rows = stockRows({ products: [P5, P1], orders, stockIns })
    expect(rows.map((r) => r.product.id)).toEqual(['p1', 'p5'])
    expect(rows[0]).toMatchObject({ inQty: 50, soldQty: 45, stock: 5, low: true })
    expect(rows[1]).toMatchObject({ stock: 100, low: false })
  })
})

describe('thống kê tháng', () => {
  it('cộng đúng tháng, bỏ đơn ngoài khoảng', () => {
    const orders = [order({ date: '2026-09-30' }), order({ date: '2026-10-01' }), order({ date: '2026-10-20' }), order({ date: '2025-01-01' })]
    const s = monthStats(orders, ['2026-09', '2026-10'])
    expect(s[0]).toMatchObject({ revenue: 500000, qty: 10, orders: 1 })
    expect(s[1]).toMatchObject({ revenue: 1000000, profit: 400000, qty: 20, orders: 2 })
  })
})

describe('dự đoán mua lại', () => {
  it('chưa đủ 2 lần mua thì không đoán', () => {
    const p = predict(C1, [order({ date: '2026-10-01' })], '2026-10-10')
    expect(p.status).toBe('unknown')
    expect(p.nextDate).toBeUndefined()
  })
  it('chu kỳ = trung vị khoảng cách, bỏ qua 1 lần lệch', () => {
    const dates = ['2026-08-01', '2026-08-08', '2026-08-15', '2026-09-20', '2026-09-27']
    const p = predict(C1, dates.map((date) => order({ date })), '2026-10-01')
    // khoảng cách 7,7,36,7 → trung vị 7
    expect(p.cycle).toBe(7)
    expect(p.nextDate).toBe('2026-10-04')
    expect(p.daysLeft).toBe(3)
    expect(p.status).toBe('soon')
  })
  it('quá hạn và chưa tới', () => {
    const orders = [order({ date: '2026-09-01' }), order({ date: '2026-09-11' })]
    expect(predict(C1, orders, '2026-09-25').status).toBe('overdue')
    expect(predict(C1, orders, '2026-09-12').status).toBe('later')
  })
  it('nhiều đơn cùng ngày tính là 1 lần mua, lượng TB theo lần', () => {
    const orders = [order({ date: '2026-09-01' }), order({ date: '2026-09-01' }), order({ date: '2026-09-11' })]
    const p = predict(C1, orders, '2026-09-12')
    expect(p.cycle).toBe(10)
    expect(p.avgQty).toBe(15)
    expect(p.avgByProduct.get('p1')).toBe(15)
  })
})

describe('mã QR VietQR', () => {
  it('CRC16-CCITT-FALSE đúng giá trị kiểm chuẩn', () => {
    expect(crc16('123456789')).toBe('29B1')
  })
  it('bỏ dấu nội dung chuyển khoản', () => {
    expect(asciiNote('Thanh toán HĐ0012 - Bà Hoa')).toBe('Thanh toan HD0012 - Ba Hoa')
  })
  it('chuỗi QR MB 938118 có số tiền', () => {
    const s = vietQrPayload('970422', '938118', 1250000, 'HD0012')
    expect(s.startsWith('000201010212')).toBe(true)
    expect(s).toContain('0010A000000727')
    expect(s).toContain('0006970422' + '0106938118')
    expect(s).toContain('0208QRIBFTTA')
    expect(s).toContain('5303704')
    expect(s).toContain('54071250000')
    expect(s).toContain('5802VN')
    expect(s).toContain('62100806HD0012')
    // CRC ở cuối khớp với phần trước nó
    expect(s.slice(-4)).toBe(crc16(s.slice(0, -4)))
    // độ dài trường 38 khớp nội dung
    const i = s.indexOf('38')
    const len = +s.slice(i + 2, i + 4)
    expect(s.slice(i + 4, i + 4 + len)).toBe('0010A00000072701200006970422010693811802' + '08QRIBFTTA')
  })
  it('không số tiền thì là QR tĩnh', () => {
    const s = vietQrPayload('970422', '938118', 0, '')
    expect(s.startsWith('000201010211')).toBe(true)
    expect(s).not.toContain('5407')
  })
})

describe('phiếu nhập & nợ người bán', () => {
  const pn = (x: Partial<Purchase> & { date: string }): Purchase => ({
    id: 'p' + ++t,
    no: t,
    supplierId: 'nb1',
    items: [{ productId: 'p1', name: 'Chai 1 lít', qty: 100, unitCost: 30000 }],
    paid: 0,
    createdAt: t,
    ...x,
  })
  it('tổng, còn nợ, số phiếu', () => {
    const a = pn({ date: '2026-10-01', paid: 1000000, items: [{ productId: 'p1', name: '', qty: 100, unitCost: 30000 }, { productId: 'p5', name: '', qty: 50, unitCost: 18000 }] })
    expect(purchaseTotal(a)).toBe(3900000)
    expect(purchaseDue(a)).toBe(2900000)
    expect(purchaseNo(7)).toBe('PN0007')
    expect(nextPurchaseNo([a, pn({ date: '2026-10-02', no: 41 })])).toBe(42)
  })
  it('nợ người bán cộng dồn, nợ cũ trước một phiếu', () => {
    const a = pn({ date: '2026-10-01', paid: 0 }) // 3tr
    const b = pn({ date: '2026-10-05', paid: 3000000 }) // trả đủ
    const c = pn({ date: '2026-10-09', paid: 1000000 }) // nợ 2tr
    const khac = pn({ date: '2026-10-02', supplierId: 'nb2' })
    expect(debtBySupplier([a, b, c, khac]).get('nb1')).toBe(5000000)
    expect(supplierDebtBefore([a, b, c, khac], c)).toBe(3000000)
    expect(supplierDebtBefore([a, b, c], a)).toBe(0)
  })
  it('tồn kho cộng cả phiếu nhập; giá vốn mới nhất lấy lần nhập sau cùng', () => {
    const stockIns: StockIn[] = [{ id: 's1', productId: 'p1', date: '2026-10-03', qty: 10, unitCost: 31000, createdAt: 1 }]
    const purchases = [pn({ date: '2026-10-01' }), pn({ date: '2026-10-08', items: [{ productId: 'p1', name: '', qty: 20, unitCost: 33000 }] })]
    expect(stockRows({ products: [P1], orders: [], stockIns, purchases })[0].stock).toBe(130)
    expect(latestCost({ stockIns, purchases }, 'p1')).toBe(33000)
    expect(latestCost({ stockIns, purchases: purchases.slice(0, 1) }, 'p1')).toBe(31000)
    expect(latestCost({ stockIns: [], purchases: [] }, 'p1')).toBeUndefined()
  })
})

describe('chốt sổ & thống kê năm', () => {
  it('nợ còn lại từng đơn: thu nợ trừ đơn cũ nhất trước, khách khác không lẫn', () => {
    const a = order({ date: '2026-01-05', paid: 0 }) // 500k
    const b = order({ date: '2026-02-05', paid: 0 }) // 500k
    const c = order({ date: '2026-02-06', customerId: 'c2', paid: 0 })
    const r = receipt({ date: '2026-03-01', amount: 700000 })
    const m = openOrderDebts({ orders: [b, c, a], receipts: [r] })
    expect(m.has(a.id)).toBe(false)
    expect(m.get(b.id)).toBe(300000)
    expect(m.get(c.id)).toBe(500000)
  })
  it('tồn sổ sách tại một ngày chỉ tính nhập/bán tới hết ngày đó', () => {
    const stockIns: StockIn[] = [{ id: 's', productId: 'p1', date: '2026-01-01', qty: 50, unitCost: 30000, createdAt: 1 }]
    const orders = [order({ date: '2026-12-31' }), order({ date: '2027-01-02' })] // mỗi đơn 10 chai p1
    expect(stockAsOf({ orders, stockIns }, '2026-12-31').get('p1')).toBe(40)
  })
  it('thống kê theo năm, năm trống giữa vẫn có dòng', () => {
    const orders = [order({ date: '2024-05-01' }), order({ date: '2026-03-01' }), order({ date: '2026-09-01' })]
    const ys = yearsOf(orders, '2026')
    expect(ys).toEqual(['2024', '2025', '2026'])
    const st = yearStats(orders, ys)
    expect(st.map((x) => x.orders)).toEqual([1, 0, 2])
    expect(st[2].revenue).toBe(1000000)
  })
})

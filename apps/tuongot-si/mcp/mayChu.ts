// Máy chủ MCP "tuongot-si": cho Claude / Codex… tra cứu và ghi sổ bán buôn tương ớt bằng ĐÚNG phần tính
// toán của web app (src/logic.ts) — số AI trả lời luôn khớp số trên màn hình.
// Làm việc bằng quyền của chính chủ shop đã đăng nhập (web.ts). Không có công cụ xoá: xoá làm trên web.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  byDateAsc,
  debtBefore,
  debtByCustomer,
  debtBySupplier,
  latestCost,
  nextPurchaseNo,
  purchaseDue,
  purchaseNo,
  purchaseTotal,
  fold,
  invoiceNo,
  lastMonths,
  monthOf,
  monthStats,
  nextOrderNo,
  orderDue,
  orderProfit,
  orderQty,
  orderTotal,
  costAt,
  priceWarnings,
  predict,
  predictAll,
  qtyByProduct,
  stockRows,
  today,
  type Prediction,
} from '../src/logic.ts'
import type { AppData, Customer, Order, OrderItem, Product, Purchase, PurchaseItem, Receipt } from '../src/types.ts'

export type Coll = 'customers' | 'products' | 'orders' | 'receipts' | 'stockIns' | 'suppliers' | 'purchases'

/** Nơi đọc/ghi dữ liệu — trên Vercel là Firestore (nguon.ts), trong bài kiểm là bộ nhớ */
export interface Kho {
  tai(): Promise<AppData>
  ghi(coll: Coll, id: string, du: Record<string, unknown>): Promise<void>
  nhatKy(d: { congCu: string; doiTuong: string; tenDoiTuong: string; tomTat: string }): Promise<void>
}

const HUONG_DAN = `Sổ bán buôn tương ớt của một cửa hàng nhỏ (chủ shop tự bán cho khách quen: quán ăn, tạp hoá).
- Hàng là các loại chai tương ớt (mặc định Chai 1 lít, Chai 500ml, Chai 330ml). Một giá bán buôn chung mỗi loại.
- Tiền: đồng (VND), số nguyên. Ngày: yyyy-mm-dd, giờ Việt Nam.
- Đơn (hoá đơn) số HĐ0001, HĐ0002…; mỗi đơn ghi khách trả ngay bao nhiêu → phần còn lại thành CÔNG NỢ.
  Nợ khách = Σ(tổng đơn − trả ngay) − Σ(tiền thu nợ). Âm = khách trả dư.
- Tồn kho = tổng nhập − tổng bán. Lãi = tiền bán − giá vốn lúc bán.
- Dự đoán mua lại: chu kỳ = trung vị khoảng cách các lần mua gần nhất; cần ≥ 2 lần mua, ít hơn thì "chưa đủ dữ liệu".
- Bắt đầu bằng tong_quan. Chỉ dùng số công cụ trả về; thiếu dữ liệu thì nói thiếu, KHÔNG đoán.
- Công cụ ghi (len_don, thu_no, nhap_hang, them_khach, sua_gia) thay đổi dữ liệu THẬT — chỉ gọi khi người dùng yêu cầu rõ; nói lại sẽ ghi gì trước khi ghi.
- Không có công cụ xoá / sửa đơn cũ — việc đó làm trên web app. Ảnh hoá đơn có mã QR cũng xuất trên web app (tab Đơn hàng → bấm đơn).
- Mọi lần ghi vào nhật ký; chủ shop xem và thu hồi quyền máy này ở Cài đặt → Kết nối AI trên web app.`

const json = (x: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(x, null, 1) }] })
const loi = (moTa: string) => ({ content: [{ type: 'text' as const, text: moTa }], isError: true })
const ngay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày dạng yyyy-mm-dd')
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

/** Tìm khách theo mã hoặc tên (không dấu, khớp một phần). Nhiều khách khớp → báo để AI hỏi lại. */
function timKhach(d: AppData, q: string): Customer | string {
  const byId = d.customers.find((c) => c.id === q)
  if (byId) return byId
  const f = fold(q.trim())
  const dung = d.customers.filter((c) => fold(c.name) === f)
  if (dung.length === 1) return dung[0]
  const gan = d.customers.filter((c) => fold(c.name).includes(f) || (c.phone && c.phone.replace(/\D/g, '') === q.replace(/\D/g, '')))
  if (gan.length === 1) return gan[0]
  if (!gan.length) return `Không có khách nào khớp "${q}". Dùng tim_khach để xem danh sách, hoặc them_khach nếu là khách mới.`
  return `Có ${gan.length} khách khớp "${q}": ${gan.map((c) => `${c.name} (${c.id})`).join('; ')}. Hỏi lại người dùng là khách nào rồi gửi đúng mã.`
}

function timLoai(d: AppData, q: string): Product | string {
  const byId = d.products.find((p) => p.id === q)
  if (byId) return byId
  const f = fold(q).replace(/\s+/g, '')
  const gan = d.products.filter((p) => {
    const n = fold(p.name).replace(/\s+/g, '')
    return n === f || n.includes(f) || n.replace(/^chai/, '') === f.replace(/^chai/, '').replace(/lit$/, 'lit')
  })
  if (gan.length === 1) return gan[0]
  return `Không xác định được loại hàng "${q}". Các loại: ${d.products.map((p) => `${p.name} (${p.id})`).join('; ')}`
}

const tomTatDuDoan = (p: Prediction, d: AppData) => ({
  khach: p.customer.name,
  ma_khach: p.customer.id,
  so_lan_mua: p.orders,
  lan_cuoi: p.lastDate ?? null,
  chu_ky_ngay: p.cycle ?? null,
  du_kien_mua: p.nextDate ?? null,
  con_ngay: p.daysLeft ?? null,
  trang_thai: { overdue: 'quá hạn', soon: 'sắp mua', later: 'chưa tới', unknown: 'chưa đủ dữ liệu' }[p.status],
  trung_binh_moi_lan: Object.fromEntries([...p.avgByProduct].map(([pid, q]) => [d.products.find((x) => x.id === pid)?.name ?? pid, Math.round(q * 10) / 10])),
})

const tomTatDon = (o: Order, d: AppData) => ({
  so_hd: invoiceNo(o.no),
  ma_don: o.id,
  ngay: o.date,
  khach: d.customers.find((c) => c.id === o.customerId)?.name ?? '(đã xoá)',
  hang: o.items.map((i) => `${i.name} × ${i.qty} @ ${i.price}`),
  so_chai: orderQty(o),
  giam_gia: o.discount || 0,
  tong: orderTotal(o),
  tra_ngay: o.paid || 0,
  con_thieu: orderDue(o),
  lai: orderProfit(o),
  ghi_chu: o.note,
})

export function taoMayChu(kho: Kho, bayGio: () => string = today) {
  const server = new McpServer({ name: 'tuongot-si', version: '1.0.0' }, { instructions: HUONG_DAN })

  // ---------------- ĐỌC ----------------

  server.registerTool(
    'tong_quan',
    { title: 'Tổng quan cửa hàng', description: 'Doanh thu / lãi / số chai tháng này và tháng trước, tổng công nợ, hàng sắp hết, khách sắp tới lượt mua, các loại hàng và giá.', inputSchema: {} },
    async () => {
      const d = await kho.tai()
      const now = bayGio()
      const [truoc, nay] = monthStats(d.orders, lastMonths(monthOf(now), 2))
      const no = debtByCustomer(d)
      const preds = predictAll(d, now)
      return json({
        hom_nay: now,
        cua_hang: d.settings.shopName,
        so_khach: d.customers.filter((c) => !c.inactive).length,
        so_don: d.orders.length,
        thang_nay: { thang: nay.month, doanh_thu: nay.revenue, lai: nay.profit, so_chai: nay.qty, so_don: nay.orders },
        thang_truoc: { thang: truoc.month, doanh_thu: truoc.revenue, lai: truoc.profit, so_chai: truoc.qty, so_don: truoc.orders },
        tong_cong_no: [...no.values()].reduce((s, x) => s + Math.max(0, x), 0),
        so_khach_dang_no: [...no.values()].filter((x) => x > 0).length,
        loai_hang: stockRows(d).map((r) => ({ ma: r.product.id, ten: r.product.name, gia_ban: r.product.price, gia_von: r.product.cost, ton: r.stock, sap_het: r.low, ngung_ban: !!r.product.inactive })),
        khach_toi_luot: preds.filter((p) => p.status === 'overdue' || p.status === 'soon').map((p) => tomTatDuDoan(p, d)),
      })
    },
  )

  server.registerTool(
    'tim_khach',
    { title: 'Tìm khách', description: 'Danh sách khách (lọc theo tên/SĐT/địa chỉ, gõ không dấu được) kèm nợ hiện tại, lần mua cuối, dự đoán lần mua tới.', inputSchema: { tu_khoa: z.string().optional().describe('Bỏ trống = tất cả') } },
    async ({ tu_khoa }) => {
      const d = await kho.tai()
      const no = debtByCustomer(d)
      const now = bayGio()
      const ds = d.customers
        .filter((c) => !tu_khoa || fold(`${c.name} ${c.phone ?? ''} ${c.address ?? ''}`).includes(fold(tu_khoa)))
        .map((c) => ({ ...tomTatDuDoan(predict(c, d.orders, now), d), sdt: c.phone, dia_chi: c.address, ghi_chu: c.note, ngung_theo_doi: !!c.inactive, dang_no: no.get(c.id) ?? 0 }))
      return json({ so_khach: ds.length, khach: ds })
    },
  )

  server.registerTool(
    'xem_khach',
    { title: 'Chi tiết một khách', description: 'Thông tin, công nợ, tổng đã mua, số chai theo tháng (12 tháng), dự đoán, lịch sử đơn và các lần thu nợ.', inputSchema: { khach: z.string().describe('Tên (một phần, không dấu được) hoặc mã khách') } },
    async ({ khach }) => {
      const d = await kho.tai()
      const c = timKhach(d, khach)
      if (typeof c === 'string') return loi(c)
      const now = bayGio()
      const don = d.orders.filter((o) => o.customerId === c.id).sort(byDateAsc)
      const thu = d.receipts.filter((r) => r.customerId === c.id).sort(byDateAsc)
      const months = lastMonths(monthOf(now), 12)
      return json({
        khach: { ma: c.id, ten: c.name, sdt: c.phone, dia_chi: c.address, ghi_chu: c.note, ngung_theo_doi: !!c.inactive },
        dang_no: debtByCustomer(d).get(c.id) ?? 0,
        tong_da_mua: don.reduce((s, o) => s + orderTotal(o), 0),
        tong_so_chai: don.reduce((s, o) => s + orderQty(o), 0),
        so_chai_theo_loai: Object.fromEntries([...qtyByProduct(don)].map(([pid, q]) => [d.products.find((p) => p.id === pid)?.name ?? pid, q])),
        so_chai_theo_thang: Object.fromEntries(monthStats(don, months).map((m) => [m.month, m.qty])),
        du_doan: tomTatDuDoan(predict(c, d.orders, now), d),
        don_hang: don.reverse().map((o) => tomTatDon(o, d)),
        thu_no: thu.reverse().map((r) => ({ ngay: r.date, so_tien: r.amount, ghi_chu: r.note })),
      })
    },
  )

  server.registerTool(
    'danh_sach_don',
    {
      title: 'Danh sách đơn',
      description: 'Các đơn bán (mới nhất trước), lọc theo khoảng ngày, khách, chỉ đơn còn nợ. Tối đa 200 đơn.',
      inputSchema: { tu_ngay: ngay.optional(), den_ngay: ngay.optional(), khach: z.string().optional().describe('Tên hoặc mã khách'), chi_con_no: z.boolean().optional() },
    },
    async ({ tu_ngay, den_ngay, khach, chi_con_no }) => {
      const d = await kho.tai()
      let cid: string | undefined
      if (khach) {
        const c = timKhach(d, khach)
        if (typeof c === 'string') return loi(c)
        cid = c.id
      }
      const ds = d.orders
        .filter((o) => (!tu_ngay || o.date >= tu_ngay) && (!den_ngay || o.date <= den_ngay) && (!cid || o.customerId === cid) && (!chi_con_no || orderDue(o) > 0))
        .sort(byDateAsc)
        .reverse()
      return json({
        so_don: ds.length,
        tong_tien: ds.reduce((s, o) => s + orderTotal(o), 0),
        tong_chai: ds.reduce((s, o) => s + orderQty(o), 0),
        don: ds.slice(0, 200).map((o) => tomTatDon(o, d)),
      })
    },
  )

  server.registerTool('cong_no', { title: 'Công nợ', description: 'Khách đang nợ (nhiều nhất trước) và khách đang trả dư.', inputSchema: {} }, async () => {
    const d = await kho.tai()
    const no = debtByCustomer(d)
    const ten = (id: string) => d.customers.find((c) => c.id === id)?.name ?? '(đã xoá)'
    const ds = [...no].filter(([, x]) => x !== 0).sort((a, b) => b[1] - a[1])
    return json({
      tong_no: ds.reduce((s, [, x]) => s + Math.max(0, x), 0),
      dang_no: ds.filter(([, x]) => x > 0).map(([id, x]) => {
        const conNo = d.orders.filter((o) => o.customerId === id && orderDue(o) > 0).sort(byDateAsc)
        return { khach: ten(id), ma_khach: id, so_tien: x, don_no_cu_nhat: conNo[0]?.date ?? null, sdt: d.customers.find((c) => c.id === id)?.phone }
      }),
      tra_du: ds.filter(([, x]) => x < 0).map(([id, x]) => ({ khach: ten(id), so_tien: -x })),
    })
  })

  server.registerTool('ton_kho', { title: 'Tồn kho', description: 'Tồn từng loại chai (nhập − bán), giá bán, giá vốn, cảnh báo sắp hết, 20 phiếu nhập gần nhất, mình còn nợ người bán bao nhiêu.', inputSchema: {} }, async () => {
    const d = await kho.tai()
    return json({
      ton: stockRows(d).map((r) => ({ ten: r.product.name, ma: r.product.id, da_nhap: r.inQty, da_ban: r.soldQty, ton: r.stock, bao_het_khi_con: r.product.lowStock, sap_het: r.low, gia_ban: r.product.price, gia_von: r.product.cost })),
      phieu_nhap_gan_nhat: [...d.purchases].sort(byDateAsc).reverse().slice(0, 20).map((p) => ({ so: purchaseNo(p.no), ngay: p.date, nguoi_ban: d.suppliers.find((x) => x.id === p.supplierId)?.name ?? null, hang: p.items.map((i) => `${i.name} × ${i.qty} @ ${i.unitCost}`), tong: purchaseTotal(p), da_tra: p.paid, con_no: purchaseDue(p) })),
      lan_nhap_le_cu: [...d.stockIns].sort(byDateAsc).reverse().slice(0, 20).map((s) => ({ ngay: s.date, loai: d.products.find((p) => p.id === s.productId)?.name, so_luong: s.qty, gia_von: s.unitCost, ghi_chu: s.note })),
      no_nguoi_ban: [...debtBySupplier(d.purchases)].filter(([, x]) => x !== 0).map(([id, x]) => ({ nguoi_ban: d.suppliers.find((s) => s.id === id)?.name ?? id, con_phai_tra: x })),
    })
  })

  server.registerTool(
    'thong_ke',
    { title: 'Thống kê theo tháng', description: 'Doanh thu, lãi, số chai, số đơn từng tháng; khách lấy nhiều nhất; cơ cấu loại chai — trong N tháng gần nhất.', inputSchema: { so_thang: z.number().int().min(1).max(36).optional().describe('Mặc định 6') } },
    async ({ so_thang }) => {
      const d = await kho.tai()
      const months = lastMonths(monthOf(bayGio()), so_thang ?? 6)
      const trong = d.orders.filter((o) => monthOf(o.date) >= months[0])
      const theoKhach = new Map<string, { tien: number; chai: number }>()
      for (const o of trong) {
        const x = theoKhach.get(o.customerId) ?? { tien: 0, chai: 0 }
        x.tien += orderTotal(o)
        x.chai += orderQty(o)
        theoKhach.set(o.customerId, x)
      }
      return json({
        theo_thang: monthStats(d.orders, months).map((m) => ({ thang: m.month, doanh_thu: m.revenue, lai: m.profit, so_chai: m.qty, so_don: m.orders })),
        khach_lay_nhieu: [...theoKhach].sort((a, b) => b[1].tien - a[1].tien).slice(0, 15).map(([id, x]) => ({ khach: d.customers.find((c) => c.id === id)?.name ?? '(đã xoá)', tien: x.tien, so_chai: x.chai })),
        theo_loai_chai: Object.fromEntries([...qtyByProduct(trong)].map(([pid, q]) => [d.products.find((p) => p.id === pid)?.name ?? pid, q])),
      })
    },
  )

  server.registerTool(
    'du_doan_mua_lai',
    { title: 'Dự đoán khách mua lại', description: 'Mỗi khách: chu kỳ mua, ngày dự kiến mua tiếp, còn/quá bao nhiêu ngày, lượng trung bình mỗi lần. Xếp quá hạn → sắp mua → chưa tới.', inputSchema: { chi_sap_mua: z.boolean().optional().describe('true = chỉ khách quá hạn hoặc còn ≤ 3 ngày') } },
    async ({ chi_sap_mua }) => {
      const d = await kho.tai()
      const ds = predictAll(d, bayGio()).filter((p) => !chi_sap_mua || p.status === 'overdue' || p.status === 'soon')
      return json({ hom_nay: bayGio(), khach: ds.map((p) => tomTatDuDoan(p, d)) })
    },
  )

  // ---------------- GHI ----------------

  server.registerTool(
    'len_don',
    {
      title: 'Lên đơn bán',
      description: 'Tạo đơn bán cho một khách ĐÃ CÓ. Giá mặc định lấy giá bán chung của loại hàng. Trả về số HĐ, tổng, nợ cũ, nợ sau đơn. Chỉ gọi khi người dùng yêu cầu rõ.',
      inputSchema: {
        khach: z.string().describe('Tên hoặc mã khách'),
        hang: z.array(z.object({ loai: z.string().describe('Tên loại (VD "1 lít", "500ml") hoặc mã'), so_luong: z.number().int().min(1), don_gia: z.number().int().min(0).optional().describe('Bỏ trống = giá chung') })).min(1),
        ngay: ngay.optional().describe('Mặc định hôm nay'),
        giam_gia: z.number().int().min(0).optional(),
        khach_tra: z.number().int().min(0).optional().describe('Khách trả ngay bao nhiêu (mặc định 0 = ghi nợ cả đơn)'),
        ghi_chu: z.string().max(200).optional(),
        bo_qua_canh_bao: z.boolean().optional().describe('true = người dùng đã xác nhận giá bất thường (giá < 1.000đ hoặc dưới giá vốn) là đúng'),
      },
    },
    async (a) => {
      const d = await kho.tai()
      const c = timKhach(d, a.khach)
      if (typeof c === 'string') return loi(c)
      const items: OrderItem[] = []
      const ngayBan = a.ngay ?? bayGio()
      for (const h of a.hang) {
        const p = timLoai(d, h.loai)
        if (typeof p === 'string') return loi(p)
        const gia = h.don_gia ?? p.price
        if (!gia) return loi(`Loại "${p.name}" chưa đặt giá bán — hỏi người dùng đơn giá hoặc dùng sua_gia trước.`)
        items.push({ productId: p.id, name: p.name, qty: h.so_luong, price: gia, cost: costAt(d, p.id, ngayBan) ?? p.cost })
      }
      const canhBao = priceWarnings(items)
      if (canhBao.length && !a.bo_qua_canh_bao)
        return loi(`Giá bất thường, CHƯA ghi đơn: ${canhBao.join('; ')}. Hỏi lại người dùng; đúng là giá đó thì gửi lại với bo_qua_canh_bao=true.`)
      const o: Order = { id: newId(), no: nextOrderNo(d.orders), customerId: c.id, date: ngayBan, items, discount: a.giam_gia ?? 0, paid: a.khach_tra ?? 0, note: a.ghi_chu?.trim() || undefined, createdAt: Date.now() }
      const noCu = debtBefore(d, o)
      await kho.ghi('orders', o.id, { ...o })
      const tom = `${items.map((i) => `${i.qty} ${i.name}`).join(', ')} = ${orderTotal(o)}đ, trả ${o.paid}đ`
      await kho.nhatKy({ congCu: 'len_don', doiTuong: `orders/${o.id}`, tenDoiTuong: `${invoiceNo(o.no)} · ${c.name}`, tomTat: tom })
      const ton = stockRows({ ...d, orders: [...d.orders, o] }).filter((r) => items.some((i) => i.productId === r.product.id))
      return json({
        da_tao: invoiceNo(o.no),
        khach: c.name,
        tong: orderTotal(o),
        tra_ngay: o.paid,
        no_cu: noCu,
        no_sau_don: noCu + orderDue(o),
        canh_bao_kho: ton.filter((r) => r.stock < 0 || r.low).map((r) => `${r.product.name}: còn ${r.stock}`),
        ghi_chu: 'Ảnh hoá đơn có QR: mở web app → Đơn hàng → bấm đơn này.',
      })
    },
  )

  server.registerTool(
    'thu_no',
    { title: 'Ghi thu nợ', description: 'Ghi một khoản khách trả nợ (không gắn với đơn). Chỉ gọi khi người dùng yêu cầu rõ.', inputSchema: { khach: z.string(), so_tien: z.number().int().min(1), ngay: ngay.optional(), ghi_chu: z.string().max(200).optional() } },
    async (a) => {
      const d = await kho.tai()
      const c = timKhach(d, a.khach)
      if (typeof c === 'string') return loi(c)
      const truoc = debtByCustomer(d).get(c.id) ?? 0
      const r: Receipt = { id: newId(), customerId: c.id, date: a.ngay ?? bayGio(), amount: a.so_tien, note: a.ghi_chu?.trim() || undefined, createdAt: Date.now() }
      await kho.ghi('receipts', r.id, { ...r })
      await kho.nhatKy({ congCu: 'thu_no', doiTuong: `receipts/${r.id}`, tenDoiTuong: c.name, tomTat: `Thu ${r.amount}đ ngày ${r.date}` })
      return json({ khach: c.name, no_truoc: truoc, da_thu: r.amount, no_con_lai: truoc - r.amount })
    },
  )

  server.registerTool(
    'nhap_hang',
    {
      title: 'Nhập hàng (tạo phiếu nhập)',
      description:
        'Tạo phiếu nhập hàng PN…: người bán (bỏ trống = người bán duy nhất nếu chỉ có một), các loại chai + số lượng + giá mua mỗi chai (bỏ trống = giá vốn hiện tại), đã trả người bán bao nhiêu. Giá mua mới cập nhật giá vốn của loại hàng. Ảnh phiếu có mã QR chuyển khoản cho người bán xuất trên web app (Kho → bấm phiếu). Chỉ gọi khi người dùng yêu cầu rõ.',
      inputSchema: {
        hang: z.array(z.object({ loai: z.string(), so_luong: z.number().int().min(1), gia_mua: z.number().int().min(0).optional() })).min(1),
        nguoi_ban: z.string().optional().describe('Tên hoặc mã người bán'),
        da_tra: z.number().int().min(0).optional().describe('Mình đã trả người bán bao nhiêu (mặc định 0 = nợ cả phiếu)'),
        ngay: ngay.optional(),
        ghi_chu: z.string().max(200).optional(),
      },
    },
    async (a) => {
      const d = await kho.tai()
      let supplierId: string | undefined
      if (a.nguoi_ban) {
        const f = fold(a.nguoi_ban)
        const ds = d.suppliers.filter((x) => x.id === a.nguoi_ban || fold(x.name).includes(f))
        if (ds.length !== 1) return loi(`Không xác định được người bán "${a.nguoi_ban}". Danh sách: ${d.suppliers.map((x) => `${x.name} (${x.id})`).join('; ') || '(chưa có — thêm trên web app, tab Kho)'}`)
        supplierId = ds[0].id
      } else if (d.suppliers.length === 1) supplierId = d.suppliers[0].id
      const items: PurchaseItem[] = []
      for (const h of a.hang) {
        const p = timLoai(d, h.loai)
        if (typeof p === 'string') return loi(p)
        items.push({ productId: p.id, name: p.name, qty: h.so_luong, unitCost: h.gia_mua ?? p.cost })
      }
      const pu: Purchase = { id: newId(), no: nextPurchaseNo(d.purchases), supplierId, date: a.ngay ?? bayGio(), items, paid: a.da_tra ?? 0, note: a.ghi_chu?.trim() || undefined, createdAt: Date.now() }
      await kho.ghi('purchases', pu.id, { ...pu })
      const sau = { ...d, purchases: [...d.purchases, pu] }
      for (const i of items) {
        const p = d.products.find((x) => x.id === i.productId)!
        const c = latestCost(sau, p.id)
        if (c !== undefined && c !== p.cost) await kho.ghi('products', p.id, { ...p, cost: c })
      }
      const ban = d.suppliers.find((x) => x.id === supplierId)
      await kho.nhatKy({ congCu: 'nhap_hang', doiTuong: `purchases/${pu.id}`, tenDoiTuong: `${purchaseNo(pu.no)}${ban ? ' · ' + ban.name : ''}`, tomTat: `${items.map((i) => `+${i.qty} ${i.name} @${i.unitCost}`).join(', ')}; trả ${pu.paid}đ` })
      return json({
        da_tao: purchaseNo(pu.no),
        nguoi_ban: ban?.name ?? null,
        tong_tien: purchaseTotal(pu),
        da_tra: pu.paid,
        con_no_phieu_nay: purchaseDue(pu),
        tong_no_nguoi_ban: ban ? (debtBySupplier(sau.purchases).get(ban.id) ?? 0) : null,
        ton_moi: Object.fromEntries(stockRows(sau).filter((r) => items.some((i) => i.productId === r.product.id)).map((r) => [r.product.name, r.stock])),
      })
    },
  )

  server.registerTool(
    'them_khach',
    { title: 'Thêm khách', description: 'Thêm khách mới. Nếu đã có khách trùng tên sẽ báo lại, cần gửi lại với cho_phep_trung=true sau khi hỏi người dùng.', inputSchema: { ten: z.string().min(1).max(80), sdt: z.string().max(20).optional(), dia_chi: z.string().max(200).optional(), ghi_chu: z.string().max(200).optional(), cho_phep_trung: z.boolean().optional() } },
    async (a) => {
      const d = await kho.tai()
      const trung = d.customers.find((c) => fold(c.name) === fold(a.ten.trim()))
      if (trung && !a.cho_phep_trung) return loi(`Đã có khách "${trung.name}" (${trung.id}). Hỏi người dùng có đúng là khách khác không rồi gửi lại với cho_phep_trung=true.`)
      const c: Customer = { id: newId(), name: a.ten.trim(), phone: a.sdt?.trim() || undefined, address: a.dia_chi?.trim() || undefined, note: a.ghi_chu?.trim() || undefined, createdAt: Date.now() }
      await kho.ghi('customers', c.id, { ...c })
      await kho.nhatKy({ congCu: 'them_khach', doiTuong: `customers/${c.id}`, tenDoiTuong: c.name, tomTat: 'Thêm khách mới' })
      return json({ da_them: c.name, ma_khach: c.id })
    },
  )

  server.registerTool(
    'sua_gia',
    { title: 'Sửa giá / mức báo hết', description: 'Đổi giá bán chung, giá vốn hoặc mức báo sắp hết của một loại hàng. Chỉ áp dụng cho đơn mới. Chỉ gọi khi người dùng yêu cầu rõ.', inputSchema: { loai: z.string(), gia_ban: z.number().int().min(0).optional(), gia_von: z.number().int().min(0).optional(), bao_het_khi_con: z.number().int().min(0).optional() } },
    async (a) => {
      const d = await kho.tai()
      const p = timLoai(d, a.loai)
      if (typeof p === 'string') return loi(p)
      const moi: Product = { ...p, price: a.gia_ban ?? p.price, cost: a.gia_von ?? p.cost, lowStock: a.bao_het_khi_con ?? p.lowStock }
      await kho.ghi('products', p.id, { ...moi })
      const doi = [a.gia_ban !== undefined && `giá bán ${p.price}→${moi.price}`, a.gia_von !== undefined && `giá vốn ${p.cost}→${moi.cost}`, a.bao_het_khi_con !== undefined && `báo hết ${p.lowStock}→${moi.lowStock}`].filter(Boolean).join(', ')
      await kho.nhatKy({ congCu: 'sua_gia', doiTuong: `products/${p.id}`, tenDoiTuong: p.name, tomTat: doi || 'không đổi' })
      return json({ loai: p.name, gia_ban: moi.price, gia_von: moi.cost, bao_het_khi_con: moi.lowStock })
    },
  )

  return server
}

/** Khách buôn quen */
export interface Customer {
  id: string
  name: string
  phone?: string
  address?: string
  note?: string
  /** Ngừng theo dõi (không hiện trong danh sách dự đoán, vẫn giữ lịch sử) */
  inactive?: boolean
  createdAt: number
}

/** Loại hàng — mặc định 3 cỡ chai: 1 lít, 500ml, 330ml */
export interface Product {
  id: string
  name: string
  /** Giá bán buôn chung (đồng/chai) */
  price: number
  /** Giá vốn hiện tại (đồng/chai) — tự cập nhật theo lần nhập gần nhất */
  cost: number
  /** Dưới mức này thì báo sắp hết hàng */
  lowStock: number
  order: number
  inactive?: boolean
}

export interface OrderItem {
  productId: string
  /** Chụp lại tên/giá/vốn lúc bán — sau này đổi giá không làm sai đơn cũ */
  name: string
  qty: number
  price: number
  cost: number
}

/** Đơn bán (một hoá đơn) */
export interface Order {
  id: string
  /** Số hoá đơn tăng dần: 1, 2, 3… (hiển thị HĐ0001) */
  no: number
  customerId: string
  /** yyyy-mm-dd */
  date: string
  items: OrderItem[]
  /** Giảm giá cả đơn (đồng) */
  discount: number
  /** Khách trả ngay khi lấy hàng (đồng) */
  paid: number
  note?: string
  createdAt: number
}

/** Khách trả nợ (thu tiền sau, không gắn với đơn) */
export interface Receipt {
  id: string
  customerId: string
  date: string
  amount: number
  note?: string
  createdAt: number
}

/** Nhập hàng / làm thêm một mẻ */
export interface StockIn {
  id: string
  productId: string
  date: string
  qty: number
  /** Giá vốn mỗi chai của mẻ này */
  unitCost: number
  note?: string
  createdAt: number
}

export interface Settings {
  shopName: string
  shopPhone: string
  shopAddress: string
  /** Mã ngân hàng theo chuẩn VietQR (MB = 970422) */
  bankBin: string
  bankName: string
  bankAccount: string
  accountName: string
  /** Lời cảm ơn cuối hoá đơn */
  invoiceNote: string
}

export const DEFAULT_SETTINGS: Settings = {
  shopName: 'Tương Ớt Phố',
  shopPhone: '',
  shopAddress: '',
  bankBin: '970422',
  bankName: 'MB Bank',
  bankAccount: '938118',
  accountName: 'LE VIET THANH',
  invoiceNote: 'Cảm ơn anh/chị đã tin dùng tương ớt!',
}

export const DEFAULT_PRODUCTS: Omit<Product, 'id'>[] = [
  { name: 'Chai 1 lít', price: 0, cost: 0, lowStock: 20, order: 1 },
  { name: 'Chai 500ml', price: 0, cost: 0, lowStock: 20, order: 2 },
  { name: 'Chai 330ml', price: 0, cost: 0, lowStock: 20, order: 3 },
]

export interface AppData {
  customers: Customer[]
  products: Product[]
  orders: Order[]
  receipts: Receipt[]
  stockIns: StockIn[]
  settings: Settings
}

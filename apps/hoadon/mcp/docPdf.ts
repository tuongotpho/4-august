// Đọc chữ trong PDF hóa đơn trên MÁY CHỦ (Node) — cùng cách ghép dòng + dò thông tin như web app (src/lib/pdfText.ts),
// chỉ khác là dùng bản "legacy" của pdfjs chạy được ngoài trình duyệt.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
// Nạp sẵn phần xử lý (worker) ngay trong máy chủ: Node không có Web Worker, và nạp tĩnh để Vercel đóng gói kèm
import * as worker from 'pdfjs-dist/legacy/build/pdf.worker.mjs'
import { groupLines, laBanNhap, parseInvoiceText, type PdfTextItem } from '../src/lib/invoicePdf.js'
import type { ParsedInvoice } from '../src/lib/invoiceXml.js'

;(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker

export async function pdfThanhDong(du: Uint8Array, toiDaTrang = 10): Promise<string[]> {
  // pdfjs "lấy mất" vùng nhớ được đưa vào -> đưa bản sao
  const viec = pdfjs.getDocument({ data: du.slice() })
  const doc = await viec.promise
  try {
    const dong: string[] = []
    for (let p = 1; p <= Math.min(doc.numPages, toiDaTrang); p++) {
      const nd = await (await doc.getPage(p)).getTextContent()
      dong.push(...groupLines(nd.items.filter((i) => 'str' in i) as PdfTextItem[]))
    }
    return dong
  } finally {
    await (viec as unknown as { destroy(): Promise<void> }).destroy()
  }
}

export type KetQuaPdf =
  | { loai: 'banNhap' }
  | { loai: 'khongDoc' } // PDF scan / ảnh, không có lớp chữ
  | { loai: 'ok'; hoaDon: Partial<ParsedInvoice> }

/** Giống readPdfInvoice của web app: bản nháp thì báo, dò được dưới 3 thông tin thì coi như không đọc được */
export async function docHoaDonPdf(du: Uint8Array): Promise<KetQuaPdf> {
  const dong = await pdfThanhDong(du)
  if (laBanNhap(dong)) return { loai: 'banNhap' }
  const { found, ...hoaDon } = parseInvoiceText(dong)
  return found < 3 ? { loai: 'khongDoc' } : { loai: 'ok', hoaDon }
}

// Lấy chữ trong PDF hoá đơn trên MÁY CHỦ / test (Node) — bản "legacy" của pdfjs chạy được ngoài trình duyệt.
// Cùng cách ghép dòng như web app (src/may/pdfChu.ts) nên ra cùng kết quả.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
// Node không có Web Worker: nạp sẵn phần xử lý ngay trong tiến trình
import * as worker from 'pdfjs-dist/legacy/build/pdf.worker.mjs'
import { ghepDong, type PdfTextItem } from '../src/core/hoaDonGoc.js'

;(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker

export async function pdfThanhDong(du: Uint8Array, toiDaTrang = 10): Promise<string[]> {
  const viec = pdfjs.getDocument({ data: du.slice() })
  const doc = await viec.promise
  try {
    const dong: string[] = []
    for (let p = 1; p <= Math.min(doc.numPages, toiDaTrang); p++) {
      const nd = await (await doc.getPage(p)).getTextContent()
      dong.push(...ghepDong(nd.items.filter((i) => 'str' in i) as PdfTextItem[]))
    }
    return dong
  } finally {
    await viec.destroy()
  }
}

// Lấy chữ trong PDF hoá đơn ngay trên trình duyệt (không gửi file đi đâu). Cùng cách ghép dòng với máy chủ (mcp/pdfChu.ts).
// Nạp pdfjs LÚC CẦN (lần đầu gặp file PDF) để trang mở nhanh như cũ.
import { ghepDong, type PdfTextItem } from '../core/hoaDonGoc'

let pdfjs: Promise<typeof import('pdfjs-dist')> | null = null
function napPdfjs() {
  pdfjs ??= (async () => {
    const [lib, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs')])
    // Chạy phần xử lý ngay trong trang (không tách luồng): app đóng gói thành 1 file HTML chạy được không cần mạng
    ;(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker
    return lib
  })()
  return pdfjs
}

export async function pdfThanhDong(du: ArrayBuffer, toiDaTrang = 10): Promise<string[]> {
  const lib = await napPdfjs()
  const viec = lib.getDocument({ data: new Uint8Array(du.slice(0)) })
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

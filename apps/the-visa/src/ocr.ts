// Đọc sao kê PDF ngay trong trình duyệt: pdf.js vẽ từng trang thành ảnh -> Tesseract nhận dạng chữ -> dựng kỳ.
// Sao kê không rời khỏi máy ở bước này (chỉ tải bộ nhận dạng chữ từ CDN về).
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url'
import { createWorker } from 'tesseract.js'
import { dungKy, type KetQuaDoc } from '../shared/docSaoKe'
import type { Chu } from '../shared/kieu'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
const DPI = 200
const TRANG_TOI_DA = 8

export async function docSaoKe(file: File, baoTienDo: (s: string) => void): Promise<KetQuaDoc & { soTrang: number }> {
  baoTienDo('Đang mở file PDF…')
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  baoTienDo('Đang nạp bộ nhận dạng chữ (lần đầu hơi lâu)…')
  const worker = await createWorker('eng')
  await worker.setParameters({ preserve_interword_spaces: '1' })
  const trang: { chu: Chu[]; rong: number }[] = []
  try {
    for (let p = 1; p <= Math.min(pdf.numPages, TRANG_TOI_DA); p++) {
      baoTienDo(`Đang đọc trang ${p}/${pdf.numPages}…`)
      const page = await pdf.getPage(p)
      const vp = page.getViewport({ scale: DPI / 72 })
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(vp.width)
      canvas.height = Math.round(vp.height)
      await page.render({ canvas, viewport: vp }).promise
      const { data } = await worker.recognize(canvas, {}, { blocks: true })
      const chu: Chu[] = []
      for (const b of data.blocks ?? []) for (const pa of b.paragraphs) for (const l of pa.lines) for (const w of l.words)
        chu.push({ text: w.text, x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 })
      trang.push({ chu, rong: canvas.width })
      // Bảng giao dịch kết thúc ở dòng tổng "Đã thanh toán" cuối bảng: các trang sau là điều khoản, bỏ qua
      if (dungKy(trang).hetBang) break
    }
  } finally {
    await worker.terminate()
  }
  return { ...dungKy(trang, file.name), soTrang: trang.length }
}

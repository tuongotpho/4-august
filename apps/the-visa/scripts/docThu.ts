// Đọc thử ảnh trang sao kê bằng OCR trên máy (Node) và đối chiếu.
// Cách chạy: npm run doc-thu -- <thư mục ảnh> <tiền tố, vd SKT5> [file .tsv đã kiểm tay]
// Ảnh: <tiền tố>_p1.png, _p2.png ... (trang đã render sẵn). Không đưa ảnh/sao kê vào repo.
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createWorker } from 'tesseract.js'
import { dungKy } from '../shared/docSaoKe.js'
import { doiChieu } from '../shared/doiChieu.js'
import type { Chu } from '../shared/kieu.js'

const [thuMuc, tienTo, tsv] = process.argv.slice(2)
const worker = await createWorker('eng')
await worker.setParameters({ preserve_interword_spaces: '1' })
const trang: { chu: Chu[]; rong: number }[] = []
for (let p = 1; existsSync(join(thuMuc, `${tienTo}_p${p}.png`)); p++) {
  const { data } = await worker.recognize(join(thuMuc, `${tienTo}_p${p}.png`), {}, { blocks: true })
  const chu: Chu[] = []
  for (const b of data.blocks ?? []) for (const pa of b.paragraphs) for (const l of pa.lines) for (const w of l.words)
    chu.push({ text: w.text, x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 })
  const rong = readFileSync(join(thuMuc, `${tienTo}_p${p}.png`)).readUInt32BE(16) // bề rộng ghi trong đầu file PNG
  trang.push({ chu, rong })
}
await worker.terminate()
const { ky, loi } = dungKy(trang, tienTo)
if (!ky) { console.log('LỖI', loi); process.exit(1) }
const dc = doiChieu(ky)
console.log(tienTo, ky.id, 'gd', ky.giaoDich.length, 'han', ky.hanTra, ky.toiThieu, 'hanMuc', ky.hanMuc, dc.khop ? 'KHỚP' : 'LỆCH', loi)
for (const m of dc.muc) console.log('  ', m.ten, m.saoKe, m.docDuoc, m.khop ? '✔' : '✘')
for (const g of ky.giaoDich.filter((g) => g.nghiSai)) console.log('  nghi:', g.ngay, g.moTa, g.nghiSai)
if (tsv) {
  const dung = readFileSync(tsv, 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'))
  let sai = 0
  dung.forEach(([d, mo, tien], i) => {
    const g = ky.giaoDich[i]
    const ngay = `20${d.slice(6, 8)}-${d.slice(3, 5)}-${d.slice(0, 2)}`
    if (!g || g.ngay !== ngay || g.soTien !== Number(tien)) { sai++; console.log('  KHÁC dòng', i + 1, d, mo, tien, '| OCR:', g?.ngay, g?.moTa, g?.soTien) }
  })
  if (ky.giaoDich.length !== dung.length) console.log('  số dòng OCR', ky.giaoDich.length, 'đúng', dung.length)
  console.log('  sai so với bản kiểm tay:', sai, '/', dung.length)
}

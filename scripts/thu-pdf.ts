// Chạy thử bộ đọc PDF trên 1 file: npx tsx scripts/thu-pdf.ts <đường dẫn pdf>
import { readFileSync } from 'node:fs'
import { pdfThanhDong } from '../mcp/docPdf.js'
import { parseInvoiceText } from '../src/lib/invoicePdf.js'

const dong = await pdfThanhDong(new Uint8Array(readFileSync(process.argv[2])))
if (process.argv.includes('--dong')) dong.forEach((l, i) => console.log(i, JSON.stringify(l)))
console.log(parseInvoiceText(dong))

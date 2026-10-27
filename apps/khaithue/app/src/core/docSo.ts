// Đọc số tiền bằng chữ tiếng Việt — dòng "Viết bằng chữ" trên phiếu thu / phiếu chi.
// 1.205.000 -> "Một triệu hai trăm linh năm nghìn đồng"

const SO = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
const DON_VI = ['', ' nghìn', ' triệu', ' tỷ']

/** Đọc nhóm 3 chữ số. `day` = có nhóm lớn hơn đứng trước (phải đọc đủ "không trăm", "linh") */
function docBa(n: number, day: boolean): string {
  const tr = Math.floor(n / 100)
  const ch = Math.floor((n % 100) / 10)
  const dv = n % 10
  const ra: string[] = []
  if (tr || day) ra.push(`${SO[tr]} trăm`)
  if (ch === 0) {
    if (dv && (tr || day)) ra.push('linh')
  } else if (ch === 1) ra.push('mười')
  else ra.push(`${SO[ch]} mươi`)
  if (dv) {
    if (dv === 1 && ch >= 2) ra.push('mốt')
    else if (dv === 5 && ch >= 1) ra.push('lăm')
    else ra.push(SO[dv])
  }
  return ra.join(' ')
}

/** Số nguyên không âm -> chữ (chưa có "đồng"). Hỗ trợ tới hàng nghìn tỷ. */
export function docSo(n: number): string {
  n = Math.round(Math.abs(n))
  if (n === 0) return 'không'
  // tách theo tỷ: phần trên tỷ đọc lại như một số rồi thêm "tỷ"
  if (n >= 1e9) {
    const ty = Math.floor(n / 1e9)
    const du = n % 1e9
    return `${docSo(ty)} tỷ${du ? ` ${docDuoiTy(du, true)}` : ''}`
  }
  return docDuoiTy(n, false)
}

function docDuoiTy(n: number, day: boolean): string {
  const nhom = [n % 1000, Math.floor(n / 1000) % 1000, Math.floor(n / 1e6) % 1000]
  let cao = 2
  while (cao > 0 && nhom[cao] === 0) cao--
  const ra: string[] = []
  for (let i = cao; i >= 0; i--) {
    if (nhom[i] === 0) continue
    ra.push(docBa(nhom[i], day || i < cao) + DON_VI[i])
  }
  return ra.join(' ')
}

/** "Một triệu hai trăm linh năm nghìn đồng" — viết hoa chữ đầu, như trên chứng từ */
export function tienBangChu(n: number): string {
  const s = `${docSo(n)} đồng`
  return s.charAt(0).toUpperCase() + s.slice(1)
}

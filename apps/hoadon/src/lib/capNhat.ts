// Phân biệt "web vừa có bản mới" với "trình duyệt máy này không chạy được một phần code".
// Trước đây mọi lần nạp phần code lỗi đều bị coi là "có bản cập nhật" → điện thoại trình duyệt cũ hỏi tải lại mãi.

/** Có bản mới trên mạng thật không: so tên file chạy chính của trang đang mở với trang trên máy chủ (đọc mới, không đệm). */
export async function coBanMoi(): Promise<boolean> {
  if (typeof document === 'undefined') return false
  const dangChay = [...document.scripts].map((s) => s.src).find((s) => /\/assets\/index-[\w-]+\.js/.test(s))
  if (!dangChay) return false
  try {
    // './' = trang gốc của app (ở địa chỉ riêng là '/', qua cổng là '/hoa-don/')
    const html = await (await fetch('./', { cache: 'no-store' })).text()
    const tenMoi = html.match(/assets\/index-[\w-]+\.js/)?.[0]
    return !!tenMoi && !dangChay.endsWith(tenMoi)
  } catch {
    return false // mất mạng: không kết luận là có bản mới
  }
}

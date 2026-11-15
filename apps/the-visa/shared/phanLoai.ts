// Tự phân loại giao dịch theo mô tả trên sao kê. Người dùng có thể đè bằng nhomTay.
import type { GiaoDich, Ky } from './kieu.js'

export const NHOM_TRA_NO = 'Trả nợ thẻ'

/** Thứ tự quan trọng: luật đầu tiên khớp sẽ thắng */
export const LUAT: { nhom: string; mau: RegExp; mau_sac: string }[] = [
  { nhom: 'Bảo hiểm', mau: /MANULIFE|PRUDENTIAL|BAO VIET|\bAIA\b|DAI-ICHI|BAO HIEM/i, mau_sac: '#0f766e' },
  { nhom: 'Xăng xe', mau: /PLX_|PTC_|PETROLIMEX|PVOIL|XANG/i, mau_sac: '#2563eb' },
  { nhom: 'Mua sắm online', mau: /Shopee|LAZADA|TIKI|TIKTOK/i, mau_sac: '#ea580c' },
  { nhom: 'Siêu thị & tạp hoá', mau: /WINMART|WCM_|\b5644\b|BACHHOAXANH|GO!? VINH|\bGO VINH|ST D2|ST NGOCKHANH|HOMEFARM|HNPMC|CIRCLE K|CO\.?OP/i, mau_sac: '#16a34a' },
  { nhom: 'Thuốc & y tế', mau: /LONGCHAU|LONG CHAU|PHARMACITY|NHA THUOC|BENH VIEN/i, mau_sac: '#dc2626' },
  { nhom: 'Ăn uống & cà phê', mau: /PHE LA|DOMINOS|HIGHLANDS|LEGEND|SOIBIEN|KFC|PIZZA|STARBUCKS|COFFEE|CAFE/i, mau_sac: '#db2777' },
  { nhom: 'Sửa điện thoại', mau: /CONG TY DTV|DIEN THOAI VUI/i, mau_sac: '#9333ea' },
  { nhom: 'Viễn thông', mau: /VIETTEL|VINAPHONE|MOBIFONE|VNPT|FPT TELECOM/i, mau_sac: '#ca8a04' },
  { nhom: 'Kính mắt', mau: /KINH MAT/i, mau_sac: '#64748b' },
  { nhom: 'Chuyển tiền qua VPBank NEO', mau: /Pay2Card/i, mau_sac: '#0891b2' },
]
export const NHOM_KHAC = 'Khác (chưa rõ)'
export const MAU_KHAC = '#94a3b8'

export const MAU_NHOM: Record<string, string> = Object.fromEntries([...LUAT.map((l) => [l.nhom, l.mau_sac]), [NHOM_KHAC, MAU_KHAC]])
export const DS_NHOM = [...LUAT.map((l) => l.nhom), NHOM_KHAC]

const TEN: [RegExp, string][] = [
  [/MANULIFE/i, 'Manulife'], [/PHE LA/i, 'Phê La'], [/DOMINOS/i, "Domino's Pizza"], [/HIGHLANDS/i, 'Highlands Coffee'],
  [/LEGEND/i, 'Trung Nguyên Legend'], [/SOIBIEN/i, 'Sói Biển'], [/Shopee/i, 'Shopee'], [/LONGCHAU|LONG CHAU/i, 'Nhà thuốc Long Châu'],
  [/ST D2 GIANGVO/i, 'Cửa hàng D2 Giảng Võ'], [/ST NGOCKHANH/i, 'Cửa hàng Ngọc Khánh'], [/WINMART|WCM_|\b5644\b/i, 'WinMart'],
  [/GO!? VINH|\bGO VINH/i, 'GO! Vĩnh Phúc'], [/PLX_|PTC_/i, 'Petrolimex'], [/Pay2Card/i, 'Pay2Card (NEO)'], [/MYVIETTEL/i, 'My Viettel'],
  [/KINH MAT/i, 'Kính mắt Việt Tín'], [/CONG TY DTV/i, 'Điện Thoại Vui'], [/HOMEFARM/i, 'Homefarm'], [/HNPMC/i, 'HNPMC'],
  [/BACHHOAXANH/i, 'Bách Hoá Xanh'], [/Virtual Card payment/i, 'Trả nợ thẻ'],
]

const KHU_VUC: [RegExp, string][] = [
  [/^(HA NOI|HANOI|HNO|Q THANH XUAN)\b/i, 'Hà Nội'], [/^VINH PHUC/i, 'Vĩnh Phúc'], [/^PHU THO/i, 'Phú Thọ'], [/^SON LA/i, 'Sơn La'],
  [/^THANH HOA/i, 'Thanh Hoá'], [/^BINH DINH/i, 'Bình Định / Gia Lai'], [/^DA NANG/i, 'Đà Nẵng'], [/^HUE/i, 'Huế'], [/^NGHE AN/i, 'Nghệ An'],
  [/^QUANG NINH/i, 'Quảng Ninh'], [/^HUNG YEN/i, 'Hưng Yên'], [/^HAI PHONG/i, 'Hải Phòng / Hải Dương'], [/^BAC NINH/i, 'Bắc Ninh'],
]

const goc = (moTa: string) => moTa.replace(/^(Retail|Credit)\s+VNM\s+/i, '')

export function nhomTuDong(moTa: string): string {
  return LUAT.find((l) => l.mau.test(moTa))?.nhom ?? NHOM_KHAC
}
export function tenNoiChi(moTa: string): string {
  return TEN.find(([m]) => m.test(moTa))?.[1] ?? goc(moTa)
}
export function khuVuc(moTa: string): string {
  if (/I2B|Pay2Card|Virtual Card|SPEEPAY|Shopee|TPHCM CUA HANG|LONG ?CHAU/i.test(moTa)) return 'Online'
  return KHU_VUC.find(([m]) => m.test(goc(moTa)))?.[1] ?? 'Khác'
}

/** Ghi có là trả nợ thẻ (không phải chi tiêu) hay hoàn tiền của cửa hàng (trừ vào chi tiêu)? */
export const laTraNo = (g: GiaoDich) => g.soTien > 0 && !/^Credit\s+VNM/i.test(g.moTa)

/** Một khoản chi đã phân loại. tien > 0 = chi, < 0 = hoàn tiền */
export interface KhoanChi {
  kyId: string
  g: GiaoDich
  ngay: string
  tien: number
  nhom: string
  ten: string
  khuVuc: string
}

export function dsKhoanChi(ky: Ky[]): KhoanChi[] {
  return ky.flatMap((k) =>
    k.giaoDich.filter((g) => !laTraNo(g)).map((g) => ({
      kyId: k.id, g, ngay: g.ngay, tien: -g.soTien,
      nhom: g.nhomTay || nhomTuDong(g.moTa), ten: tenNoiChi(g.moTa), khuVuc: khuVuc(g.moTa),
    })),
  )
}

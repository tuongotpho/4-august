// XUẤT FILE XML BÁO CÁO TÀI CHÍNH theo đúng khung của HTKK 5.8.1 (đọc từ bộ cài: menu.xml + các file .xsd), để nạp vào HTKK
// hoặc nộp trên thuedientu.gdt.gov.vn (file CHƯA ký số — ký bằng USB token khi nộp).
//   Mẫu 683  "Bộ báo cáo tài chính (B01a - DNN)(TT133/2016/TT-BTC)"   — khung 133_B01A_DNN_BCTC, phiên bản XML 2.3.2
//            phần chính B01a (47 ô: Thuyết minh / Số cuối năm / Số đầu năm) + PL_KQHDSXKD (B02-DNN, 16 ô) + PL_LCTTTT (B03-DNN trực tiếp, 24 ô).
//            PL_CDTK (Bảng cân đối tài khoản F01-DNN) khung cho phép bỏ trống; app chưa lập — xem ghi chú ở giao diện.
//   Mẫu 1280 "Bộ báo cáo tài chính năm (TT58/2026/TT-BTC)"           — khung 58_BCTC, phiên bản XML 3.0.5
//            phần chính B01-DNSN (14 ô) + PL_BCKQHDKD (B02-DNSN, 5 ô).
// Thứ tự thẻ, tên thẻ chép từ .xsd của HTKK; kiểm lại bằng `npm run kiem-xsd` (lxml) với khung của HTKK.
import type { SoLieuBctc } from './bctc.js'
import type { HoSoDN } from './types.js'
import { dinhDang, esc } from './xml.js'

/** Phiên bản HTKK có các mẫu BCTC này (mẫu TT58 chỉ có từ HTKK 5.8.1) */
const DICH_VU_BCTC = { maDVu: 'HTKK', tenDVu: 'HỖ TRỢ KÊ KHAI THUẾ', pbanDVu: '5.8.1', ttinNhaCCapDVu: '' }

interface MauXml {
  maTKhai: string
  tenTKhai: string
  moTaBMau: string
  pban: string
  maFile: string
}

export const MAU_XML_BCTC: Record<'TT133' | 'TT58', MauXml> = {
  TT133: {
    maTKhai: '683',
    tenTKhai: 'Bộ báo cáo tài chính (B01a - DNN)(TT133/2016/TT-BTC)',
    moTaBMau: '(Ban hành theo Thông tư số 133/2016/TT-BTC ngày 26/8/2016 của Bộ Tài chính)',
    pban: '2.3.2',
    maFile: '133_B01A_DNN_BCTC',
  },
  TT58: {
    maTKhai: '1280',
    tenTKhai: 'Bộ báo cáo tài chính năm (TT58/2026/TT-BTC)',
    moTaBMau: '(Kèm theo Thông tư số 58/2026/TT-BTC ngày 25 tháng 5 năm 2026 của Bộ trưởng Bộ Tài chính)',
    pban: '3.0.5',
    maFile: '58_BCTC',
  },
}

// Thứ tự ô theo .xsd của HTKK
const O_B01A = ['110', '120', '121', '122', '123', '124', '130', '131', '132', '133', '134', '135', '136', '140', '141', '142', '150', '151', '152', '160', '161', '162',
  '170', '180', '181', '182', '200', '300', '311', '312', '313', '314', '315', '316', '317', '318', '319', '320', '400', '411', '412', '413', '414', '415', '416', '417', '500']
const O_B02_133 = ['01', '02', '10', '11', '20', '21', '22', '23', '24', '30', '31', '32', '40', '50', '51', '60']
const O_B03TT_133 = ['01', '02', '03', '04', '05', '06', '07', '20', '21', '22', '23', '24', '25', '30', '31', '32', '33', '34', '35', '40', '50', '60', '61', '70']
const O_B01_DNSN = ['110', '120', '130', '140', '150', '200', '300', '310', '320', '400', '410', '420', '430', '500']
const O_B02_DNSN = ['01', '02', '03', '10', '20']

const the = (tag: string, v: string | number | undefined | null) => (v === undefined || v === null || v === '' ? `<${tag}/>` : `<${tag}>${esc(v)}</${tag}>`)
/** Khối số: mỗi ô một thẻ ctXXX, thiếu số ghi 0 (khung kiểu long) */
const khoiSo = (ten: string, o: string[], so: Record<string, number>) => `<${ten}>\n${o.map((m) => `<ct${m}>${Math.round(so[m] ?? 0)}</ct${m}>`).join('\n')}\n</${ten}>`
/** Cột "Thuyết minh": để trống như HTKK khi không ghi số thuyết minh */
const khoiTrong = (ten: string, o: string[]) => `<${ten}>\n${o.map((m) => `<ct${m}/>`).join('\n')}\n</${ten}>`
const dmy = (d: string) => d // dd/MM/yyyy giữ nguyên
const ddmmyyyy = (d: string) => d.replace(/\//g, '')

function phanChung(mau: MauXml, b: SoLieuBctc, dn: HoSoDN, ngayLap: string) {
  return `<TTinChung>
<TTinDVu>
${the('maDVu', DICH_VU_BCTC.maDVu)}
${the('tenDVu', DICH_VU_BCTC.tenDVu)}
${the('pbanDVu', DICH_VU_BCTC.pbanDVu)}
${the('ttinNhaCCapDVu', DICH_VU_BCTC.ttinNhaCCapDVu)}
</TTinDVu>
<TTinTKhaiThue>
<TKhaiThue>
${the('maTKhai', mau.maTKhai)}
${the('tenTKhai', mau.tenTKhai)}
${the('moTaBMau', mau.moTaBMau)}
${the('pbanTKhaiXML', mau.pban)}
<loaiTKhai>C</loaiTKhai>
<soLan>0</soLan>
<KyKKhaiThue>
<kieuKy>Y</kieuKy>
${the('kyKKhai', b.nam)}
${the('kyKKhaiTuNgay', dmy(b.tuNgay))}
${the('kyKKhaiDenNgay', dmy(b.denNgay))}
<kyKKhaiTuThang/>
<kyKKhaiDenThang/>
</KyKKhaiThue>
${the('maCQTNoiNop', dn.maCQTNoiNop)}
${the('tenCQTNoiNop', dn.tenCQTNoiNop)}
${the('ngayLapTKhai', ngayLap)}
<GiaHan>
<maLyDoGiaHan/>
<lyDoGiaHan/>
</GiaHan>
${the('nguoiKy', dn.nguoiKy)}
${the('ngayKy', ngayLap)}
<nganhNgheKD/>
</TKhaiThue>
<NNT>
${the('mst', dn.mst)}
${the('tenNNT', dn.tenNNT)}
${the('dchiNNT', dn.dchiNNT)}
${the('phuongXa', dn.phuongXa)}
<maHuyenNNT/>
<tenHuyenNNT/>
${the('maTinhNNT', dn.maTinhNNT)}
${the('tenTinhNNT', dn.tenTinhNNT)}
${the('dthoaiNNT', dn.dthoaiNNT)}
<faxNNT/>
${the('emailNNT', dn.emailNNT)}
</NNT>
</TTinTKhaiThue>
</TTinChung>`
}

const bocNgoai = (noiDung: string) => `<?xml version="1.0" encoding="UTF-8"?>
<HSoThueDTu xmlns="http://kekhaithue.gdt.gov.vn/TKhaiThue" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<HSoKhaiThue id="_NODE_TO_SIGN">
${noiDung}
</HSoKhaiThue>
</HSoThueDTu>
`

export interface NguoiKyBctc {
  nguoiLapBieu?: string
  keToanTruong?: string
}

/** Mẫu 683 — BCTC theo TT133 (B01a-DNN + B02-DNN + B03-DNN trực tiếp) */
export function xmlBctcTT133(b: SoLieuBctc, dn: HoSoDN, ngayLap: string, ky: NguoiKyBctc = {}): string {
  if (b.cheDo !== 'TT133') throw new Error('Cần BCTC đã đổi sang mẫu TT133')
  const mau = MAU_XML_BCTC.TT133
  const lc = b.lctt?.phuongPhap === 'trucTiep' ? b.lctt : null
  const body = `${phanChung(mau, b, dn, ngayLap)}
<CTieuTKhaiChinh>
<bctcDaKiemToan>${b.daKiemToan ? 'true' : 'false'}</bctcDaKiemToan>
<maYKienKToan/>
<tenYKienKToan/>
${khoiTrong('ThuyetMinh', O_B01A)}
${khoiSo('SoCuoiNam', O_B01A, b.cdkt.cuoi)}
${khoiSo('SoDauNam', O_B01A, b.cdkt.dau)}
${the('nguoiLapBieu', ky.nguoiLapBieu)}
${the('keToanTruong', ky.keToanTruong)}
${the('ngayLap', ngayLap)}
${the('nguoiDaiDienTheoPhapLuat', dn.nguoiKy)}
</CTieuTKhaiChinh>
<PLuc>
<PL_KQHDSXKD>
${khoiTrong('ThuyetMinh', O_B02_133)}
${khoiSo('NamNay', O_B02_133, b.kqkd.nay)}
${khoiSo('NamTruoc', O_B02_133, b.kqkd.truoc)}
</PL_KQHDSXKD>
${lc ? `<PL_LCTTTT>
${khoiTrong('ThuyetMinh', O_B03TT_133)}
${khoiSo('NamNay', O_B03TT_133, lc.nay)}
${khoiSo('NamTruoc', O_B03TT_133, lc.truoc)}
</PL_LCTTTT>` : ''}
</PLuc>`
  return dinhDang(bocNgoai(body))
}

/** Mẫu 1280 — BCTC doanh nghiệp siêu nhỏ theo TT58 (B01-DNSN + B02-DNSN) */
export function xmlBctcTT58(b: SoLieuBctc, dn: HoSoDN, ngayLap: string, ky: NguoiKyBctc = {}): string {
  if (b.cheDo !== 'TT58') throw new Error('Cần BCTC đã đổi sang mẫu TT58')
  const mau = MAU_XML_BCTC.TT58
  const body = `${phanChung(mau, b, dn, ngayLap)}
<CTieuTKhaiChinh>
${khoiSo('SoCuoiNam', O_B01_DNSN, b.cdkt.cuoi)}
${khoiSo('SoDauNam', O_B01_DNSN, b.cdkt.dau)}
<PhanKy>
${the('nguoiLapBieu', ky.nguoiLapBieu)}
${the('keToanTruong', ky.keToanTruong)}
${the('ngayLap', ngayLap)}
${the('thuTruongDonVi', dn.nguoiKy)}
</PhanKy>
</CTieuTKhaiChinh>
<PLuc>
<PL_BCKQHDKD>
${khoiSo('NamNay', O_B02_DNSN, b.kqkd.nay)}
${khoiSo('NamTruoc', O_B02_DNSN, b.kqkd.truoc)}
</PL_BCKQHDKD>
</PLuc>`
  return dinhDang(bocNgoai(body))
}

/** Tên file theo cách HTKK đặt cho BCTC: <MST>000-<mã file>-<từ ngày>_<đến ngày>_VND-L00.xml (vd BCTC 2025: …-200_BCTC-01012025_31122025_VND-L00.xml) */
export function tenFileXmlBctc(mau: 'TT133' | 'TT58', b: SoLieuBctc, mst: string): string {
  return `${mst}000-${MAU_XML_BCTC[mau].maFile}-${ddmmyyyy(b.tuNgay)}_${ddmmyyyy(b.denNgay)}_VND-L00.xml`
}

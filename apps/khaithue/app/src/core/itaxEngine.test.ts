import { describe, it, expect } from 'vitest';
import { cleanXmlForXslt, matchSpecsForXml } from './itaxEngine';
import { getFlatXslt, callIh, safeFormatNumber } from './mauItaxBctc';
import { xmlBctcTT133, xmlBctcTT99, xmlBctcTT200, xmlBctcTT58 } from './xmlBctc';
import { lapBctcTheoMau, type CheDoBctc } from './lapBctc';
import { khoTrong } from './kho';
import type { HoSoDN } from './types';

const DN: HoSoDN = {
  mst: '0100000001', tenNNT: 'Công ty TNHH Thử & Cộng sự', dchiNNT: 'Số 1 phố Thử', phuongXa: 'Phường Thử', maXaNNT: '', maTinhNNT: '101', tenTinhNNT: 'Hà Nội',
  dthoaiNNT: '0900000000', emailNNT: 'thu@example.com', maCQTNoiNop: '10100', tenCQTNoiNop: 'Thuế cơ sở thử', nguoiKy: 'Nguyễn Văn Thử',
};

function taoBan(mau: CheDoBctc, nam: number) {
  const k = khoTrong();
  k.congTy[DN.mst] = { hoSo: DN, kyNguon: '', suaTay: true };
  k.hoaDon = { [DN.mst]: {
    b1: { l: 'ban', mb: DN.mst, mm: '0200000002', kh: 'C26TAA', so: '1', ng: `10/03/${nam}`, ten: 'Khách A', v: 1_000_000_000, t: 80_000_000, tt: 'Hóa đơn mới' },
    m1: { l: 'mua', mb: '0300000003', kh: 'C26TBB', so: '9', ng: `05/03/${nam}`, ten: 'NCC B', v: 800_000_000, t: 64_000_000, tt: 'Hóa đơn mới' },
  } };
  return lapBctcTheoMau(k, DN.mst, nam, mau, { tonKhoCuoi: 20_000_000 }).bctc;
}

describe('itaxEngine', () => {
  it('cleanXmlForXslt làm sạch BOM và loại bỏ default namespace', () => {
    const raw = '\uFEFF<HSoThueDTu xmlns="http://kekhaithue.gdt.gov.vn/TKhaiThue"><HSoKhaiThue/></HSoThueDTu>';
    const cleaned = cleanXmlForXslt(raw);
    expect(cleaned.startsWith('\uFEFF')).toBe(false);
    expect(cleaned).toContain('<HSoThueDTu>');
    expect(cleaned).not.toContain('xmlns=');
  });

  it('safeFormatNumber và callIh định dạng số tiền chuẩn', () => {
    expect(safeFormatNumber(1234567)).toBe('1.234.567');
    expect(safeFormatNumber(-500000)).toBe('(500.000)');
    expect(safeFormatNumber('0')).toBe('0');
    expect(safeFormatNumber('')).toBe('');
    expect(callIh('formatNumber', ['987654321'])).toBe('987.654.321');
  });

  it('lấy được XSLT phẳng của các mẫu BCTC', () => {
    const xsl402 = getFlatXslt('data/xslt/xslt 2.2.6/tkhaithue/xslt/bctc/tkhai_bctc200_nam.xslt');
    expect(xsl402).toBeTruthy();
    expect(xsl402).toContain('<xsl:stylesheet');

    const xsl683 = getFlatXslt('data/xslt/xslt 2.3.2/tkhaithue/xslt/bctc/tkhai_bctc_133_b01a.xslt');
    expect(xsl683).toBeTruthy();
    expect(xsl683).toContain('<xsl:stylesheet');

    const xsl1281 = getFlatXslt('data/xslt/xslt 3.0.5/tkhaithue/xslt/bctc/tkhai_bctc99_2025_nam.xslt');
    expect(xsl1281).toBeTruthy();
    expect(xsl1281).toContain('<xsl:stylesheet');

    const xsl1280 = getFlatXslt('data/xslt/xslt 3.0.5/tkhaithue/xslt/bctc/tkhai_bctc58_nam.xslt');
    expect(xsl1280).toBeTruthy();
    expect(xsl1280).toContain('<xsl:stylesheet');
  });

  it('matchSpecsForXml nhận diện đủ biểu chính và phụ lục cho XML TT133', () => {
    const b = taoBan('TT133', 2026);
    const xml = xmlBctcTT133(b, DN, '2027-03-25');
    const specs = matchSpecsForXml(xml);

    expect(specs.length).toBe(3);
    const ids = specs.map(s => s.id);
    expect(ids).toEqual(['tkhai', 'PL_KQHDSXKD', 'PL_LCTTTT']);
  });

  it('matchSpecsForXml nhận diện đủ biểu chính và phụ lục cho XML TT99', () => {
    const b = taoBan('TT99', 2026);
    const xml = xmlBctcTT99(b, DN, '2027-03-25');
    const specs = matchSpecsForXml(xml);

    const ids = specs.map(s => s.id);
    expect(ids).toContain('tkhai');
    expect(ids).toContain('PL_KQHDSXKD');
    expect(ids).toContain('PL_LCTTTT');
  });

  it('matchSpecsForXml nhận diện đủ biểu chính và phụ lục cho XML TT200', () => {
    const b = taoBan('TT200', 2025);
    const xml = xmlBctcTT200(b, DN, '2026-03-25');
    const specs = matchSpecsForXml(xml);

    const ids = specs.map(s => s.id);
    expect(ids).toContain('tkhai');
    expect(ids).toContain('PL_KQHDSXKD');
    expect(ids).toContain('PL_LCTTTT');
  });

  it('matchSpecsForXml nhận diện đủ biểu chính và phụ lục cho XML TT58', () => {
    const b = taoBan('TT58', 2026);
    const xml = xmlBctcTT58(b, DN, '2027-03-25');
    const specs = matchSpecsForXml(xml);

    const ids = specs.map(s => s.id);
    expect(ids).toContain('tkhai');
    expect(ids).toContain('PL_BCKQHDKD');
  });
});

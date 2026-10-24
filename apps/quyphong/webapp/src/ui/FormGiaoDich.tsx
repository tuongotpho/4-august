import { useEffect, useRef, useState } from 'react';
import { nhanTien, ngayTruoc, TIEN_NHANH } from '../lib/mau_nhap.js';
import { taoId } from '../lib/store.js';
import { chieuUng, type KhoanUng } from '../lib/cong_no.js';
import { dinhDangNgay, dinhDangTien, docTien } from '../lib/tinh_toan.js';
import { NHOM_CHI, NHOM_CHI_UNG, NHOM_HOAN, NHOM_THU, type GiaoDich, type Loai } from '../lib/types.js';

interface Props {
  /** Giao dịch đang sửa (null = thêm mới). */
  ban?: GiaoDich | null;
  /** Giá trị điền sẵn khi thêm mới (từ mẫu). */
  macDinh?: GiaoDich;
  tenMau?: string;
  onLuu: (g: GiaoDich) => Promise<void>;
  onXoa?: (id: string) => Promise<void>;
  onLuuMau?: (g: GiaoDich) => void;
  /** Công nợ ứng của cả sổ — để chọn khoản mà dòng này trả / hoàn */
  khoanUng?: KhoanUng[];
  onDong: () => void;
}

const trong = (): GiaoDich => ({
  id: taoId(),
  loai: 'chi',
  ngay: ngayTruoc(0),
  soTien: null,
  noiDung: '',
  doiTuong: '',
  ghiChu: '',
  daHoan: false,
  hinhThuc: 'CK',
  nhom: 'Khác',
});

export function FormGiaoDich({ ban, macDinh, tenMau, onLuu, onXoa, onLuuMau, khoanUng = [], onDong }: Props) {
  const goc = () => (macDinh ? { ...macDinh, id: taoId() } : trong());
  const [g, setG] = useState<GiaoDich>(ban ?? goc());
  const [tienChu, setTienChu] = useState(() => {
    const n = ban?.soTien ?? macDinh?.soTien;
    return n != null ? dinhDangTien(n) : '';
  });
  const [loi, setLoi] = useState('');
  const [thongBao, setThongBao] = useState('');
  const [dangLuu, setDangLuu] = useState(false);
  const [moRong, setMoRong] = useState(!!ban || !!macDinh?.hoanCho);
  const oTien = useRef<HTMLInputElement>(null);
  const oNoiDung = useRef<HTMLInputElement>(null);

  // Từ mẫu: con trỏ vào ô tiền (bàn phím số bật lên ngay). Nhập trống: vào nội dung.
  useEffect(() => {
    if (ban) return;
    (macDinh && macDinh.soTien == null ? oTien : oNoiDung).current?.focus();
  }, []);

  const dsNhom = g.loai === 'thu' ? NHOM_THU : NHOM_CHI;
  const doi = <K extends keyof GiaoDich>(k: K, v: GiaoDich[K]) => setG((x) => ({ ...x, [k]: v }));
  const doiLoai = (l: Loai) =>
    setG((x) => ({ ...x, loai: l, hoanCho: undefined, nhom: (l === 'thu' ? NHOM_THU : NHOM_CHI).includes(x.nhom) ? x.nhom : 'Khác' }));

  // Trả / hoàn ứng: chi trả cho khoản người khác ứng cho phòng, thu hoàn cho khoản phòng đã ứng ra
  const coTheTra = !!g.hoanCho || (g.loai === 'chi' ? g.nhom === NHOM_CHI_UNG : g.nhom === NHOM_HOAN);
  const dsTra = khoanUng.filter(
    (k) => k.g.id === g.hoanCho || (k.conLai > 0 && k.g.id !== g.id && k.chieu === (g.loai === 'chi' ? 'phong_no' : 'no_phong')),
  );
  const chonTra = (id: string) => {
    const k = khoanUng.find((x) => x.g.id === id);
    setG((x) => ({ ...x, hoanCho: id || undefined, doiTuong: x.doiTuong || k?.g.doiTuong || '' }));
    if (k && !docTien(tienChu)) setTienChu(dinhDangTien(k.conLai));
  };

  function kiemTra(): GiaoDich | null {
    const soTien = docTien(tienChu);
    if (tienChu.trim() && soTien == null) return setLoi('Số tiền không hợp lệ (ví dụ: 1.500.000, 1,5tr, 500k)'), null;
    if (!g.noiDung.trim()) return setLoi('Nhập nội dung'), null;
    if (!g.ngay) return setLoi('Chọn ngày'), null;
    setLoi('');
    return { ...g, noiDung: g.noiDung.trim(), soTien };
  }

  async function luu(nhapTiep: boolean) {
    const gd = kiemTra();
    if (!gd) return;
    setDangLuu(true);
    try {
      await onLuu(gd);
      if (!nhapTiep) return onDong();
      // Giữ mẫu, loại, ngày, hình thức; xóa tiền và nội dung riêng để nhập khoản kế tiếp
      const moi = goc();
      setG({ ...moi, ngay: gd.ngay, hinhThuc: gd.hinhThuc });
      setTienChu(moi.soTien != null ? dinhDangTien(moi.soTien) : '');
      setThongBao(`Đã lưu: ${gd.noiDung} — ${dinhDangTien(gd.soTien)}`);
      (moi.soTien == null ? oTien : oNoiDung).current?.focus();
    } catch (err) {
      setLoi(String(err));
    } finally {
      setDangLuu(false);
    }
  }

  const homNay = ngayTruoc(0);
  const homQua = ngayTruoc(1);

  return (
    <div className="phu" onMouseDown={(e) => e.target === e.currentTarget && onDong()}>
      <form
        className="hop"
        onSubmit={(e) => {
          e.preventDefault();
          luu(false);
        }}
      >
        <div className="dau-hop rong">
          <h2>{ban ? 'Sửa giao dịch' : tenMau ? tenMau : 'Thêm giao dịch'}</h2>
          <button type="button" className="dong" onClick={onDong} aria-label="Đóng">
            ✕
          </button>
        </div>

        <div className="chon-loai rong">
          {(['chi', 'thu'] as const).map((l) => (
            <button type="button" key={l} className={g.loai === l ? `chon ${l}` : ''} onClick={() => doiLoai(l)}>
              {l === 'thu' ? 'Thu' : 'Chi'}
            </button>
          ))}
        </div>

        <label className="rong o-tien">
          Số tiền (đồng)
          <input
            ref={oTien}
            inputMode="numeric"
            enterKeyHint="next"
            placeholder="0"
            value={tienChu}
            onChange={(e) => setTienChu(e.target.value)}
            onBlur={() => {
              const n = docTien(tienChu);
              if (n != null) setTienChu(dinhDangTien(n));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                oNoiDung.current?.focus();
              }
            }}
          />
        </label>
        <div className="chip-hang rong">
          {TIEN_NHANH.map((n) => (
            <button type="button" key={n} className={docTien(tienChu) === n ? 'chip chon' : 'chip'} onClick={() => setTienChu(dinhDangTien(n))}>
              {nhanTien(n)}
            </button>
          ))}
        </div>

        <label className="rong">
          Nội dung
          <input
            ref={oNoiDung}
            value={g.noiDung}
            enterKeyHint="done"
            onChange={(e) => doi('noiDung', e.target.value)}
            onFocus={(e) => {
              // Con trỏ cuối câu để gõ tiếp sau phần mẫu điền sẵn
              const el = e.target;
              requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
            }}
          />
        </label>

        <div className="rong">
          <div className="nhan-nho">Ngày</div>
          <div className="chip-hang">
            <button type="button" className={g.ngay === homNay ? 'chip chon' : 'chip'} onClick={() => doi('ngay', homNay)}>
              Hôm nay
            </button>
            <button type="button" className={g.ngay === homQua ? 'chip chon' : 'chip'} onClick={() => doi('ngay', homQua)}>
              Hôm qua
            </button>
            <input type="date" className="chip-ngay" value={g.ngay ?? ''} onChange={(e) => doi('ngay', e.target.value || null)} />
          </div>
        </div>

        <div className="rong">
          <div className="nhan-nho">Hình thức</div>
          <div className="chip-hang">
            {(
              [
                ['CK', 'Chuyển khoản'],
                ['TM', 'Tiền mặt'],
              ] as const
            ).map(([v, t]) => (
              <button type="button" key={v} className={g.hinhThuc === v ? 'chip chon' : 'chip'} onClick={() => doi('hinhThuc', g.hinhThuc === v ? '' : v)}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {!moRong ? (
          <button type="button" className="lien-ket rong" onClick={() => setMoRong(true)}>
            {g.nhom} · {g.doiTuong || 'thêm người, ghi chú…'} ▾
          </button>
        ) : (
          <>
            <label>
              Nhóm
              <select value={g.nhom} onChange={(e) => doi('nhom', e.target.value)}>
                {dsNhom.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label>
              {g.loai === 'thu' ? 'Đơn vị / người nộp' : 'Người nhận'}
              <input value={g.doiTuong} onChange={(e) => doi('doiTuong', e.target.value)} />
            </label>
            <label className="rong">
              Ghi chú
              <input value={g.ghiChu} onChange={(e) => doi('ghiChu', e.target.value)} />
            </label>
            {coTheTra && (
              <label className="rong">
                {g.loai === 'chi' ? 'Trả cho khoản ứng' : 'Hoàn cho khoản ứng'}
                <select value={g.hoanCho ?? ''} onChange={(e) => chonTra(e.target.value)}>
                  <option value="">
                    {g.loai === 'chi' ? '— Không: đây là khoản phòng ứng ra —' : '— Không gắn khoản ứng nào —'}
                  </option>
                  {dsTra.map((k) => (
                    <option key={k.g.id} value={k.g.id}>
                      {dinhDangNgay(k.g.ngay)} · {k.g.noiDung} · còn {dinhDangTien(k.conLai)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="o-chon rong">
              <input type="checkbox" checked={g.daHoan} onChange={(e) => doi('daHoan', e.target.checked)} />
              {chieuUng(g) ? 'Đã trả / hoàn xong (không cần ghi dòng trả)' : 'Đã hoàn'}
            </label>
          </>
        )}

        {g.nguon && <p className="nho rong">Dòng gốc trong Excel: {g.nguon}</p>}
        {loi && <p className="loi rong">{loi}</p>}
        {thongBao && !loi && <p className="da-luu rong">✓ {thongBao}</p>}

        <div className="nut-hang rong">
          {ban && onXoa && (
            <button
              type="button"
              className="nguy"
              onClick={async () => {
                if (!confirm(`Xóa "${g.noiDung}"?`)) return;
                await onXoa(g.id);
                onDong();
              }}
            >
              Xóa
            </button>
          )}
          {!ban && onLuuMau && (
            <button type="button" title="Lưu các ô đang điền thành một mẫu nhập nhanh" onClick={() => onLuuMau({ ...g, soTien: docTien(tienChu) })}>
              ☆ Làm mẫu
            </button>
          )}
          <span style={{ flex: 1 }} />
          {!ban && !macDinh?.hoanCho && (
            <button type="button" disabled={dangLuu} onClick={() => luu(true)}>
              Lưu + tiếp
            </button>
          )}
          <button type="submit" className="chinh" disabled={dangLuu}>
            {dangLuu ? 'Đang lưu…' : 'Lưu'}
          </button>
        </div>
      </form>
    </div>
  );
}

import { useState } from 'react';
import { taoId } from '../lib/store.js';
import { dinhDangTien, docTien } from '../lib/tinh_toan.js';
import { NHOM_CHI, NHOM_THU, type GiaoDich, type Loai } from '../lib/types.js';

interface Props {
  ban?: GiaoDich | null;
  onLuu: (g: GiaoDich) => Promise<void>;
  onXoa?: (id: string) => Promise<void>;
  onDong: () => void;
}

const homNay = () => new Date().toLocaleDateString('sv-SE'); // yyyy-mm-dd theo giờ máy

export function FormGiaoDich({ ban, onLuu, onXoa, onDong }: Props) {
  const [g, setG] = useState<GiaoDich>(
    ban ?? {
      id: taoId(),
      loai: 'chi',
      ngay: homNay(),
      soTien: null,
      noiDung: '',
      doiTuong: '',
      ghiChu: '',
      daHoan: false,
      hinhThuc: 'CK',
      nhom: 'Khác',
    },
  );
  const [tienChu, setTienChu] = useState(ban?.soTien != null ? dinhDangTien(ban.soTien) : '');
  const [loi, setLoi] = useState('');
  const [dangLuu, setDangLuu] = useState(false);

  const dsNhom = g.loai === 'thu' ? NHOM_THU : NHOM_CHI;
  const doi = <K extends keyof GiaoDich>(k: K, v: GiaoDich[K]) => setG((x) => ({ ...x, [k]: v }));

  const doiLoai = (l: Loai) =>
    setG((x) => ({ ...x, loai: l, nhom: (l === 'thu' ? NHOM_THU : NHOM_CHI).includes(x.nhom) ? x.nhom : 'Khác' }));

  async function gui(e: React.FormEvent) {
    e.preventDefault();
    const soTien = docTien(tienChu);
    if (!g.noiDung.trim()) return setLoi('Nhập nội dung');
    if (!g.ngay) return setLoi('Chọn ngày');
    if (tienChu.trim() && soTien == null) return setLoi('Số tiền không hợp lệ (ví dụ: 1.500.000 hoặc 1,5tr)');
    setDangLuu(true);
    try {
      await onLuu({ ...g, noiDung: g.noiDung.trim(), soTien });
      onDong();
    } catch (err) {
      setLoi(String(err));
      setDangLuu(false);
    }
  }

  return (
    <div className="phu" onMouseDown={(e) => e.target === e.currentTarget && onDong()}>
      <form className="hop" onSubmit={gui}>
        <h2>{ban ? 'Sửa giao dịch' : 'Thêm giao dịch'}</h2>
        <div className="chon-loai">
          {(['thu', 'chi'] as const).map((l) => (
            <button type="button" key={l} className={g.loai === l ? `chon ${l}` : ''} onClick={() => doiLoai(l)}>
              {l === 'thu' ? 'Thu' : 'Chi'}
            </button>
          ))}
        </div>
        <label>
          Ngày
          <input type="date" value={g.ngay ?? ''} onChange={(e) => doi('ngay', e.target.value || null)} />
        </label>
        <label>
          Số tiền (đồng)
          <input
            inputMode="decimal"
            placeholder="1.500.000 hoặc 1,5tr"
            value={tienChu}
            onChange={(e) => setTienChu(e.target.value)}
            onBlur={() => {
              const n = docTien(tienChu);
              if (n != null) setTienChu(dinhDangTien(n));
            }}
          />
        </label>
        <label className="rong">
          Nội dung
          <input value={g.noiDung} onChange={(e) => doi('noiDung', e.target.value)} autoFocus />
        </label>
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
        <label>
          Hình thức
          <select value={g.hinhThuc} onChange={(e) => doi('hinhThuc', e.target.value as GiaoDich['hinhThuc'])}>
            <option value="">—</option>
            <option value="CK">Chuyển khoản</option>
            <option value="TM">Tiền mặt</option>
          </select>
        </label>
        <label className="o-chon">
          <input type="checkbox" checked={g.daHoan} onChange={(e) => doi('daHoan', e.target.checked)} />
          Đã hoàn
        </label>
        <label className="rong">
          Ghi chú
          <input value={g.ghiChu} onChange={(e) => doi('ghiChu', e.target.value)} />
        </label>
        {g.nguon && <p className="nho rong">Dòng gốc trong Excel: {g.nguon}</p>}
        {loi && <p className="loi rong">{loi}</p>}
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
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onDong}>
            Hủy
          </button>
          <button type="submit" className="chinh" disabled={dangLuu}>
            {dangLuu ? 'Đang lưu…' : 'Lưu'}
          </button>
        </div>
      </form>
    </div>
  );
}

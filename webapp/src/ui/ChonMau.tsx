import { useState } from 'react';
import type { MauNhap } from '../lib/mau_nhap.js';
import { dinhDangTien } from '../lib/tinh_toan.js';

interface Props {
  dsMau: MauNhap[];
  onChon: (m: MauNhap | null) => void;
  onLuuMau: (ds: MauNhap[] | null) => Promise<void>;
  onDong: () => void;
}

/** Bảng chọn mẫu nhập nhanh — trên điện thoại hiện như tấm trượt từ dưới lên. */
export function ChonMau({ dsMau, onChon, onLuuMau, onDong }: Props) {
  const [sua, setSua] = useState(false);

  const nhom = (['chi', 'thu'] as const).map((loai) => ({ loai, ds: dsMau.filter((m) => m.loai === loai) }));

  function doiCho(id: string, buoc: -1 | 1) {
    const ds = [...dsMau];
    const i = ds.findIndex((m) => m.id === id);
    // Đổi chỗ với mẫu kế bên cùng loại
    let j = i + buoc;
    while (j >= 0 && j < ds.length && ds[j].loai !== ds[i].loai) j += buoc;
    if (j < 0 || j >= ds.length) return;
    [ds[i], ds[j]] = [ds[j], ds[i]];
    onLuuMau(ds);
  }

  return (
    <div className="phu tam-truot" onMouseDown={(e) => e.target === e.currentTarget && onDong()}>
      <div className="hop chon-mau">
        <div className="dau-hop">
          <h2>{sua ? 'Sửa mẫu nhập' : 'Nhập nhanh'}</h2>
          <button type="button" className="dong" onClick={onDong} aria-label="Đóng">
            ✕
          </button>
        </div>

        {nhom.map(({ loai, ds }) =>
          ds.length === 0 ? null : (
            <section key={loai}>
              <h3 className={loai}>{loai === 'chi' ? 'Chi' : 'Thu'}</h3>
              <div className="luoi-mau">
                {ds.map((m) =>
                  sua ? (
                    <div key={m.id} className="o-mau dang-sua">
                      <span className="bieu-tuong">{m.bieuTuong}</span>
                      <span className="ten">{m.ten}</span>
                      <span className="nut-mau">
                        <button type="button" aria-label="Lên" onClick={() => doiCho(m.id, -1)}>
                          ↑
                        </button>
                        <button type="button" aria-label="Xuống" onClick={() => doiCho(m.id, 1)}>
                          ↓
                        </button>
                        <button type="button" aria-label="Đổi tên" onClick={() => {
                          const ten = prompt('Tên mẫu', m.ten);
                          if (ten?.trim()) onLuuMau(dsMau.map((x) => (x.id === m.id ? { ...x, ten: ten.trim() } : x)));
                        }}>
                          ✎
                        </button>
                        <button type="button" className="nguy" aria-label="Xóa" onClick={() => {
                          if (confirm(`Xóa mẫu "${m.ten}"?`)) onLuuMau(dsMau.filter((x) => x.id !== m.id));
                        }}>
                          ✕
                        </button>
                      </span>
                    </div>
                  ) : (
                    <button key={m.id} type="button" className={`o-mau ${m.loai}`} onClick={() => onChon(m)}>
                      <span className="bieu-tuong">{m.bieuTuong}</span>
                      <span className="ten">{m.ten}</span>
                      {m.soTien != null && <span className="nho">{dinhDangTien(m.soTien)}</span>}
                    </button>
                  ),
                )}
              </div>
            </section>
          ),
        )}

        {sua ? (
          <div className="nut-hang">
            <button
              type="button"
              onClick={() => confirm('Bỏ các mẫu tự tạo và dùng lại bộ mẫu mặc định?') && onLuuMau(null)}
            >
              Khôi phục mặc định
            </button>
            <span style={{ flex: 1 }} />
            <button type="button" className="chinh" onClick={() => setSua(false)}>
              Xong
            </button>
          </div>
        ) : (
          <div className="nut-hang">
            <button type="button" onClick={() => setSua(true)}>
              ✎ Sửa mẫu
            </button>
            <span style={{ flex: 1 }} />
            <button type="button" className="chinh" onClick={() => onChon(null)}>
              Nhập trống
            </button>
          </div>
        )}
        <p className="nho">Muốn thêm mẫu: điền form như bình thường rồi bấm “☆ Làm mẫu”.</p>
      </div>
    </div>
  );
}

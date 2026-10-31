import { useEffect, useState } from 'react';
import type { DataStore, NhatKyAI, PhienAI } from '../lib/store.js';

const gio = (d: Date | null) => (d ? d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '');

/** Kết nối AI (MCP): địa chỉ máy chủ, các máy đã được cho phép (thu hồi được) và nhật ký AI ghi gì. */
export function KetNoiAI({ ai, onDong }: { ai: NonNullable<DataStore['ai']>; onDong: () => void }) {
  const [phien, setPhien] = useState<PhienAI[] | null>(null);
  const [nhatKy, setNhatKy] = useState<NhatKyAI[]>([]);
  const [daChep, setDaChep] = useState('');
  // Mở dưới cổng chung …/quy-phong/ (Firebase app-by-lethanh.web.app): máy chủ AI ở cùng tên miền, dưới /quy-phong
  const goc = location.pathname.startsWith('/quy-phong/') ? `${location.origin}/quy-phong` : location.origin;
  const url = `${goc}/mcp`;
  const lenh = `claude mcp add --transport http quyphong ${url}`;

  useEffect(() => ai.theoDoiPhien(setPhien), [ai]);
  useEffect(() => ai.theoDoiNhatKy(setNhatKy), [ai]);

  const chep = (s: string) =>
    navigator.clipboard?.writeText(s).then(() => {
      setDaChep(s);
      setTimeout(() => setDaChep(''), 1500);
    });

  return (
    <div className="phu" onMouseDown={(e) => e.target === e.currentTarget && onDong()}>
      <div className="hop ket-noi-ai">
        <div className="dau-hop">
          <h2>Kết nối AI (MCP)</h2>
          <button type="button" className="dong" onClick={onDong} aria-label="Đóng">
            ✕
          </button>
        </div>

        <p className="nho">
          Cho Claude (máy tính, web, điện thoại) xem sổ quỹ và ghi thu / chi bằng lời, vd “chi sinh nhật sếp Nam 3 triệu tiền mặt”. AI dùng đúng quyền tài khoản Google
          của bạn; mỗi máy phải đăng nhập và bấm cho phép một lần.
        </p>

        <div className="o-chep">
          <code>{url}</code>
          <button type="button" onClick={() => chep(url)}>
            {daChep === url ? 'Đã chép' : 'Chép'}
          </button>
        </div>
        <ul className="nho huong-dan">
          <li>
            <b>claude.ai / app Claude điện thoại:</b> Cài đặt → Connectors → Add custom connector → dán địa chỉ trên.
          </li>
          <li>
            <b>Claude Code:</b> <code>{lenh}</code>{' '}
            <button type="button" className="lien-ket" onClick={() => chep(lenh)}>
              {daChep === lenh ? 'đã chép' : 'chép lệnh'}
            </button>{' '}
            rồi gõ <code>/mcp</code> → quyphong → Authenticate.
          </li>
        </ul>

        <h3>Máy đã được cho phép</h3>
        {phien === null ? (
          <p className="nho">Đang tải…</p>
        ) : phien.length === 0 ? (
          <p className="nho">Chưa có máy nào.</p>
        ) : (
          <ul className="ds-phien">
            {phien.map((p) => (
              <li key={p.id}>
                <div>
                  <b>{p.tenMay}</b>
                  <div className="nho">
                    {p.ungDung} · {p.noiNhan} · {gio(p.taoLuc)}
                  </div>
                </div>
                <button type="button" className="nguy" onClick={() => confirm(`Thu hồi quyền của "${p.tenMay}"?`) && ai.thuHoi(p.id)}>
                  Thu hồi
                </button>
              </li>
            ))}
          </ul>
        )}

        <h3>Nhật ký AI ghi / xoá</h3>
        {nhatKy.length === 0 ? (
          <p className="nho">Chưa có.</p>
        ) : (
          <ul className="ds-nhat-ky">
            {nhatKy.map((n) => (
              <li key={n.id}>
                <span className="nho">
                  {gio(n.luc)} · {n.tenMay}
                </span>
                <div>{n.moTa}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

import { dinhDangTien, theoNhom, theoThang } from '../lib/tinh_toan.js';
import type { GiaoDich } from '../lib/types.js';

const trieu = (n: number) => (n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + 'tr';

export function ThongKe({ ds }: { ds: GiaoDich[] }) {
  const thang = theoThang(ds);
  const max = Math.max(1, ...thang.flatMap((t) => [t.thu, t.chi]));

  return (
    <div className="thong-ke">
      <section className="the">
        <h3>Thu – chi theo tháng</h3>
        <div className="chu-giai">
          <span className="o thu" /> Thu <span className="o chi" /> Chi
        </div>
        <div className="bieu-do">
          {thang.map((t) => (
            <div key={t.thang} className="cot" title={`${t.thang.slice(5)}/${t.thang.slice(0, 4)}\nThu: ${dinhDangTien(t.thu)}\nChi: ${dinhDangTien(t.chi)}\nTồn: ${dinhDangTien(t.ton)}`}>
              <div className="cap">
                <div className="thanh thu" style={{ height: `${(t.thu / max) * 100}%` }} />
                <div className="thanh chi" style={{ height: `${(t.chi / max) * 100}%` }} />
              </div>
              <div className="nhan">
                {t.thang.slice(5)}
                <br />
                {t.thang.slice(2, 4)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {(['chi', 'thu'] as const).map((loai) => {
        const nhom = theoNhom(ds, loai);
        const tong = nhom.reduce((s, n) => s + n.tien, 0) || 1;
        return (
          <section className="the" key={loai}>
            <h3>{loai === 'chi' ? 'Chi' : 'Thu'} theo nhóm</h3>
            <table className="bang-nhom">
              <tbody>
                {nhom.map((n) => (
                  <tr key={n.nhom}>
                    <td>{n.nhom}</td>
                    <td className="so">{n.so} lần</td>
                    <td className="thanh-ngang">
                      <div className={`thanh ${loai}`} style={{ width: `${(n.tien / tong) * 100}%` }} />
                    </td>
                    <td className="so">{trieu(n.tien)}</td>
                    <td className="so nho">{Math.round((n.tien / tong) * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}

      <section className="the">
        <h3>Bảng tháng</h3>
        <div className="cuon">
          <table className="bang">
            <thead>
              <tr>
                <th>Tháng</th>
                <th className="so">Thu</th>
                <th className="so">Chi</th>
                <th className="so an-dt">Chênh lệch</th>
                <th className="so">
                  Tồn<span className="an-dt"> cuối tháng</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {[...thang].reverse().map((t) => (
                <tr key={t.thang}>
                  <td>{`${t.thang.slice(5)}/${t.thang.slice(0, 4)}`}</td>
                  <td className="so thu">{dinhDangTien(t.thu)}</td>
                  <td className="so chi">{dinhDangTien(t.chi)}</td>
                  <td className={`so an-dt ${t.thu - t.chi < 0 ? 'am' : ''}`}>{dinhDangTien(t.thu - t.chi)}</td>
                  <td className={`so ${t.ton < 0 ? 'am' : ''}`}>{dinhDangTien(t.ton)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// Tab "Các kỳ đã lưu": danh sách, xem file gốc, xoá.
import type { Ky } from '../shared/kieu'
import { doiChieu } from '../shared/doiChieu'
import { dong, ngayVN, traDungHan } from '../shared/thongKe'

export function CacKy({ ky, moPdf, xoa }: { ky: Ky[]; moPdf: (id: string) => Promise<void>; xoa: (k: Ky) => Promise<void> }) {
  if (!ky.length) return <div className="card">Chưa có kỳ nào.</div>
  const th = new Map(traDungHan(ky).map((x) => [x.ky.id, x]))
  return (
    <div className="card">
      <div className="tbl" style={{ maxHeight: 'none' }}>
        <table>
          <thead><tr><th>Kỳ sao kê</th><th className="n">Nợ phát sinh</th><th className="n">Dư nợ cuối kỳ</th><th>Hạn trả</th><th>Đã trả đủ?</th><th>Đối chiếu</th><th /></tr></thead>
          <tbody>
            {[...ky].reverse().map((k) => {
              const dc = doiChieu(k), t = th.get(k.id)
              return (
                <tr key={k.id}>
                  <td>{ngayVN(k.tu)} – {ngayVN(k.den)}<div className="tag">{k.giaoDich.length} giao dịch{k.luuLuc ? ` · lưu ${ngayVN(k.luuLuc.slice(0, 10))}` : ''}</div></td>
                  <td className="n">{dong(k.phatSinh)}</td>
                  <td className="n">{dong(k.cuoiKy)}</td>
                  <td>{k.hanTra ? ngayVN(k.hanTra) : '—'}</td>
                  <td>{t ? (t.du ? <span className="ok">✔ {t.ngayTra ? ngayVN(t.ngayTra) : ''}</span> : <span className="sai">✘ trả {dong(t.daTra)}</span>) : <span className="sub">chờ sao kê kỳ sau</span>}</td>
                  <td>{dc.khop ? <span className="ok">✔ khớp</span> : <span className="sai">✘ lệch</span>}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="chip" onClick={() => moPdf(k.id)}>File gốc</button>{' '}
                    <button className="chip" onClick={() => { if (confirm(`Xoá kỳ ${ngayVN(k.tu)} – ${ngayVN(k.den)} và file gốc? Không hoàn tác được.`)) xoa(k) }}>Xoá</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

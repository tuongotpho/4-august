// Bảng giao dịch: tìm, lọc nhóm, sắp xếp, đổi nhóm từng dòng.
import { useMemo, useState } from 'react'
import { DS_NHOM, MAU_NHOM, type KhoanChi } from '../shared/phanLoai'
import { ngayVN } from '../shared/thongKe'

type Khoa = 'ngay' | 'ten' | 'nhom' | 'khuVuc' | 'tien'

export function BangGiaoDich({ khoan, doiNhom }: { khoan: KhoanChi[]; doiNhom?: (k: KhoanChi, nhom: string) => void }) {
  const [q, setQ] = useState('')
  const [nhom, setNhom] = useState('')
  const [sx, setSx] = useState<{ k: Khoa; chieu: number }>({ k: 'ngay', chieu: -1 })
  const ds = useMemo(() => {
    const t = q.trim().toLowerCase()
    return khoan
      .filter((x) => (!nhom || x.nhom === nhom) && (!t || `${x.ten} ${x.g.moTa} ${x.nhom} ${x.khuVuc}`.toLowerCase().includes(t)))
      .sort((a, b) => (a[sx.k] > b[sx.k] ? 1 : a[sx.k] < b[sx.k] ? -1 : 0) * sx.chieu)
  }, [khoan, q, nhom, sx])
  const tong = ds.reduce((s, x) => s + x.tien, 0)
  const th = (k: Khoa, ten: string, n = false) => (
    <th className={`sx${n ? ' n' : ''}`} onClick={() => setSx({ k, chieu: sx.k === k ? -sx.chieu : k === 'tien' ? -1 : 1 })}>
      {ten}{sx.k === k ? (sx.chieu > 0 ? ' ▲' : ' ▼') : ''}
    </th>
  )
  const nhomCo = [...new Set([...DS_NHOM, ...khoan.map((x) => x.nhom)])]
  return (
    <>
      <div className="bar" style={{ marginTop: 0 }}>
        <input type="search" placeholder="Tìm: Shopee, xăng, Long Châu…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={nhom} onChange={(e) => setNhom(e.target.value)}>
          <option value="">Tất cả nhóm</option>
          {nhomCo.map((n) => <option key={n}>{n}</option>)}
        </select>
        <span className="sub">{ds.length} giao dịch · {tong.toLocaleString('vi-VN')} đ</span>
      </div>
      <div className="tbl">
        <table>
          <thead><tr>{th('ngay', 'Ngày')}{th('ten', 'Nơi chi')}{th('nhom', 'Nhóm')}{th('khuVuc', 'Khu vực')}{th('tien', 'Số tiền (đ)', true)}</tr></thead>
          <tbody>
            {ds.map((x) => (
              <tr key={x.kyId + x.g.id}>
                <td>{ngayVN(x.ngay)}</td>
                <td>{x.ten}<div className="tag">{x.g.moTa}{x.tien < 0 ? ' (hoàn tiền)' : ''}</div></td>
                <td>
                  <span className="dot" style={{ background: MAU_NHOM[x.nhom] ?? '#94a3b8' }} />
                  {doiNhom ? (
                    <select value={x.nhom} onChange={(e) => doiNhom(x, e.target.value)} title="Đổi nhóm cho giao dịch này">
                      {nhomCo.map((n) => <option key={n}>{n}</option>)}
                    </select>
                  ) : x.nhom}
                  {x.g.nhomTay && <span className="tag"> (tự chọn)</span>}
                </td>
                <td>{x.khuVuc}</td>
                <td className="n">{x.tien.toLocaleString('vi-VN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

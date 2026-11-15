// Tab "Tải sao kê": chọn/kéo file PDF -> đọc trong trình duyệt -> đối chiếu với tổng ngân hàng -> người dùng bấm Lưu.
import { useState } from 'react'
import type { GiaoDich, Ky } from '../shared/kieu'
import { doiChieu } from '../shared/doiChieu'
import { dong, ngayVN, nhanKy } from '../shared/thongKe'
// phần đọc PDF + nhận dạng chữ khá nặng: chỉ tải khi có file cần đọc

interface Viec {
  file: File
  trangThai: string
  ky?: Ky
  loi?: string[]
  daLuu?: boolean
  dangLuu?: boolean
}

export function TaiLen({ daCo, luu }: { daCo: Ky[]; luu: (ky: Ky, file: File) => Promise<void> }) {
  const [viec, setViec] = useState<Viec[]>([])
  const [keo, setKeo] = useState(false)
  const sua = (i: number, p: Partial<Viec>) => setViec((v) => v.map((x, j) => (j === i ? { ...x, ...p } : x)))

  async function nhan(files: FileList | null) {
    const ds = [...(files ?? [])].filter((f) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf')
    if (!ds.length) return
    const dau = viec.length
    setViec((v) => [...v, ...ds.map((file) => ({ file, trangThai: 'Chờ đọc…' }))])
    // đọc lần lượt từng file (đọc song song làm máy yếu bị đơ)
    for (let k = 0; k < ds.length; k++) {
      const i = dau + k
      try {
        const { docSaoKe } = await import('./ocr')
        const kq = await docSaoKe(ds[k], (s) => sua(i, { trangThai: s }))
        sua(i, { trangThai: kq.ky ? 'Đã đọc xong' : 'Không đọc được', ky: kq.ky ?? undefined, loi: kq.loi })
      } catch (e) {
        sua(i, { trangThai: 'Lỗi', loi: [(e as Error).message] })
      }
    }
  }

  async function bamLuu(i: number) {
    const v = viec[i]
    if (!v.ky) return
    sua(i, { dangLuu: true })
    try {
      await luu(v.ky, v.file)
      sua(i, { daLuu: true, dangLuu: false })
    } catch (e) {
      sua(i, { dangLuu: false, loi: [...(v.loi ?? []), 'Lưu lỗi: ' + (e as Error).message] })
    }
  }

  const suaGD = (i: number, gid: string, p: Partial<GiaoDich>) => {
    const ky = viec[i].ky!
    sua(i, { ky: { ...ky, giaoDich: ky.giaoDich.map((g) => (g.id === gid ? { ...g, ...p, nghiSai: undefined } : g)) } })
  }

  return (
    <>
      <label className={`tha ${keo ? 'keo' : ''}`} style={{ display: 'block' }}
        onDragOver={(e) => { e.preventDefault(); setKeo(true) }} onDragLeave={() => setKeo(false)}
        onDrop={(e) => { e.preventDefault(); setKeo(false); nhan(e.dataTransfer.files) }}>
        <input type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => { nhan(e.target.files); e.target.value = '' }} />
        <div style={{ fontSize: 17, fontWeight: 600 }}>Bấm để chọn, hoặc kéo thả file sao kê PDF vào đây</div>
        <div className="sub">Sao kê thẻ tín dụng VPBank (kể cả bản scan). Chọn được nhiều file một lúc. Máy đọc chữ ngay trên trình duyệt, mỗi file ~20–40 giây.</div>
      </label>

      {viec.map((v, i) => {
        const dc = v.ky ? doiChieu(v.ky) : null
        const trung = v.ky && daCo.some((k) => k.id === v.ky!.id)
        const nghi = v.ky?.giaoDich.filter((g) => g.nghiSai) ?? []
        return (
          <div key={i} className="card" style={{ marginTop: 14 }}>
            <div className="top">
              <div>
                <h2 style={{ margin: 0 }}>{v.file.name}</h2>
                <div className="sub">{v.ky ? `Kỳ ${ngayVN(v.ky.tu)} – ${ngayVN(v.ky.den)} · ${v.ky.giaoDich.length} giao dịch` : v.trangThai}</div>
              </div>
              <div className="phai">
                {v.daLuu ? <span className="ok">✔ Đã lưu</span> : v.ky && (
                  <button className="nut" disabled={v.dangLuu} onClick={() => bamLuu(i)}>
                    {v.dangLuu ? 'Đang lưu…' : trung ? 'Lưu (ghi đè kỳ đã có)' : dc?.khop ? 'Lưu kỳ này' : 'Vẫn lưu dù lệch'}
                  </button>
                )}
                {!v.daLuu && <button className="nut phu" onClick={() => setViec((x) => x.filter((_, j) => j !== i))}>Bỏ</button>}
              </div>
            </div>
            {v.loi?.map((l) => <div key={l} className="loi">{l}</div>)}
            {dc && (
              <table style={{ marginTop: 10 }}>
                <thead><tr><th>Đối chiếu với tổng ngân hàng in</th><th className="n">Sao kê in</th><th className="n">Cộng từ giao dịch</th><th /></tr></thead>
                <tbody>
                  {dc.muc.map((m) => (
                    <tr key={m.ten}><td>{m.ten}</td><td className="n">{dong(m.saoKe)}</td><td className="n">{dong(m.docDuoc)}</td><td className={m.khop ? 'ok' : 'sai'}>{m.khop ? '✔ khớp' : `✘ lệch ${dong(m.docDuoc - m.saoKe)}`}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
            {v.ky && (
              <div className="sub" style={{ marginTop: 8 }}>
                {v.ky.hanTra && <>Hạn trả {ngayVN(v.ky.hanTra)} · tối thiểu {dong(v.ky.toiThieu ?? 0)} · </>}
                {v.ky.hanMuc && <>hạn mức {dong(v.ky.hanMuc)} · </>}
                {trung && <span className="canh">kỳ {nhanKy(v.ky)} đã có trong dữ liệu, lưu sẽ thay bản cũ</span>}
              </div>
            )}
            {v.ky && !v.daLuu && (!dc?.khop || nghi.length > 0) && (
              <details open style={{ marginTop: 10 }}>
                <summary>{nghi.length ? `${nghi.length} dòng máy đọc chưa chắc (tô cam) — ` : ''}soát và sửa tay giao dịch</summary>
                <div className="sub" style={{ margin: '6px 0' }}>Mở file PDF gốc so từng dòng. Sửa số tiền ngay trong ô (chi tiêu ghi số âm, ghi có ghi số dương); bảng đối chiếu ở trên tự tính lại.</div>
                <div className="tbl">
                  <table>
                    <thead><tr><th>Ngày</th><th>Mô tả</th><th className="n">Số tiền</th></tr></thead>
                    <tbody>
                      {v.ky.giaoDich.map((g) => (
                        <tr key={g.id} className={g.nghiSai ? 'dong-nghi' : ''} title={g.nghiSai}>
                          <td><input type="text" value={ngayVN(g.ngay)} size={10} onChange={(e) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(e.target.value); if (m) suaGD(i, g.id, { ngay: `${m[3]}-${m[2]}-${m[1]}` }) }} /></td>
                          <td>{g.moTa}{g.nghiSai && <div className="tag canh">{g.nghiSai}</div>}</td>
                          <td className="n"><input type="number" value={g.soTien} step={1} style={{ width: 130, textAlign: 'right' }} onChange={(e) => suaGD(i, g.id, { soTien: Math.round(Number(e.target.value)) })} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </div>
        )
      })}
    </>
  )
}

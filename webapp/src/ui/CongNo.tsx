import { useState } from 'react';
import { SO_NGAY_QUA_HAN, tongCongNo, type KhoanUng } from '../lib/cong_no.js';
import { dinhDangNgay, dinhDangTien } from '../lib/tinh_toan.js';
import type { GiaoDich } from '../lib/types.js';

interface Props {
  ds: KhoanUng[];
  ton: number;
  onTra: (k: KhoanUng) => void;
  onChon: (g: GiaoDich) => void;
}

export function CongNo({ ds, ton, onTra, onChon }: Props) {
  const [hienXong, setHienXong] = useState(false);
  const t = tongCongNo(ds);
  const loc = (chieu: KhoanUng['chieu']) => ds.filter((k) => k.chieu === chieu && (hienXong || k.conLai > 0)).reverse();

  return (
    <div className="cong-no">
      <div className="tong-hop">
        <div className="o-so">
          <span>Phòng đang nợ (người ứng cho phòng)</span>
          <b className="chi">{dinhDangTien(t.phongNo)}</b>
        </div>
        <div className="o-so">
          <span>Đang ở ngoài (phòng ứng, chưa hoàn)</span>
          <b className="thu">{dinhDangTien(t.noPhong)}</b>
        </div>
        <div className="o-so" title="Tồn quỹ − phòng đang nợ + tiền đang ở ngoài">
          <span>Tồn quỹ khi thanh toán hết</span>
          <b className={ton - t.phongNo + t.noPhong < 0 ? 'am' : ''}>{dinhDangTien(ton - t.phongNo + t.noPhong)}</b>
        </div>
      </div>

      <label className="o-chon">
        <input type="checkbox" checked={hienXong} onChange={(e) => setHienXong(e.target.checked)} />
        Hiện cả khoản đã trả / hoàn xong
      </label>

      <BangUng
        tieuDe="Phòng phải trả"
        moTa="Thu nhóm “Ứng, vay”. Bấm Trả để ghi khoản chi trả lại (trả nhiều lần được)."
        ds={loc('phong_no')}
        nutTra="Trả"
        onTra={onTra}
        onChon={onChon}
      />
      <BangUng
        tieuDe="Phải thu hồi"
        moTa="Chi nhóm “Ứng, vay, trả”. Bấm Thu hồi để ghi khoản thu hoàn lại."
        ds={loc('no_phong')}
        nutTra="Thu hồi"
        onTra={onTra}
        onChon={onChon}
      />
    </div>
  );
}

function BangUng({
  tieuDe,
  moTa,
  ds,
  nutTra,
  onTra,
  onChon,
}: {
  tieuDe: string;
  moTa: string;
  ds: KhoanUng[];
  nutTra: string;
  onTra: (k: KhoanUng) => void;
  onChon: (g: GiaoDich) => void;
}) {
  return (
    <section className="cuon">
      <h3>{tieuDe}</h3>
      <p className="nho">{moTa}</p>
      {ds.length === 0 ? (
        <p className="nho">Không có khoản nào.</p>
      ) : (
        <table className="bang so-quy the-dt ung">
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Nội dung</th>
              <th className="so">Số tiền</th>
              <th className="so an-dt">Đã trả</th>
              <th className="so">Còn lại</th>
              <th className="so an-dt">Số ngày</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ds.map((k) => (
              <tr key={k.g.id} onClick={() => onChon(k.g)}>
                <td className="ngay">
                  {dinhDangNgay(k.g.ngay)}
                  {k.conLai > 0 && <span className="chi-dt"> · {k.soNgay} ngày</span>}
                </td>
                <td className="noi-dung">
                  {k.g.noiDung}
                  {k.g.doiTuong && <div className="nho">{k.g.doiTuong}</div>}
                  {k.cacLanTra.map((x) => (
                    <div
                      key={x.id}
                      className="nho lan-tra"
                      onClick={(e) => {
                        e.stopPropagation();
                        onChon(x);
                      }}
                    >
                      ↳ {dinhDangNgay(x.ngay)} · {x.noiDung} · {dinhDangTien(x.soTien)}
                    </div>
                  ))}
                </td>
                <td className="so goc">{dinhDangTien(k.g.soTien)}</td>
                <td className="so an-dt">{k.daTra ? dinhDangTien(k.daTra) : ''}</td>
                <td className="so tien">
                  {k.conLai ? <b>{dinhDangTien(k.conLai)}</b> : <span className="nhan-tag hoan">Xong</span>}
                </td>
                <td className={`so an-dt ${k.conLai && (k.soNgay ?? 0) > SO_NGAY_QUA_HAN ? 'am' : ''}`}>{k.conLai ? k.soNgay : ''}</td>
                <td className="nut">
                  {k.conLai > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTra(k);
                      }}
                    >
                      {nutTra}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

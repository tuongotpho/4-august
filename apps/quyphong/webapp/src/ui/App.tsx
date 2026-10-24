import { useEffect, useMemo, useRef, useState } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { coFirebase, firebase } from '../lib/firebase.js';
import { MO_CAI_DAT, QUA_CONG, TRANG_CHU, veTrangChuDangNhap } from '../lib/cong.js';
import { FirestoreStore } from '../lib/firestore_store.js';
import { LocalStore } from '../lib/local_store.js';
import type { DataStore } from '../lib/store.js';
import {
  cacNam,
  dinhDangNgay,
  dinhDangTien,
  docJson,
  loc,
  soQuy,
  tong,
  xuatCsv,
  type BoLoc,
} from '../lib/tinh_toan.js';
import { NHOM_CHI, NHOM_THU, type GiaoDich } from '../lib/types.js';
import { apMau, MAU_MAC_DINH, mauTuGiaoDich, ngayTruoc, type MauNhap } from '../lib/mau_nhap.js';
import { congNo, giaoDichTra } from '../lib/cong_no.js';
import { taoId } from '../lib/store.js';
import { ChonMau } from './ChonMau.js';
import { CongNo } from './CongNo.js';
import { FormGiaoDich } from './FormGiaoDich.js';
import { KetNoiAI } from './KetNoiAI.js';
import { ThongKe } from './ThongKe.js';

export function App() {
  const fb = firebase();
  const [user, setUser] = useState<User | null | undefined>(fb ? undefined : null);

  useEffect(() => (fb ? onAuthStateChanged(fb.auth, setUser) : undefined), []);

  const store = useMemo<DataStore | null>(() => {
    if (!fb) return new LocalStore();
    return user ? new FirestoreStore(fb.db, user.uid) : null;
  }, [user]);

  if (coFirebase && user === undefined) return <div className="giua">Đang tải…</div>;
  if (coFirebase && !user && QUA_CONG) {
    // Qua cổng chung: đăng nhập ở trang chủ
    veTrangChuDangNhap();
    return <div className="giua">Đang về trang chủ để đăng nhập…</div>;
  }
  if (coFirebase && !user)
    return (
      <div className="giua">
        <h1>Quỹ phòng KTAT</h1>
        <button className="chinh" onClick={() => signInWithPopup(fb!.auth, new GoogleAuthProvider())}>
          Đăng nhập bằng Google
        </button>
        <BanQuyen />
      </div>
    );

  return <SoQuy store={store!} user={user ?? null} onDangXuat={fb ? () => signOut(fb.auth) : undefined} />;
}

function BanQuyen() {
  return (
    <footer className="ban-quyen">
      <p>(C) August87 - 0982722036</p>
    </footer>
  );
}

type Tab = 'so' | 'thong-ke' | 'cong-no';

function SoQuy({ store, user, onDangXuat }: { store: DataStore; user: User | null; onDangXuat?: () => void }) {
  const [ds, setDs] = useState<GiaoDich[] | null>(null);
  const [loi, setLoi] = useState('');
  const [tab, setTab] = useState<Tab>('so');
  const [boLoc, setBoLoc] = useState<BoLoc>({});
  /** Form đang mở: sửa một giao dịch, hoặc thêm mới (theo mẫu hoặc trống). */
  const [form, setForm] = useState<{ ban?: GiaoDich; mau?: MauNhap | null; macDinh?: GiaoDich; tieuDe?: string } | null>(null);
  const [moChonMau, setMoChonMau] = useState(false);
  const [moAI, setMoAI] = useState(MO_CAI_DAT);
  /** Điện thoại: menu ⋯ ở đầu trang và phần lọc thêm (nhóm, năm, tháng…) mặc định gập. */
  const [moMenu, setMoMenu] = useState(false);
  const [moLoc, setMoLoc] = useState(false);
  const [mauRieng, setMauRieng] = useState<MauNhap[] | null>(null);
  const dsMau = mauRieng ?? MAU_MAC_DINH;
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => store.theoDoi(setDs, (e) => setLoi(e.message)), [store]);
  useEffect(() => store.theoDoiMau(setMauRieng), [store]);

  const themMau = (g: GiaoDich) => {
    const ten = prompt('Tên mẫu (hiện trên nút)', g.noiDung.trim());
    if (ten == null) return;
    store.luuMau([...dsMau, mauTuGiaoDich(g, ten)]).then(() => alert(`Đã thêm mẫu "${ten || g.noiDung}"`));
  };

  const so = useMemo(() => soQuy(ds ?? []), [ds]);
  const daLoc = useMemo(() => loc(so, boLoc), [so, boLoc]);
  const tongHet = tong(so);
  const tongLoc = tong(daLoc);
  const coLoc = Object.values(boLoc).some(Boolean);
  const soLocThem = (['loai', 'nhom', 'nam', 'thang', 'chiCanKiemTra'] as const).filter((k) => boLoc[k]).length;
  const soCanKT = so.filter((g) => g.canhBao.length).length;
  const khoanUng = useMemo(() => congNo(ds ?? [], ngayTruoc(0)), [ds]);
  const nam = cacNam(so);
  const dsNhom = boLoc.loai === 'thu' ? NHOM_THU : boLoc.loai === 'chi' ? NHOM_CHI : [...new Set([...NHOM_THU, ...NHOM_CHI])];

  const datLoc = (b: Partial<BoLoc>) => setBoLoc((x) => ({ ...x, ...b }));

  async function nhapFile(f: File) {
    try {
      const moi = docJson(JSON.parse(await f.text()));
      const thayThe =
        (ds?.length ?? 0) > 0 &&
        confirm(
          `Nhập ${moi.length} giao dịch.\n\nOK = THAY THẾ toàn bộ ${ds!.length} giao dịch hiện có.\nHủy = gộp thêm (trùng mã thì ghi đè).`,
        );
      await store.nhap(moi, thayThe);
    } catch (e) {
      alert('Không nhập được: ' + (e as Error).message);
    }
  }

  function xuat() {
    const blob = new Blob([xuatCsv(daLoc)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `so-quy-ktat-${new Date().toLocaleDateString('sv-SE')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="trang">
      <header>
        {/* Qua cổng chung: nút về trang chủ (mẫu thống nhất 5 app: góc trái, ô 40px, ngôi nhà), luôn hiện */}
        {QUA_CONG && (
          <a className="nut-trang-chu" href={TRANG_CHU} aria-label="Về trang chủ" title="Về trang chủ">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
              <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            </svg>
          </a>
        )}
        <h1>Quỹ phòng KTAT</h1>
        <div className={moMenu ? 'tai-khoan mo' : 'tai-khoan'}>
          <button className="nut-menu" aria-label="Menu" aria-expanded={moMenu} onClick={() => setMoMenu(!moMenu)}>
            ⋯
          </button>
          {moMenu && <div className="nen-menu" onClick={() => setMoMenu(false)} />}
          {/* Máy tính: các nút nằm ngang. Điện thoại: thành danh sách thả xuống từ nút ⋯ */}
          <div className="menu" onClick={() => setMoMenu(false)}>
            {user ? (
              <span className="nho email">{user.email}</span>
            ) : (
              <span className="nho email" title="Chưa cấu hình Firebase — dữ liệu chỉ nằm trong trình duyệt này">
                Lưu trên máy này
              </span>
            )}
            {/* Qua cổng chung: Kết nối AI, đăng xuất ở trang chủ (trang chủ mở Kết nối AI bằng ?cai-dat) */}
            {user && store.ai && !QUA_CONG && <button onClick={() => setMoAI(true)}>Kết nối AI</button>}
            <button onClick={() => fileRef.current?.click()}>Nhập JSON</button>
            <button onClick={xuat} disabled={!daLoc.length}>
              Xuất Excel (CSV)
            </button>
            {user && !QUA_CONG && <button onClick={onDangXuat}>Đăng xuất</button>}
          </div>
        </div>
      </header>

      <div className="tong-hop">
        <div className="o-so">
          <span>Tồn quỹ</span>
          <b className={tongHet.ton < 0 ? 'am' : ''}>{dinhDangTien(tongHet.ton)}</b>
        </div>
        <div className="o-so">
          <span>Tổng thu{coLoc && ' (đang lọc)'}</span>
          <b className="thu">{dinhDangTien(coLoc ? tongLoc.thu : tongHet.thu)}</b>
        </div>
        <div className="o-so">
          <span>Tổng chi{coLoc && ' (đang lọc)'}</span>
          <b className="chi">{dinhDangTien(coLoc ? tongLoc.chi : tongHet.chi)}</b>
        </div>
      </div>

      <nav className="the-tab">
        <button className={tab === 'so' ? 'chon' : ''} onClick={() => setTab('so')}>
          Sổ quỹ
        </button>
        <button className={tab === 'thong-ke' ? 'chon' : ''} onClick={() => setTab('thong-ke')}>
          Thống kê
        </button>
        <button className={tab === 'cong-no' ? 'chon' : ''} onClick={() => setTab('cong-no')}>
          Công nợ ứng
        </button>
        <span style={{ flex: 1 }} className="an-dt" />
        <button className="chinh an-dt" onClick={() => setMoChonMau(true)}>
          + Thêm
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) nhapFile(f);
            e.target.value = '';
          }}
        />
      </nav>

      {loi && <p className="loi">{loi}</p>}

      {ds === null ? (
        <p className="giua">Đang tải dữ liệu…</p>
      ) : ds.length === 0 ? (
        <div className="trong">
          <p>Chưa có giao dịch nào.</p>
          <p className="nho">
            Bấm <b>Nhập JSON</b> và chọn file <code>data/giao_dich.json</code> (tạo bởi <code>scripts/chuan_hoa.py</code>), hoặc{' '}
            <b>+ Thêm</b> để nhập tay.
          </p>
        </div>
      ) : (
        <>
          <div className="bo-loc" hidden={tab === 'cong-no'}>
            <input
              type="search"
              placeholder="Tìm nội dung, người, ghi chú…"
              value={boLoc.tuKhoa ?? ''}
              onChange={(e) => datLoc({ tuKhoa: e.target.value })}
            />
            <button className={soLocThem ? 'nut-loc chon' : 'nut-loc'} aria-expanded={moLoc} onClick={() => setMoLoc(!moLoc)}>
              Lọc{soLocThem ? ` (${soLocThem})` : ''} {moLoc ? '▴' : '▾'}
            </button>
            <div className={moLoc ? 'loc-them mo' : 'loc-them'}>
              <select value={boLoc.loai ?? ''} onChange={(e) => datLoc({ loai: e.target.value as BoLoc['loai'], nhom: '' })}>
                <option value="">Thu + Chi</option>
                <option value="thu">Thu</option>
                <option value="chi">Chi</option>
              </select>
              <select value={boLoc.nhom ?? ''} onChange={(e) => datLoc({ nhom: e.target.value })}>
                <option value="">Mọi nhóm</option>
                {dsNhom.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
              <select value={boLoc.nam ?? ''} onChange={(e) => datLoc({ nam: e.target.value })}>
                <option value="">Mọi năm</option>
                {nam.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
              <select value={boLoc.thang ?? ''} onChange={(e) => datLoc({ thang: e.target.value })}>
                <option value="">Mọi tháng</option>
                {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((t) => (
                  <option key={t} value={t}>
                    Tháng {+t}
                  </option>
                ))}
              </select>
              <label className="o-chon">
                <input type="checkbox" checked={!!boLoc.chiCanKiemTra} onChange={(e) => datLoc({ chiCanKiemTra: e.target.checked })} />
                Cần kiểm tra ({soCanKT})
              </label>
              {coLoc && <button onClick={() => setBoLoc({})}>Bỏ lọc</button>}
            </div>
          </div>

          {tab === 'cong-no' ? (
            <CongNo
              ds={khoanUng}
              ton={tongHet.ton}
              onChon={(g) => setForm({ ban: g })}
              onTra={(k) =>
                setForm({
                  macDinh: giaoDichTra(k, taoId(), ngayTruoc(0)),
                  tieuDe: k.chieu === 'phong_no' ? 'Trả tiền ứng' : 'Thu hồi tiền ứng',
                })
              }
            />
          ) : tab === 'so' ? (
            <BangSo ds={daLoc} onChon={(g) => setForm({ ban: g })} />
          ) : (
            <ThongKe ds={daLoc} />
          )}
        </>
      )}

      <BanQuyen />

      <button className="nut-noi" aria-label="Thêm giao dịch" onClick={() => setMoChonMau(true)}>
        +
      </button>

      {moAI && store.ai && <KetNoiAI ai={store.ai} onDong={() => setMoAI(false)} />}

      {moChonMau && (
        <ChonMau
          dsMau={dsMau}
          onChon={(m) => {
            setMoChonMau(false);
            setForm({ mau: m });
          }}
          onLuuMau={(x) => store.luuMau(x)}
          onDong={() => setMoChonMau(false)}
        />
      )}

      {form && (
        <FormGiaoDich
          ban={form.ban ?? null}
          macDinh={form.mau ? apMau(form.mau, ngayTruoc(0)) : form.macDinh}
          tenMau={form.mau ? `${form.mau.bieuTuong} ${form.mau.ten}` : form.tieuDe}
          khoanUng={khoanUng}
          onLuu={(g) => store.luu(g)}
          onXoa={(id) => store.xoa(id)}
          onLuuMau={themMau}
          onDong={() => setForm(null)}
        />
      )}
    </div>
  );
}

function BangSo({ ds, onChon }: { ds: ReturnType<typeof soQuy>; onChon: (g: GiaoDich) => void }) {
  const moiNhat = [...ds].reverse();
  return (
    <div className="cuon">
      <p className="nho">{ds.length} giao dịch — bấm vào một dòng để sửa</p>
      <table className="bang so-quy the-dt">
        <thead>
          <tr>
            <th>Ngày</th>
            <th>Nội dung</th>
            <th className="an-dt">Nhóm</th>
            <th className="so">Thu</th>
            <th className="so">Chi</th>
            <th className="so">Tồn quỹ</th>
            <th className="an-dt">HT</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {moiNhat.map((g) => {
            const v = g.canhBao;
            return (
              <tr key={g.id} onClick={() => onChon(g)}>
                <td className="ngay">
                  {dinhDangNgay(g.ngay)}
                  <span className="chi-dt"> · {g.nhom}</span>
                </td>
                <td className="noi-dung">
                  {g.noiDung}
                  {(g.doiTuong || g.ghiChu) && (
                    <div className="nho">{[g.doiTuong, g.ghiChu].filter(Boolean).join(' · ')}</div>
                  )}
                </td>
                <td className="nho an-dt">{g.nhom}</td>
                <td className="so thu tien">{g.loai === 'thu' ? dinhDangTien(g.soTien) : ''}</td>
                <td className="so chi tien">{g.loai === 'chi' ? dinhDangTien(g.soTien) : ''}</td>
                <td className={`so ton ${g.ton < 0 ? 'am' : ''}`}>{dinhDangTien(g.ton)}</td>
                <td className="nho an-dt">{g.hinhThuc}</td>
                <td className="nhan">{g.hinhThuc && <span className="nhan-tag chi-dt">{g.hinhThuc}</span>}
                  {g.daHoan && <span className="nhan-tag hoan">Đã hoàn</span>}
                  {v.length > 0 && (
                    <span className="nhan-tag canh-bao" title={v.join('\n')}>
                      !
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

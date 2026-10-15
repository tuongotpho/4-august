import { useEffect, useMemo, useRef, useState } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { coFirebase, firebase } from '../lib/firebase.js';
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
  vanDe,
  xuatCsv,
  type BoLoc,
} from '../lib/tinh_toan.js';
import { NHOM_CHI, NHOM_THU, type GiaoDich } from '../lib/types.js';
import { FormGiaoDich } from './FormGiaoDich.js';
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
  if (coFirebase && !user)
    return (
      <div className="giua">
        <h1>Quỹ phòng KTAT</h1>
        <button className="chinh" onClick={() => signInWithPopup(fb!.auth, new GoogleAuthProvider())}>
          Đăng nhập bằng Google
        </button>
      </div>
    );

  return <SoQuy store={store!} user={user ?? null} onDangXuat={fb ? () => signOut(fb.auth) : undefined} />;
}

type Tab = 'so' | 'thong-ke';

function SoQuy({ store, user, onDangXuat }: { store: DataStore; user: User | null; onDangXuat?: () => void }) {
  const [ds, setDs] = useState<GiaoDich[] | null>(null);
  const [loi, setLoi] = useState('');
  const [tab, setTab] = useState<Tab>('so');
  const [boLoc, setBoLoc] = useState<BoLoc>({});
  const [dangSua, setDangSua] = useState<GiaoDich | null | 'moi'>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => store.theoDoi(setDs, (e) => setLoi(e.message)), [store]);

  const so = useMemo(() => soQuy(ds ?? []), [ds]);
  const daLoc = useMemo(() => loc(so, boLoc), [so, boLoc]);
  const tongHet = tong(so);
  const tongLoc = tong(daLoc);
  const coLoc = Object.values(boLoc).some(Boolean);
  const soCanKT = so.filter((g) => vanDe(g).length).length;
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
        <h1>Quỹ phòng KTAT</h1>
        <div className="tai-khoan">
          {user ? (
            <>
              <span className="nho">{user.email}</span>
              <button onClick={onDangXuat}>Đăng xuất</button>
            </>
          ) : (
            <span className="nho" title="Chưa cấu hình Firebase — dữ liệu chỉ nằm trong trình duyệt này">
              Lưu trên máy này
            </span>
          )}
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
        <span style={{ flex: 1 }} />
        <button onClick={() => fileRef.current?.click()}>Nhập JSON</button>
        <button onClick={xuat} disabled={!daLoc.length}>
          Xuất Excel (CSV)
        </button>
        <button className="chinh" onClick={() => setDangSua('moi')}>
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
          <div className="bo-loc">
            <input
              type="search"
              placeholder="Tìm nội dung, người, ghi chú…"
              value={boLoc.tuKhoa ?? ''}
              onChange={(e) => datLoc({ tuKhoa: e.target.value })}
            />
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

          {tab === 'so' ? (
            <BangSo ds={daLoc} onChon={setDangSua} />
          ) : (
            <ThongKe ds={daLoc} />
          )}
        </>
      )}

      {dangSua && (
        <FormGiaoDich
          ban={dangSua === 'moi' ? null : dangSua}
          onLuu={(g) => store.luu(g)}
          onXoa={(id) => store.xoa(id)}
          onDong={() => setDangSua(null)}
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
      <table className="bang so-quy">
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
            const v = vanDe(g);
            return (
              <tr key={g.id} onClick={() => onChon(g)}>
                <td className="ngay">{dinhDangNgay(g.ngay)}</td>
                <td>
                  {g.noiDung}
                  {(g.doiTuong || g.ghiChu) && (
                    <div className="nho">{[g.doiTuong, g.ghiChu].filter(Boolean).join(' · ')}</div>
                  )}
                </td>
                <td className="nho an-dt">{g.nhom}</td>
                <td className="so thu">{g.loai === 'thu' ? dinhDangTien(g.soTien) : ''}</td>
                <td className="so chi">{g.loai === 'chi' ? dinhDangTien(g.soTien) : ''}</td>
                <td className={`so ${g.ton < 0 ? 'am' : ''}`}>{dinhDangTien(g.ton)}</td>
                <td className="nho an-dt">{g.hinhThuc}</td>
                <td>
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

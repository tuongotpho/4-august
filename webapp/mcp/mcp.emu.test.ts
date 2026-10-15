/**
 * Vòng đầy đủ AI ↔ web app trên Firebase emulator:  npm run test:emu
 * AI đăng ký -> người dùng cho phép -> đổi vé (PKCE) -> gọi công cụ -> web app (FirestoreStore) thấy ngay
 * -> thu hồi trên web app -> AI bị chặn. Thiếu FIRESTORE_EMULATOR_HOST thì bỏ qua.
 */
import { createHash, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { FirestoreStore } from '../src/lib/firestore_store.js';
import type { NhatKyAI, PhienAI } from '../src/lib/store.js';
import type { GiaoDich } from '../src/lib/types.js';
import { taoXuLy } from './web.js';

const coEmu = !!process.env.FIRESTORE_EMULATOR_HOST;
const GOC = 'http://may-chu.test';

async function dangNhap(ten: string) {
  const app = initializeApp({ apiKey: 'AIzaSyCfCX-xKHVnvv2tEb_AVdxL_xvqnnSjgcQ', projectId: 'app-from-ai', authDomain: 'x' }, ten);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app, 'quyphong');
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const { user } = await signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: ten, email: `${ten}@test.local` })));
  return { app, store: new FirestoreStore(db, user.uid), refreshToken: user.refreshToken };
}

const cho = <T>(dangKy: (cb: (x: T) => void) => () => void, dk: (x: T) => boolean) =>
  new Promise<T>((ok) => {
    const huy = dangKy((x) => {
      if (dk(x)) {
        setTimeout(() => huy());
        ok(x);
      }
    });
  });

describe.skipIf(!coEmu)('MCP quyphong trên emulator', () => {
  it('OAuth + công cụ + liên thông web app + thu hồi', async () => {
    const xuLy = taoXuLy({ ...process.env, QUY_GIA_LAP: '1', QUY_MCP_KHOA: randomBytes(32).toString('hex'), QUY_GOC_URL: GOC });
    const goi = (duong: string, init: RequestInit = {}) => xuLy(new Request(GOC + duong, init));
    const a = await dangNhap('chu-quy');
    await a.store.nhap(
      [
        { id: 'g1', loai: 'thu', ngay: '2026-10-01', soTien: 10_000_000, noiDung: 'Thưởng phòng', doiTuong: 'NPSC', ghiChu: '', daHoan: false, hinhThuc: '', nhom: 'Thưởng' },
        { id: 'g2', loai: 'chi', ngay: '2026-10-02', soTien: 2_000_000, noiDung: 'Liên hoan', doiTuong: '', ghiChu: '', daHoan: false, hinhThuc: '', nhom: 'Liên hoan, giao lưu' },
      ],
      true,
    );

    // 1. Thông tin khám phá
    const meta = await (await goi('/.well-known/oauth-authorization-server')).json();
    expect(meta.token_endpoint).toBe(`${GOC}/oauth/token`);

    // 2. Đăng ký: địa chỉ lạ bị từ chối, localhost được
    expect((await goi('/oauth/dang-ky', { method: 'POST', body: JSON.stringify({ redirect_uris: ['https://ke-gian.example/cb'] }) })).status).toBe(400);
    const redirect = 'http://localhost:33418/callback';
    const kh = await (await goi('/oauth/dang-ky', { method: 'POST', body: JSON.stringify({ redirect_uris: [redirect], client_name: 'Claude Code' }) })).json();

    // 3. Trang đăng nhập -> cho phép (giả trình duyệt gửi mã làm mới)
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const q = new URLSearchParams({ client_id: kh.client_id, redirect_uri: redirect, response_type: 'code', code_challenge: challenge, code_challenge_method: 'S256', state: 'abc' });
    const html = await (await goi(`/oauth/dang-nhap?${q}`)).text();
    const yeuCau = JSON.parse(/const yeuCau = (".*?");/.exec(html)![1]);
    const cp = await (await goi('/oauth/cho-phep', { method: 'POST', body: JSON.stringify({ yeuCau, maLamMoi: a.refreshToken, tenMay: 'Máy thử' }) })).json();
    const tra = new URL(cp.chuyenToi);
    expect(tra.searchParams.get('state')).toBe('abc');

    // 4. Đổi mã lấy vé: sai verifier bị từ chối
    const doiVe = (v: string) =>
      goi('/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'authorization_code', code: tra.searchParams.get('code')!, code_verifier: v, redirect_uri: redirect, client_id: kh.client_id }),
      });
    expect((await doiVe('sai')).status).toBe(400);
    const ve = await (await doiVe(verifier)).json();
    expect(ve.token_type).toBe('Bearer');

    // 5. Gọi công cụ
    let so = 0;
    const rpc = async (method: string, params: unknown, token = ve.access_token) => {
      const r = await goi('/mcp', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
        body: JSON.stringify({ jsonrpc: '2.0', id: ++so, method, params }),
      });
      return { status: r.status, j: r.status === 200 ? await r.json() : null };
    };
    const congCu = async (name: string, args: Record<string, unknown> = {}) => {
      const { j } = await rpc('tools/call', { name, arguments: args });
      return { loi: !!j.result.isError, kq: JSON.parse(j.result.content[0].text) };
    };

    expect((await rpc('tools/list', {}, 've-gia')).status).toBe(401);
    const ds = await rpc('tools/list', {});
    expect(ds.j.result.tools.map((t: { name: string }) => t.name).sort()).toEqual(
      ['danh_sach_giao_dich', 'danh_sach_mau', 'sua_giao_dich', 'them_giao_dich', 'tong_hop', 'tong_quan', 'xoa_giao_dich'].sort(),
    );

    const tq = (await congCu('tong_quan')).kq;
    expect(tq).toMatchObject({ so_giao_dich: 2, ton_quy: 8_000_000, tong_thu: 10_000_000, tong_chi: 2_000_000 });

    // Ghi theo mẫu, tiền dạng chữ
    const them = (await congCu('them_giao_dich', { mau: 'sinh nhật', noi_dung: 'Sinh nhật sếp Nam', so_tien: '3tr', ngay: '2026-10-10' })).kq;
    expect(them).toMatchObject({ da_ghi: true, mau_da_dung: 'Sinh nhật', ton_quy_moi: 5_000_000 });
    expect(them.giao_dich).toMatchObject({ loai: 'chi', nhom: 'Sinh nhật', hinh_thuc: 'TM', so_tien: 3_000_000 });
    // Nghi trùng -> không ghi
    expect((await congCu('them_giao_dich', { mau: 'Sinh nhật', noi_dung: 'Sinh nhật sếp Nam', so_tien: 3_000_000, ngay: '2026-10-10' })).kq.da_ghi).toBe(false);
    // Nhóm sai -> báo lỗi
    expect((await congCu('them_giao_dich', { loai: 'thu', noi_dung: 'x', so_tien: 1, nhom: 'Sinh nhật' })).loi).toBe(true);

    // Web app thấy ngay
    const webThay = await cho<GiaoDich[]>((cb) => a.store.theoDoi(cb), (x) => x.length === 3);
    const moi = webThay.find((g) => g.noiDung === 'Sinh nhật sếp Nam')!;
    expect(moi).toMatchObject({ soTien: 3_000_000, nhom: 'Sinh nhật', hinhThuc: 'TM', ngay: '2026-10-10' });

    // Lọc + sửa + xoá
    expect((await congCu('danh_sach_giao_dich', { tim: 'sinh nhat' })).kq.so_dong).toBe(1);
    const sua = (await congCu('sua_giao_dich', { id: moi.id, so_tien: 3_500_000, hinh_thuc: 'CK' })).kq;
    expect(sua.thay_doi.map((x: { o: string }) => x.o).sort()).toEqual(['hinhThuc', 'soTien']);
    expect((await congCu('xoa_giao_dich', { id: moi.id, xac_nhan: 'sai' })).kq).toMatchObject({ da_xoa: false, can_xac_nhan: 'Sinh nhật sếp Nam' });
    expect((await congCu('xoa_giao_dich', { id: moi.id, xac_nhan: 'Sinh nhật sếp Nam' })).kq).toMatchObject({ da_xoa: true, ton_quy_moi: 8_000_000 });

    // Nhật ký + phiên hiện trên web app
    const nk = await cho<NhatKyAI[]>((cb) => a.store.ai.theoDoiNhatKy(cb), (x) => x.length === 3);
    expect(nk.map((x) => x.congCu).sort()).toEqual(['sua_giao_dich', 'them_giao_dich', 'xoa_giao_dich']);
    const phien = await cho<PhienAI[]>((cb) => a.store.ai.theoDoiPhien(cb), (x) => x.length === 1);
    expect(phien[0]).toMatchObject({ tenMay: 'Máy thử', ungDung: 'Claude Code', noiNhan: 'localhost:33418' });

    // Làm mới vé được; thu hồi trên web app -> /mcp và làm mới đều bị chặn
    const lamMoi = () =>
      goi('/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: ve.refresh_token }),
      });
    expect((await lamMoi()).status).toBe(200);
    await a.store.ai.thuHoi(phien[0].id);
    expect((await rpc('tools/list', {})).status).toBe(401);
    expect((await lamMoi()).status).toBe(400);

    await deleteApp(a.app);
  }, 60_000);
});

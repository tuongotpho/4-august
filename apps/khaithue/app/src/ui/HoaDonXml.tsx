// Mục "Hoá đơn điện tử XML" ở tab Kho hồ sơ: tải XML / ZIP lên là lưu kho luôn (chống trùng); quản lý danh sách đã lưu
// (thẻ tổng mua / bán, lọc theo tháng, loại, tình trạng, thuế suất, đối tác; nhóm; xếp; xuất Excel);
// mở xem như bản in (thay iTax Viewer — vốn không đọc được hoá đơn), tải lại file XML gốc.
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import * as XLSX from 'xlsx'
import type { Kho } from '../core/kho'
import { tien } from '../core/nhan'
import { parseInvoice, TINH_CHAT_LQ, tienXem, type BenHoaDon, type ChuKy, type HoaDonXem } from '../core/xemHoaDon'
import { VungThaFile } from './chung'
import {
  congTheoChieu, demTheo, dongExcel, lapDanhSach, locDanhSach, LOC_TRONG, nhomDanhSach, TEN_CAN_XEM, TEN_LOAI, TEN_TINH_TRANG, xepDanhSach,
  type BoLoc, type Cong, type CotXep, type KieuNhom, type LoaiHd, type TinhTrang,
} from '../core/quanLyXml'

export interface DongNapXml {
  ten: string
  kq: 'moi' | 'daCo' | 'loi'
  moTa: string
  khoa?: string
}

export interface BaoCaoNapXml {
  dong: DongNapXml[]
  dangNhap: boolean
  loiMay: number
}

const ngayIn = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}
const ngayGio = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s)
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : s
}
const HTTT: Record<string, string> = { TM: 'Tiền mặt', CK: 'Chuyển khoản', 'TM/CK': 'Tiền mặt / Chuyển khoản' }

function taiVe(ten: string, du: Uint8Array) {
  const url = URL.createObjectURL(new Blob([du as Uint8Array<ArrayBuffer>], { type: 'application/xml' }))
  const a = document.createElement('a')
  a.href = url
  a.download = ten
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function HoaDonXmlDN({ kho, mst, dangNhap, coFileGoc, onNap, layXml }: {
  kho: Kho
  mst: string
  dangNhap: boolean
  /** Hoá đơn này đã có file XML gốc trên mây chưa */
  coFileGoc: (khoa: string) => boolean
  onNap: (f: File[]) => Promise<BaoCaoNapXml>
  layXml: (khoa: string) => Promise<{ ten: string; du: Uint8Array } | null>
}) {
  const [dang, setDang] = useState(false)
  const [bc, setBc] = useState<BaoCaoNapXml | null>(null)
  const [xemDaCo, setXemDaCo] = useState(false)
  const [moNap, setMoNap] = useState(false)
  const [loc, setLoc] = useState<BoLoc>(LOC_TRONG)
  const [nhom, setNhom] = useState<KieuNhom>('')
  const [xep, setXep] = useState<{ cot: CotXep; giam: boolean }>({ cot: 'ngay', giam: true })
  const [dong, setDong] = useState<Set<string>>(new Set())
  const [mo, setMo] = useState<string | null>(null)
  const datLoc = (x: Partial<BoLoc>) => setLoc((l) => ({ ...l, ...x }))

  const ds = useMemo(() => lapDanhSach(kho.goc?.[mst], mst, dangNhap ? coFileGoc : undefined), [kho, mst, dangNhap, coFileGoc])
  const cacThang = useMemo(() => [...demTheo(ds, (x) => x.thang)].sort((a, b) => b[0].split('/').reverse().join('').localeCompare(a[0].split('/').reverse().join(''))), [ds])
  const cacThueSuat = useMemo(() => [...demTheo(ds, (x) => x.thueSuat)].sort((a, b) => b[1] - a[1]), [ds])
  const cacLoai = useMemo(() => demTheo(ds, (x) => x.loai), [ds])
  const cacTinhTrang = useMemo(() => demTheo(ds, (x) => x.tinhTrang), [ds])
  // Thẻ tổng: theo mọi bộ lọc trừ chiều (để thấy cả mua lẫn bán)
  const theoChieu = useMemo(() => {
    const d = locDanhSach(ds, { ...loc, chieu: '', canXem: false })
    return { ...congTheoChieu(d), canXem: d.filter((x) => x.canXem.length).length }
  }, [ds, loc])
  const daLoc = useMemo(() => xepDanhSach(locDanhSach(ds, loc), xep.cot, xep.giam), [ds, loc, xep])
  const cacNhom = useMemo(() => nhomDanhSach(daLoc, nhom), [daLoc, nhom])
  // Thứ tự Trước / Sau trong hộp xem: theo đúng thứ tự đang hiện (bỏ nhóm đang thu gọn)
  const thuTu = useMemo(() => cacNhom.filter((n) => !dong.has(n.khoa)).flatMap((n) => n.ds.map((x) => x.khoa)), [cacNhom, dong])
  const viTri = mo ? thuTu.indexOf(mo) : -1
  const tenDoiTac = loc.doiTac ? ds.find((x) => x.doiTac.mst === loc.doiTac)?.doiTac.ten : ''
  const coLoc = JSON.stringify(loc) !== JSON.stringify(LOC_TRONG)

  async function nap(f: File[]) {
    if (!f.length || dang) return
    setDang(true)
    setXemDaCo(false)
    try {
      setBc(await onNap(f))
      setMoNap(false)
    } finally {
      setDang(false)
    }
  }

  function xuatExcel() {
    const ws = XLSX.utils.json_to_sheet(dongExcel(daLoc))
    ws['!cols'] = [10, 9, 8, 9, 8, 13, 16, 13, 40, 10, 15, 13, 15, 30, 26, 40].map((wch) => ({ wch }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Hoa don XML')
    XLSX.writeFile(wb, `hoa-don-xml-${mst}${loc.thang ? `-${loc.thang.replace('/', '-')}` : ''}.xlsx`)
  }

  const dem = (kq: DongNapXml['kq']) => bc?.dong.filter((d) => d.kq === kq).length ?? 0
  const vungNap = (
    <VungThaFile
      accept=".xml,.zip"
      onFiles={(f) => void nap(f)}
      nhan={
        <>
          <div className="font-medium">{dang ? 'Đang đọc và lưu…' : 'Kéo thả file hoá đơn XML vào đây, hoặc bấm để chọn'}</div>
          <div className="mt-1 text-slate-600">Một hay nhiều file <b>.xml</b>, hoặc nguyên gói <b>.zip</b> (kể cả gói của tiện ích tải hoá đơn hàng loạt). Hoá đơn đã có trong kho thì báo “đã có”, không ghi đè.</div>
        </>
      }
    />
  )
  const nutXep = (cot: CotXep, chu: string, phai = false) => (
    <button onClick={() => setXep((x) => ({ cot, giam: x.cot === cot ? !x.giam : cot !== 'doiTac' }))} className={`inline-flex items-center gap-0.5 hover:text-slate-900 ${phai ? 'flex-row-reverse' : ''}`}>
      {chu}<span className="w-3 text-xs">{xep.cot === cot ? (xep.giam ? '▼' : '▲') : ''}</span>
    </button>
  )

  return (
    <div className="space-y-3 text-sm">
      {ds.length === 0 || moNap ? vungNap : (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setMoNap(true)} className="rounded-lg bg-emerald-700 px-3 py-1.5 font-medium text-white">＋ Tải thêm hoá đơn XML / ZIP</button>
          <span className="text-xs text-slate-500">App cộng lại các con số trên hoá đơn, <b>không kiểm chữ ký số</b>. Muốn biết thật / giả: tra hoadondientu.gdt.gov.vn.</span>
        </div>
      )}
      {(ds.length === 0 || moNap) && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
          App đọc file XML hoá đơn, hiện như bản in và <b>cộng lại các con số</b> (dòng hàng, thuế, tổng tiền). App <b>KHÔNG kiểm chữ ký số</b> — muốn biết
          hoá đơn thật hay giả, tra trên <b>hoadondientu.gdt.gov.vn</b>.
          {moNap && ds.length > 0 && <button onClick={() => setMoNap(false)} className="ml-2 underline">Đóng ô tải lên</button>}
        </p>
      )}
      {!dangNhap && <p className="text-slate-500">Chưa đăng nhập: hoá đơn chỉ vào sổ trên máy này, file XML gốc chưa được lưu lên mây.</p>}

      {bc && (
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="flex items-start gap-2">
            <p className="flex-1">
              <b className="text-emerald-700">{dem('moi')} hoá đơn mới{bc.dangNhap ? ' đã lưu vào kho' : ' đã vào sổ trên máy'}</b>
              {' · '}<b>{dem('daCo')} đã có</b> (không ghi đè)
              {' · '}<b className={dem('loi') ? 'text-red-700' : ''}>{dem('loi')} lỗi</b>
              {' '}— tổng {bc.dong.length} file.
            </p>
            <button onClick={() => setBc(null)} className="text-slate-400 hover:text-slate-700" title="Ẩn kết quả">✕</button>
          </div>
          <ul className="mt-2 max-h-48 space-y-1 overflow-auto">
            {bc.dong.filter((d) => d.kq === 'loi').map((d, i) => (
              <li key={`l${i}`} className="rounded bg-red-50 px-2 py-1 text-red-800">⛔ <b>{d.ten}</b>: {d.moTa}</li>
            ))}
            {bc.dong.filter((d) => d.kq === 'moi').map((d, i) => (
              <li key={`m${i}`} className="text-slate-700">✅ {d.moTa}</li>
            ))}
          </ul>
          {dem('daCo') > 0 && (
            <>
              <button className="mt-1 text-emerald-700 underline" onClick={() => setXemDaCo(!xemDaCo)}>{xemDaCo ? 'Ẩn' : 'Xem'} {dem('daCo')} hoá đơn đã có</button>
              {xemDaCo && (
                <ul className="mt-1 max-h-48 space-y-0.5 overflow-auto text-slate-600">
                  {bc.dong.filter((d) => d.kq === 'daCo').map((d, i) => <li key={`d${i}`}>↺ {d.moTa}</li>)}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {ds.length === 0 ? (
        <p className="text-slate-500">Chưa có hoá đơn XML nào trong kho của công ty này.</p>
      ) : (
        <div className="space-y-3">
          {/* Thẻ tổng: bấm để lọc */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-the-tong-xml>
            <TheTong mau="sky" chu="Mua vào" phu="thuế đầu vào" c={theoChieu.mua} chon={loc.chieu === 'mua'} onClick={() => datLoc({ chieu: loc.chieu === 'mua' ? '' : 'mua' })} />
            <TheTong mau="emerald" chu="Bán ra" phu="thuế đầu ra" c={theoChieu.ban} chon={loc.chieu === 'ban'} onClick={() => datLoc({ chieu: loc.chieu === 'ban' ? '' : 'ban' })} />
            <button onClick={() => datLoc({ canXem: !loc.canXem })} className={`col-span-2 rounded-xl border p-3 text-left transition sm:col-span-1 ${loc.canXem ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-300' : 'border-slate-200 bg-white hover:border-amber-400'}`}>
              <div className="text-slate-500">⚠️ Cần xem lại</div>
              <div className="text-2xl font-bold text-amber-700">{theoChieu.canXem}</div>
              <div className="text-xs text-slate-500">thiếu mã CQT, không chữ ký số, chưa có file gốc trên mây</div>
            </button>
          </div>

          {/* Tháng */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <Chip chon={!loc.thang} onClick={() => datLoc({ thang: '' })}>Mọi tháng <i>{ds.length}</i></Chip>
            {cacThang.map(([t, n]) => <Chip key={t} chon={loc.thang === t} onClick={() => datLoc({ thang: loc.thang === t ? '' : t })}>Th {t} <i>{n}</i></Chip>)}
          </div>

          {/* Lọc + nhóm */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-2">
            <input value={loc.tim} onChange={(e) => datLoc({ tim: e.target.value })} placeholder="🔍 Tìm: tên, MST, ký hiệu, số, tên hàng…" className="min-w-48 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5" />
            <Chon value={loc.loai} onChange={(v) => datLoc({ loai: v as BoLoc['loai'] })} tatCa="Mọi loại HĐ" muc={(Object.keys(TEN_LOAI) as LoaiHd[]).filter((k) => cacLoai.has(k)).map((k) => [k, `${TEN_LOAI[k]} (${cacLoai.get(k)})`])} />
            <Chon value={loc.tinhTrang} onChange={(v) => datLoc({ tinhTrang: v as BoLoc['tinhTrang'] })} tatCa="Mọi tình trạng" muc={(Object.keys(TEN_TINH_TRANG) as TinhTrang[]).filter((k) => cacTinhTrang.has(k)).map((k) => [k, `${TEN_TINH_TRANG[k]} (${cacTinhTrang.get(k)})`])} />
            <Chon value={loc.thueSuat} onChange={(v) => datLoc({ thueSuat: v })} tatCa="Mọi thuế suất" muc={cacThueSuat.map(([k, n]) => [k, `Thuế ${k} (${n})`])} />
            <span className="mx-1 hidden h-6 w-px bg-slate-300 sm:block" />
            <Chon value={nhom} onChange={(v) => (setNhom(v as KieuNhom), setDong(new Set()))} tatCa="Không nhóm" muc={[['thang', 'Nhóm theo tháng'], ['doiTac', 'Nhóm theo đối tác'], ['loai', 'Nhóm theo loại HĐ'], ['thueSuat', 'Nhóm theo thuế suất']]} />
            <button onClick={xuatExcel} disabled={!daLoc.length} className="rounded-lg border border-emerald-600 bg-white px-3 py-1.5 text-emerald-700 disabled:opacity-40">⬇ Excel</button>
          </div>

          {(coLoc || loc.doiTac) && (
            <div className="flex flex-wrap items-center gap-2 text-slate-600">
              <span>Đang xem <b>{daLoc.length}</b>/{ds.length} hoá đơn</span>
              {loc.doiTac && (
                <button onClick={() => datLoc({ doiTac: '' })} className="max-w-full truncate rounded-full bg-emerald-700 px-3 py-1 text-xs text-white">
                  ✕ Đối tác: {tenDoiTac || loc.doiTac}
                </button>
              )}
              <button onClick={() => setLoc(LOC_TRONG)} className="text-emerald-700 underline">Bỏ mọi bộ lọc</button>
            </div>
          )}

          {/* Danh sách */}
          {daLoc.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500">Không có hoá đơn nào khớp bộ lọc.</p>
          ) : (
            <div className="max-h-[40rem] overflow-auto rounded-xl border border-slate-200">
              <table className="w-full">
                <thead className="sticky top-0 z-10 bg-slate-100 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-2">{nutXep('ngay', 'Ngày')}</th>
                    <th className="p-2">Hoá đơn</th>
                    <th className="p-2">{nutXep('doiTac', 'Đối tác')}</th>
                    <th className="hidden p-2 md:table-cell">Thuế suất</th>
                    <th className="hidden p-2 text-right sm:table-cell">Trước thuế</th>
                    <th className="hidden p-2 text-right sm:table-cell">{nutXep('thue', 'Thuế', true)}</th>
                    <th className="p-2 text-right">{nutXep('tong', 'Tổng', true)}</th>
                  </tr>
                </thead>
                {cacNhom.map((n) => (
                  <tbody key={n.khoa || 'tat-ca'}>
                    {nhom && (
                      <tr className="cursor-pointer border-t border-slate-200 bg-slate-50 hover:bg-slate-100" onClick={() => setDong((s) => { const m = new Set(s); if (m.has(n.khoa)) m.delete(n.khoa); else m.add(n.khoa); return m })}>
                        <td colSpan={4} className="p-2">
                          <span className="mr-1 inline-block w-3 text-slate-400">{dong.has(n.khoa) ? '▸' : '▾'}</span>
                          <b>{n.ten}</b> <span className="text-slate-500">· {n.cong.so} HĐ{n.phu ? ` · ${n.phu}` : ''}</span>
                        </td>
                        <td className="hidden p-2 text-right font-medium sm:table-cell">{tien(n.cong.chuaThue)}</td>
                        <td className="hidden p-2 text-right font-medium sm:table-cell">{tien(n.cong.thue)}</td>
                        <td className="p-2 text-right font-semibold">{tien(n.cong.tong)}</td>
                      </tr>
                    )}
                    {!dong.has(n.khoa) && n.ds.map((x) => (
                      <tr key={x.khoa} onClick={() => setMo(x.khoa)} className={`cursor-pointer border-t border-slate-100 hover:bg-emerald-50 ${mo === x.khoa ? 'bg-emerald-50' : ''}`}>
                        <td className={`whitespace-nowrap border-l-4 p-2 ${x.chieu === 'ban' ? 'border-emerald-500' : 'border-sky-500'}`}>
                          {x.g.ngay}
                          <div className={`text-xs ${x.chieu === 'ban' ? 'text-emerald-700' : 'text-sky-700'}`}>{x.chieu === 'ban' ? 'Bán ra' : 'Mua vào'}</div>
                        </td>
                        <td className="whitespace-nowrap p-2">
                          <b>{x.g.kyHieu}</b>-{x.g.so}
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {x.loai !== 'coMa' && <Nhan mau="slate">{TEN_LOAI[x.loai]}</Nhan>}
                            {x.tinhTrang !== 'goc' && <Nhan mau="violet">{x.tinhTrang === 'thayThe' ? 'Thay thế' : 'Điều chỉnh'}</Nhan>}
                            {x.canXem.map((c) => <Nhan key={c} mau="amber" title={TEN_CAN_XEM[c]}>{c === 'thieuMa' ? '⚠ thiếu mã' : c === 'khongKy' ? '⚠ không ký' : '☁̸ chưa có file'}</Nhan>)}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="line-clamp-2">{x.doiTac.ten}</div>
                          <button
                            onClick={(e) => { e.stopPropagation(); datLoc({ doiTac: loc.doiTac === x.doiTac.mst ? '' : x.doiTac.mst }) }}
                            title="Chỉ xem hoá đơn của đối tác này"
                            className="text-xs text-slate-500 hover:text-emerald-700 hover:underline"
                          >{x.doiTac.mst}</button>
                        </td>
                        <td className="hidden p-2 text-slate-600 md:table-cell">{x.thueSuat.join(', ')}</td>
                        <td className="hidden p-2 text-right sm:table-cell">{tien(x.g.chuaThue)}</td>
                        <td className="hidden p-2 text-right sm:table-cell">{tien(x.g.thue)}</td>
                        <td className="p-2 text-right font-medium">{tien(x.g.tong)}</td>
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          )}
          <p className="text-xs text-slate-500">Bấm một dòng để xem bản hoá đơn (phím ← → để lật). Bấm MST để lọc theo đối tác. Bấm tiêu đề cột để xếp. Danh sách gồm hoá đơn XML đã nạp (cả từ ô “Nạp toàn bộ hồ sơ thuế”).</p>
        </div>
      )}

      {mo && (
        <XemHoaDon
          khoa={mo}
          layXml={layXml}
          dong={() => setMo(null)}
          truoc={viTri > 0 ? () => setMo(thuTu[viTri - 1]) : undefined}
          sau={viTri >= 0 && viTri < thuTu.length - 1 ? () => setMo(thuTu[viTri + 1]) : undefined}
        />
      )}
    </div>
  )
}

const MAU_THE = {
  sky: { vien: 'border-sky-500 bg-sky-50 ring-2 ring-sky-300', chu: 'text-sky-700' },
  emerald: { vien: 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-300', chu: 'text-emerald-700' },
}

function TheTong({ mau, chu, phu, c, chon, onClick }: { mau: keyof typeof MAU_THE; chu: string; phu: string; c: Cong; chon: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={!c.so} className={`min-w-0 rounded-xl border p-2 text-left transition disabled:opacity-50 sm:p-3 ${chon ? MAU_THE[mau].vien : 'border-slate-200 bg-white hover:border-slate-400'}`}>
      <div className="flex items-baseline justify-between text-slate-500"><span>{chu}</span><span><b className={`text-2xl ${MAU_THE[mau].chu}`}>{c.so}</b> HĐ</span></div>
      <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 text-xs text-slate-600">
        <span>Tiền hàng</span><span className="text-right">{tien(c.chuaThue)}</span>
        <span>Thuế ({phu})</span><span className="text-right font-medium text-slate-800">{tien(c.thue)}</span>
        <span>Tổng thanh toán</span><span className="text-right font-semibold text-slate-900">{tien(c.tong)}</span>
      </div>
    </button>
  )
}

function Chip({ chon, onClick, children }: { chon: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs [&_i]:ml-1 [&_i]:not-italic [&_i]:opacity-60 ${chon ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-emerald-500'}`}>
      {children}
    </button>
  )
}

function Chon({ value, onChange, tatCa, muc }: { value: string; onChange: (v: string) => void; tatCa: string; muc: [string, string][] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`rounded-lg border px-2 py-1.5 ${value ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-300 bg-white'}`}>
      <option value="">{tatCa}</option>
      {muc.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
    </select>
  )
}

const MAU_NHAN = { slate: 'bg-slate-100 text-slate-700', violet: 'bg-violet-100 text-violet-800', amber: 'bg-amber-100 text-amber-800' }

function Nhan({ mau, title, children }: { mau: keyof typeof MAU_NHAN; title?: string; children: ReactNode }) {
  return <span title={title} className={`rounded px-1.5 py-0.5 text-[11px] font-normal ${MAU_NHAN[mau]}`}>{children}</span>
}

/** Hộp xem một hoá đơn: tải file XML gốc (phiên này / mây), đọc, hiện như bản in */
function XemHoaDon({ khoa, layXml, dong, truoc, sau }: {
  khoa: string
  layXml: (khoa: string) => Promise<{ ten: string; du: Uint8Array } | null>
  dong: () => void
  truoc?: () => void
  sau?: () => void
}) {
  const [tt, setTt] = useState<{ khoa: string; tep?: { ten: string; du: Uint8Array } | null; inv?: HoaDonXem; loi?: string } | null>(null)
  useEffect(() => {
    let huy = false
    layXml(khoa).then(
      (tep) => {
        if (huy) return
        if (!tep) return setTt({ khoa, tep: null })
        try {
          setTt({ khoa, tep, inv: parseInvoice(new TextDecoder().decode(tep.du), tep.ten) })
        } catch (e) {
          setTt({ khoa, tep, loi: (e as Error).message })
        }
      },
      (e) => !huy && setTt({ khoa, loi: `Không tải được file từ mây: ${(e as Error).message}` }),
    )
    return () => {
      huy = true
    }
  }, [khoa, layXml])
  useEffect(() => {
    const phim = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dong()
      if (e.key === 'ArrowLeft' && truoc) truoc()
      if (e.key === 'ArrowRight' && sau) sau()
    }
    window.addEventListener('keydown', phim)
    return () => window.removeEventListener('keydown', phim)
  }, [dong, truoc, sau])
  const xong = tt?.khoa === khoa ? tt : null

  function inRa() {
    document.body.classList.add('in-hoa-don')
    const bo = () => {
      document.body.classList.remove('in-hoa-don')
      window.removeEventListener('afterprint', bo)
    }
    window.addEventListener('afterprint', bo)
    window.print()
  }

  return createPortal(
    <div className="hop-hoa-don fixed inset-0 z-50 overflow-auto bg-slate-900/50 p-2 sm:p-6" onClick={dong}>
      <div className="mx-auto max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <div className="khong-in mb-2 flex flex-wrap items-center gap-2 rounded-xl bg-white p-2">
          <button onClick={truoc} disabled={!truoc} className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40">‹ Trước</button>
          <button onClick={sau} disabled={!sau} className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40">Sau ›</button>
          <span className="flex-1" />
          {xong?.tep && <button onClick={() => taiVe(xong.tep!.ten, xong.tep!.du)} className="rounded-lg border border-emerald-600 px-3 py-1.5 text-emerald-700">⬇ Tải file XML gốc</button>}
          {xong?.inv && <button onClick={inRa} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-white">In / Lưu PDF</button>}
          <button onClick={dong} className="rounded-lg border border-slate-300 px-3 py-1.5">✕ Đóng</button>
        </div>
        {!xong ? (
          <div className="rounded-xl bg-white p-6 text-center text-slate-600">Đang mở hoá đơn…</div>
        ) : xong.loi ? (
          <div className="rounded-xl bg-white p-6 text-red-700">⛔ {xong.loi}</div>
        ) : !xong.inv ? (
          <div className="rounded-xl bg-white p-6 text-slate-700">
            Chưa có file XML gốc của hoá đơn này để xem bản in (hoá đơn nạp lúc chưa đăng nhập, hoặc nạp ở máy khác bằng bản app cũ). Đăng nhập rồi nạp lại file XML là xem được.
          </div>
        ) : (
          <>
            <div className="khong-in mb-2 space-y-1">
              {xong.inv.kiem.map((k, i) => (
                <div key={i} className={`rounded-lg px-3 py-2 text-sm ${k.muc === 'dat' ? 'bg-emerald-50 text-emerald-800' : k.muc === 'canhBao' ? 'bg-red-50 text-red-800' : 'bg-sky-50 text-sky-900'}`}>
                  {k.muc === 'dat' ? '✅ ' : k.muc === 'canhBao' ? '⚠️ ' : 'ℹ️ '}{k.noiDung}
                </div>
              ))}
              <div className="rounded-lg bg-white/90 px-3 py-2 text-xs text-slate-600">
                File: {xong.tep!.ten} · chuẩn XML {xong.inv.pban || '?'} · app chỉ hiển thị và cộng tiền, <b>không kiểm chữ ký số</b>.
              </div>
            </div>
            <BanInHoaDon inv={xong.inv} />
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

function DongBen({ ben, laBan, httt }: { ben: BenHoaDon | null; laBan: boolean; httt: string }) {
  if (!ben) return null
  const o = ben.o
  const dong: [string, string][] = [
    [laBan ? 'Đơn vị bán hàng' : 'Đơn vị mua hàng', o.Ten ?? ''],
    ['Họ tên người mua hàng', laBan ? '' : o.HVTNMHang ?? ''],
    ['Mã số thuế', o.MST ?? ''],
    ['Mã khách hàng', o.MKHang ?? ''],
    ['Mã ĐVQHNS', o.MDVQHNSach ?? ''],
    ['Địa chỉ', o.DChi ?? ''],
    ['Điện thoại', o.SDThoai ?? ''],
    ['Email', o.DCTDTu ?? ''],
    ['Số tài khoản', o.STKNHang ? `${o.STKNHang}${o.TNHang ? ` tại ${o.TNHang}` : ''}` : ''],
    ['Tên cửa hàng', o.TCHang ?? ''],
    ['Điểm kinh doanh', [o.TDDKDoanh, o.DCDDKDoanh].filter(Boolean).join(' – ')],
    ['Fax', o.Fax ?? ''],
    ['Website', o.Website ?? ''],
    ['Hình thức thanh toán', laBan ? '' : HTTT[httt] ?? httt],
  ]
  return (
    <div className="border-t border-dashed border-slate-300 py-2">
      {dong.filter((d) => d[1]).map(([k, v], i) => (
        <div key={k} className="flex gap-2">
          <span className="w-40 shrink-0 text-slate-500 sm:w-48">{k}:</span>
          <span className={i === 0 ? 'font-semibold uppercase' : ''}>{v}</span>
        </div>
      ))}
    </div>
  )
}

function Dau({ ky, nhan }: { ky: ChuKy | null; nhan: string }) {
  if (!ky) return <div className="inline-block rounded border border-dashed border-slate-400 px-3 py-2 text-slate-500">Không có chữ ký số</div>
  return (
    <div className="inline-block rounded border-2 border-red-600 px-3 py-2 text-left text-xs text-red-700">
      ✔ {nhan}<br />
      <b>Ký bởi:</b> {ky.ten || ky.chuThe || '(không rõ tên)'}<br />
      <b>Ký ngày:</b> {ngayGio(ky.luc)}
    </div>
  )
}

/** Bản thể hiện của hoá đơn (giống tờ in) */
export function BanInHoaDon({ inv }: { inv: HoaDonXem }) {
  const tsChung = inv.thueSuat.length === 1 ? inv.thueSuat[0].ts : ''
  const bangThue = inv.thueSuat.length > 1 || inv.thueSuat.some((t) => t.ts && !inv.dong.every((d) => d.ts === t.ts))
  const khac = [...inv.khacChung, ...inv.khacToan, ...(inv.ban?.khac ?? []), ...(inv.mua?.khac ?? [])]
  const lq = inv.lienQuan
  const tong: [string, number | null][] = [
    ['Cộng tiền hàng', inv.tongTruocThue],
    ...(inv.ckTM ? [['Chiết khấu thương mại', inv.ckTM] as [string, number]] : []),
    [`Tiền thuế GTGT${tsChung ? ` (${tsChung})` : ''}`, inv.tongThue],
    ...inv.phi.map((p) => [p.ten || 'Phí', p.tien] as [string, number | null]),
  ]
  return (
    <div className="ban-in-hd rounded-xl bg-white p-4 text-sm text-slate-900 shadow sm:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1 text-center">
          <h2 className="text-xl font-bold uppercase text-red-700">{inv.loai}</h2>
          <div className="italic text-slate-500">(Bản thể hiện của hoá đơn điện tử)</div>
          <div>Ngày {ngayIn(inv.ngay).replace(/\//g, ' / ')}</div>
        </div>
        <div className="sm:w-48">
          Mẫu số: <b>{inv.mau}</b><br />
          Ký hiệu: <b>{inv.kyHieu}</b><br />
          Số: <b className="text-red-700">{inv.so}</b>
        </div>
      </div>
      <div className="mt-2 text-center">
        {inv.mccqt ? <>Mã của cơ quan thuế: <b className="break-all">{inv.mccqt}</b></> : <i className="text-slate-500">(Hoá đơn không có mã của cơ quan thuế)</i>}
      </div>
      {lq && (
        <div className="mt-2 rounded bg-amber-50 px-2 py-1">
          <b>Hoá đơn liên quan ({TINH_CHAT_LQ[lq.tc] ?? 'liên quan'}):</b> mẫu {lq.mau}, ký hiệu {lq.kh}, số {lq.so}, ngày {ngayIn(lq.ngay)}{lq.gc ? ` — ${lq.gc}` : ''}
        </div>
      )}
      <div className="mt-3">
        <DongBen ben={inv.ban} laBan httt={inv.httt} />
        <DongBen ben={inv.mua} laBan={false} httt={inv.httt} />
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="bg-slate-100">
              {['STT', 'Tên hàng hoá, dịch vụ', 'ĐVT', 'Số lượng', 'Đơn giá', 'Chiết khấu', 'Thuế suất', 'Thành tiền'].map((h) => <th key={h} className="border border-slate-300 p-1">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {inv.dong.length ? inv.dong.map((d, i) => {
              const them = [...d.trung, ...d.khac].map((x) => `${x.k}: ${x.v}`).join(' · ')
              return (
                <tr key={i} className={d.tchat === '2' ? 'bg-emerald-50' : d.tchat === '3' ? 'bg-amber-50' : ''}>
                  <td className="border border-slate-300 p-1 text-center">{d.stt}</td>
                  <td className="border border-slate-300 p-1">
                    {d.ten}{d.tchat === '2' && <i> (khuyến mại)</i>}{d.tchat === '3' && <i> (chiết khấu)</i>}
                    {d.ma && <div className="text-xs text-slate-500">Mã: {d.ma}</div>}
                    {them && <div className="text-xs text-slate-500">{them}</div>}
                  </td>
                  <td className="border border-slate-300 p-1 text-center">{d.dvt}</td>
                  <td className="border border-slate-300 p-1 text-right">{tienXem(d.sl)}</td>
                  <td className="border border-slate-300 p-1 text-right">{tienXem(d.dg)}</td>
                  <td className="border border-slate-300 p-1 text-right">{d.stck ? `${tienXem(d.stck)}${d.tlck ? ` (${tienXem(d.tlck)}%)` : ''}` : ''}</td>
                  <td className="border border-slate-300 p-1 text-center">{d.ts}</td>
                  <td className="border border-slate-300 p-1 text-right">{tienXem(d.tien)}</td>
                </tr>
              )
            }) : (
              <tr><td colSpan={8} className="border border-slate-300 p-2 text-center italic">Không có dòng hàng</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {bangThue && (
        <table className="mt-2 ml-auto border-collapse text-xs sm:text-sm">
          <thead><tr className="bg-slate-100"><th className="border border-slate-300 p-1">Thuế suất</th><th className="border border-slate-300 p-1">Tiền hàng</th><th className="border border-slate-300 p-1">Tiền thuế</th></tr></thead>
          <tbody>
            {inv.thueSuat.map((t, i) => (
              <tr key={i}><td className="border border-slate-300 p-1 text-center">{t.ts}</td><td className="border border-slate-300 p-1 text-right">{tienXem(t.tien)}</td><td className="border border-slate-300 p-1 text-right">{tienXem(t.thue)}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-3 ml-auto grid max-w-md grid-cols-[1fr_auto] gap-x-4 gap-y-0.5">
        {tong.filter((r) => r[1] != null).map(([k, v]) => (
          <div key={k} className="contents"><div>{k}:</div><div className="text-right">{tienXem(v)}</div></div>
        ))}
        <div className="font-bold">Tổng tiền thanh toán:</div>
        <div className="text-right font-bold">{tienXem(inv.tong)}{inv.tienTe !== 'VND' ? ` ${inv.tienTe}` : ''}</div>
      </div>
      {inv.bangChu && <div className="mt-2 italic">Số tiền viết bằng chữ: {inv.bangChu}</div>}
      {khac.length > 0 && (
        <div className="mt-2 border-t border-dashed border-slate-300 pt-2 text-xs">
          {khac.map((x, i) => <div key={i}>{x.k}: <b>{x.v}</b></div>)}
        </div>
      )}
      <div className="mt-4 grid grid-cols-2 gap-4 text-center">
        <div><h4 className="mb-2 font-semibold">Người mua hàng</h4>{inv.kyMua ? <Dau ky={inv.kyMua} nhan="Người mua đã ký số" /> : <div className="text-slate-500">(Không bắt buộc ký)</div>}</div>
        <div><h4 className="mb-2 font-semibold">Người bán hàng</h4><Dau ky={inv.kyBan} nhan="Người bán đã ký số" /></div>
      </div>
      {inv.kyCqt && <div className="mt-3 text-center"><Dau ky={inv.kyCqt} nhan="Cơ quan thuế đã ký cấp mã" /></div>}
      {inv.mstTcgp && <div className="mt-3 text-center text-xs text-slate-500">MST tổ chức cung cấp giải pháp HĐĐT: {inv.mstTcgp}</div>}
      <div className="mt-4 border-t border-slate-200 pt-2 text-center text-xs text-slate-500">(C) August87 - 0982722036</div>
    </div>
  )
}

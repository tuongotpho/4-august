/**
 * Cầu nối app Lịch giảng ATLĐ <-> Google Calendar của anh.
 * Cách cài (một lần, ~3 phút) — app có hướng dẫn kèm khóa điền sẵn ở Cài đặt → Google Calendar:
 *   1. script.google.com → Dự án mới → dán toàn bộ file này (thay KHOA bằng khóa app đưa).
 *   2. Triển khai → Triển khai mới → Loại: Ứng dụng web; Thực thi với tư cách: Tôi; Người có quyền truy cập: Bất kỳ ai.
 *   3. Cho phép quyền truy cập Lịch → chép "URL ứng dụng web" (đuôi /exec) dán vào app.
 * Script chạy bằng tài khoản Google của anh, chỉ ai có đúng KHOA mới gọi được.
 */
const KHOA = 'DAN_KHOA_TU_APP_VAO_DAY'
/** Lịch muốn ghi vào: 'primary' = lịch chính; hoặc ID lịch riêng (Cài đặt lịch → Tích hợp lịch → ID lịch) */
const LICH = 'primary'
const MUI_GIO = 'Asia/Ho_Chi_Minh'

function doPost(e) {
  try {
    const y = JSON.parse(e.postData.contents)
    if (!KHOA || KHOA === 'DAN_KHOA_TU_APP_VAO_DAY' || y.khoa !== KHOA) return tra({ ok: false, loi: 'Sai khóa' })
    const cal = LICH === 'primary' ? CalendarApp.getDefaultCalendar() : CalendarApp.getCalendarById(LICH)
    if (!cal) return tra({ ok: false, loi: 'Không tìm thấy lịch ' + LICH })

    if (y.hanhDong === 'thu') return tra({ ok: true, ten: cal.getName() })

    if (y.hanhDong === 'xoa') {
      const ev = layTheoId(cal, y.eventId)
      if (ev) ev.deleteEvent()
      return tra({ ok: true })
    }

    if (y.hanhDong === 'luu') {
      const s = y.suKien
      let ev = layTheoId(cal, y.eventId) || timCu(cal, s)
      if (!ev) {
        ev = s.caNgay
          ? cal.createAllDayEvent(s.tieuDe, ngay(s.batDau), ngay(s.ketThuc), { description: s.moTa, location: s.diaDiem })
          : cal.createEvent(s.tieuDe, new Date(s.batDau), new Date(s.ketThuc), { description: s.moTa, location: s.diaDiem })
      } else {
        ev.setTitle(s.tieuDe)
        ev.setDescription(s.moTa)
        ev.setLocation(s.diaDiem || '')
        if (s.caNgay) ev.setAllDayDates(ngay(s.batDau), ngay(s.ketThuc))
        else ev.setTime(new Date(s.batDau), new Date(s.ketThuc))
      }
      return tra({ ok: true, eventId: ev.getId() })
    }
    return tra({ ok: false, loi: 'Không hiểu yêu cầu' })
  } catch (err) {
    return tra({ ok: false, loi: String(err && err.message ? err.message : err) })
  }
}

function doGet() {
  return tra({ ok: true, ghiChu: 'Cầu nối Lịch giảng ATLĐ đang chạy' })
}

function layTheoId(cal, id) {
  if (!id) return null
  try {
    return cal.getEventById(id)
  } catch (e) {
    return null
  }
}

/** Lớp chưa có eventId: tìm sự kiện cũ cùng ngày (AppSheet tạo trước đây) có tên khách hàng / thẻ [atld:id] để khỏi tạo trùng */
function timCu(cal, s) {
  const dau = ngay(s.ngay)
  const cuoi = new Date(dau.getTime() + 24 * 3600 * 1000)
  const tim = String(s.tim || '').toLowerCase().trim()
  const the = (s.moTa.match(/\[atld:[^\]]+\]/) || [''])[0]
  const ds = cal.getEvents(dau, cuoi)
  for (let i = 0; i < ds.length; i++) {
    const ev = ds[i]
    if (the && (ev.getDescription() || '').indexOf(the) >= 0) return ev
  }
  if (tim.length < 3) return null
  for (let i = 0; i < ds.length; i++) {
    if (ds[i].getTitle().toLowerCase().indexOf(tim) >= 0) return ds[i]
  }
  return null
}

/** 'YYYY-MM-DD' -> 0 giờ ngày đó theo giờ Việt Nam */
function ngay(s) {
  return Utilities.parseDate(String(s).slice(0, 10), MUI_GIO, 'yyyy-MM-dd')
}

function tra(x) {
  return ContentService.createTextOutput(JSON.stringify(x)).setMimeType(ContentService.MimeType.JSON)
}

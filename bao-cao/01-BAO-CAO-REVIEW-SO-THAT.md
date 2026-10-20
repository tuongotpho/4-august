# [01] Review app bán buôn tương ớt trên số thật + gợi ý nâng cấp

21/10/2026 · tiếp nối: (báo cáo đầu tiên) · nguồn: kết nối AI "Sổ bán buôn tương ớt" (đọc thẳng database `tuongot-sale`, số chốt ngày 20/10/2026), mã nguồn bản `7e21979`

---

## Kết luận trước

- Phần mềm **tính đúng**: công nợ, tồn kho, thống kê khớp nhau giữa web và kết nối AI.
- Có **3 lỗi dữ liệu** làm sai số lãi và tồn kho. Cả 3 đều do nhập liệu và app chưa chặn, không phải do công thức tính.
  1. **HĐ0022 gõ nhầm giá: 26đ/chai** (thay vì 26.000đ). Lãi tháng 1/2026 bị âm 198.960đ.
  2. **Chai 500ml tồn âm 51 chai.** App ghi đã bán 425 chai nhưng chỉ ghi nhập 374 chai. Riêng 190 chai đã bán *trước* phiếu nhập đầu tiên (10/03/2026), tức là thiếu tồn đầu kỳ.
  3. **Giá vốn chai 330ml lệch nhau** giữa các đơn: 13.000đ / 14.000đ / 20.000đ. Các đơn của Ch Phương Anh vì vậy đều báo lãi 0đ.
- Nên làm trước: anh sửa tay HĐ0022, rồi em thêm **chốt chặn khi nhập liệu** (mục 4.1, 4.2).

## 1. Số thật hiện có

| Mục | Số |
|---|---|
| Khách | 3 (Ch Liễu Thanh Hóa, Phở Hiền, Ch Phương Anh) |
| Đơn bán | 22 đơn, 592 chai, 16.031.040đ |
| Phiếu nhập | 7 phiếu (PN0001–PN0007), đã trả đủ, không nợ người bán |
| Công nợ khách | 1.600.000đ, chỉ Ch Liễu (HĐ0001 ngày 18/10/2026) |
| Trả dư | Phở Hiền 300.000đ (HĐ0003 đơn 300.000đ nhưng ghi trả 600.000đ) |
| Năm 2025 | 2 đơn · 92 chai · 2.710.000đ · lãi 870.000đ |
| Năm 2026 (tới 20/10) | 20 đơn · 500 chai · 13.321.040đ (sửa HĐ0022 thì thành 14.360.000đ) |

Bán theo loại chai: 500ml 425 chai · 330ml 157 chai · 1 lít 10 chai. Khách lớn nhất là Ch Liễu: 12.610.000đ, 421 chai (79% doanh thu).

## 2. Đối chiếu tính năng mới với số thật

| Tính năng | Kết quả trên số thật |
|---|---|
| Tô nổi đơn còn nợ | Chỉ HĐ0001 (1.600.000đ) được tô. Khớp với tổng nợ ở công cụ Công nợ. 300.000đ trả dư của Phở Hiền không bị trừ nhầm sang khách khác. |
| Thống kê theo năm | 2025 / 2026 tách đúng như bảng trên. |
| Chốt sổ cuối năm | Tồn sổ sách tại 31/12/2025 của chai 500ml là **−92**, vì chưa có phiếu nhập nào trước 2026. Nếu chốt sổ 2025 với số đếm thực, app sẽ tạo phiếu nhập bù đúng phần thiếu. Đây cũng là cách gọn nhất để xử lý lỗi số 2. |
| Ảnh phiếu có bảng nợ cũ | Ch Liễu chỉ có 1 đơn nợ (HĐ0001), nên đơn kế tiếp sẽ in bảng 1 dòng. |

## 3. Chi tiết 3 lỗi dữ liệu

**Lỗi 1: HĐ0022 (28/01/2026, Ch Phương Anh): 40 chai 330ml × 26đ = 1.040đ.**
Gần như chắc là gõ thiếu "000". Sửa thành 26.000đ thì đơn là 1.040.000đ. Doanh thu tháng 1/2026 thành 2.240.000đ, lãi hết âm.
→ **Anh cần làm:** tab Đơn hàng → tìm "HĐ0022" → Sửa đơn → sửa giá. *(Em không sửa hộ vì đây là dữ liệu thật.)*

**Lỗi 2: Chai 500ml tồn −51.**
- Phiếu nhập sớm nhất là PN0006 ngày 10/03/2026. Trước ngày đó app đã ghi bán 190 chai 500ml (năm 2025: 92 chai; tháng 1–2/2026: 98 chai).
- Nghĩa là số hàng có sẵn hoặc đã nhập trước tháng 3/2026 chưa được ghi.
→ **Cách xử lý:** đếm kho thực bây giờ, rồi dùng Kho → Chốt sổ (hoặc tạo một phiếu nhập "tồn đầu kỳ" ghi ngày sớm). *Cần anh xác nhận số đếm thực.*

**Lỗi 3: Giá vốn 330ml không thống nhất.**
- Phiếu nhập: PN0001 và PN0002 giá 13.000đ, PN0007 (20/10/2026) giá **20.000đ**.
- Giá bán 330ml cũng là 20.000đ, nên mọi đơn tính theo vốn 20.000đ đều lãi 0đ.
- Các đơn nhập bù cho tháng trước lấy *giá vốn tại lúc gõ đơn*, không lấy giá vốn tại *ngày bán*. Vì vậy đơn Ch Phương Anh vốn 20.000đ, đơn Ch Liễu vốn 14.000đ.
→ **Anh cần xác nhận:** PN0007 giá 20.000đ/chai 330ml là đúng hay gõ nhầm (13.000đ)?

## 4. Gợi ý nâng cấp (xếp theo mức đáng làm)

### Nên làm ngay (chặn lỗi nhập liệu)
1. **Chặn giá bất thường khi lên đơn.** Giá nhỏ hơn 1.000đ, hoặc thấp hơn giá vốn, thì hỏi lại trước khi lưu. Lỗi HĐ0022 sẽ không xảy ra.
2. **Cảnh báo tồn âm.** Bán quá số tồn thì hỏi lại; tab Kho và Tổng quan hiện dòng đỏ "500ml đang âm 51 chai: thiếu phiếu nhập?". Bấm vào mở thẳng Chốt sổ.
3. **Giá vốn theo ngày bán.** Đơn ghi lùi ngày thì lấy giá của phiếu nhập gần nhất *trước ngày bán*. Thêm nút "Tính lại giá vốn các đơn cũ" để sửa lãi các đơn đã nhập.

### Nên làm tiếp
4. **Nhắc khách tới lượt mua.** Ch Phương Anh đã quá hạn 11 ngày (chu kỳ 35 ngày). Thêm nút "Nhắn Zalo" soạn sẵn tin "Chị ơi lấy tương ớt chưa ạ" kèm số điện thoại.
5. **Đồng bộ kết nối AI với web.** Công cụ AI chưa có thống kê theo năm và xem trước chốt sổ. Cột "còn thiếu" của từng đơn vẫn tính riêng từng đơn, chưa trừ các lần thu nợ như web.
6. **Hoàn tất đăng nhập Google.** Phần sửa đang để dành trong máy. Còn thiếu 1 việc bấm tay trên Google Cloud Console.

### Để sau, khi khách đông hơn
7. Báo cáo lãi theo từng khách (Ch Liễu chiếm 79% doanh thu, nên biết lãi thật từ khách này).
8. Tự gửi bản sao lưu hằng tháng. Hiện đã có nút "Tải sao lưu" trong Cài đặt nhưng phải nhớ bấm tay.

## 5. Chưa kiểm được

- Số đếm kho thực: phải có anh đếm thì mới biết tồn âm là do thiếu phiếu nhập hay do ghi bán thừa.
- PN0007 giá 20.000đ đúng hay sai: cần anh xác nhận.
- HĐ0003 Phở Hiền trả 600.000đ cho đơn 300.000đ: trả trước cho lần sau, hay gõ nhầm?

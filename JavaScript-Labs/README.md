# JavaScript Labs
 
Bài tập cá nhân môn **Phát triển ứng dụng TMĐT** (UEH)
 
## 1. Thông tin sinh viên
 
| | |
|---|---|
| Họ và tên | Đoàn Thị Thu Ngọc |
 
## 2. Mục tiêu
 
- **Lab 08** – nắm nền tảng ngôn ngữ JavaScript: script nhúng/ngoài, Console, đối tượng có sẵn, mảng, hàm, đối tượng tự định nghĩa.
- **Lab 09** – dùng DOM và sự kiện để chọn, sửa, thêm, xóa phần tử; làm việc với form và kiểm tra dữ liệu nhập.
- **Lab 10** – dùng jQuery để chọn phần tử, xử lý sự kiện, tạo hiệu ứng và gọi dữ liệu bằng GET request.
- Hiểu vai trò của JavaScript trong website thương mại điện tử (kiểm tra form đặt hàng, ẩn/hiện thông tin sản phẩm, cập nhật dữ liệu không tải lại trang).
## 3. Cấu trúc thư mục
 
```
JavaScript-Labs/
├── index.html          # Trang chủ: thông tin sinh viên, liên kết 3 Lab, tóm tắt kiến thức, tự đánh giá
├── README.md
├── css/
│   └── style.css       # Giao diện trang chủ
├── js/
│   └── main.js         # Hiệu ứng trang chủ (đổi giao diện sáng/tối, hiện dần khi cuộn...)
├── images/
│   └── avatar.jpg      # Ảnh đại diện (tùy chọn)
├── Lab08/              # JavaScript 1: Language Foundations
│   ├── index.html      # Danh sách Exercise 8.1 – 8.11
│   ├── css/ js/ flags/ images/ ...
├── Lab09/              # JavaScript 2: DOM and Events
│   ├── index.html      # Danh sách Exercise 9.1 – 9.8
│   ├── css/ js/ images/ ...
└── Lab10/              # JavaScript 3: jQuery
    ├── index.html      # Danh sách Exercise 10.1 – 10.10
    ├── css/ js/ images/ ...   # js/ gồm cả jquery-3.1.1.min.js (bản dự phòng)
```
 
## 4. Nội dung từng Lab
 
### Lab 08 – JavaScript 1: Language Foundations
| Exercise | Nội dung |
|---|---|
| 8.1 | Bật/tắt JavaScript và kiểm tra bằng trang thử |
| 8.2 | Script nhúng trong HTML (`alert`, `console`) |
| 8.3 | Script ngoài (`hello.js`) và `document.write` |
| 8.4 | Thẻ `<noscript>` |
| 8.5 | Console: `log`, `warn`, `error`, đọc thông báo lỗi |
| 8.6 | Đối tượng có sẵn: `String`, `Date`, `Math` |
| 8.7 | Mảng: tạo lịch tháng bằng vòng lặp |
| 8.8 | Hàm, tham số, giá trị trả về, phạm vi biến |
| 8.9 | Hàm là đối tượng, hàm ẩn danh, callback (tính thuế) |
| 8.10 | Tạo đối tượng bằng hàm khởi tạo (`order`) |
| 8.11 | Mảng đối tượng (`Country`) và `for...in` |
 
### Lab 09 – JavaScript 2: DOM and Events
| Exercise | Nội dung |
|---|---|
| 9.1 | Chọn phần tử: `getElementById`, `querySelector(All)`, `innerHTML`/`innerText` |
| 9.2 | Quan hệ cha/con/anh em trong cây DOM, `nodeType` |
| 9.3 | Thêm và xóa phần tử: `createElement`, `appendChild`, `removeChild` |
| 9.4 | Xử lý sự kiện đơn giản: `click`, `mouseover`, `mouseout`, `setTimeout` |
| 9.5 | Sự kiện `load` |
| 9.6 | Debug bằng breakpoint, sự kiện `mouseover` nhiều phần tử |
| 9.7 | Form: `focus`/`blur` đổi màu ô nhập |
| 9.8 | Kiểm tra form rỗng, `preventDefault()`, hiện lỗi trong `<div>` |
 
### Lab 10 – JavaScript 3: jQuery
| Exercise | Nội dung |
|---|---|
| 10.1 | Nạp jQuery từ CDN + bản dự phòng cục bộ |
| 10.2 | Selector cơ bản: `$()`, `.val()`, `.html()`, `.attr()`, `.css()`, `.addClass()` |
| 10.3 | Selector nâng cao: `:password`, `:nth-child`, `:contains` |
| 10.4 | Sự kiện jQuery: `.click()`, `.on()`, `.off()`, `$(function(){})` |
| 10.5 | Chèn phần tử: `after`, `before`, `append`, `prepend`, `appendTo`... |
| 10.6 | Hiệu ứng: `fadeIn/Out/Toggle`, `slideDown/Up/Toggle` |
| 10.7 | Popup ảnh phóng to khi rê chuột |
| 10.8 | `animate()` nhiều giai đoạn |
| 10.9 | `$.get` lấy danh sách thành phố từ web service |
| 10.10 | jqXHR: `.done()`, `.fail()`, `.always()` |
 
## 5. GitHub Pages
 
- Trang chủ: https://ngocdoan206.github.io/ptudtmdt-css-basic-tuan-3/JavaScript-Labs/
- Lab 08: https://ngocdoan206.github.io/ptudtmdt-css-basic-tuan-3/JavaScript-Labs/Lab08/
- Lab 09: https://ngocdoan206.github.io/ptudtmdt-css-basic-tuan-3/JavaScript-Labs/Lab09/
- Lab 10: https://ngocdoan206.github.io/ptudtmdt-css-basic-tuan-3/JavaScript-Labs/Lab10/
## 6. Hướng dẫn truy cập
 
**Trên web:** mở trang chủ ở liên kết trên, bấm vào thẻ Lab 08 / 09 / 10 để vào danh sách Exercise của từng Lab, rồi bấm từng Exercise để xem kết quả.
 
**Trên máy:**
1. Clone repository: `git clone https://github.com/ngocdoan206/ptudtmdt-css-basic-tuan-3.git`
2. Mở thư mục `JavaScript-Labs` bằng VS Code.
3. Mở `index.html` bằng **Live Server** (hoặc bấm đúp để mở bằng trình duyệt).
## 7. Lưu ý
 
- Lab 09 và Lab 10 tải Bootstrap, Font Awesome và jQuery từ CDN nên cần có Internet. jQuery có thêm bản dự phòng trong `Lab10/js/`.
- **Exercise 10.9** gọi web service qua `http`, nên chỉ lấy được dữ liệu khi chạy trên máy (Live Server). Trên GitHub Pages (`https`) trình duyệt chặn yêu cầu này.
- Exercise 10.10 dùng API công khai `https://jsonplaceholder.typicode.com/users` nên chạy được trên cả hai môi trường.
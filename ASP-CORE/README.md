# Bài tập cá nhân ASP.NET Core MVC – Movie Store

**Sinh viên:** Đoàn Thị Thu Ngọc – MSSV 31241027062
**Môn:** Phát triển ứng dụng Thương mại điện tử – UEH

**Demo:** http://uehptudw31241027062.somee.com

## Mô tả
Website bán phim xây dựng bằng ASP.NET Core MVC (.NET 10), CSDL SQL Server trên Somee.

Chức năng chính:
- Quản lý thể loại (Genres) và phim (Movies): thêm, sửa, xóa, xem chi tiết
- Upload hình ảnh phim (lưu vào `wwwroot/images`, tên file dạng GUID)
- Kiểm tra dữ liệu phía server bằng Data Annotations và validation tự viết
- Đăng ký / đăng nhập bằng ASP.NET Core Identity
- Giỏ hàng lưu trong Session; Checkout lưu đơn hàng vào CSDL và gửi email xác nhận qua Gmail SMTP (App Password)

## Công nghệ
| Thành phần | Phiên bản |
|---|---|
| ASP.NET Core MVC | .NET 10 |
| Entity Framework Core (SQL Server) | 10.0.x |
| ASP.NET Core Identity | 10.0.x |
| Newtonsoft.Json (Session) | 10.0.x |
| Hosting + CSDL | Somee.com (MS SQL Express) |

## Cấu trúc thư mục
```
ASP-CORE/
├── README.md
├── SourceCode/
│   └── 31241027062_DoanThiThuNgoc/   # mã nguồn dự án
└── Report/
    ├── BaiTap_CaNhan_ASP_CORE_LMS.docx
    └── images/
```

## Cách chạy
1. Cài .NET SDK 10.
2. Vào thư mục dự án, copy `appsettings.example.json` thành `appsettings.json`, điền connection string và Gmail App Password của bạn.
3. Chạy:
   ```
   dotnet tool install --global dotnet-ef --version 10.0.*
   dotnet ef database update
   dotnet run --launch-profile https
   ```

## Bảo mật
- `appsettings.json` chứa mật khẩu CSDL và Gmail App Password nên **không đưa lên GitHub** (đã khai báo trong `.gitignore`). Repo chỉ có file mẫu `appsettings.example.json`.
- Thư mục `publish/` (bản triển khai, cũng chứa `appsettings.json`) cũng bị loại khỏi Git.

## Điểm em tự cải tiến so với đề
- **Sửa lỗi F5 cộng thêm sản phẩm:** chuyển "Mua"/"Remove" sang POST và áp dụng mẫu Post/Redirect/Get (trang `/Movies/Cart`).
- **Giảm kích thước bản publish:** gỡ gói scaffold sau khi dùng xong và giới hạn `SatelliteResourceLanguages`. Bản gốc khoảng 55 MB làm vượt hạn mức đĩa của Somee.

## Hạn chế đã biết
- `HoaDon` chưa liên kết với `ShippingDetail`; `MaKhachHang` chưa gắn với tài khoản đăng nhập.
- `ChiTietHoaDon` chưa lưu đơn giá tại thời điểm mua.
- Trang quản trị (Create/Edit/Delete) chưa giới hạn quyền bằng `[Authorize]`.
- Bản trên Somee chạy HTTP, chưa có HTTPS.
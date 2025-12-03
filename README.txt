Các thành viên trong nhóm 

52200085_Nguyễn Quốc Mạnh
52200077_Nguyễn Minh Luân
52200026_Huỳnh Tấn Nhã

Link git dự án của nhóm: https://github.com/ManhNguyenQuoc-moc/finalNodeJs
Link video demo của nhóm: https://drive.google.com/file/d/1RpFo7M14adNywzTBFpVs-W9xo1gcK9kf/view?usp=sharing

Hướng dẫn cài đặt & chạy bằng Docker
Dự án gồm 3 dịch vụ chính (mongo, backend, frontend) và công cụ quản trị mongo-express. Tất cả chạy bằng Docker Compose*(version: `"3.9"`).

1) Yêu cầu hệ thống
Docker Desktop 4.x (Docker Engine 20+)
Docker Compose v2 (đi kèm Docker Desktop)
Cổng rảnh: 3000, 5000, 27017, 8081 có thể đổi trong (`docker-compose.yml`)

2) Cấu trúc thư mục
.
├─ Backend/             
├─ FrontEnd/            
├─ mongo-init/     
├─ .gitignore
├─ docker-compose.yml
├─ package-lock.json
└─ README.md (file này)

3) Biến môi trường (.env)
file `.env` trong `Backend/`. Compose đã đọc file `Backend/.env` qua `env_file`.
3.1 Backend/.env (thêm file này để có biến môi trường để chạy dự án)
PORT=5000
MONGO_URI=mongodb+srv://manhnguyen61120042003_db_user:pass@ecommerce.xmo5ayl.mongodb.net/ecommerce_db?retryWrites=true&w=majority&appName=Ecommerce
# MONGO_URI=mongodb://shop-mongodb:27017/shop?replicaSet=rs0
CLOUDINARY_CLOUD_NAME=djsp2cxfl
CLOUDINARY_API_KEY=523695858461134
CLOUDINARY_API_SECRET=-aS8sI_dTzXFQCcL3DMwvUpdSyY
JWT_SECRET=supersecret123
GOOGLE_CLIENT_ID=885064049777-nldk321tl2ft0g9fbq6puobhu4dtjbrc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/login
FACEBOOK_CLIENT_ID=1331764434997972 
FACEBOOK_CLIENT_SECRET=0a6dd1f859c6b37b418dfa6ab82ceeaf
FACEBOOK_REDIRECT_URI=http://localhost:5000/api/auth/facebook/login
EMAIL_USER=huynhtannha54@gmail.com
EMAIL_PASS=pwkxdiitrzixmfdi
GEMINI_API_KEY=AIzaSyCYxJfSjCtbkIT4kum99Ik6FJoEw9lFQC4
FRONTEND_URL = http://localhost:3000

Lưu ý về bảo mật: Vì để cho Giảng viên chấm bài và chạy dự án dễ dàng hơn nên nhóm mới public các thông tin này. Nhóm luôn tuân thủ các nguyên tắc bảo mật về file env này.

Compose đã set các biến `NODE_ENV`, `BACKEND_ORIGIN`, `PUBLIC_BACKEND_ORIGIN` cho `frontend`. 

Dùng MongoDB Atlas thay cho Mongo local
Tạo cluster trên Atlas, tạo **Database User** (username/password) và thêm IP vào **Network Access** (lúc dev có thể `0.0.0.0/0`, nhưng production nên giới hạn IP).
Lấy connection string dạng `mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<dbName>?retryWrites=true&w=majority`.

Hiện tại nhóm đang sử dụng  MongoDB Atlas nên URL trên đã bao gồm kết nối database cho dự án nên không cần thêm data cho dự án.

4) Cấu hình Compose 
Anchor `x-mode: &MODE dev`**: điều khiển `target` build của Dockerfile backend/frontend và set `NODE_ENV`. Muốn chạy production, xem mục 7.
Network: `shop-network` (bridge)
Volume: `mongo_data` lưu dữ liệu MongoDB bền vững
Healthchecks: đảm bảo `backend` và `frontend` chỉ start sau khi service phụ thuộc **healthy**
Mapping port:
  * Mongo: `27017:27017`
  * Backend: `5000:5000`
  * Frontend: `3000:3000`
  * Mongo Express: `8081:8081` (user/pass mặc định bên dưới)

5) Chạy nhanh (Development)
Từ thư mục gốc (nơi có `docker-compose.yml`):
Build & start tất cả service bằng lệnh sau, mở bằng cmd hoặc terminal trong thư mục chứa `docker-compose.yml`.

docker compose up -d --build

Xem log theo service

docker compose logs -f mongo
docker compose logs -f backend
docker compose logs -f frontend

Dừng toàn bộ bằng lệnh

docker compose down

Sau khi chạy:
Frontend: [http://localhost:3000](http://localhost:3000)
Backend (health endpoint `/`): [http://localhost:5000](http://localhost:5000)
API ví dụ: [http://localhost:5000/api/health](http://localhost:5000/api/health)
Mongo (kết nối Compass): `mongodb://localhost:27017` (DB `shop`)
Mongo Express: [http://localhost:8081](http://localhost:8081)

6) Tài khoản demo cho giảng viên

Đến đây có thể vào docker desktop để xem và truy cập vào [http://localhost:3000] để vào trang web 
Tài khoản user
Username:manhnguyen61120042003@gmail.com
password:123456
Tài khoản Admin
Username:manhnguyen6112003@gmail.com
password:123456789

7) Tham khảo URL

* Frontend: `http://localhost:3000`
* Backend: `http://localhost:5000`

8) Các tính năng bổ sung thêm có trong dự án 
Phân tích cảm xúc comment của khách hàng bằng AI

9) Tính năng của dự án

9.1. User (khách hàng)
Đăng ký / đăng nhập / JWT
Xem sản phẩm, tìm kiếm, lọc
Giỏ hàng / thanh toán
Xem lịch sử đơn hàng

9.2. Admin
Quản lý sản phẩm, danh mục, thương hiệu
Quản lý tồn kho theo biến thể (color/size/variant)
Quản lý đơn hàng & trạng thái đơn
Quản trị người dung

9.3. Dashboard cơ bản
Tổng quan doanh thu, lợi nhuận, số đơn, user mới
Top sản phẩm

9.4. Dashboard nâng cao (Bonus)
So sánh doanh thu / lợi nhuận / số đơn theo:
Năm / Quý / Tháng / Tuần / Ngày
Thống kê khách hàng:
LTV, khách mới vs quay lại, phân khúc chi tiêu
Phân bổ sản phẩm theo SKU
Biểu đồ phân loại trạng thái đơn hang

9.5. Mã giảm giá (Bonus)
Tạo / cập nhật / xoá
Hạn sử dụng, giới hạn lượt dùng

10) Link git chứa repo của dự án bao gồm dự án và các thể hiện làm việt nhóm thông qua git

https://github.com/ManhNguyenQuoc-moc/finalNodeJs

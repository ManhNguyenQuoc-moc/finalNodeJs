Hướng dẫn cài đặt & chạy bằng Docker
Dự án gồm 3 dịch vụ chính (mongo, backend, frontend) và công cụ quản trị mongo-express. Tất cả chạy bằng Docker Compose*(version: `"3.9"`).

1) Yêu cầu hệ thống
Docker Desktop 4.x (Docker Engine 20+)
Docker Compose v2 (đi kèm Docker Desktop)
Cổng rảnh: 3000, 5000, 27017, 8081có thể đổi trong (`docker-compose.yml`)

2) Cấu trúc thư mục
.
├─ Backend/             
├─ FrontEnd/            
├─ mongo-init/     
├─ .gitignore
├─ docker-compose.yml
├─ package-lock.json
└─ README.md (file này)
Lưu ý: Thư mục `mongo-init/` (nếu có) sẽ được mount vào container Mongo để chạy script `.js`/`.sh` khi khởi tạo DB lần đầu.

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
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/login
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
FACEBOOK_REDIRECT_URI=
EMAIL_USER=huynhtannha54@gmail.com
EMAIL_PASS=
Trong container, hostname của Mongo là mongo (tên service), không phải `localhost`.
Compose đã set các biến `NODE_ENV`, `BACKEND_ORIGIN`, `PUBLIC_BACKEND_ORIGIN` cho `frontend`. 
3.3 Dùng MongoDB Atlas thay cho Mongo local
Tạo cluster trên Atlas, tạo **Database User** (username/password) và thêm IP vào **Network Access** (lúc dev có thể `0.0.0.0/0`, nhưng production nên giới hạn IP).
Lấy connection string dạng `mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<dbName>?retryWrites=true&w=majority`.

4) Cấu hình Compose (tóm tắt)
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
1 Build & start tất cả service (chạy nền)
docker compose up -d --build
2 Xem log theo service
docker compose logs -f mongo
docker compose logs -f backend
docker compose logs -f frontend
3 Dừng toàn bộ
docker compose down
Sau khi chạy:
Frontend: [http://localhost:3000](http://localhost:3000)
Backend (health endpoint `/`): [http://localhost:5000](http://localhost:5000)
API ví dụ: [http://localhost:5000/api/health](http://localhost:5000/api/health) (tùy bạn hiện thực)
Mongo (kết nối Compass): `mongodb://localhost:27017` (DB `shop`)
Mongo Express: [http://localhost:8081](http://localhost:8081)
Username: `admin` — Password: `admin123`

Đến đây có thể vào docker desktop để xem và truy cập vào [http://localhost:3000] để vào trang user
và truy cập vào [http://localhost:3000/admin] để vào trang admin

6) Phát triển nóng (hot reload)
Compose đã mount:
`./Backend:/app` và `./FrontEnd:/app`
* Thư mục `node_modules` nằm **trong container** (`/app/node_modules`) để tránh lỗi native bindings giữa host/container.
Hãy đảm bảo Backend/Frontend có script dev (VD: `npm run dev` với nodemon/vite). Dockerfile cần start những script này ở target `dev`.

7) Chạy Production
đổi x-mode trong file (`docker-compose.yml`)
x-mode: &MODE prod
Khi đó `target: *MODE` sẽ build stage `prod` trong Dockerfile của `Backend` và `FrontEnd`. Đảm bảo Dockerfile có multi-stage `dev`/`prod`.

8) Healthchecks (giải thích)
    Mongo: chạy `mongosh --eval "db.runCommand({ ping:1 }).ok"`
    Backend: `curl -sf http://localhost:5000/`
    Frontend: `curl -sf http://localhost:3000/`
Nếu healthcheck fail quá số lần `retries`, container sẽ bị đánh dấu unhealthy. Kiểm tra log ứng dụng.

9) Troubleshooting (lỗi thường gặp)
1. **Port đang được dùng**
   Sửa cổng trong `docker-compose.yml` hoặc tắt tiến trình đang chiếm dụng.
2. **Backend không kết nối được Mongo**
   Kiểm tra `MONGO_URI` phải dùng hostname `mongo` (không phải `localhost`).
3. **Lỗi quyền/hiệu năng trên Windows**
   Nên dùng WSL2. Tránh mount vào đường dẫn có ký tự đặc biệt/khoảng trắng.
4. **Dữ liệu Mongo bị cũ**
   Xóa volume và chạy lại:
      docker compose down -v
      docker compose up -d --build
5. Script trong `mongo-init/` không chạy**
      Chỉ chạy **lần đầu** khi volume `mongo_data` trống.
      Đảm bảo file `.js`/`.sh` dùng **LF** (Unix) thay vì CRLF (Windows).
6. Hot reload không hoạt động**
      Đảm bảo tool (nodemon/vite/next) lắng nghe thay đổi và không bị ignore.

10) Lệnh hữu ích
# Liệt kê container
docker compose ps
# Vào shell của container backend/frontend
docker exec -it shop-backend sh
# Xem log nhanh từng container
docker logs -n 100 shop-backend
# Dọn rác image/volume không dùng
docker system prune -af
11) Tham khảo URL
* Frontend: `http://localhost:3000`
* Backend: `http://localhost:5000`
* Mongo Express: `http://localhost:8081` (admin / admin123)
* MongoDB Compass: `mongodb://localhost:27017` — DB: `shop`

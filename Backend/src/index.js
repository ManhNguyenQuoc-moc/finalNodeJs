require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 5000;

(async () => {
  await connectDB(process.env.MONGO_URI);

  // 1) Tạo HTTP server từ Express app
  const server = http.createServer(app);

  // 2) Gắn socket.io
  const io = new Server(server, {
    cors: {
      origin: process.env.FE_ORIGIN || "http://localhost:3000",
      methods: ["GET", "POST"],
    },
  });

  // 3) Gán global io để controller có thể emit
  global.io = io;

  // 4) Lắng nghe kết nối
  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    // Join product room (support both event names for compatibility)
    socket.on("product:join", ({ productId }) => {
      if (!productId) return;
      const room = `product:${productId}`;
      socket.join(room);
      console.log(`Socket ${socket.id} joined ${room}`);
    });

    socket.on("join-product-room", (productId) => {
      if (!productId) return;
      const room = `product:${productId}`;
      socket.join(room);
      console.log(`Socket ${socket.id} joined ${room}`);
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
    });
  });

  // 5) Start server
  server.listen(PORT, () => {
    console.log(`Backend + Socket.IO running at http://localhost:${PORT}`);
  });
})();

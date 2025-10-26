const http = require("http");
const { Server } = require("socket.io");
const app = require("./app"); // ⛳️ Đây nhận về Express instance từ app.js

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
const io = new Server(server);
global.io = io;

// Lắng nghe trên 0.0.0.0 để truy cập từ mọi interface (Docker, LAN…)
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 FE listening on http://0.0.0.0:${PORT}`);
});

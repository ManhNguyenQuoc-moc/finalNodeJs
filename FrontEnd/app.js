// app.js — FE Gateway (SSR EJS) + Admin (chung port)
require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const express = require("express");
const path = require("path");
const proxy = require("express-http-proxy");
const ejsMate = require("ejs-mate");

// Ưu tiên IPv4
require("dns").setDefaultResultOrder?.("ipv4first");

const app = express();

/* ===================== CONFIG ===================== */
const PORT = process.env.PORT || process.env.FE_PORT || 3000;
// Local: http://127.0.0.1:5000 ; Docker: http://shop-backend:5000
const BACKEND = process.env.BACKEND_ORIGIN || "http://shop-backend:5000";

// FE paths
const FE_PUBLIC_DIR = process.env.FE_PUBLIC_DIR || path.join(__dirname, "src", "public");
const FE_VIEWS_DIR = process.env.FE_VIEWS_DIR || path.join(__dirname, "src", "views");

// Admin paths
const ADMIN_VIEWS_DIR = path.join(__dirname, "src", "admin_views", "views");
const ADMIN_PUBLIC_DIR = process.env.ADMIN_PUBLIC_DIR || path.join(__dirname, "src", "admin_public");

/* ===================== VIEW & STATIC ===================== */
// ejs-mate để dùng <% layout(...) %>
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
// Cho EJS tìm view ở cả FE và Admin
app.set("views", [FE_VIEWS_DIR, ADMIN_VIEWS_DIR]);
// Cho include absolute trong EJS
app.locals.basedir = app.get("views");

// Static FE
app.use(express.static(FE_PUBLIC_DIR));
// Static Admin served dưới prefix /admin/*
app.use("/admin_public", express.static(ADMIN_PUBLIC_DIR));

/* ===================== PARSERS ===================== */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/* ===================== ROUTERS ===================== */
// 1) FE page routes (đã tách ra file riêng)
const createPagesRouter = require("./src/routes/pages");
app.use("/", createPagesRouter({ BACKEND, proxy }));
// 2) Admin router (export Express.Router)
const adminRouter = require("./src/routes/adminroute");
app.use("/admin", adminRouter({ BACKEND, proxy }));

/* ===================== HEALTH & DIAG ===================== */
app.get("/__health", (_req, res) => res.json({ ok: true, service: "frontend" }));
app.get("/__routes", (_req, res) => {
  const out = [];
  app._router.stack.forEach(l => {
    if (l.route?.path) {
      out.push(`${Object.keys(l.route.methods).join(",").toUpperCase()} ${l.route.path}`);
    } else if (l.name === 'router' && l.handle?.stack) {
      l.handle.stack.forEach(s => s.route?.path && out.push(`${Object.keys(s.route.methods).join(",").toUpperCase()} ${l.regexp} -> ${s.route.path}`));
    }
  });
  res.type("text").send(out.sort().join("\n"));
});

/* ===================== HTTP + SOCKET.IO ===================== */
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
global.io = io;
io.on("connection", (socket) => socket.emit("hello", { msg: "Socket connected to FE gateway" }));

server.listen(PORT, "0.0.0.0", () => {
  console.log(`FE SSR (EJS) chạy tại http://0.0.0.0:${PORT}`);
  console.log(`Backend: ${BACKEND}`);
});

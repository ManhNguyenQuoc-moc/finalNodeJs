// src/middleware/session.js
const crypto = require("crypto");
const { User } = require("../models");

function ensureSession(req, res, next) {
  if (!req.cookies.sid) {
    const sid = (crypto.randomUUID && crypto.randomUUID())
      || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    res.cookie("sid", sid, { httpOnly: true, sameSite: "lax" });
    req.cookies.sid = sid;
  }
  next();
}

module.exports = { ensureSession };

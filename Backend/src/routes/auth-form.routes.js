// src/routes/auth-form.routes.js
const express = require("express");
const ctrl = require("../controllers/auth-form.controller");

const router = express.Router();

router.post("/login", express.urlencoded({ extended: true }), ctrl.login);
router.post("/register", express.urlencoded({ extended: true }), ctrl.register);
router.get("/logout", ctrl.logout);

module.exports = router;

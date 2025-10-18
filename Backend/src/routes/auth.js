const express = require("express");
const passport = require("../config/passport");
const authController = require("../controllers/authController");
const router = express.Router();

router.post("/register", authController.register);
router.get("/verify", authController.verifyEmail);
router.post("/set-password", authController.setPassword);
router.post("/login", authController.login);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["email", "profile"],
    authType: "reauthenticate",
  })
);
router.get(
  "/google/login",
  passport.authenticate("google", {
    failureRedirect: "/login",
    session: false,
  }),
  authController.googleLogin
);
router.get(
  "/facebook",
  passport.authenticate("facebook", {
    scope: ["email"],
    authType: "reauthenticate",
  })
);
router.get(
  "/facebook/login",
  passport.authenticate("facebook", {
    failureRedirect: "/login",
    session: false,
  }),
  authController.facebookLogin
);

// router.post("/google-login", authController.googleLogin);

module.exports = router;

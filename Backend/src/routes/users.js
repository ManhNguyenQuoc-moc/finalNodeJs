const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/profile", authMiddleware, (req, res) => {
  res.json({
    message: "Profile fetched successfully",
    user: req.user, 
  });
});
//API
router.post("/", userController.createUser);
router.get("/", userController.getUsers);

module.exports = router;

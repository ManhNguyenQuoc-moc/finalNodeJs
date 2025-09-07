// const jwt = require("jsonwebtoken");

// module.exports = (req, res, next) => {
//   const token = req.headers["authorization"]?.split(" ")[1];
//   if (!token) {
//     return res.status(401).json({ success: false, message: "No token provided" });
//   }

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     req.user = decoded; // gắn thông tin user vào request
//     next();
//   } catch (err) {
//     res.status(403).json({ success: false, message: "Invalid token" });
//   }
// };

// middleware/authMiddleware.js
const { verifyToken } = require("../utils/token");

function requireAuth(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }
  const token = authHeader.split(" ")[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
  req.user = decoded;
  req.currentUser = decoded;

  next();
}
function requireAuthOptional(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);

    if (decoded) {
      req.user = decoded;
      req.currentUser = decoded;
    }
  }
  next();
}
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.currentUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const userRole = req.currentUser.role;
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ message: "Forbidden: Access denied" });
    }

    next();
  };
}
module.exports = {
  requireAuth,
  requireAuthOptional,
  requireRole,
};

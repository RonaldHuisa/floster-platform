const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");

const {
  getPromotionDashboard,
  getMembersByLevel,
} = require("../controllers/referralController");

const router = express.Router();

router.get("/dashboard", authMiddleware, getPromotionDashboard);
router.get("/members/:level", authMiddleware, getMembersByLevel);

module.exports = router;
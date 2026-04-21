const express = require("express");
const router = express.Router();
const {
  getOverview,
  getWardStats,
  getDailyReports,
  getOfficerPerformance,
} = require("../controllers/analyticsController");
const { protect, authorise } = require("../middleware/authMiddleware");

router.get("/overview", protect, authorise("admin"), getOverview);
router.get("/ward-stats", protect, authorise("admin"), getWardStats);
router.get("/daily-reports", protect, authorise("admin"), getDailyReports);
router.get("/officer-performance", protect, authorise("admin"), getOfficerPerformance);

module.exports = router;
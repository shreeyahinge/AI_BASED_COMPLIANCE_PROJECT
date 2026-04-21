const express = require("express");
const router = express.Router();
const {
  createReport,
  getAllReports,
  getMyReports,
  getReportById,
  updateReportStatus,
} = require("../controllers/reportController");
const { protect, authorise } = require("../middleware/authMiddleware");

router.post("/", protect, authorise("citizen", "officer"), createReport);
router.get("/", protect, authorise("admin", "officer"), getAllReports);
router.get("/my", protect, getMyReports);
router.get("/:id", protect, getReportById);
router.put("/:id/status", protect, authorise("admin", "officer"), updateReportStatus);

module.exports = router;
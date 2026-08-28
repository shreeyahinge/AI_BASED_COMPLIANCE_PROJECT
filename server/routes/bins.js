const express = require("express");
const router = express.Router();
const {
  createBin,
  getAllBins,
  getBinStats,
  getBinById,
  updateBin,
  deleteBin,
  predictBinOverflow,
  liveDetectBin,
} = require("../controllers/binController");

const { protect, authorise } = require("../middleware/authMiddleware");

router.post("/", protect, authorise("admin"), createBin);
router.get("/", protect, getAllBins);
router.get("/stats", protect, authorise("admin"), getBinStats);
router.get("/:id", protect, getBinById);
router.post("/:id/live-detect", protect, liveDetectBin);
router.put("/:id", protect, authorise("admin"), updateBin);
router.delete("/:id", protect, authorise("admin"), deleteBin);
router.get("/:id/predict", protect, authorise("admin"), predictBinOverflow);

module.exports = router;
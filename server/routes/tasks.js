const express = require("express");
const router = express.Router();
const {
  getAllTasks,
  getMyTasks,
  startTask,
  completeTask,
  getTaskStats,
  getOptimisedRoute,
} = require("../controllers/taskController");
const { protect, authorise } = require("../middleware/authMiddleware");

router.get("/", protect, authorise("admin"), getAllTasks);
router.get("/my", protect, authorise("officer"), getMyTasks);
router.get("/stats", protect, authorise("admin"), getTaskStats);
router.put("/:id/start", protect, authorise("officer"), startTask);
router.put("/:id/complete", protect, authorise("officer"), completeTask);
router.get("/optimise-route", protect, authorise("officer"), getOptimisedRoute);

module.exports = router;
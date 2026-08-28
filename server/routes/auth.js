const express = require("express");
const router = express.Router();
const {
  registerUser,
  loginUser,
  getMe,
  getOfficers,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const User = require("../models/User");

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/me", protect, getMe);
router.get("/officers", protect, getOfficers);

// Leaderboard
router.get("/leaderboard", protect, async (req, res) => {
  try {
    const leaders = await User.find({ role: "citizen" })
      .sort({ greenPoints: -1 })
      .limit(10)
      .select("name city greenPoints createdAt");
    res.json(leaders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
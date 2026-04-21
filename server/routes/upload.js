const express = require("express");
const router = express.Router();
const { upload, cloudinary } = require("../config/cloudinary");
const { protect } = require("../middleware/authMiddleware");

// @route  POST /api/upload
// @access Protected
router.post("/", protect, upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    res.json({
      url: req.file.path,
      publicId: req.file.filename,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ message: error.message });
  }
});

// @route  DELETE /api/upload/:publicId
// @access Protected
router.delete("/:publicId", protect, async (req, res) => {
  try {
    await cloudinary.uploader.destroy(req.params.publicId);
    res.json({ message: "Image deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
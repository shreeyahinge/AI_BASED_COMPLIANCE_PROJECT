const express = require("express");
const router = express.Router();
const { upload, cloudinary } = require("../config/cloudinary");
const { protect } = require("../middleware/authMiddleware");
const { preprocessImage, applyPrivacyBlur } = require("../services/imageService");

// @route  POST /api/upload
router.post("/", protect, upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const originalUrl = req.file.path;

    // Apply preprocessing in background (don't block response)
    let processedUrl = originalUrl;
    try {
      const preprocessed = await preprocessImage(originalUrl);
      if (preprocessed.success) {
        processedUrl = preprocessed.processedUrl;
      }
    } catch (e) {
      console.log("Preprocessing skipped:", e.message);
    }

    // Apply privacy blur
    let finalUrl = processedUrl;
    try {
      const privacy = await applyPrivacyBlur(processedUrl);
      if (privacy.success) {
        finalUrl = privacy.privacyUrl;
      }
    } catch (e) {
      console.log("Privacy blur skipped:", e.message);
    }

    res.json({
      url: finalUrl,
      originalUrl,
      publicId: req.file.filename,
      message: "Photo uploaded, preprocessed and privacy-filtered",
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ message: error.message });
  }
});

router.delete("/:publicId", protect, async (req, res) => {
  try {
    await cloudinary.uploader.destroy(req.params.publicId);
    res.json({ message: "Image deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
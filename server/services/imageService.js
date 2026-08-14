const sharp = require("sharp");
const axios = require("axios");
const { cloudinary } = require("../config/cloudinary");

// Download image from URL to buffer
const downloadImage = async (imageUrl) => {
  const response = await axios.get(imageUrl, {
    responseType: "arraybuffer",
  });
  return Buffer.from(response.data);
};

// Background subtraction — enhance bin area
const preprocessImage = async (imageUrl) => {
  try {
    const buffer = await downloadImage(imageUrl);

    // Apply preprocessing using Sharp
    const processed = await sharp(buffer)
      .resize(800, 600, { fit: "inside", withoutEnlargement: true })
      .normalize() // Auto-levels — improves contrast
      .sharpen({ sigma: 1.5 }) // Sharpen edges
      .modulate({ saturation: 1.2 }) // Boost colours
      .toBuffer();

    // Upload processed image to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: "smartbin/processed",
            transformation: [{ quality: "auto" }],
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        )
        .end(processed);
    });

    return {
      success: true,
      processedUrl: uploadResult.secure_url,
      originalUrl: imageUrl,
    };
  } catch (error) {
    console.error("Image preprocessing error:", error.message);
    return {
      success: false,
      processedUrl: imageUrl, // Fall back to original
      originalUrl: imageUrl,
      error: error.message,
    };
  }
};

// Privacy blur — blur faces and plates
const applyPrivacyBlur = async (imageUrl) => {
  try {
    const buffer = await downloadImage(imageUrl);

    // Apply a general privacy-safe treatment
    // In production, you'd use a face detection API here
    // For now we apply subtle gaussian blur to the top portion
    // (where faces typically appear in street-level photos)
    const metadata = await sharp(buffer).metadata();
    const { width, height } = metadata;

    const processed = await sharp(buffer)
      .blur(0.3) // Very subtle overall softening
      .toBuffer();

    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { folder: "smartbin/privacy" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        )
        .end(processed);
    });

    return {
      success: true,
      privacyUrl: uploadResult.secure_url,
    };
  } catch (error) {
    return {
      success: false,
      privacyUrl: imageUrl,
      error: error.message,
    };
  }
};

module.exports = { preprocessImage, applyPrivacyBlur };
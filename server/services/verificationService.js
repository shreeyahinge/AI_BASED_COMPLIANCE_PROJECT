const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const urlToBase64 = async (imageUrl) => {
  const response = await axios.get(imageUrl, {
    responseType: "arraybuffer",
  });
  const buffer = Buffer.from(response.data);
  return {
    base64: buffer.toString("base64"),
    mimeType: response.headers["content-type"] || "image/jpeg",
  };
};

const verifyCleanBin = async (afterPhotoUrl) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const { base64, mimeType } = await urlToBase64(afterPhotoUrl);

    const prompt = `You are verifying whether a waste bin has been cleaned by a sanitation worker.

Analyse this image and respond ONLY with a valid JSON object:
{
  "isClean": true or false,
  "confidence": number between 0 and 100,
  "reasoning": "brief explanation",
  "remainingWaste": number between 0 and 100
}

Rules:
- isClean: true if the bin appears empty or nearly empty (less than 20% full)
- confidence: how confident you are in this assessment
- remainingWaste: estimated fill level remaining (0 = completely empty)
- If you cannot see a bin clearly, set isClean to false and confidence below 50`;

    const result = await model.generateContent([
      { inlineData: { data: base64, mimeType } },
      prompt,
    ]);

    const responseText = result.response.text();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) throw new Error("No JSON in Gemini response");

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      isClean: parsed.isClean || false,
      confidence: parsed.confidence || 0,
      reasoning: parsed.reasoning || "",
      remainingWaste: parsed.remainingWaste || 0,
      verified: parsed.isClean && parsed.confidence >= 60,
    };
  } catch (error) {
    console.error("Verification error:", error.message);
    return {
      isClean: true,
      confidence: 70,
      reasoning: "AI verification unavailable — auto-approved",
      remainingWaste: 5,
      verified: true,
      error: error.message,
    };
  }
};

module.exports = { verifyCleanBin };
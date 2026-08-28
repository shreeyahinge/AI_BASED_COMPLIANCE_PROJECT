const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Convert image URL or Base64 data URI to Gemini format
const getImageData = async (imageInput) => {
  if (typeof imageInput === "string" && imageInput.startsWith("data:")) {
    const matches = imageInput.match(/^data:([A-Za-z0-9-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      return { mimeType: matches[1], base64: matches[2] };
    }
  }

  if (typeof imageInput === "string" && (imageInput.startsWith("http://") || imageInput.startsWith("https://"))) {
    const response = await axios.get(imageInput, {
      responseType: "arraybuffer",
      timeout: 5000,
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    const buffer = Buffer.from(response.data);
    const base64 = buffer.toString("base64");
    const mimeType = response.headers["content-type"] || "image/jpeg";
    return { base64, mimeType };
  }

  return { base64: imageInput, mimeType: "image/jpeg" };
};

const analyseWasteImage = async (imageInput) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const { base64, mimeType } = await getImageData(imageInput);

    const prompt = `You are an AI waste detection system for a city waste management platform.

Analyse this image and respond ONLY with a valid JSON object in this exact format:
{
  "isWaste": true or false,
  "fillLevel": number between 0 and 100,
  "aiScore": number between 0 and 100,
  "wasteLabels": ["label1", "label2"],
  "wasteType": "mixed/organic/recyclable/hazardous/unknown",
  "reasoning": "brief explanation"
}

// Rules:
- isWaste: true only if you can clearly see a garbage bin, waste, litter, or overflowing trash
- fillLevel: estimate how full the bin is (0 = empty, 100 = completely full/overflowing)
- aiScore: your confidence percentage that this is a waste-related image
- wasteLabels: list of waste-related items you can see
- If the image has NO visible waste or bin, set isWaste to false and aiScore below 30
- Do NOT include any text outside the JSON`;

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Gemini AI API call timed out after 6s")), 6000)
    );

    const generatePromise = model.generateContent([
      { inlineData: { data: base64, mimeType } },
      prompt,
    ]);

    const result = await Promise.race([generatePromise, timeoutPromise]);

    const responseText = result.response.text();

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in Gemini response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      isWaste: parsed.isWaste || false,
      aiScore: Math.min(100, Math.max(0, parsed.aiScore || 0)),
      fillLevel: Math.min(100, Math.max(0, parsed.fillLevel || 0)),
      labels: parsed.wasteLabels || [],
      wasteLabels: parsed.wasteLabels || [],
      wasteType: parsed.wasteType || "unknown",
      reasoning: parsed.reasoning || "",
    };
  } catch (error) {
    console.error("Gemini AI error:", error.message);
    // Fallback — don't break the app if AI fails
    return {
      isWaste: true,
      aiScore: 60,
      fillLevel: 60,
      labels: ["waste", "bin"],
      wasteLabels: ["waste"],
      wasteType: "unknown",
      reasoning: "AI analysis unavailable — using default values",
      error: error.message,
    };
  }
};

module.exports = { analyseWasteImage };
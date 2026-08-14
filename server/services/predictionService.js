const Report = require("../models/Report");
const Bin = require("../models/Bin");

// Simple linear regression
const linearRegression = (points) => {
  const n = points.length;
  if (n < 2) return null;

  const sumX = points.reduce((acc, p) => acc + p.x, 0);
  const sumY = points.reduce((acc, p) => acc + p.y, 0);
  const sumXY = points.reduce((acc, p) => acc + p.x * p.y, 0);
  const sumX2 = points.reduce((acc, p) => acc + p.x * p.x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
};

const predictOverflow = async (binId) => {
  try {
    // Get last 10 reports for this bin
    const reports = await Report.find({ bin: binId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("fillLevel createdAt");

    if (reports.length < 2) {
      return {
        canPredict: false,
        message: "Not enough data — need at least 2 reports",
      };
    }

    // Convert to data points (x = hours ago, y = fill level)
    const now = Date.now();
    const points = reports.map((r) => ({
      x: (now - new Date(r.createdAt).getTime()) / (1000 * 60 * 60),
      y: r.fillLevel,
    })).reverse();

    const regression = linearRegression(points);
    if (!regression) {
      return { canPredict: false, message: "Could not calculate regression" };
    }

    const { slope, intercept } = regression;

    // Predict when fill level reaches 90%
    if (slope <= 0) {
      return {
        canPredict: true,
        prediction: "Bin fill level is decreasing — no overflow expected soon",
        hoursToOverflow: null,
        currentTrend: "decreasing",
      };
    }

    // Hours from now until fill = 90%
    const currentFill = intercept;
    const hoursToOverflow = (90 - currentFill) / slope;

    let urgency = "low";
    if (hoursToOverflow <= 2) urgency = "critical";
    else if (hoursToOverflow <= 6) urgency = "high";
    else if (hoursToOverflow <= 12) urgency = "medium";

    return {
      canPredict: true,
      hoursToOverflow: Math.max(0, Math.round(hoursToOverflow)),
      urgency,
      currentFillRate: Math.round(slope * 10) / 10,
      prediction:
        hoursToOverflow <= 0
          ? "Bin is likely already overflowing"
          : `Bin predicted to overflow in ~${Math.round(hoursToOverflow)} hours`,
      dataPoints: points.length,
    };
  } catch (error) {
    return { canPredict: false, message: error.message };
  }
};

module.exports = { predictOverflow };
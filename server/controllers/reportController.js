const Report = require("../models/Report");
const Bin = require("../models/Bin");
const User = require("../models/User");
const Task = require("../models/Task");
const { analyseWasteImage } = require("../services/aiService");

const getPriority = (score) => {
  if (score >= 85) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  if (score >= 20) return "low";
  return "rejected";
};

// @route  POST /api/reports
const createReport = async (req, res) => {
  try {
    const { binId, photoUrl, fillLevel, latitude, longitude, notes } = req.body;

    const bin = await Bin.findById(binId);
    if (!bin) {
      return res.status(404).json({ message: "Bin not found" });
    }

    // Run Gemini AI analysis
    let aiResult = {
      isWaste: true,
      aiScore: 70,
      fillLevel: fillLevel || 70,
      labels: [],
      wasteLabels: [],
      wasteType: "unknown",
    };

    if (photoUrl) {
      console.log("Running Gemini AI analysis...");
      aiResult = await analyseWasteImage(photoUrl);
      console.log("AI Result:", aiResult);
    }

    // Reject spam
    if (!aiResult.isWaste || aiResult.aiScore < 20) {
      const report = await Report.create({
        citizen: req.user._id,
        bin: binId,
        photoUrl: photoUrl || "",
        aiScore: aiResult.aiScore,
        aiLabels: aiResult.wasteLabels,
        fillLevel: 0,
        priority: "rejected",
        status: "rejected",
        location: { latitude, longitude },
        city: bin.city,
        ward: bin.ward,
        area: bin.area,
        notes: "Auto-rejected: AI could not detect waste in this photo.",
      });

      return res.status(200).json({
        message: "Report auto-rejected — AI could not detect waste in this photo",
        report,
        aiAnalysis: {
          wasteType: aiResult.wasteType,
          reasoning: aiResult.reasoning,
          detectedLabels: aiResult.wasteLabels,
        },
      });
    }

    const finalFillLevel = aiResult.fillLevel || fillLevel || 0;
    const priority = getPriority(aiResult.aiScore);

    const report = await Report.create({
      citizen: req.user._id,
      bin: binId,
      photoUrl: photoUrl || "",
      aiScore: aiResult.aiScore,
      aiLabels: aiResult.wasteLabels,
      fillLevel: finalFillLevel,
      priority,
      status: "pending",
      location: { latitude, longitude },
      city: bin.city,
      ward: bin.ward,
      area: bin.area,
      notes,
    });

    // Update bin
    bin.fillLevel = finalFillLevel;
    bin.lastUpdated = Date.now();
    if (finalFillLevel >= 85) bin.status = "critical";
    else if (finalFillLevel >= 50) bin.status = "medium";
    else bin.status = "clean";
    await bin.save();

    // Award Green Points
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { greenPoints: 10 },
    });

    // Auto-create task for high/critical
    if (priority === "high" || priority === "critical") {
      const officer = await User.findOne({
        role: "officer",
        city: new RegExp(`^${bin.city}$`, "i"),
        isActive: true,
      });

      if (officer) {
        const task = await Task.create({
          report: report._id,
          bin: binId,
          assignedTo: officer._id,
          assignedBy: req.user._id,
          priority,
          city: bin.city,
          ward: bin.ward,
        });

        report.status = "assigned";
        await report.save();

        // Socket.io alerts
        const io = req.app.get("io");
        if (io) {
          io.to("admin_room").emit("new_critical_report", {
            message: `🚨 New ${priority} report — ${bin.location.address}`,
            report: report._id,
            bin: bin.binId,
            ward: bin.ward,
            priority,
          });
          io.to(`city_${bin.city}`).emit("new_task_assigned", {
            message: `📋 New task assigned at ${bin.location.address}. Your path has been updated!`,
            taskId: task._id,
            priority,
            address: bin.location.address,
          });
        }
      }
    }

    const populatedReport = await Report.findById(report._id)
      .populate("citizen", "name email greenPoints")
      .populate("bin", "location city ward area status");

    res.status(201).json({
      ...populatedReport.toObject(),
      aiAnalysis: {
        wasteType: aiResult.wasteType,
        reasoning: aiResult.reasoning,
        detectedLabels: aiResult.wasteLabels,
      },
    });
  } catch (error) {
    console.error("Create report error:", error);
    res.status(500).json({ message: error.message });
  }
};

// @route  GET /api/reports
const getAllReports = async (req, res) => {
  try {
    const filter = {};
    if (req.query.city) filter.city = req.query.city;
    if (req.query.ward) filter.ward = req.query.ward;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.status) filter.status = req.query.status;

    const reports = await Report.find(filter)
      .populate("citizen", "name email phone")
      .populate("bin", "binId location city ward area status fillLevel")
      .sort({ createdAt: -1 })
      .lean();

    const reportIds = reports.map((r) => r._id);
    const tasks = await Task.find({ report: { $in: reportIds } })
      .populate("assignedTo", "name email phone city assignedWard")
      .populate("assignedBy", "name email")
      .lean();

    const taskMap = {};
    tasks.forEach((t) => {
      taskMap[t.report.toString()] = t;
    });

    const reportsWithTask = reports.map((r) => ({
      ...r,
      task: taskMap[r._id.toString()] || null,
    }));

    res.json(reportsWithTask);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  GET /api/reports/my
const getMyReports = async (req, res) => {
  try {
    const reports = await Report.find({ citizen: req.user._id })
      .populate("bin", "binId location city ward area status")
      .sort({ createdAt: -1 })
      .lean();

    const reportIds = reports.map((r) => r._id);
    const tasks = await Task.find({ report: { $in: reportIds } })
      .populate("assignedTo", "name email phone city assignedWard")
      .lean();

    const taskMap = {};
    tasks.forEach((t) => {
      taskMap[t.report.toString()] = t;
    });

    const reportsWithTask = reports.map((r) => ({
      ...r,
      task: taskMap[r._id.toString()] || null,
    }));

    res.json(reportsWithTask);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  GET /api/reports/:id
const getReportById = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate("citizen", "name email phone")
      .populate("bin", "binId location city ward area status fillLevel")
      .lean();
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    const task = await Task.findOne({ report: report._id })
      .populate("assignedTo", "name email phone city assignedWard")
      .populate("assignedBy", "name email")
      .lean();

    res.json({ ...report, task: task || null });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  PUT /api/reports/:id/status
const updateReportStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }
    report.status = status;
    await report.save();
    res.json(report);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createReport,
  getAllReports,
  getMyReports,
  getReportById,
  updateReportStatus,
};
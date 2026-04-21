const Report = require("../models/Report");
const Bin = require("../models/Bin");
const User = require("../models/User");
const Task = require("../models/Task");

// Helper — map AI score to priority
const getPriority = (score) => {
  if (score >= 85) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  if (score >= 20) return "low";
  return "rejected";
};

// @route  POST /api/reports
// @access Citizen / Officer
const createReport = async (req, res) => {
  try {
    const {
      binId,
      photoUrl,
      aiScore,
      aiLabels,
      fillLevel,
      latitude,
      longitude,
      notes,
    } = req.body;

    // Check bin exists
    const bin = await Bin.findById(binId);
    if (!bin) {
      return res.status(404).json({ message: "Bin not found" });
    }

    const priority = getPriority(aiScore || 0);

    // Reject spam reports
    if (priority === "rejected") {
      return res.status(400).json({
        message: "Report rejected — AI could not detect waste in this photo",
        aiScore,
      });
    }

    // Create report
    const report = await Report.create({
      citizen: req.user._id,
      bin: binId,
      photoUrl,
      aiScore: aiScore || 0,
      aiLabels: aiLabels || [],
      fillLevel: fillLevel || 0,
      priority,
      location: { latitude, longitude },
      city: bin.city,
      ward: bin.ward,
      area: bin.area,
      notes,
    });

    // Update bin fill level and status automatically
    bin.fillLevel = fillLevel || bin.fillLevel;
    bin.lastUpdated = Date.now();
    if (fillLevel >= 85) bin.status = "critical";
    else if (fillLevel >= 50) bin.status = "medium";
    else bin.status = "clean";
    await bin.save();

    // Award green points to citizen
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { greenPoints: 10 },
    });

    // Auto-create task if priority is high or critical
    if (priority === "high" || priority === "critical") {
      // Find available officer in same ward
      const officer = await User.findOne({
        role: "officer",
        assignedWard: bin.ward,
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

        // Emit real-time alert to admin room
        const io = req.app.get("io");
        if (io) {
          io.to("admin_room").emit("new_critical_report", {
            message: `🚨 New ${priority} report — ${bin.location.address}`,
            report: report._id,
            bin: bin.binId,
            ward: bin.ward,
            priority,
          });

          // Emit to officer's ward room
          io.to(`ward_${bin.ward}`).emit("new_task_assigned", {
            message: `📋 New task assigned in ${bin.ward}`,
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

    res.status(201).json(populatedReport);
  } catch (error) {
    console.error("Create report error:", error);
    res.status(500).json({ message: error.message });
  }
};

// @route  GET /api/reports
// @access Admin / Officer
// Supports: ?city=Mumbai&ward=Ward42&priority=critical&status=pending
const getAllReports = async (req, res) => {
  try {
    const filter = {};
    if (req.query.city) filter.city = req.query.city;
    if (req.query.ward) filter.ward = req.query.ward;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.status) filter.status = req.query.status;

    const reports = await Report.find(filter)
      .populate("citizen", "name email")
      .populate("bin", "location city ward area status fillLevel")
      .sort({ createdAt: -1 });

    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  GET /api/reports/my
// @access Citizen
const getMyReports = async (req, res) => {
  try {
    const reports = await Report.find({ citizen: req.user._id })
      .populate("bin", "location city ward area status")
      .sort({ createdAt: -1 });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  GET /api/reports/:id
// @access Protected
const getReportById = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate("citizen", "name email")
      .populate("bin", "location city ward area status fillLevel");
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }
    res.json(report);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  PUT /api/reports/:id/status
// @access Admin / Officer
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

const Task = require("../models/Task");
const Bin = require("../models/Bin");
const Report = require("../models/Report");
const User = require("../models/User");
const { verifyCleanBin } = require("../services/verificationService");
const { optimiseRoute } = require("../services/routeService");

// @route  GET /api/tasks
// @access Admin
const getAllTasks = async (req, res) => {
  try {
    const filter = {};
    if (req.query.city) filter.city = req.query.city;
    if (req.query.ward) filter.ward = req.query.ward;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.priority) filter.priority = req.query.priority;

    const tasks = await Task.find(filter)
      .populate("report", "photoUrl aiScore priority fillLevel notes location createdAt")
      .populate("bin", "binId location city ward area fillLevel status locationType")
      .populate("assignedTo", "name email phone city assignedWard")
      .populate("assignedBy", "name email")
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  POST /api/tasks/assign
// @access Admin
const assignTask = async (req, res) => {
  try {
    const { reportId, officerId, priority, notes } = req.body;

    const report = await Report.findById(reportId).populate("bin");
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    const officer = await User.findById(officerId);
    if (!officer || officer.role !== "officer") {
      return res.status(400).json({ message: "Invalid officer selected" });
    }

    let task = await Task.findOne({ report: reportId });

    if (task) {
      task.assignedTo = officer._id;
      task.assignedBy = req.user._id;
      if (priority) task.priority = priority;
      if (notes) task.notes = notes;
      task.status = "pending";
      await task.save();
    } else {
      task = await Task.create({
        report: report._id,
        bin: report.bin?._id || report.bin,
        assignedTo: officer._id,
        assignedBy: req.user._id,
        priority: priority || report.priority || "medium",
        city: report.city || officer.city,
        ward: report.ward || officer.assignedWard,
        notes: notes || "",
      });
    }

    report.status = "assigned";
    await report.save();

    const populatedTask = await Task.findById(task._id)
      .populate("assignedTo", "name email phone city assignedWard")
      .populate("assignedBy", "name email")
      .populate("bin", "binId location city ward area fillLevel status locationType")
      .populate("report", "photoUrl aiScore priority fillLevel notes location createdAt");

    const io = req.app.get("io");
    if (io) {
      io.to(`city_${task.city}`).emit("new_task_assigned", {
        message: `📋 Task assigned to ${officer.name} at ${report.bin?.location?.address || "specified bin"}`,
        taskId: task._id,
        officerId: officer._id,
        priority: task.priority,
        address: report.bin?.location?.address,
      });
      io.to("admin_room").emit("task_updated", {
        message: `Task assigned to ${officer.name}`,
        taskId: task._id,
        reportId: report._id,
      });
    }

    res.json({
      message: `Task successfully assigned to ${officer.name}`,
      task: populatedTask,
    });
  } catch (error) {
    console.error("Assign task error:", error);
    res.status(500).json({ message: error.message });
  }
};


// @route  GET /api/tasks/optimise-route
// @access Officer
const getOptimisedRoute = async (req, res) => {
  try {
    const route = await optimiseRoute(req.user._id);
    res.json(route);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// @route  GET /api/tasks/my
// @access Officer
const getMyTasks = async (req, res) => {
  try {
    const tasks = await Task.find({
      assignedTo: req.user._id,
      status: { $in: ["pending", "in_progress"] },
    })
      .populate("report", "photoUrl aiScore priority notes location")
      .populate("bin", "location city ward area fillLevel status")
      .sort({ priority: -1, createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  PUT /api/tasks/:id/start
// @access Officer
const startTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Only assigned officer can start
    if (task.assignedTo.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not your task" });
    }

    task.status = "in_progress";
    task.startedAt = Date.now();
    if (req.body.beforePhotoUrl) task.beforePhotoUrl = req.body.beforePhotoUrl;

    await task.save();
    res.json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  PUT /api/tasks/:id/complete
// @access Officer
const completeTask = async (req, res) => {
  try {
    const { afterPhotoUrl, notes } = req.body;

    if (!afterPhotoUrl) {
      return res.status(400).json({
        message: "After photo is required to complete a task",
      });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (task.assignedTo.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not your task" });
    }

    // Run AI verification on after photo
    console.log("Verifying after photo with Gemini AI...");
    const verification = await verifyCleanBin(afterPhotoUrl);
    console.log("Verification result:", verification);

    if (!verification.verified) {
      return res.status(400).json({
        message: "Task cannot be closed — AI detected waste still remaining",
        verification,
        hint: "Please clean the bin completely and upload a new photo",
      });
    }

    task.status = "completed";
    task.afterPhotoUrl = afterPhotoUrl;
    task.completedAt = Date.now();
    task.aiVerified = true;
    if (notes) task.notes = notes;
    await task.save();

    // Update bin to clean
    await Bin.findByIdAndUpdate(task.bin, {
      status: "clean",
      fillLevel: verification.remainingWaste || 0,
      lastCleaned: Date.now(),
    });

    // Resolve the report
    await Report.findByIdAndUpdate(task.report, { status: "resolved" });

    // Notify admin via Socket.io
    const io = req.app.get("io");
    if (io) {
      io.to("admin_room").emit("task_completed", {
        message: `✅ Task completed in ${task.city}`,
        taskId: task._id,
        aiVerified: true,
        confidence: verification.confidence,
      });
    }

    res.json({
      task,
      verification: {
        isClean: verification.isClean,
        confidence: verification.confidence,
        reasoning: verification.reasoning,
      },
      message: "Task completed and AI-verified successfully!",
    });
  } catch (error) {
    console.error("Complete task error:", error);
    res.status(500).json({ message: error.message });
  }
};

// @route  GET /api/tasks/stats
// @access Admin
const getTaskStats = async (req, res) => {
  try {
    const city = req.query.city;
    const filter = city ? { city } : {};

    const total = await Task.countDocuments(filter);
    const pending = await Task.countDocuments({ ...filter, status: "pending" });
    const inProgress = await Task.countDocuments({ ...filter, status: "in_progress" });
    const completed = await Task.countDocuments({ ...filter, status: "completed" });

    res.json({ total, pending, inProgress, completed });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAllTasks,
  assignTask,
  getMyTasks,
  startTask,
  completeTask,
  getTaskStats,
  getOptimisedRoute,
};
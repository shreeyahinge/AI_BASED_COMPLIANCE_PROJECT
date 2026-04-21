const Task = require("../models/Task");
const Bin = require("../models/Bin");
const Report = require("../models/Report");

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
      .populate("report", "photoUrl aiScore priority")
      .populate("bin", "location city ward area fillLevel status")
      .populate("assignedTo", "name email phone")
      .populate("assignedBy", "name email")
      .sort({ createdAt: -1 });

    res.json(tasks);
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
      .populate("report", "photoUrl aiScore priority notes")
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

    task.status = "completed";
    task.afterPhotoUrl = afterPhotoUrl;
    task.completedAt = Date.now();
    task.aiVerified = true; // Will be real AI check in Term 2
    if (notes) task.notes = notes;

    await task.save();

    // Update bin status to clean
    await Bin.findByIdAndUpdate(task.bin, {
      status: "clean",
      fillLevel: 0,
      lastCleaned: Date.now(),
    });

    // Update report status to resolved
    await Report.findByIdAndUpdate(task.report, {
      status: "resolved",
    });

    res.json(task);
  } catch (error) {
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

module.exports = { getAllTasks, getMyTasks, startTask, completeTask, getTaskStats };
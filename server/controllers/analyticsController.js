const Report = require("../models/Report");
const Bin = require("../models/Bin");
const Task = require("../models/Task");
const { generateWardReport } = require("../services/pdfService");

// @route  GET /api/analytics/overview
const getOverview = async (req, res) => {
  try {
    const city = req.query.city;
    const filter = city ? { city } : {};

    const [
      totalBins,
      criticalBins,
      totalReports,
      resolvedReports,
      pendingReports,
      totalTasks,
      completedTasks,
    ] = await Promise.all([
      Bin.countDocuments({ ...filter, isActive: true }),
      Bin.countDocuments({ ...filter, status: "critical" }),
      Report.countDocuments(filter),
      Report.countDocuments({ ...filter, status: "resolved" }),
      Report.countDocuments({ ...filter, status: "pending" }),
      Task.countDocuments(filter),
      Task.countDocuments({ ...filter, status: "completed" }),
    ]);

    const resolutionRate = totalReports > 0
      ? Math.round((resolvedReports / totalReports) * 100)
      : 0;

    res.json({
      totalBins,
      criticalBins,
      totalReports,
      resolvedReports,
      pendingReports,
      totalTasks,
      completedTasks,
      resolutionRate,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// @route  GET /api/analytics/export-pdf
const exportPDF = async (req, res) => {
  try {
    const city = req.query.city;
    const filter = city ? { city } : {};

    const [overviewData, wardStatsData] = await Promise.all([
      // inline overview calculation
      (async () => {
        const Bin = require("../models/Bin");
        const Report = require("../models/Report");
        const Task = require("../models/Task");
        const [totalBins, criticalBins, totalReports,
          resolvedReports, totalTasks, completedTasks] = await Promise.all([
          Bin.countDocuments({ ...filter, isActive: true }),
          Bin.countDocuments({ ...filter, status: "critical" }),
          Report.countDocuments(filter),
          Report.countDocuments({ ...filter, status: "resolved" }),
          Task.countDocuments(filter),
          Task.countDocuments({ ...filter, status: "completed" }),
        ]);
        return {
          totalBins, criticalBins, totalReports, resolvedReports,
          totalTasks, completedTasks,
          resolutionRate: totalReports > 0
            ? Math.round((resolvedReports / totalReports) * 100) : 0,
        };
      })(),
      Report.aggregate([
        { $match: filter },
        { $group: {
          _id: "$ward",
          totalReports: { $sum: 1 },
          criticalReports: { $sum: { $cond: [{ $eq: ["$priority", "critical"] }, 1, 0] } },
          resolvedReports: { $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] } },
          avgFillLevel: { $avg: "$fillLevel" },
        }},
        { $sort: { totalReports: -1 } },
      ]),
    ]);

    generateWardReport({ overview: overviewData, wardStats: wardStatsData }, res);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};



// @route  GET /api/analytics/ward-stats
const getWardStats = async (req, res) => {
  try {
    const city = req.query.city;
    const matchFilter = city ? { city } : {};

    const wardStats = await Report.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: "$ward",
          totalReports: { $sum: 1 },
          criticalReports: {
            $sum: { $cond: [{ $eq: ["$priority", "critical"] }, 1, 0] },
          },
          resolvedReports: {
            $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] },
          },
          avgFillLevel: { $avg: "$fillLevel" },
        },
      },
      { $sort: { totalReports: -1 } },
    ]);

    res.json(wardStats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  GET /api/analytics/daily-reports
const getDailyReports = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const city = req.query.city;

    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    const matchFilter = { createdAt: { $gte: dateFrom } };
    if (city) matchFilter.city = city;

    const daily = await Report.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
          critical: {
            $sum: { $cond: [{ $eq: ["$priority", "critical"] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json(daily);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  GET /api/analytics/officer-performance
const getOfficerPerformance = async (req, res) => {
  try {
    const city = req.query.city;
    const matchFilter = city ? { city } : {};

    const performance = await Task.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: "$assignedTo",
          totalTasks: { $sum: 1 },
          completedTasks: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          avgCompletionTime: {
            $avg: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$completedAt", null] },
                    { $ne: ["$startedAt", null] },
                  ],
                },
                { $subtract: ["$completedAt", "$startedAt"] },
                null,
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "officer",
        },
      },
      { $unwind: "$officer" },
      {
        $project: {
          name: "$officer.name",
          role: "$officer.role",
          city: "$officer.city",
          totalTasks: 1,
          completedTasks: 1,
          avgCompletionTimeMs: "$avgCompletionTime",
        },
      },
      { $sort: { completedTasks: -1 } },
    ]);

    res.json(performance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getOverview,
  getWardStats,
  getDailyReports,
  getOfficerPerformance,
  exportPDF,
};
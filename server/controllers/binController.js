const Bin = require("../models/Bin");

// @route  POST /api/bins
// @access Admin only
const createBin = async (req, res) => {
  try {
    const {
      binId,
      address,
      longitude,
      latitude,
      city,
      ward,
      area,
      locationType,
      capacity,
    } = req.body;

    // Check for duplicate binId
    const exists = await Bin.findOne({ binId });
    if (exists) {
      return res.status(400).json({ message: "Bin ID already exists" });
    }

    const bin = await Bin.create({
      binId,
      location: {
        type: "Point",
        coordinates: [longitude, latitude],
        address,
      },
      city,
      ward,
      area,
      locationType,
      capacity,
    });

    res.status(201).json(bin);
  } catch (error) {
    console.error("Create bin error:", error);
    res.status(500).json({ message: error.message });
  }
};

// @route  GET /api/bins
// @access Protected
// Supports filtering: ?city=Mumbai&ward=Ward42&status=critical
const getAllBins = async (req, res) => {
  try {
    const filter = { isActive: true };

    if (req.query.city) filter.city = req.query.city;
    if (req.query.ward) filter.ward = req.query.ward;
    if (req.query.area) filter.area = req.query.area;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.locationType) filter.locationType = req.query.locationType;

    const bins = await Bin.find(filter)
      .populate("assignedOfficer", "name email phone")
      .sort({ createdAt: -1 });

    res.json(bins);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  GET /api/bins/stats
// @access Admin
const getBinStats = async (req, res) => {
  try {
    const city = req.query.city;
    const matchFilter = city ? { city, isActive: true } : { isActive: true };

    const stats = await Bin.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const total = await Bin.countDocuments(matchFilter);
    const critical = stats.find((s) => s._id === "critical")?.count || 0;
    const medium = stats.find((s) => s._id === "medium")?.count || 0;
    const clean = stats.find((s) => s._id === "clean")?.count || 0;

    res.json({ total, critical, medium, clean });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  GET /api/bins/:id
// @access Protected
const getBinById = async (req, res) => {
  try {
    const bin = await Bin.findById(req.params.id).populate(
      "assignedOfficer",
      "name email phone"
    );
    if (!bin) {
      return res.status(404).json({ message: "Bin not found" });
    }
    res.json(bin);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  PUT /api/bins/:id
// @access Admin only
const updateBin = async (req, res) => {
  try {
    const bin = await Bin.findById(req.params.id);
    if (!bin) {
      return res.status(404).json({ message: "Bin not found" });
    }

    const { fillLevel, status, ward, area, capacity, assignedOfficer, isActive } = req.body;

    if (fillLevel !== undefined) {
      bin.fillLevel = fillLevel;
      // Auto-set status based on fill level
      if (fillLevel >= 85) bin.status = "critical";
      else if (fillLevel >= 50) bin.status = "medium";
      else bin.status = "clean";
    }
    if (status) bin.status = status;
    if (ward) bin.ward = ward;
    if (area) bin.area = area;
    if (capacity) bin.capacity = capacity;
    if (assignedOfficer !== undefined) bin.assignedOfficer = assignedOfficer;
    if (isActive !== undefined) bin.isActive = isActive;

    bin.lastUpdated = Date.now();

    const updatedBin = await bin.save();
    res.json(updatedBin);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  DELETE /api/bins/:id
// @access Admin only
const deleteBin = async (req, res) => {
  try {
    const bin = await Bin.findById(req.params.id);
    if (!bin) {
      return res.status(404).json({ message: "Bin not found" });
    }
    await bin.deleteOne();
    res.json({ message: "Bin removed successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createBin,
  getAllBins,
  getBinStats,
  getBinById,
  updateBin,
  deleteBin,
};
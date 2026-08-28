const Bin = require("../models/Bin");
const Report = require("../models/Report");
const Task = require("../models/Task");
const User = require("../models/User");
const { analyseWasteImage } = require("../services/aiService");
const { cloudinary } = require("../config/cloudinary");
const { predictOverflow } = require("../services/predictionService");

// @route  POST /api/bins/:id/live-detect
// @access Protected
const liveDetectBin = async (req, res) => {
  try {
    const { imageBase64, photoUrl, source } = req.body;
    const binId = req.params.id;

    if (!imageBase64 && !photoUrl) {
      return res.status(400).json({ message: "Image data is required for live detection" });
    }

    const bin = await Bin.findById(binId);
    if (!bin) {
      return res.status(404).json({ message: "Bin not found" });
    }

    const imageInput = imageBase64 || photoUrl;
    console.log(`[IoT Live Camera] Analysing frame for bin ${bin.binId || bin._id}...`);
    const aiResult = await analyseWasteImage(imageInput);
    console.log("[IoT Live Camera] AI result:", aiResult);

    const detectedFillLevel = aiResult.fillLevel || 0;
    const aiScore = aiResult.aiScore || 0;

    // Update bin status in DB
    bin.fillLevel = detectedFillLevel;
    bin.lastUpdated = Date.now();
    if (detectedFillLevel >= 85) bin.status = "critical";
    else if (detectedFillLevel >= 50) bin.status = "medium";
    else bin.status = "clean";
    await bin.save();

    // Broadcast live bin update via Socket.io
    const io = req.app.get("io");
    if (io) {
      io.to("admin_room").emit("bin_updated", {
        binId: bin._id,
        code: bin.binId,
        fillLevel: bin.fillLevel,
        status: bin.status,
        address: bin.location?.address,
        updatedAt: bin.lastUpdated,
      });
      io.to(`city_${bin.city}`).emit("bin_updated", {
        binId: bin._id,
        code: bin.binId,
        fillLevel: bin.fillLevel,
        status: bin.status,
        address: bin.location?.address,
        updatedAt: bin.lastUpdated,
      });
    }

    let automatedReport = null;
    let automatedTask = null;
    let alertDispatched = false;

    // Priority based on fillLevel & aiScore
    const priority = detectedFillLevel >= 85 ? "critical" : detectedFillLevel >= 60 ? "high" : detectedFillLevel >= 40 ? "medium" : "low";

    // Auto-create Report and dispatch Task if waste level is High or Critical (>= 60%)
    if ((priority === "critical" || priority === "high") && aiResult.isWaste) {
      // Check if there is already an active pending/in_progress task for this bin within the last 30 minutes
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
      const existingActiveTask = await Task.findOne({
        bin: bin._id,
        status: { $in: ["pending", "in_progress"] },
        createdAt: { $gte: thirtyMinsAgo },
      });

      if (!existingActiveTask) {
        let storedPhotoUrl = photoUrl || "";
        if (imageBase64 && imageBase64.startsWith("data:")) {
          try {
            const uploadRes = await cloudinary.uploader.upload(imageBase64, {
              folder: "smartbin/iot_camera",
              transformation: [{ width: 800, quality: "auto" }],
            });
            storedPhotoUrl = uploadRes.secure_url;
          } catch (uploadErr) {
            console.log("Cloudinary live upload fallback:", uploadErr.message);
            storedPhotoUrl = imageBase64;
          }
        }

        const adminUser = await User.findOne({ role: "admin" });
        const fallbackUserId = req.user?._id || adminUser?._id;

        // Create automated Report
        automatedReport = await Report.create({
          citizen: fallbackUserId,
          bin: bin._id,
          photoUrl: storedPhotoUrl || "https://images.unsplash.com/photo-1605600659908-0ef719419d41?w=800&auto=format&fit=crop",
          aiScore,
          aiLabels: aiResult.wasteLabels || [],
          fillLevel: detectedFillLevel,
          priority,
          status: "assigned",
          location: {
            latitude: bin.location?.coordinates?.[1],
            longitude: bin.location?.coordinates?.[0],
          },
          city: bin.city,
          ward: bin.ward,
          area: bin.area,
          notes: `🤖 Automated Live Camera Detection: ${aiResult.wasteType || "Waste"} detected (${detectedFillLevel}% full). ${aiResult.reasoning || ""}`,
        });

        // Find officer in that city/ward
        let officer = await User.findOne({
          role: "officer",
          city: new RegExp(`^${bin.city}$`, "i"),
          assignedWard: bin.ward,
          isActive: true,
        });

        if (!officer) {
          officer = await User.findOne({
            role: "officer",
            city: new RegExp(`^${bin.city}$`, "i"),
            isActive: true,
          });
        }

        if (officer) {
          automatedTask = await Task.create({
            report: automatedReport._id,
            bin: bin._id,
            assignedTo: officer._id,
            assignedBy: fallbackUserId,
            priority,
            city: bin.city,
            ward: bin.ward,
            notes: `Auto-dispatched via Live Camera AI Detection (${detectedFillLevel}% full)`,
          });

          alertDispatched = true;

          // Socket Alerts
          if (io) {
            io.to("admin_room").emit("new_critical_report", {
              message: `🚨 [Live Camera] ${priority.toUpperCase()} Overflow detected at ${bin.location?.address || bin.binId} (${detectedFillLevel}%)`,
              report: automatedReport._id,
              bin: bin.binId,
              ward: bin.ward,
              priority,
            });

            io.to(`city_${bin.city}`).emit("new_task_assigned", {
              message: `📋 [Auto-Dispatched] New task assigned at ${bin.location?.address || bin.binId}. Fill level: ${detectedFillLevel}%`,
              taskId: automatedTask._id,
              priority,
              address: bin.location?.address,
            });
          }
        }
      }
    }

    res.json({
      success: true,
      bin,
      aiResult,
      alertDispatched,
      report: automatedReport,
      task: automatedTask,
      message: `Live detection complete: ${detectedFillLevel}% fill level detected`,
    });
  } catch (error) {
    console.error("Live detect error:", error);
    res.status(500).json({ message: error.message });
  }
};

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
// @route  GET /api/bins/:id/predict
// @access Admin
const predictBinOverflow = async (req, res) => {
  try {
    const bin = await Bin.findById(req.params.id);
    if (!bin) {
      return res.status(404).json({ message: "Bin not found" });
    }
    const prediction = await predictOverflow(req.params.id);
    res.json({ bin: bin.binId, location: bin.location.address, ...prediction });
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
  predictBinOverflow,
  liveDetectBin,
};
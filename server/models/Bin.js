const mongoose = require("mongoose");

const binSchema = new mongoose.Schema(
  {
    binId: {
      type: String,
      unique: true,
      required: [true, "Please add a bin ID"],
      trim: true,
      // e.g. "MUM-WARD42-001"
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
      address: {
        type: String,
        required: [true, "Please add an address"],
      },
    },
    city: {
      type: String,
      required: [true, "Please add a city"],
      trim: true,
    },
    ward: {
      type: String,
      required: [true, "Please add a ward"],
      trim: true,
      // e.g. "Ward 42", "Zone B"
    },
    area: {
      type: String,
      required: [true, "Please add an area name"],
      trim: true,
      // e.g. "Andheri East", "Bandra West"
    },
    locationType: {
      type: String,
      enum: [
        "street",
        "market",
        "park",
        "hospital",
        "school",
        "residential",
        "commercial",
        "bus stop",
        "railway station",
        "other",
      ],
      default: "street",
    },
    capacity: {
      type: Number,
      required: [true, "Please add capacity in litres"],
      default: 100,
    },
    fillLevel: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    status: {
      type: String,
      enum: ["clean", "medium", "critical"],
      default: "clean",
    },
    assignedOfficer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    lastCleaned: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
      // Can deactivate a bin without deleting it
    },
  },
  { timestamps: true }
);

// Geospatial index for map queries
binSchema.index({ location: "2dsphere" });

// Index for fast filtering by city/ward
binSchema.index({ city: 1, ward: 1 });
binSchema.index({ status: 1 });

module.exports = mongoose.model("Bin", binSchema);
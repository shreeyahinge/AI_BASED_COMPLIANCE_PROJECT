const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    citizen: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    bin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bin",
      required: true,
    },
    photoUrl: {
      type: String,
      required: [true, "Photo is required"],
    },
    aiScore: {
      type: Number,
      default: 0,
    },
    aiLabels: {
      type: [String],
      default: [],
    },
    fillLevel: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical", "rejected"],
      default: "low",
    },
    status: {
      type: String,
      enum: ["pending", "assigned", "resolved", "rejected"],
      default: "pending",
    },
    location: {
      latitude: { type: Number },
      longitude: { type: Number },
    },
    city: {
      type: String,
      default: "",
    },
    ward: {
      type: String,
      default: "",
    },
    area: {
      type: String,
      default: "",
    },
    notes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// Indexes for fast querying
reportSchema.index({ city: 1, ward: 1 });
reportSchema.index({ status: 1 });
reportSchema.index({ priority: 1 });
reportSchema.index({ citizen: 1 });

module.exports = mongoose.model("Report", reportSchema);
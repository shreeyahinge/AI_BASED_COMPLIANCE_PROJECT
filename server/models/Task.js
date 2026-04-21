const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    report: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Report",
      required: true,
    },
    bin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bin",
      required: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "cancelled"],
      default: "pending",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    city: {
      type: String,
      default: "",
    },
    ward: {
      type: String,
      default: "",
    },
    beforePhotoUrl: {
      type: String,
      default: "",
    },
    afterPhotoUrl: {
      type: String,
      default: "",
    },
    aiVerified: {
      type: Boolean,
      default: false,
      // True only when AI confirms bin is clean in after photo
    },
    notes: {
      type: String,
      default: "",
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes for fast queries
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ city: 1, ward: 1 });
taskSchema.index({ status: 1, priority: 1 });

module.exports = mongoose.model("Task", taskSchema);
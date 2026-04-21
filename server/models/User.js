const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add a name"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Please add an email"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Please add a password"],
      minlength: 6,
    },
    role: {
      type: String,
      enum: ["citizen", "officer", "admin"],
      default: "citizen",
    },
    phone: {
      type: String,
      default: "",
    },
    city: {
      type: String,
      default: "",
      // Which city this user belongs to
    },
    assignedWard: {
      type: String,
      default: "",
      // For officers — which ward they are responsible for
    },
    assignedZone: {
      type: String,
      default: "",
      // For officers — broader zone if needed
    },
    greenPoints: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
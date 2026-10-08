const mongoose = require("mongoose");

const registrationSchema = new mongoose.Schema(
  {
    referenceId: { type: String, required: true, unique: true, index: true },
    eventId: { type: String, required: true, index: true },
    eventName: { type: String, default: "" },
    fullName: { type: String, default: "" },
    email: { type: String, default: "" },
    mobile: { type: String, default: "" },
    department: { type: String, default: "" },
    year: { type: String, default: "" },
    teamName: { type: String, default: "" },
    participationType: { type: String, default: "" },
    registrationDateTime: { type: String, default: () => new Date().toISOString() },
  },
  {
    collection: "registrations",
    strict: false,
    versionKey: false,
    timestamps: true,
  }
);

module.exports = mongoose.models.Registration || mongoose.model("Registration", registrationSchema);

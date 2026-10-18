const mongoose = require("mongoose");

const appSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true }, // e.g. "branding", "permissions", "profile"
    value: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  {
    collection: "app_settings",
    strict: false,
    versionKey: false,
    timestamps: true
  }
);

module.exports = mongoose.models.AppSettings || mongoose.model("AppSettings", appSettingsSchema);

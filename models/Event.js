const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  category: String,
  status: String,
  registrationFee: { type: Number, default: 0 },
  qrCode: String,
  scannerEnabled: mongoose.Schema.Types.Mixed
}, {
  collection: "events",
  strict: false,
  versionKey: false
});

module.exports = mongoose.models.Event || mongoose.model("Event", eventSchema);

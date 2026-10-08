const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    referenceId: { type: String, required: true, index: true },
    eventId: { type: String, required: true, index: true },
    eventName: { type: String, default: "" },
    participantName: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    department: { type: String, default: "" },
    year: { type: String, default: "" },
    team: { type: String, default: "" },
    amount: { type: mongoose.Schema.Types.Mixed, default: 0 },
    paymentTransactionId: { type: String, default: "" },
    paymentStatus: { type: String, default: "Submitted" },
    registrationDateTime: { type: String, default: "" },
    paymentMethod: { type: String, default: "UPI" },
    paymentDate: { type: String, default: () => new Date().toISOString() },
  },
  {
    collection: "payments",
    strict: false,
    versionKey: false,
    timestamps: true,
  }
);

module.exports = mongoose.models.Payment || mongoose.model("Payment", paymentSchema);

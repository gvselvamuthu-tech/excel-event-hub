const mongoose = require("mongoose");

const paymentQrSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true }, // e.g. "qr-1"
    name: { type: String, required: true }, // e.g. "Main Campus UPI" or "QR 1"
    provider: { type: String, default: "UPI" }, // e.g. "GooglePay / PhonePe"
    dataUrl: { type: String, required: true }, // base64 data url image
    active: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false }
  },
  {
    collection: "payment_qrs",
    strict: false,
    versionKey: false,
    timestamps: true
  }
);

module.exports = mongoose.models.PaymentQr || mongoose.model("PaymentQr", paymentQrSchema);

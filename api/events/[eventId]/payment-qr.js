const QRCode = require("qrcode");
const { connectToDatabase } = require("../../../lib/db");
const Event = require("../../../models/Event");
const { parseRegistrationFee, buildEventUpiPaymentLink } = require("../../../public/js/payment-config");

module.exports = async function handler(req, res) {
  if (req.method && req.method.toUpperCase() !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "Method not allowed." }));
  }

  try {
    await connectToDatabase();

    const queryEventId = req.query && (req.query.eventId || req.query.id);
    let eventId = queryEventId;

    if (!eventId) {
      const parsedUrl = new URL(req.url || "/", "http://localhost");
      const parts = parsedUrl.pathname.split("/").filter(Boolean);
      // Expected pathname: /api/events/:eventId/payment-qr
      const qrIdx = parts.indexOf("payment-qr");
      if (qrIdx > 0) {
        eventId = parts[qrIdx - 1];
      }
    }

    if (eventId) {
      eventId = decodeURIComponent(eventId).trim();
    }

    if (!eventId) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ error: "A valid event id is required." }));
    }

    const event = await Event.findOne({ id: eventId }, { id: 1, title: 1, registrationFee: 1 }).lean();
    if (!event) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ error: "The selected event could not be found." }));
    }

    if (parseRegistrationFee(event.registrationFee) === null) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ error: `Event "${event.id}" has an invalid registration fee.` }));
    }

    const paymentUri = buildEventUpiPaymentLink(event);
    const qrImage = await QRCode.toBuffer(paymentUri, {
      type: "png",
      errorCorrectionLevel: "H",
      margin: 2,
      width: 512
    });

    res.statusCode = 200;
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store");
    return res.end(qrImage);
  } catch (error) {
    console.error("QR Generation error:", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: error.message || "Failed to generate payment QR code." }));
  }
};

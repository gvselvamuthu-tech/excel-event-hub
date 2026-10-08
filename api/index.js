const QRCode = require("qrcode");
const { connectToDatabase } = require("../lib/db");
const Event = require("../models/Event");
const Registration = require("../models/Registration");
const Payment = require("../models/Payment");
const { verifyAdminCredentials } = require("../lib/admin-credentials");
const { normalizeLegacyRegistrationFee } = require("../lib/event-fees");
const { parseRegistrationFee, buildEventUpiPaymentLink } = require("../public/js/payment-config");
const { REGISTRATION_FIELDS, PAYMENT_FIELDS, generateExcelBuffer } = require("../lib/excel-export");

// Helper to parse JSON body from incoming request
async function parseBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }
  if (typeof req.body === "string" && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      // continue to buffer stream
    }
  }
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 7 * 1024 * 1024) {
        reject(new Error("Request body too large."));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

async function readEvents() {
  const rows = await Event.find({}, { _id: 0 }).lean();
  return {
    technical: rows.filter((event) => String(event.category).toLowerCase() === "technical"),
    nonTechnical: rows.filter((event) => String(event.category).toLowerCase() === "non-technical")
  };
}

async function writeEvents(payload) {
  if (!payload || !Array.isArray(payload.technical) || !Array.isArray(payload.nonTechnical)) {
    throw new Error("Events must include technical and nonTechnical arrays.");
  }
  const events = [...payload.technical, ...payload.nonTechnical];
  if (events.length > 200 || events.some((event) => !event || typeof event !== "object" || !String(event.id || "").trim() || !String(event.title || "").trim())) {
    throw new Error("Each event must have an id and title; at most 200 events are allowed.");
  }
  const ids = events.map((event) => String(event.id));
  if (new Set(ids).size !== ids.length) throw new Error("Event ids must be unique.");
  const existingEvents = await Event.find({ id: { $in: ids } }, { id: 1, registrationFee: 1 }).lean();
  const existingById = new Map(existingEvents.map((event) => [String(event.id), event]));

  const normalized = events.map((event) => ({
    ...event,
    registrationFee: (() => {
      const hasFee = Object.prototype.hasOwnProperty.call(event, "registrationFee");
      const existing = existingById.get(String(event.id));
      if (!hasFee && !existing) throw new Error(`Registration fee is required for new event "${event.id}".`);
      const registrationFee = parseRegistrationFee(hasFee ? event.registrationFee : existing.registrationFee);
      if (registrationFee === null) {
        throw new Error(`Registration fee for event "${event.id}" must be a non-negative number with up to two decimal places.`);
      }
      return registrationFee;
    })(),
    category: payload.technical.includes(event) ? "Technical" : "Non-Technical",
    qrCode: String(event.qrCode || "").trim() || "upi:auto",
    scannerEnabled: event.scannerEnabled !== undefined && event.scannerEnabled !== null && String(event.scannerEnabled).trim() !== ""
      ? ["true", "1", "yes"].includes(String(event.scannerEnabled).trim().toLowerCase())
      : /\bseminar\b/i.test(`${event.id || ""} ${event.title || ""}`),
  }));

  const normalizedIds = normalized.map((event) => String(event.id));
  if (normalized.length) {
    await Event.bulkWrite(normalized.map((event) => ({
      updateOne: {
        filter: { id: String(event.id) },
        update: { $set: event },
        upsert: true
      }
    })), { ordered: true });
  }
  await Event.deleteMany({ id: { $nin: normalizedIds } });
}

module.exports = async function handler(req, res) {
  try {
    await connectToDatabase();

    const rawPath = req.headers["x-matched-path"] || req.headers["x-invoke-path"] || req.url;
    const url = new URL(rawPath, "http://localhost");
    let pathname = url.pathname;
    
    // Normalize path if running behind rewrites
    if (pathname.startsWith("/api/")) {
      // standard path
    } else if (req.query && req.query.path) {
      pathname = "/api/" + (Array.isArray(req.query.path) ? req.query.path.join("/") : req.query.path);
    }

    const method = req.method ? req.method.toUpperCase() : "GET";

    // 1. Admin Verify
    if (method === "POST" && pathname === "/api/admin/verify") {
      const { username, password } = await parseBody(req);
      if (!verifyAdminCredentials(username, password)) {
        return sendJson(res, 401, { error: "Invalid admin credentials" });
      }
      return sendJson(res, 200, { verified: true });
    }

    // 2. Events List (GET)
    if (method === "GET" && pathname === "/api/events") {
      const data = await readEvents();
      return sendJson(res, 200, data);
    }

    // 3. Events Update (PUT)
    if (method === "PUT" && pathname === "/api/events") {
      const body = await parseBody(req);
      await writeEvents(body);
      const data = await readEvents();
      return sendJson(res, 200, data);
    }

    // 4. Payment QR Generation (GET /api/events/:eventId/payment-qr)
    const paymentQrMatch = /^\/api\/events\/([^/]+)\/payment-qr$/.exec(pathname);
    if (method === "GET" && paymentQrMatch) {
      const eventId = decodeURIComponent(paymentQrMatch[1]);
      if (!eventId.trim()) {
        return sendJson(res, 400, { error: "A valid event id is required to generate a payment QR." });
      }
      const event = await Event.findOne({ id: eventId }, { id: 1, title: 1, registrationFee: 1 }).lean();
      if (!event) {
        return sendJson(res, 404, { error: "The selected event could not be found." });
      }
      if (parseRegistrationFee(event.registrationFee) === null) {
        throw new Error(`Event "${event.id}" has an invalid registration fee; its payment QR cannot be generated.`);
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
    }

    // 5. Event QR Upload (POST /api/event-qr/:eventId)
    if (method === "POST" && pathname.startsWith("/api/event-qr/")) {
      const eventId = decodeURIComponent(pathname.slice("/api/event-qr/".length));
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_\-\.]{0,99}$/.test(eventId)) {
        throw new Error("A valid event id is required for the QR upload.");
      }
      const { dataUrl } = await parseBody(req);
      const match = /^data:image\/(png|jpeg|webp);base64,([a-zA-Z0-9+/]+={0,2})$/.exec(String(dataUrl || ""));
      if (!match) throw new Error("Upload a PNG, JPEG, or WebP QR image.");
      const image = Buffer.from(match[2], "base64");
      if (!image.length || image.length > 5 * 1024 * 1024) {
        throw new Error("QR images must be smaller than 5 MB.");
      }
      // Store dataUrl directly in MongoDB on the event record so it survives serverless statelessness
      await Event.updateOne(
        { id: eventId },
        { $set: { qrCode: dataUrl } }
      );
      return sendJson(res, 201, { qrCode: dataUrl });
    }

    // 6. Registrations (GET)
    if (method === "GET" && pathname === "/api/registrations") {
      const records = await Registration.find({}, { _id: 0, createdAt: 0, updatedAt: 0 }).lean();
      return sendJson(res, 200, records);
    }

    // 7. Registrations Download (GET /api/registrations/download)
    if (method === "GET" && pathname === "/api/registrations/download") {
      const records = await Registration.find({}, { _id: 0, createdAt: 0, updatedAt: 0 }).lean();
      const buffer = await generateExcelBuffer("Registrations", REGISTRATION_FIELDS, records);
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", 'attachment; filename="registrations.xlsx"');
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      return res.end(buffer);
    }

    // 8. Registrations (POST)
    if (method === "POST" && pathname === "/api/registrations") {
      const record = await parseBody(req);
      if (!record.referenceId) throw new Error("Registration referenceId is required.");
      if (!record.eventId) throw new Error("Registration eventId is required.");
      const event = await Event.findOne({ id: record.eventId }).lean();
      if (!event) throw new Error("The selected event could not be found.");
      if (String(event.status || "Open").trim().toLowerCase() === "closed") {
        throw new Error("Registration for this event is closed.");
      }
      await Registration.updateOne(
        { referenceId: String(record.referenceId) },
        { $set: record },
        { upsert: true }
      );
      return sendJson(res, 201, { success: true });
    }

    // 9. Payments (GET)
    if (method === "GET" && pathname === "/api/payments") {
      const records = await Payment.find({}, { _id: 0, createdAt: 0, updatedAt: 0 }).lean();
      return sendJson(res, 200, records);
    }

    // 10. Payments Download (GET /api/payments/download)
    if (method === "GET" && pathname === "/api/payments/download") {
      const records = await Payment.find({}, { _id: 0, createdAt: 0, updatedAt: 0 }).lean();
      const buffer = await generateExcelBuffer("Payments", PAYMENT_FIELDS, records);
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", 'attachment; filename="payments.xlsx"');
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      return res.end(buffer);
    }

    // 11. Payments (POST)
    if (method === "POST" && pathname === "/api/payments") {
      const record = await parseBody(req);
      if (!record.referenceId) throw new Error("Payment referenceId is required.");
      await Payment.updateOne(
        { referenceId: String(record.referenceId) },
        { $set: record },
        { upsert: true }
      );
      return sendJson(res, 201, { success: true });
    }

    // 12. Clear Payments (POST /api/payments/clear)
    if (method === "POST" && pathname === "/api/payments/clear") {
      const { username, password, confirmed } = await parseBody(req);
      if (!verifyAdminCredentials(username, password)) {
        return sendJson(res, 401, { error: "Invalid admin credentials" });
      }
      if (confirmed !== true) {
        return sendJson(res, 400, { error: "Explicit confirmation is required before clearing payment records." });
      }
      const countBefore = await Payment.countDocuments();
      await Payment.deleteMany({});
      return sendJson(res, 200, {
        success: true,
        message: "All payment records cleared successfully.",
        clearedCount: countBefore,
        remainingCount: 0,
        backupFile: "mongodb-cleared"
      });
    }

    return sendJson(res, 404, {
      error: "API route not found.",
      debug: {
        rawUrl: req.url,
        parsedPathname: pathname,
        method,
        query: req.query
      }
    });
  } catch (error) {
    console.error("API Error:", error);
    return sendJson(res, error.statusCode || 400, { error: error.message || "Request failed." });
  }
};

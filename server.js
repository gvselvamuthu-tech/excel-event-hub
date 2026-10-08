const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const vm = require("node:vm");
const ExcelJS = require("exceljs");
const QRCode = require("qrcode");
const { parseRegistrationFee, buildEventUpiPaymentLink } = require("./public/js/payment-config");
const { normalizeLegacyRegistrationFee } = require("./lib/event-fees");
const { withWorkbookLock } = require("./lib/workbook-lock");

const ROOT = __dirname;
require("dotenv").config({ path: path.join(ROOT, ".env") });

const { verifyAdminCredentials } = require("./lib/admin-credentials");
const { clearWorkbookRecords } = require("./lib/workbook-records");
const mongoose = require("mongoose");
const Event = require("./models/Event");
const Registration = require("./models/Registration");
const Payment = require("./models/Payment");
const { generateExcelBuffer } = require("./lib/excel-export");
const mongoUri = process.env.MONGODB_URI;

const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const UPLOADS_DIR = path.join(ROOT, "uploads");
const EVENT_QR_DIR = path.join(UPLOADS_DIR, "event-qr");
const BACKUPS_DIR = path.join(DATA_DIR, "backups");
const WORKBOOKS = {
  events: path.join(DATA_DIR, "events.xlsx"),
  registrations: path.join(DATA_DIR, "registrations.xlsx"),
  payments: path.join(DATA_DIR, "payments.xlsx")
};
const REGISTRATION_FIELDS = [
  "referenceId", "eventId", "eventName", "fullName", "email", "mobile",
  "department", "year", "teamName", "participationType", "registrationDateTime"
];
const PAYMENT_FIELDS = [
  "referenceId", "eventId", "eventName", "participantName", "email", "phone",
  "department", "year", "team", "amount", "paymentTransactionId", "paymentStatus",
  "registrationDateTime", "paymentMethod", "paymentDate"
];
const COMPLEX_EVENT_FIELDS = new Set(["rules", "prizes"]);

function sourceEvents() {
  const sandbox = { window: {} };
  const source = fs.readFileSync(path.join(DATA_DIR, "events.js"), "utf8");
  vm.runInNewContext(source, sandbox, { timeout: 1000 });
  return JSON.parse(JSON.stringify(sandbox.window.EVENT_DATA));
}

async function ensureWorkbook(file, sheetName, fields, rows = []) {
  if (fs.existsSync(file)) return;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = fields.map((field) => ({ header: field, key: field }));
  rows.forEach((row) => sheet.addRow(serializeRow(row)));
  await workbook.xlsx.writeFile(file);
}

function serializeRow(row) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [
    key,
    Array.isArray(value) ? JSON.stringify(value) : value
  ]));
}

async function initializeWorkbooks() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const initialEvents = sourceEvents();
  const eventRows = [...initialEvents.technical, ...initialEvents.nonTechnical];
  const eventFields = [...new Set(eventRows.flatMap((event) => Object.keys(event)))];
  await ensureWorkbook(WORKBOOKS.events, "Events", eventFields, eventRows);
  await ensureWorkbook(WORKBOOKS.registrations, "Registrations", REGISTRATION_FIELDS);
  await ensureWorkbook(WORKBOOKS.payments, "Payments", PAYMENT_FIELDS);
  const storedEvents = await readRows(WORKBOOKS.events, "Events");
  if (storedEvents.some((event) => !String(event.qrCode || "").trim() || event.scannerEnabled === undefined || event.scannerEnabled === null || String(event.scannerEnabled).trim() === "")) {
    const migratedEvents = storedEvents.map((event) => ({
      ...event,
      qrCode: String(event.qrCode || "").trim() || "upi:auto",
      scannerEnabled: event.scannerEnabled !== undefined && event.scannerEnabled !== null && String(event.scannerEnabled).trim() !== ""
        ? ["true", "1", "yes"].includes(String(event.scannerEnabled).trim().toLowerCase())
        : /\bseminar\b/i.test(`${event.id || ""} ${event.title || ""}`)
    }));
    const migratedFields = [...new Set(migratedEvents.flatMap((event) => Object.keys(event)))];
    await writeRows(WORKBOOKS.events, "Events", migratedFields, migratedEvents);
  }
}

async function readRows(file, sheetName) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  const sheet = workbook.getWorksheet(sheetName) || workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) return [];
  const fields = sheet.getRow(1).values.slice(1).map((field) => String(field || ""));
  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const record = {};
    fields.forEach((field, index) => {
      if (field) record[field] = row.getCell(index + 1).value ?? "";
    });
    for (const field of COMPLEX_EVENT_FIELDS) {
      if (typeof record[field] === "string" && record[field].trim()) {
        try {
          record[field] = JSON.parse(record[field]);
        } catch (error) {
          record[field] = record[field].split(",").map((item) => item.trim()).filter(Boolean);
        }
      }
    }
    rows.push(record);
  });
  return rows;
}

async function writeRows(file, sheetName, fields, rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = fields.map((field) => ({ header: field, key: field }));
  rows.forEach((row) => sheet.addRow(serializeRow(row)));
  await workbook.xlsx.writeFile(file);
}

async function readEvents() {
  const rows = await Event.find({}, { _id: 0 }).lean();
  return {
    technical: rows.filter((event) => String(event.category).toLowerCase() === "technical"),
    nonTechnical: rows.filter((event) => String(event.category).toLowerCase() === "non-technical")
  };
}

async function migrateEventRegistrationFees() {
  const events = await Event.find({}, { id: 1, registrationFee: 1 }).lean();
  for (const event of events) {
    const registrationFee = normalizeLegacyRegistrationFee(event.registrationFee);
    if (typeof event.registrationFee !== "number" || event.registrationFee !== registrationFee) {
      await Event.updateOne({ id: event.id }, { $set: { registrationFee } });
    }
  }
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

function readWorkbookData(file, sheetName) {
  return readRows(file, sheetName);
}

async function appendRecord(file, sheetName, fields, record, uniqueField) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new Error("A record object is required.");
  }
  return withWorkbookLock(file, async () => {
    const current = await readWorkbookData(file, sheetName);
    const next = { ...record };
    if (uniqueField && next[uniqueField]) {
      const existingIndex = current.findIndex((row) => String(row[uniqueField]) === String(next[uniqueField]));
      if (existingIndex >= 0) current[existingIndex] = next;
      else current.push(next);
    } else {
      current.push(next);
    }
    const allFields = [...new Set([...fields, ...current.flatMap((row) => Object.keys(row))])];
    await writeRows(file, sheetName, allFields, current);
  });
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

async function sendWorkbookDownload(response, file, filename, label) {
  try {
    const workbookStat = await fs.promises.stat(file);
    if (!workbookStat.isFile()) {
      sendJson(response, 404, { error: `The ${label} workbook is not available for download.` });
      return;
    }
    const workbook = await fs.promises.readFile(file);
    response.writeHead(200, {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": workbook.length,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    });
    response.end(workbook);
  } catch (error) {
    const notFound = error.code === "ENOENT";
    sendJson(response, notFound ? 404 : 500, {
      error: notFound
        ? `The ${label} workbook was not found.`
        : `The ${label} workbook could not be downloaded.`
    });
  }
}

function readJson(request, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > maxBytes) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    request.on("error", reject);
  });
}

function serveStatic(request, response, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const decodedPath = decodeURIComponent(requested);
  const legacyQrPrefix = "/data/event-qr/";
  const isLegacyDataScript = ["/data/events.js", "/data/college.js"].includes(decodedPath);
  const isLegacyQr = decodedPath.startsWith(legacyQrPrefix);
  const isUpload = decodedPath.startsWith("/uploads/");
  const fileRoot = isLegacyDataScript ? ROOT : isLegacyQr ? EVENT_QR_DIR : isUpload ? UPLOADS_DIR : PUBLIC_DIR;
  const relativePath = isLegacyDataScript
    ? decodedPath.slice(1)
    : isLegacyQr
      ? path.basename(decodedPath.slice(legacyQrPrefix.length))
      : isUpload
        ? decodedPath.slice("/uploads/".length)
        : decodedPath;
  const file = path.resolve(fileRoot, relativePath.replace(/^[/\\]+/, ""));
  const relativeFile = path.relative(fileRoot, file);
  if (relativeFile === ".." || relativeFile.startsWith(`..${path.sep}`) || path.isAbsolute(relativeFile)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  fs.readFile(file, (error, contents) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500).end("Not found");
      return;
    }
    const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".jpe": "image/jpeg", ".webp": "image/webp" };
    const contentType = types[path.extname(file)] || "application/octet-stream";
    const isText = contentType.startsWith("text/") || contentType === "image/svg+xml" || contentType.includes("javascript");
    response.writeHead(200, { "Content-Type": isText ? `${contentType}; charset=utf-8` : contentType });
    response.end(contents);
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost");
  try {
    const paymentQrMatch = /^\/api\/events\/([^/]+)\/payment-qr$/.exec(url.pathname);
    if (request.method === "POST" && url.pathname === "/api/admin/verify") {
      const { username, password } = await readJson(request, 8192);
      if (!verifyAdminCredentials(username, password)) {
        sendJson(response, 401, { error: "Invalid admin credentials" });
        return;
      }
      sendJson(response, 200, { verified: true });
    } else if (request.method === "POST" && url.pathname === "/api/payments/clear") {
      const { username, password, confirmed } = await readJson(request, 8192);
      if (!verifyAdminCredentials(username, password)) {
        sendJson(response, 401, { error: "Invalid admin credentials" });
        return;
      }
      if (confirmed !== true) {
        sendJson(response, 400, { error: "Explicit confirmation is required before clearing payment records." });
        return;
      }
      try {
        const countBefore = await Payment.countDocuments();
        await Payment.deleteMany({});
        sendJson(response, 200, {
          success: true,
          message: "All payment records cleared successfully.",
          clearedCount: countBefore,
          remainingCount: 0,
          backupFile: "mongodb-cleared"
        });
      } catch (error) {
        console.error("Could not clear payment records:", error);
        sendJson(response, 500, { error: error.message || "Payment records could not be cleared." });
      }
    } else if (request.method === "GET" && paymentQrMatch) {
      const eventId = decodeURIComponent(paymentQrMatch[1]);
      if (!eventId.trim()) {
        sendJson(response, 400, { error: "A valid event id is required to generate a payment QR." });
        return;
      }
      const event = await Event.findOne({ id: eventId }, { id: 1, title: 1, registrationFee: 1 }).lean();
      if (!event) {
        sendJson(response, 404, { error: "The selected event could not be found." });
        return;
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
      response.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store" });
      response.end(qrImage);
    } else if (request.method === "GET" && url.pathname === "/api/events") {
      sendJson(response, 200, await readEvents());
    } else if (request.method === "PUT" && url.pathname === "/api/events") {
      await writeEvents(await readJson(request));
      sendJson(response, 200, await readEvents());
    } else if (request.method === "POST" && url.pathname.startsWith("/api/event-qr/")) {
      const eventId = decodeURIComponent(url.pathname.slice("/api/event-qr/".length));
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_\-\.]{0,99}$/.test(eventId)) {
        throw new Error("A valid event id is required for the QR upload.");
      }

      const { dataUrl } = await readJson(request, 7 * 1024 * 1024);
      const match = /^data:image\/(png|jpeg|webp);base64,([a-zA-Z0-9+/]+={0,2})$/.exec(String(dataUrl || ""));
      if (!match) throw new Error("Upload a PNG, JPEG, or WebP QR image.");

      const image = Buffer.from(match[2], "base64");
      if (!image.length || image.length > 5 * 1024 * 1024) {
        throw new Error("QR images must be smaller than 5 MB.");
      }

      await Event.updateOne(
        { id: eventId },
        { $set: { qrCode: dataUrl } }
      );
      sendJson(response, 201, { qrCode: dataUrl });
    } else if (request.method === "GET" && url.pathname === "/api/registrations") {
      const records = await Registration.find({}, { _id: 0, createdAt: 0, updatedAt: 0 }).lean();
      sendJson(response, 200, records);
    } else if (request.method === "GET" && url.pathname === "/api/registrations/download") {
      const records = await Registration.find({}, { _id: 0, createdAt: 0, updatedAt: 0 }).lean();
      const buffer = await generateExcelBuffer("Registrations", REGISTRATION_FIELDS, records);
      response.writeHead(200, {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="registrations.xlsx"',
        "Content-Length": buffer.length,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      });
      response.end(buffer);
    } else if (request.method === "POST" && url.pathname === "/api/registrations") {
      const record = await readJson(request);
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
      sendJson(response, 201, { success: true });
    } else if (request.method === "GET" && url.pathname === "/api/payments") {
      const records = await Payment.find({}, { _id: 0, createdAt: 0, updatedAt: 0 }).lean();
      sendJson(response, 200, records);
    } else if (request.method === "GET" && url.pathname === "/api/payments/download") {
      const records = await Payment.find({}, { _id: 0, createdAt: 0, updatedAt: 0 }).lean();
      const buffer = await generateExcelBuffer("Payments", PAYMENT_FIELDS, records);
      response.writeHead(200, {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="payments.xlsx"',
        "Content-Length": buffer.length,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      });
      response.end(buffer);
    } else if (request.method === "POST" && url.pathname === "/api/payments") {
      const record = await readJson(request);
      if (!record.referenceId) throw new Error("Payment referenceId is required.");
      await Payment.updateOne(
        { referenceId: String(record.referenceId) },
        { $set: record },
        { upsert: true }
      );
      sendJson(response, 201, { success: true });
    } else if (url.pathname.startsWith("/api/")) {
      sendJson(response, 404, { error: "API route not found." });
    } else if ((request.method === "GET" || request.method === "HEAD") && /^\/pages\/[a-z0-9-]+\.html$/i.test(url.pathname)) {
      response.writeHead(302, { Location: `/${path.basename(url.pathname)}${url.search}` }).end();
    } else if (request.method === "GET" || request.method === "HEAD") {
      serveStatic(request, response, url.pathname);
    } else {
      response.writeHead(405).end("Method not allowed");
    }
  } catch (error) {
    sendJson(response, 400, { error: error.message || "Request failed." });
  }
});

const port = Number(process.env.PORT) || 8000;
async function startServer() {
  if (!mongoUri || mongoUri === "YOUR_MONGODB_CONNECTION_STRING") {
    throw new Error("MONGODB_URI is required to start the event service.");
  }
  await mongoose.connect(mongoUri);
  console.log("MongoDB connected");
  await Event.collection.createIndex({ id: 1 }, { unique: true });
  await migrateEventRegistrationFees();
  await initializeWorkbooks();
  server.listen(port, "0.0.0.0", () => {
    console.log(`Excel Event Hub running at http://0.0.0.0:${port}`);
  });
}

startServer().catch((error) => {
  console.error("Could not start Excel Event Hub:", error.message || error);
  process.exitCode = 1;
});
const fs = require("node:fs");
const path = require("node:path");
const ExcelJS = require("exceljs");
const mongoose = require("mongoose");

const ROOT = path.resolve(__dirname, "..");
require("dotenv").config({ path: path.join(ROOT, ".env") });
const Event = require(path.join(ROOT, "models", "Event"));
const workbookPath = path.join(ROOT, "data", "events.xlsx");
const complexFields = new Set(["rules", "prizes"]);

function parseComplexFields(record) {
  for (const field of complexFields) {
    if (typeof record[field] !== "string" || !record[field].trim()) continue;
    try {
      record[field] = JSON.parse(record[field]);
    } catch {
      record[field] = record[field].split(",").map((value) => value.trim()).filter(Boolean);
    }
  }
  return record;
}

async function readSourceEvents() {
  if (!fs.existsSync(workbookPath)) {
    throw new Error("The current event workbook was not found at data/events.xlsx.");
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);
  const sheet = workbook.getWorksheet("Events") || workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) {
    throw new Error("The current event workbook does not contain event records.");
  }

  const fields = sheet.getRow(1).values.slice(1).map((field) => String(field || ""));
  const events = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const event = {};
    fields.forEach((field, index) => {
      if (field) event[field] = row.getCell(index + 1).value ?? "";
    });
    events.push(parseComplexFields(event));
  });
  return events;
}

function findDuplicateIds(events) {
  const seen = new Set();
  const duplicates = new Set();
  for (const event of events) {
    const id = String(event.id || "");
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return [...duplicates];
}

function normalizeForComparison(value) {
  if (Array.isArray(value)) return value.map(normalizeForComparison);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalizeForComparison(value[key])]));
  }
  return value;
}

async function migrate() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri || mongoUri === "YOUR_MONGODB_CONNECTION_STRING") {
    throw new Error("MONGODB_URI is not configured.");
  }

  const sourceEvents = await readSourceEvents();
  const sourceDuplicates = findDuplicateIds(sourceEvents);
  if (sourceDuplicates.length) {
    throw new Error(`Duplicate event IDs in source workbook: ${sourceDuplicates.join(", ")}`);
  }
  if (sourceEvents.some((event) => !String(event.id || "").trim() || !String(event.title || "").trim())) {
    throw new Error("Every source event must have its existing ID and name before migration.");
  }

  await mongoose.connect(mongoUri);
  const existingDuplicates = await Event.aggregate([
    { $group: { _id: "$id", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]);
  if (existingDuplicates.length) {
    throw new Error(`Duplicate event IDs already exist in MongoDB: ${existingDuplicates.map((item) => item._id).join(", ")}`);
  }

  await Event.collection.createIndex({ id: 1 }, { unique: true });
  const operations = sourceEvents.map((event) => ({
    updateOne: {
      filter: { id: String(event.id) },
      update: { $set: event },
      upsert: true
    }
  }));
  if (operations.length) {
    await Event.bulkWrite(operations, { ordered: true });
  }

  const importedIds = sourceEvents.map((event) => String(event.id));
  const migratedEvents = await Event.find({ id: { $in: importedIds } }).lean();
  const migratedById = new Map(migratedEvents.map((event) => [String(event.id), event]));
  const missingIds = importedIds.filter((id) => !migratedById.has(id));
  const mismatchedIds = sourceEvents
    .filter((source) => {
      const saved = migratedById.get(String(source.id));
      if (!saved) return false;
      return Object.entries(source).some(([field, value]) =>
        JSON.stringify(normalizeForComparison(saved[field])) !== JSON.stringify(normalizeForComparison(value))
      );
    })
    .map((event) => String(event.id));
  const postMigrationDuplicates = await Event.aggregate([
    { $group: { _id: "$id", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]);
  const idsInMongo = (await Event.find({}, { id: 1, _id: 0 }).lean())
    .map((event) => String(event.id))
    .sort();
  const statusPreserved = sourceEvents.every((source) =>
    migratedById.get(String(source.id))?.status === source.status
  );
  const qrAndScannerPreserved = sourceEvents.every((source) => {
    const saved = migratedById.get(String(source.id));
    return saved?.qrCode === source.qrCode && saved?.scannerEnabled === source.scannerEnabled;
  });

  const report = {
    sourceEventCount: sourceEvents.length,
    migratedEventCount: operations.length,
    sourceEventIds: importedIds,
    eventIdsInMongoDB: idsInMongo,
    duplicateEventIdsDetected: [...sourceDuplicates, ...existingDuplicates.map((item) => String(item._id)), ...postMigrationDuplicates.map((item) => String(item._id))],
    statusPreserved,
    qrCodeAndScannerEnabledPreserved: qrAndScannerPreserved,
    missingEventIds: missingIds,
    mismatchedEventIds: mismatchedIds,
    verified: missingIds.length === 0 && mismatchedIds.length === 0 && postMigrationDuplicates.length === 0 && statusPreserved && qrAndScannerPreserved
  };
  console.log(JSON.stringify(report, null, 2));

  if (!report.verified) {
    throw new Error("MongoDB verification failed; the original workbook has been retained.");
  }
}

migrate()
  .catch((error) => {
    console.error(`Event migration failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

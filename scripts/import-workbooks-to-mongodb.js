const ExcelJS = require("exceljs");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { connectToDatabase } = require("../lib/db");
const Payment = require("../models/Payment");
const Registration = require("../models/Registration");

async function importExcelData() {
  await connectToDatabase();
  console.log("Connected to MongoDB");

  // 1. Import Payments
  const payFile = path.join(__dirname, "..", "data", "payments.xlsx");
  const payWb = new ExcelJS.Workbook();
  await payWb.xlsx.readFile(payFile);
  const paySheet = payWb.getWorksheet("Payments") || payWb.worksheets[0];
  const payHeaders = paySheet.getRow(1).values.slice(1);
  const payRows = [];
  paySheet.eachRow((row, idx) => {
    if (idx === 1) return;
    const item = {};
    payHeaders.forEach((h, i) => {
      item[h] = row.getCell(i + 1).value ?? "";
    });
    payRows.push(item);
  });

  console.log(`Found ${payRows.length} payments in Excel`);
  for (const pay of payRows) {
    if (pay.referenceId) {
      await Payment.updateOne(
        { referenceId: String(pay.referenceId) },
        { $set: pay },
        { upsert: true }
      );
    }
  }

  // 2. Import Registrations
  const regFile = path.join(__dirname, "..", "data", "registrations.xlsx");
  const regWb = new ExcelJS.Workbook();
  await regWb.xlsx.readFile(regFile);
  const regSheet = regWb.getWorksheet("Registrations") || regWb.worksheets[0];
  const regHeaders = regSheet.getRow(1).values.slice(1);
  const regRows = [];
  regSheet.eachRow((row, idx) => {
    if (idx === 1) return;
    const item = {};
    regHeaders.forEach((h, i) => {
      item[h] = row.getCell(i + 1).value ?? "";
    });
    regRows.push(item);
  });

  console.log(`Found ${regRows.length} registrations in Excel`);
  for (const reg of regRows) {
    if (reg.referenceId) {
      await Registration.updateOne(
        { referenceId: String(reg.referenceId) },
        { $set: reg },
        { upsert: true }
      );
    }
  }

  const payCount = await Payment.countDocuments();
  const regCount = await Registration.countDocuments();
  console.log(`MongoDB Payment count: ${payCount}`);
  console.log(`MongoDB Registration count: ${regCount}`);

  await mongoose.disconnect();
}

importExcelData().catch((err) => {
  console.error("Import error:", err);
  process.exit(1);
});

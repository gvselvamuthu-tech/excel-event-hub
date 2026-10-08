const ExcelJS = require("exceljs");

const REGISTRATION_FIELDS = [
  "referenceId", "eventId", "eventName", "fullName", "email", "mobile",
  "department", "year", "teamName", "participationType", "registrationDateTime"
];

const PAYMENT_FIELDS = [
  "referenceId", "eventId", "eventName", "participantName", "email", "phone",
  "department", "year", "team", "amount", "paymentTransactionId", "paymentStatus",
  "registrationDateTime", "paymentMethod", "paymentDate"
];

function serializeRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      Array.isArray(value) ? JSON.stringify(value) : value ?? ""
    ])
  );
}

/**
 * Generate an Excel buffer in-memory using ExcelJS from an array of record objects
 */
async function generateExcelBuffer(sheetName, fields, rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = fields.map((field) => ({ header: field, key: field }));
  rows.forEach((row) => sheet.addRow(serializeRow(row)));
  return await workbook.xlsx.writeBuffer();
}

module.exports = {
  REGISTRATION_FIELDS,
  PAYMENT_FIELDS,
  generateExcelBuffer
};

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const ExcelJS = require("exceljs");
const { clearWorkbookRecords } = require("../lib/workbook-records");

async function createWorkbook(file, sheetName, headers, rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(row));
  await workbook.xlsx.writeFile(file);
}

async function readSheet(file, sheetName) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  return workbook.getWorksheet(sheetName);
}

async function countDataRows(file, sheetName) {
  const sheet = await readSheet(file, sheetName);
  let count = 0;
  sheet.eachRow({ includeEmpty: false }, (_row, rowNumber) => {
    if (rowNumber > 1) count += 1;
  });
  return count;
}

for (const dataset of [
  { name: "registrations", sheetName: "Registrations", headers: ["referenceId", "eventId", "fullName"] },
  { name: "payments", sheetName: "Payments", headers: ["referenceId", "eventId", "amount"] }
]) {
  test(`clearing ${dataset.name} preserves its headers, creates a backup, and leaves other data intact`, async (context) => {
    const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "excel-event-hub-clear-"));
    context.after(() => fs.promises.rm(directory, { recursive: true, force: true }));

    const selectedFile = path.join(directory, `${dataset.name}.xlsx`);
    const otherName = dataset.name === "registrations" ? "payments" : "registrations";
    const otherSheet = otherName === "payments" ? "Payments" : "Registrations";
    const otherFile = path.join(directory, `${otherName}.xlsx`);
    const eventsFile = path.join(directory, "events.xlsx");
    const backupsDirectory = path.join(directory, "backups");
    const records = [["REF-1", "seminar", "Alex"], ["REF-2", "workshop", "Sam"]];

    await createWorkbook(selectedFile, dataset.sheetName, dataset.headers, records);
    await createWorkbook(otherFile, otherSheet, ["referenceId", "amount"], [["OTHER-1", 20]]);
    await createWorkbook(eventsFile, "Events", ["id", "registrationFee"], [["seminar", 20]]);
    const otherBefore = await fs.promises.readFile(otherFile);
    const eventsBefore = await fs.promises.readFile(eventsFile);

    const result = await clearWorkbookRecords({
      file: selectedFile,
      sheetName: dataset.sheetName,
      backupDirectory: backupsDirectory
    });

    const clearedSheet = await readSheet(selectedFile, dataset.sheetName);
    assert.deepEqual(clearedSheet.getRow(1).values.slice(1), dataset.headers);
    assert.equal(await countDataRows(selectedFile, dataset.sheetName), 0);
    assert.equal(result.deletedCount, records.length);
    assert.equal(await countDataRows(otherFile, otherSheet), 1);
    assert.deepEqual(await fs.promises.readFile(otherFile), otherBefore);
    assert.deepEqual(await fs.promises.readFile(eventsFile), eventsBefore);

    const backupPath = path.join(backupsDirectory, result.backupFile);
    assert.equal(await countDataRows(backupPath, dataset.sheetName), records.length);
  });
}

test("clearing aborts when the required worksheet is missing", async (context) => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "excel-event-hub-clear-invalid-"));
  context.after(() => fs.promises.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "registrations.xlsx");
  const backupDirectory = path.join(directory, "backups");
  await createWorkbook(file, "WrongSheet", ["referenceId"], [["REF-1"]]);
  const original = await fs.promises.readFile(file);

  await assert.rejects(
    clearWorkbookRecords({ file, sheetName: "Registrations", backupDirectory }),
    /required "Registrations" sheet is missing/
  );
  assert.deepEqual(await fs.promises.readFile(file), original);
  await assert.rejects(fs.promises.access(backupDirectory));
});

test("payment clearing rejects a workbook with missing or changed payment headers", async (context) => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "excel-event-hub-payment-headers-"));
  context.after(() => fs.promises.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "payments.xlsx");
  const backupDirectory = path.join(directory, "backups");
  const headers = Array.from({ length: 15 }, (_, index) => `paymentField${index + 1}`);
  await createWorkbook(file, "Payments", [...headers.slice(0, -1), "changedHeader"], [["REF-1"]]);
  const original = await fs.promises.readFile(file);

  await assert.rejects(
    clearWorkbookRecords({
      file,
      sheetName: "Payments",
      backupDirectory,
      expectedHeaders: headers
    }),
    /does not contain the expected headers/
  );
  assert.deepEqual(await fs.promises.readFile(file), original);
  await assert.rejects(fs.promises.access(backupDirectory));
});

test("payment clearing preserves all fifteen expected headers and creates a recoverable backup", async (context) => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "excel-event-hub-payment-clear-"));
  context.after(() => fs.promises.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "payments.xlsx");
  const backupDirectory = path.join(directory, "backups");
  const headers = Array.from({ length: 15 }, (_, index) => `paymentField${index + 1}`);
  await createWorkbook(file, "Payments", headers, [["REF-1"], ["REF-2"]]);

  const result = await clearWorkbookRecords({
    file,
    sheetName: "Payments",
    backupDirectory,
    expectedHeaders: headers
  });
  const clearedSheet = await readSheet(file, "Payments");
  assert.deepEqual(clearedSheet.getRow(1).values.slice(1), headers);
  assert.equal(await countDataRows(file, "Payments"), 0);
  assert.equal(result.deletedCount, 2);
  assert.equal(await countDataRows(path.join(backupDirectory, result.backupFile), "Payments"), 2);
});

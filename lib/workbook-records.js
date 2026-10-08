const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const ExcelJS = require("exceljs");

function getHeaderValues(sheet) {
  return sheet.getRow(1).values.slice(1);
}

function getRecordCount(sheet) {
  let count = 0;
  sheet.eachRow({ includeEmpty: false }, (_row, rowNumber) => {
    if (rowNumber > 1) count += 1;
  });
  return count;
}

async function clearWorkbookRecords({ file, sheetName, backupDirectory, expectedHeaders }) {
  const workbookStat = await fs.promises.stat(file);
  if (!workbookStat.isFile()) {
    throw new Error(`The ${sheetName} workbook path is not a file.`);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) {
    throw new Error(`The required "${sheetName}" sheet is missing.`);
  }

  const headers = getHeaderValues(sheet);
  if (!headers.length || headers.every((header) => header === null || header === undefined || String(header).trim() === "")) {
    throw new Error(`The "${sheetName}" sheet does not contain valid headers.`);
  }
  if (expectedHeaders && (headers.length !== expectedHeaders.length
    || headers.some((header, index) => String(header).trim() !== expectedHeaders[index]))) {
    throw new Error(`The "${sheetName}" sheet does not contain the expected headers.`);
  }

  const recordCount = getRecordCount(sheet);
  const backupName = `${path.basename(file, path.extname(file))}-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}.xlsx`;
  await fs.promises.mkdir(backupDirectory, { recursive: true });
  const backupPath = path.join(backupDirectory, backupName);
  await fs.promises.copyFile(file, backupPath, fs.constants.COPYFILE_EXCL);

  const temporaryPath = path.join(path.dirname(file), `.${path.basename(file)}-${randomUUID()}.tmp`);
  let replacedOriginal = false;
  try {
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      for (let columnNumber = 1; columnNumber <= sheet.columnCount; columnNumber += 1) {
        row.getCell(columnNumber).value = null;
      }
    }
    await workbook.xlsx.writeFile(temporaryPath);

    const verifiedWorkbook = new ExcelJS.Workbook();
    await verifiedWorkbook.xlsx.readFile(temporaryPath);
    const verifiedSheet = verifiedWorkbook.getWorksheet(sheetName);
    const verifiedHeaders = verifiedSheet && getHeaderValues(verifiedSheet);
    if (!verifiedSheet || getRecordCount(verifiedSheet) !== 0
      || JSON.stringify(verifiedHeaders) !== JSON.stringify(headers)) {
      throw new Error(`The "${sheetName}" workbook failed post-clear validation.`);
    }

    await fs.promises.rename(temporaryPath, file);
    replacedOriginal = true;

    const persistedWorkbook = new ExcelJS.Workbook();
    await persistedWorkbook.xlsx.readFile(file);
    const persistedSheet = persistedWorkbook.getWorksheet(sheetName);
    if (!persistedSheet || getRecordCount(persistedSheet) !== 0
      || JSON.stringify(getHeaderValues(persistedSheet)) !== JSON.stringify(headers)) {
      throw new Error(`The "${sheetName}" workbook failed post-save validation.`);
    }
  } catch (error) {
    await fs.promises.rm(temporaryPath, { force: true });
    if (replacedOriginal) {
      const restorePath = path.join(path.dirname(file), `.${path.basename(file)}-${randomUUID()}.restore`);
      try {
        await fs.promises.copyFile(backupPath, restorePath);
        await fs.promises.rename(restorePath, file);
      } catch (restoreError) {
        await fs.promises.rm(restorePath, { force: true });
        throw new Error(`Workbook validation failed and the original file could not be restored from ${backupName}: ${restoreError.message}`, { cause: error });
      }
    }
    throw error;
  }

  return { deletedCount: recordCount, backupFile: backupName };
}

module.exports = { clearWorkbookRecords };

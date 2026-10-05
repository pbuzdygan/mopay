import { parentPort, workerData } from 'node:worker_threads';
import ExcelJS from 'exceljs';
import { checkImportArchive } from './importArchive.js';
import { IMPORT_LIMITS as limits, importError } from './importLimits.js';

try {
  const buffer = Buffer.from(workerData);
  const checkedArchive = await checkImportArchive(buffer);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(checkedArchive);
  if (workbook.worksheets.length > limits.sheets) throw importError('IMPORT_LIMIT_EXCEEDED');
  let cells = 0;
  let rows = 0;
  for (const sheet of workbook.worksheets) {
    rows += sheet.rowCount;
    if (sheet.rowCount > limits.rows || sheet.columnCount > limits.columns) throw importError('IMPORT_LIMIT_EXCEEDED');
    sheet.eachRow(row => {
      row.eachCell(() => { cells++; });
    });
  }
  if (cells > limits.cells || rows > limits.totalRows) throw importError('IMPORT_LIMIT_EXCEEDED');
  // Import consumers need worksheet cells/styles/comments, not embedded media.
  workbook.media = [];
  const model = workbook.model;
  model.definedNames = [];
  model.worksheets.forEach((sheet, index) => { sheet.id = index + 1; });
  model.sheets = model.worksheets;
  parentPort.postMessage({ model });
} catch (error) {
  parentPort.postMessage({ error: error.code === 'IMPORT_LIMIT_EXCEEDED' ? error.code : 'INVALID_FILE' });
}

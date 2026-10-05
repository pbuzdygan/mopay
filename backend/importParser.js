import { Worker } from 'node:worker_threads';
import ExcelJS from 'exceljs';
import { IMPORT_LIMITS as limits, importError } from './importLimits.js';

let parsing = false;

export async function runImportWorker(buffer, {
  workerUrl = new URL('./importWorker.js', import.meta.url), timeoutMs = limits.timeoutMs,
} = {}) {
  const worker = new Worker(workerUrl, {
    workerData: buffer, env: {}, execArgv: [],
    resourceLimits: { maxOldGenerationSizeMb: 192, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 },
  });
  let timer;
  try {
    return await new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(importError('IMPORT_TIMEOUT')), timeoutMs);
      worker.once('message', message => message.error ? reject(importError(message.error)) : resolve(message.model));
      worker.once('error', () => reject(importError('INVALID_FILE')));
      worker.once('exit', () => reject(importError('INVALID_FILE')));
    });
  } finally {
    clearTimeout(timer);
    await worker.terminate();
  }
}

export async function loadImportWorkbook(data) {
  if (parsing) throw importError('IMPORT_BUSY');
  // Require canonical base64, avoiding permissive decoding of malformed input.
  if (data.length > Math.ceil(limits.compressedBytes / 3) * 4) throw importError('IMPORT_LIMIT_EXCEEDED');
  if (data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) throw importError('INVALID_FILE');
  const buffer = Buffer.from(data, 'base64');
  if (buffer.toString('base64') !== data) throw importError('INVALID_FILE');
  if (!buffer.length || buffer.length > limits.compressedBytes) throw importError('IMPORT_LIMIT_EXCEEDED');
  parsing = true;
  try {
    const model = await runImportWorker(buffer);
    const workbook = new ExcelJS.Workbook();
    workbook.model = model;
    return workbook;
  } finally {
    parsing = false;
  }
}

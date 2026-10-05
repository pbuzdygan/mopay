import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { createRequire } from 'node:module';
import { checkImportArchive } from '../importArchive.js';
import { loadImportWorkbook, runImportWorker } from '../importParser.js';
import { IMPORT_LIMITS as limits } from '../importLimits.js';

const require = createRequire(import.meta.url);
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
let valid;

before(async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('2028').getCell('A1').value = 'Mopay Import Template';
  valid = Buffer.from(await workbook.xlsx.writeBuffer());
});

async function modified(edit) {
  const zip = await JSZip.loadAsync(valid);
  await edit(zip);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

test('valid XLSX passes streamed ZIP/XML checks and retains worksheet values', async () => {
  await checkImportArchive(valid);
  const workbook = await loadImportWorkbook(valid.toString('base64'));
  assert.equal(workbook.worksheets[0].name, '2028');
  assert.equal(workbook.worksheets[0].getCell('A1').value, 'Mopay Import Template');
});

test('compressed, member and aggregate expanded byte budgets reject bounded fixtures', async () => {
  await assert.rejects(loadImportWorkbook('A'.repeat(Math.ceil(limits.compressedBytes / 3) * 4 + 4)), { code: 'IMPORT_LIMIT_EXCEEDED' });
  const member = await modified(zip => zip.file('xl/media/padding.bin', Buffer.alloc(limits.memberBytes + 1, 65)));
  assert.ok(member.length < 50000);
  await assert.rejects(checkImportArchive(member), { code: 'IMPORT_LIMIT_EXCEEDED' });
  const total = await modified(zip => {
    for (let i = 0; i < 7; i++) zip.file(`xl/media/padding-${i}.bin`, Buffer.alloc(limits.memberBytes, 65));
  });
  await assert.rejects(checkImportArchive(total), { code: 'IMPORT_LIMIT_EXCEEDED' });
});

test('forged uncompressed ZIP size cannot bypass actual-byte accounting', async () => {
  const buffer = await modified(zip => zip.file('xl/media/forged.bin', Buffer.alloc(limits.memberBytes + 1, 65)));
  let found = false;
  for (let index = 0; index < buffer.length - 46; index++) {
    if (buffer.readUInt32LE(index) !== 0x02014b50) continue;
    const length = buffer.readUInt16LE(index + 28);
    if (buffer.subarray(index + 46, index + 46 + length).toString() === 'xl/media/forged.bin') {
      buffer.writeUInt32LE(1, index + 24);
      found = true;
      break;
    }
  }
  assert.ok(found);
  await assert.rejects(checkImportArchive(buffer), { code: 'IMPORT_LIMIT_EXCEEDED' });
});

test('checked archive rebuild removes conflicting ZIP filename interpretations', async () => {
  const buffer = Buffer.from(valid);
  const name = Buffer.from('xl/worksheets/sheet1.xml');
  const index = buffer.indexOf(name);
  assert.ok(index >= 30);
  buffer[index] = 'x'.charCodeAt(0);
  const rebuilt = await checkImportArchive(buffer);
  const zip = await JSZip.loadAsync(rebuilt);
  assert.ok(zip.file('xl/worksheets/sheet1.xml'));
  assert.equal(zip.file('xl/worksheets/sheet1.xml').unsafeOriginalName, 'xl/worksheets/sheet1.xml');
  const workbook = await loadImportWorkbook(buffer.toString('base64'));
  assert.equal(workbook.worksheets[0].getCell('A1').value, 'Mopay Import Template');
});

test('archive entry and worksheet cardinality limits apply before ExcelJS', async () => {
  const tooMany = await modified(zip => {
    for (let i = 0; i < limits.files; i++) zip.file(`extra-${i}`, 'fixture');
  });
  await assert.rejects(checkImportArchive(tooMany), { code: 'IMPORT_LIMIT_EXCEEDED' });
  const sheets = await modified(async zip => {
    const xml = await zip.file('xl/worksheets/sheet1.xml').async('string');
    for (let i = 2; i <= limits.sheets + 1; i++) zip.file(`xl/worksheets/sheet${i}.xml`, xml);
  });
  await assert.rejects(checkImportArchive(sheets), { code: 'IMPORT_LIMIT_EXCEEDED' });
});

test('oversized row, column, range, sheet IDs and XML depth are rejected', async () => {
  for (const replacement of [
    '<worksheet><sheetData><row r="5001"/></sheetData></worksheet>',
    '<worksheet><sheetData><row r="1"><c r="BM1"/></row></sheetData></worksheet>',
    '<worksheet><dimension ref="A1:XFD1048576"/></worksheet>',
    '<worksheet><mergeCells><mergeCell ref="A1:BL5000"/></mergeCells></worksheet>',
    '<worksheet>' + '<nested>'.repeat(33) + '</nested>'.repeat(33) + '</worksheet>',
  ]) {
    const file = await modified(zip => zip.file('xl/worksheets/sheet1.xml', replacement));
    await assert.rejects(checkImportArchive(file), { code: 'IMPORT_LIMIT_EXCEEDED' });
  }
  const ids = await modified(async zip => {
    const xml = await zip.file('xl/workbook.xml').async('string');
    zip.file('xl/workbook.xml', xml.replace('sheetId="1"', 'sheetId="999999999"'));
  });
  await assert.rejects(checkImportArchive(ids), { code: 'IMPORT_LIMIT_EXCEEDED' });
});

test('explicit cell and repeated row budgets cannot be bypassed with duplicate addresses', async () => {
  for (const data of [
    '<worksheet><sheetData><row r="1">' + '<c r="A1"/>'.repeat(limits.cells + 1) + '</row></sheetData></worksheet>',
    '<worksheet><sheetData>' + '<row r="1"/>'.repeat(limits.rows + 1) + '</sheetData></worksheet>',
  ]) {
    const buffer = await modified(zip => zip.file('xl/worksheets/sheet1.xml', data));
    await assert.rejects(checkImportArchive(buffer), { code: 'IMPORT_LIMIT_EXCEEDED' });
  }
  const sparse = await modified(zip => {
    const xml = '<worksheet><dimension ref="A1:A5000"/></worksheet>';
    for (let i = 1; i <= 3; i++) zip.file(`xl/worksheets/sheet${i}.xml`, xml);
  });
  await assert.rejects(checkImportArchive(sparse), { code: 'IMPORT_LIMIT_EXCEEDED' });
});

test('DTD, traversal, corrupt archives and malformed base64 are rejected', async () => {
  const dtd = await modified(zip => zip.file('xl/worksheets/sheet1.xml', '<!DOCTYPE worksheet><worksheet/>'));
  await assert.rejects(checkImportArchive(dtd), { code: 'INVALID_FILE' });
  const traversal = await modified(zip => zip.file('../outside.bin', 'fixture'));
  await assert.rejects(checkImportArchive(traversal), { code: 'INVALID_FILE' });
  await assert.rejects(loadImportWorkbook('not-base64'), { code: 'INVALID_FILE' });
  await assert.rejects(loadImportWorkbook(Buffer.from('not ZIP').toString('base64')), { code: 'INVALID_FILE' });
  assert.equal((await loadImportWorkbook(valid.toString('base64'))).worksheets.length, 1);
});

test('shared admission rejects concurrent parsing and releases after completion', async () => {
  const first = loadImportWorkbook(valid.toString('base64'));
  await assert.rejects(loadImportWorkbook(valid.toString('base64')), { code: 'IMPORT_BUSY' });
  await first;
  assert.equal((await loadImportWorkbook(valid.toString('base64'))).worksheets.length, 1);
});

test('deadline, worker exceptions and unexpected exits terminate safely', async () => {
  const hanging = new URL('data:text/javascript,setInterval(() => {}, 1000)');
  await assert.rejects(runImportWorker(valid, { workerUrl: hanging, timeoutMs: 100 }), { code: 'IMPORT_TIMEOUT' });
  const crash = new URL('data:text/javascript,throw new Error("Synthetic worker failure")');
  await assert.rejects(runImportWorker(valid, { workerUrl: crash }), { code: 'INVALID_FILE' });
  const empty = new URL('data:text/javascript,');
  await assert.rejects(runImportWorker(valid, { workerUrl: empty }), { code: 'INVALID_FILE' });
  assert.equal((await loadImportWorkbook(valid.toString('base64'))).worksheets.length, 1);
});

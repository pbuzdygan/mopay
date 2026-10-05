import unzipper from 'unzipper';
import { SaxesParser } from 'saxes';
import JSZip from 'jszip';
import { IMPORT_LIMITS as limits, importError } from './importLimits.js';

function checkAddress(address) {
  const match = /^([A-Z]{1,3})([1-9]\d*)$/.exec(address);
  if (!match) throw importError('INVALID_FILE');
  let column = 0;
  for (const char of match[1]) column = column * 26 + char.charCodeAt(0) - 64;
  const row = Number(match[2]);
  if (row > limits.rows || column > limits.columns) throw importError('IMPORT_LIMIT_EXCEEDED');
  return { row, column };
}

function checkXml(buffer, worksheet, counts) {
  const parser = new SaxesParser({ xmlns: true });
  let depth = 0;
  let rows = 0;
  let maxRow = 0;
  parser.on('doctype', () => { throw importError('INVALID_FILE'); });
  parser.on('opentag', tag => {
    if (++depth > limits.xmlDepth) throw importError('IMPORT_LIMIT_EXCEEDED');
    const attribute = name => Object.values(tag.attributes).find(attr => attr.local === name)?.value;
    if (tag.local === 'sheet') {
      const id = attribute('sheetId');
      if (id !== undefined && (!/^[1-9]\d*$/.test(id) || Number(id) > 10000)) {
        throw importError('IMPORT_LIMIT_EXCEEDED');
      }
    }
    if (!worksheet) return;
    if (tag.local === 'row') {
      if (++rows > limits.rows) throw importError('IMPORT_LIMIT_EXCEEDED');
      const row = attribute('r');
      if (row !== undefined && (!/^[1-9]\d*$/.test(row) || Number(row) > limits.rows)) {
        throw importError('IMPORT_LIMIT_EXCEEDED');
      }
      maxRow = Math.max(maxRow, Number(row ?? 0));
    }
    if (tag.local === 'c') {
      if (++counts.cells > limits.cells) throw importError('IMPORT_LIMIT_EXCEEDED');
      const address = attribute('r');
      if (address) maxRow = Math.max(maxRow, checkAddress(address).row);
    }
    if (tag.local === 'dimension' || tag.local === 'mergeCell') {
      const range = attribute('ref');
      if (!range) throw importError('INVALID_FILE');
      const endpoints = range.split(':');
      if (endpoints.length > 2) throw importError('INVALID_FILE');
      const start = checkAddress(endpoints[0]);
      const end = checkAddress(endpoints[1] ?? endpoints[0]);
      maxRow = Math.max(maxRow, end.row);
      if (end.row < start.row || end.column < start.column) throw importError('INVALID_FILE');
      if (tag.local === 'mergeCell') {
        counts.mergedCells += (end.row - start.row + 1) * (end.column - start.column + 1);
        if (counts.mergedCells > limits.cells) throw importError('IMPORT_LIMIT_EXCEEDED');
      }
    }
  });
  parser.on('closetag', () => { depth--; });
  parser.write(buffer.toString('utf8')).close();
  if (worksheet) {
    counts.rows += Math.max(maxRow, rows);
    if (counts.rows > limits.totalRows) throw importError('IMPORT_LIMIT_EXCEEDED');
  }
}

// No files are extracted. Metadata checks are followed by actual inflated-byte
// accounting so forged ZIP lengths cannot bypass the budget.
export async function checkImportArchive(buffer) {
  if (buffer.length > limits.compressedBytes) throw importError('IMPORT_LIMIT_EXCEEDED');
  const archive = await unzipper.Open.buffer(buffer);
  if (!archive.files.length || archive.files.length > limits.files) throw importError('IMPORT_LIMIT_EXCEEDED');
  const names = new Set();
  const canonical = new JSZip();
  const counts = { cells: 0, mergedCells: 0, rows: 0 };
  let expanded = 0;
  let sheets = 0;
  for (const file of archive.files) {
    if (names.has(file.path) || file.path.length > 256 || file.path.split('/').length > 8 ||
        file.path.includes('\\') || file.path.startsWith('/') ||
        file.path.split('/').some(part => part === '..' || part === '.') ||
        file.path.includes('\0') || (file.flags & 1) || ![0, 8].includes(file.compressionMethod)) {
      throw importError('INVALID_FILE');
    }
    names.add(file.path);
    if (file.uncompressedSize > limits.memberBytes) throw importError('IMPORT_LIMIT_EXCEEDED');
    const worksheet = /^xl\/worksheets\/[^/]+\.xml$/.test(file.path);
    if (worksheet && ++sheets > limits.sheets) throw importError('IMPORT_LIMIT_EXCEEDED');
    const xml = /\.(xml|rels)$/.test(file.path);
    const chunks = [];
    let size = 0;
    const stream = file.stream();
    for await (const chunk of stream) {
      size += chunk.length;
      expanded += chunk.length;
      if (size > limits.memberBytes || expanded > limits.expandedBytes) {
        throw importError('IMPORT_LIMIT_EXCEEDED');
      }
      chunks.push(chunk);
    }
    if (size !== file.uncompressedSize) throw importError('INVALID_FILE');
    const content = Buffer.concat(chunks);
    if (xml) checkXml(content, worksheet, counts);
    canonical.file(file.path, content);
  }
  if (!names.has('[Content_Types].xml') || !names.has('xl/workbook.xml') || !sheets) {
    throw importError('INVALID_FILE');
  }
  // ExcelJS uses another ZIP reader. Rebuild from checked names/content so
  // Unicode extras or conflicting local headers cannot change its interpretation.
  return canonical.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
}

export const IMPORT_LIMITS = Object.freeze({
  compressedBytes: 6 * 1024 * 1024,
  expandedBytes: 24 * 1024 * 1024,
  memberBytes: 4 * 1024 * 1024,
  files: 128,
  sheets: 20,
  rows: 5000,
  totalRows: 10000,
  columns: 64,
  cells: 100000,
  xmlDepth: 32,
  timeoutMs: 30000,
});

export function importError(code) {
  return Object.assign(new Error(code), { code });
}

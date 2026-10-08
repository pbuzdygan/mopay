import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

export const DEMO_OWNER = 'mopay-demo-v1';

export function checkFile(file) {
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.nlink !== 1) throw new Error(`Unsafe demo storage destination: ${file}`);
    return stat;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export function readState(file) {
  if (!checkFile(file)) return null;
  if (fs.statSync(file).size > 4096) throw new Error('Demo state is too large');
  const state = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (state.version !== 1 || !['inactive', 'pending', 'active'].includes(state.phase)
      || typeof state.generation !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(state.generation)
      || !Number.isInteger(state.year) || state.year < 1001 || state.year > 9999
      || !Number.isInteger(state.month) || state.month < 0 || state.month > 11) {
    throw new Error('Invalid or unsupported demo state; restore its backup before restarting');
  }
  return state;
}

export function writeState(file, state) {
  checkFile(file);
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(state) + '\n', { flag: 'wx', mode: 0o600 });
    const fd = fs.openSync(temporary, 'r');
    try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(temporary, file);
    const directory = fs.openSync(path.dirname(file), 'r');
    try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

export function reserveGeneration(config, now = new Date()) {
  let state = readState(config.stateFile);
  if (!state || state.phase === 'inactive') {
    state = { version: 1, phase: 'pending', generation: randomUUID(), year: now.getFullYear(), month: now.getMonth() };
    writeState(config.stateFile, state);
  }
  return state;
}

export function completeStartup(config, state) {
  if (config.demo) writeState(config.stateFile, { ...state, phase: 'active' });
  else {
    const previous = readState(config.stateFile);
    if (previous && previous.phase !== 'inactive') writeState(config.stateFile, { ...previous, phase: 'inactive' });
  }
}

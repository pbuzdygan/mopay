import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function runtimeConfig(env = process.env) {
  const value = (env.APP_DEMO || '').trim();
  if (!['', 'false', 'true'].includes(value)) throw new Error('APP_DEMO must be true or false');
  const normalFile = path.resolve(env.DB_FILE || './mopay.sqlite');
  const extension = ['.sqlite', '.db'].includes(path.extname(normalFile)) ? path.extname(normalFile) : '';
  const stem = extension ? normalFile.slice(0, -extension.length) : normalFile;
  const demoFile = `${stem}.demo${extension || '.sqlite'}`;
  return { demo: value === 'true', normalFile, demoFile, stateFile: `${stem}.demo.state.json`, dbFile: value === 'true' ? demoFile : normalFile };
}

export const config = runtimeConfig();

// The entrypoint uses the same parser without importing SQLite or encryption.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(config.dbFile);
}

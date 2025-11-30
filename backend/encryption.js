import crypto from 'crypto';

const KEY_RAW = process.env.APP_ENC_KEY;
if (!KEY_RAW) {
  console.error('Error: APP_ENC_KEY environment variable is required for Mopay to start.');
  process.exit(1);
}

const PREFIX = 'enc:';

function decodeKey() {
  const normalized = KEY_RAW.trim();
  const payload = normalized.startsWith('base64:') ? normalized.slice('base64:'.length) : normalized;
  const buf = Buffer.from(payload, 'base64');
  if (buf.length !== 32) {
    throw new Error('APP_ENC_KEY must be a base64-encoded 32-byte key (use openssl rand -base64 32)');
  }
  return buf;
}

const KEY = decodeKey();
export const KEY_FINGERPRINT = crypto.createHash('sha256').update(KEY).digest('hex');

export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

export function encryptText(value) {
  if (value === null || value === undefined) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const data = Buffer.from(String(value), 'utf8');
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, encrypted]).toString('base64');
  return `${PREFIX}${payload}`;
}

export function decryptText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' && !isEncrypted(value)) {
    return value;
  }
  if (!isEncrypted(value)) return '';
  const raw = Buffer.from(value.slice(PREFIX.length), 'base64');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

export function encryptNumber(value) {
  if (value === null || value === undefined) return null;
  return encryptText(String(value));
}

export function decryptToNumber(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && !isEncrypted(value)) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const text = decryptText(value);
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

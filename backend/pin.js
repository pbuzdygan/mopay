import crypto from 'crypto';
import { encryptText, decryptText } from './encryption.js';

const PIN_META_KEY = 'pin_hash';

export function initializePin(db, pin) {
  if (typeof pin !== 'string' || pin.trim().length === 0) {
    throw new Error('APP_PIN must be provided (4-8 digits)');
  }
  const normalized = pin.trim();
  if (!/^[0-9]{4,8}$/.test(normalized)) {
    throw new Error('APP_PIN must contain 4-8 digits');
  }

  const existing = db.prepare('SELECT value FROM meta WHERE key=?').get(PIN_META_KEY);
  if (!existing?.value) {
    const record = encryptText(JSON.stringify(buildRecord(normalized)));
    db.prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)').run(PIN_META_KEY, record);
    console.log('PIN encrypted and stored in database');
    return;
  }

  const parsed = parseRecord(existing.value);
  if (!parsed || !verifyPinAgainstRecordSync(normalized, parsed)) {
    const record = encryptText(JSON.stringify(buildRecord(normalized)));
    db.prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)').run(PIN_META_KEY, record);
    console.log('PIN value from APP_PIN updated and stored securely');
  } else {
    console.log('PIN already stored securely');
  }
}

export async function verifyPinValue(db, candidate) {
  if (typeof candidate !== 'string') return false;
  const existing = db.prepare('SELECT value FROM meta WHERE key=?').get(PIN_META_KEY);
  if (!existing?.value) return false;
  const parsed = parseRecord(existing.value);
  if (!parsed) return false;
  return verifyPinAgainstRecord(candidate, parsed);
}

function buildRecord(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPin(pin, salt);
  return { salt, hash };
}

function hashPin(pin, salt) {
  return crypto.scryptSync(pin, salt, 32).toString('hex');
}

function hashPinAsync(pin, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(pin, salt, 32, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey.toString('hex'));
    });
  });
}

function hashesMatch(hashed, expected) {
  const a = Buffer.from(hashed, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function verifyPinAgainstRecordSync(pin, record) {
  return hashesMatch(hashPin(pin, record.salt), record.hash);
}

async function verifyPinAgainstRecord(pin, record) {
  return hashesMatch(await hashPinAsync(pin, record.salt), record.hash);
}

function parseRecord(value) {
  try {
    const text = decryptText(value);
    return JSON.parse(text);
  } catch {
    return null;
  }
}

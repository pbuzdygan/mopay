import crypto from 'crypto';

const DEFAULT_TTL_SECONDS = 60 * 60 * 12;

function parseSessionToken(req) {
  const headerToken = req.get('x-mopay-session');
  if (typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim();
  }
  const authHeader = req.get('authorization');
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    if (token) return token;
  }
  return null;
}

function readPositiveNumberEnv(key, fallback) {
  const value = process.env[key];
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function createSessionAuth() {
  const ttlMs = readPositiveNumberEnv('APP_SESSION_TTL_SECONDS', DEFAULT_TTL_SECONDS) * 1000;
  const maxSessions = readPositiveNumberEnv('APP_SESSION_MAX_ACTIVE', 5000);
  const sessions = new Map();
  let nextCleanupAt = 0;

  const cleanup = (now = Date.now()) => {
    if (now < nextCleanupAt) return;
    for (const [token, session] of sessions.entries()) {
      if (session.expiresAt <= now) sessions.delete(token);
    }
    nextCleanupAt = now + 60_000;
  };

  const createSession = (req) => {
    cleanup();
    if (sessions.size >= maxSessions) {
      const oldest = sessions.entries().next().value?.[0];
      if (oldest) sessions.delete(oldest);
    }
    const token = crypto.randomBytes(32).toString('base64url');
    sessions.set(token, {
      createdAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
      ip: req.ip,
      userAgent: req.get('user-agent') || '',
    });
    return token;
  };

  const revokeSession = (token) => {
    if (!token) return false;
    return sessions.delete(token);
  };

  const authorizeRequest = (req) => {
    cleanup();
    const token = parseSessionToken(req);
    if (!token) {
      return { ok: false, error: 'AUTH_REQUIRED', token: null };
    }
    const session = sessions.get(token);
    if (!session) {
      return { ok: false, error: 'AUTH_REQUIRED', token };
    }
    if (session.expiresAt <= Date.now()) {
      sessions.delete(token);
      return { ok: false, error: 'AUTH_EXPIRED', token };
    }
    session.expiresAt = Date.now() + ttlMs;
    return { ok: true, token, session };
  };

  const requireSession = (req, res, next) => {
    const authResult = authorizeRequest(req);
    if (!authResult.ok) {
      return res.status(401).json({ ok: false, error: authResult.error });
    }
    req.authSession = { token: authResult.token, ...authResult.session };
    next();
  };

  return {
    createSession,
    revokeSession,
    requireSession,
    authorizeRequest,
    getTokenFromRequest: parseSessionToken,
  };
}

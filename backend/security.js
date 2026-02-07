function readPositiveNumberEnv(key, fallback) {
  const value = process.env[key];
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function createPinAttemptGuard() {
  const perMinuteLimit = readPositiveNumberEnv('APP_PIN_RATE_LIMIT_PER_MIN', 12);
  const burstLimit = readPositiveNumberEnv('APP_PIN_RATE_LIMIT_BURST', 4);
  const burstWindowMs = readPositiveNumberEnv('APP_PIN_RATE_LIMIT_BURST_WINDOW_MS', 10_000);
  const lockThreshold = readPositiveNumberEnv('APP_PIN_LOCK_THRESHOLD', 6);
  const baseLockMs = readPositiveNumberEnv('APP_PIN_LOCK_BASE_MS', 120_000);
  const maxLockMs = readPositiveNumberEnv('APP_PIN_LOCK_MAX_MS', 1_800_000);
  const stateByIp = new Map();
  let nextCleanupAt = 0;

  const getState = (ip) => {
    if (!stateByIp.has(ip)) {
      stateByIp.set(ip, {
        attempts: [],
        failures: [],
        lockUntil: 0,
        lockLevel: 0,
        lastSeenAt: Date.now(),
      });
    }
    return stateByIp.get(ip);
  };

  const cleanup = (now) => {
    if (now < nextCleanupAt) return;
    for (const [ip, state] of stateByIp.entries()) {
      const stale = now - state.lastSeenAt > 24 * 60 * 60 * 1000;
      if (stale && state.lockUntil <= now && state.attempts.length === 0 && state.failures.length === 0) {
        stateByIp.delete(ip);
      }
    }
    nextCleanupAt = now + 60_000;
  };

  const prune = (state, now) => {
    state.attempts = state.attempts.filter((ts) => now - ts <= 60_000);
    state.failures = state.failures.filter((ts) => now - ts <= 15 * 60_000);
    state.lastSeenAt = now;
  };

  const beforeVerify = (ip) => {
    const now = Date.now();
    cleanup(now);
    const state = getState(ip);
    prune(state, now);
    if (state.lockUntil > now) {
      return {
        allowed: false,
        reason: 'LOCKOUT',
        retryAfterSeconds: Math.max(1, Math.ceil((state.lockUntil - now) / 1000)),
      };
    }
    state.attempts.push(now);
    const burstCount = state.attempts.filter((ts) => now - ts <= burstWindowMs).length;
    if (state.attempts.length > perMinuteLimit || burstCount > burstLimit) {
      return {
        allowed: false,
        reason: 'RATE_LIMIT',
        retryAfterSeconds: Math.max(1, Math.ceil(burstWindowMs / 1000)),
      };
    }
    return { allowed: true };
  };

  const onFailure = (ip) => {
    const now = Date.now();
    const state = getState(ip);
    prune(state, now);
    state.failures.push(now);
    if (state.failures.length >= lockThreshold) {
      const lockMs = Math.min(baseLockMs * Math.max(1, 2 ** state.lockLevel), maxLockMs);
      state.lockUntil = now + lockMs;
      state.lockLevel += 1;
      state.failures = [];
      return { lockApplied: true, lockMs };
    }
    return { lockApplied: false, lockMs: 0 };
  };

  const onSuccess = (ip) => {
    const state = getState(ip);
    state.failures = [];
    state.lockLevel = 0;
    state.lockUntil = 0;
  };

  return { beforeVerify, onFailure, onSuccess };
}

export function createSecurityAudit() {
  const webhookUrl = process.env.SECURITY_WEBHOOK_URL || '';
  const alertThreshold = readPositiveNumberEnv('SECURITY_ALERT_PIN_FAIL_THRESHOLD', 20);
  const alertWindowMs = readPositiveNumberEnv('SECURITY_ALERT_PIN_FAIL_WINDOW_MS', 10 * 60 * 1000);
  const alertCooldownMs = readPositiveNumberEnv('SECURITY_ALERT_COOLDOWN_MS', 15 * 60 * 1000);
  const pinFailByIp = new Map();

  const log = (event, payload = {}, level = 'warn') => {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      channel: 'security',
      event,
      ...payload,
    });
    if (level === 'error') console.error(line);
    else if (level === 'info') console.log(line);
    else console.warn(line);
  };

  const sendWebhook = async (payload) => {
    if (!webhookUrl) return;
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      log('SECURITY_ALERT_SEND_FAILED', { error: String(error) }, 'error');
    }
  };

  const trackPinFailure = (ip, payload = {}) => {
    const now = Date.now();
    const state = pinFailByIp.get(ip) || { timestamps: [], lastAlertAt: 0 };
    state.timestamps = state.timestamps.filter((ts) => now - ts <= alertWindowMs);
    state.timestamps.push(now);
    pinFailByIp.set(ip, state);
    if (state.timestamps.length < alertThreshold) return;
    if (now - state.lastAlertAt < alertCooldownMs) return;
    state.lastAlertAt = now;
    const alertPayload = {
      severity: 'high',
      type: 'PIN_FAIL_THRESHOLD',
      ip,
      count: state.timestamps.length,
      windowMs: alertWindowMs,
      ...payload,
    };
    log('PIN_FAIL_THRESHOLD', alertPayload, 'error');
    void sendWebhook(alertPayload);
  };

  return { log, trackPinFailure };
}


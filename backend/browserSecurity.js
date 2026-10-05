// Production assets and the service worker are served from this origin.
// React/Motion need style attributes; inline scripts and style elements do not.
export const browserSecurityHeaders = Object.freeze({
  'Content-Security-Policy': [
    "default-src 'none'",
    "script-src 'self'",
    "script-src-attr 'none'",
    "style-src 'self'",
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self' https://api.github.com",
    "worker-src 'self'",
    "manifest-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; '),
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
});

export function browserSecurity(req, res, next) {
  for (const [name, value] of Object.entries(browserSecurityHeaders)) {
    res.setHeader(name, value);
  }
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
}

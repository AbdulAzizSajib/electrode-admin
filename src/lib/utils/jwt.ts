/**
 * Client-side JWT payload reader. This does NOT verify the signature — it just
 * base64url-decodes the middle segment so the UI can read claims (role, name,
 * email, exp) that the backend already put in the token. The backend
 * re-verifies the signature and re-checks role/session on every protected
 * request, so a tampered or expired token here only ever affects what this
 * app shows/hides, never what the API allows.
 */
export function decodeJwt<T = Record<string, unknown>>(token: string): T {
  const payload = token.split('.')[1]
  if (!payload) throw new Error('Malformed JWT: missing payload segment')

  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')

  const json = decodeURIComponent(
    atob(padded)
      .split('')
      .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join(''),
  )

  return JSON.parse(json) as T
}

/** `exp` is a JWT's standard "seconds since epoch" expiry claim. */
export function isTokenExpired(exp: number, skewSeconds = 30): boolean {
  return Date.now() >= (exp - skewSeconds) * 1000
}

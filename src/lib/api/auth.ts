/**
 * Real backend auth calls — unlike every other `src/lib/api/*` module (still
 * mock-data, see client.ts), auth talks to the live Express API directly
 * because the session/JWT plumbing has to exist before there's a session to
 * gate mock data behind. `credentials: 'include'` sends/receives the
 * httpOnly `accessToken`/`refreshToken` cookies the server also sets; the
 * token values in the response body are what the client can actually read.
 */
import { requestData as request } from '@/lib/api/request'

export interface AuthTokens {
  token: string
  accessToken: string
  refreshToken: string
}

export interface AuthUser {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  isActive: boolean
  needPasswordChange: boolean
}

export function login(email: string, password: string) {
  return request<AuthTokens & { redirect: boolean; user: AuthUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

/** Server reads the httpOnly refresh cookie; no body needed. */
export function refreshAccessToken() {
  return request<AuthTokens>('/auth/refresh-token', { method: 'POST' })
}

/**
 * Cookie-authenticated "who am I". Does not currently return `role` — role
 * only exists inside the decoded access-token JWT (see session-store.ts) —
 * so treat this call as session liveness/identity confirmation, not a role
 * source, until the backend adds it.
 */
export function fetchMe() {
  return request<AuthUser>('/auth/me')
}

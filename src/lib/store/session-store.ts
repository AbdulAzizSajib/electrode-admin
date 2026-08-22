import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { decodeJwt, isTokenExpired } from '@/lib/utils/jwt'
import { login as loginRequest, refreshAccessToken as refreshRequest, fetchMe } from '@/lib/api/auth'

export type AdminRole = 'OWNER' | 'ADMIN' | 'STAFF'

export interface SessionUser {
  id: string
  name: string
  email: string
  role: AdminRole
  avatarUrl?: string
}

/** Shape of the decoded accessToken JWT payload — see `src/lib/api/auth.ts`. */
interface AccessTokenClaims {
  userId: string
  role: AdminRole
  name: string
  email: string
  isActive: boolean
  isDeleted: boolean
  emailVerified: boolean
  iat: number
  exp: number
}

interface SessionState {
  user: SessionUser | null
  isAuthenticated: boolean
  /** Readable only because the login/refresh response body exposes it once — the server also sets it as an httpOnly cookie the API relies on directly. */
  accessToken: string | null
  refreshToken: string | null
  /** True while the post-reload background check against /auth/me hasn't resolved yet. */
  isVerifying: boolean

  login: (email: string, password: string) => Promise<void>
  logout: () => void
  updateUser: (patch: Partial<SessionUser>) => void
  /** Silently refreshes the access token using the refresh cookie. Returns whether it succeeded. */
  refreshSession: () => Promise<boolean>
  /** Runs once on app start: restores the optimistic session from storage, then verifies it against the server. */
  bootstrap: () => Promise<void>
}

function userFromClaims(claims: AccessTokenClaims): SessionUser {
  return { id: claims.userId, name: claims.name, email: claims.email, role: claims.role }
}

// Proactive refresh, scheduled from a token's `exp` claim — kept outside the
// store's state since a timer handle isn't serializable/persistable state.
let refreshTimer: ReturnType<typeof setTimeout> | undefined

function scheduleRefresh(exp: number, refresh: () => Promise<boolean>) {
  if (refreshTimer) clearTimeout(refreshTimer)
  const msUntilExpiry = exp * 1000 - Date.now()
  const fireIn = Math.max(msUntilExpiry - 60_000, 5_000) // refresh 60s early; never sooner than 5s out
  refreshTimer = setTimeout(() => void refresh(), fireIn)
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      isVerifying: false,

      login: async (email, password) => {
        const result = await loginRequest(email, password)
        const claims = decodeJwt<AccessTokenClaims>(result.accessToken)
        set({
          user: userFromClaims(claims),
          isAuthenticated: true,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        })
        scheduleRefresh(claims.exp, get().refreshSession)
      },

      logout: () => {
        if (refreshTimer) clearTimeout(refreshTimer)
        set({ user: null, isAuthenticated: false, accessToken: null, refreshToken: null })
      },

      updateUser: (patch) => set((state) => ({ user: state.user ? { ...state.user, ...patch } : state.user })),

      refreshSession: async () => {
        try {
          const result = await refreshRequest()
          const claims = decodeJwt<AccessTokenClaims>(result.accessToken)
          set({
            user: userFromClaims(claims),
            isAuthenticated: true,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
          })
          scheduleRefresh(claims.exp, get().refreshSession)
          return true
        } catch {
          set({ user: null, isAuthenticated: false, accessToken: null, refreshToken: null })
          return false
        }
      },

      bootstrap: async () => {
        const { accessToken, isAuthenticated } = get()
        if (!isAuthenticated || !accessToken) return

        set({ isVerifying: true })
        try {
          const claims = decodeJwt<AccessTokenClaims>(accessToken)
          if (isTokenExpired(claims.exp)) {
            const refreshed = await get().refreshSession() // also (re)schedules the next refresh on success
            if (!refreshed) return
          } else {
            scheduleRefresh(claims.exp, get().refreshSession)
          }
          // Confirms the session is still live server-side; not a role source (see fetchMe's docstring).
          await fetchMe()
        } catch {
          set({ user: null, isAuthenticated: false, accessToken: null, refreshToken: null })
        } finally {
          set({ isVerifying: false })
        }
      },
    }),
    { name: 'ecom-admin-session' },
  ),
)

/**
 * Convenience read hook for the current session. `role`/`isAuthenticated` are
 * UI/UX signals only (show/hide, redirect) — the backend re-verifies role
 * from the session/DB on every protected route regardless of what this
 * returns, so never treat it as a security boundary.
 */
export function useAuth() {
  const user = useSessionStore((s) => s.user)
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated)
  const isLoading = useSessionStore((s) => s.isVerifying)
  return { user, role: user?.role ?? null, isAuthenticated, isLoading }
}

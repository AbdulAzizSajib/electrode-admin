import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { ShieldAlert } from 'lucide-react'
import { useSessionStore, type AdminRole } from '@/lib/store/session-store'
import { EmptyState } from '@/components/ui/empty-state'

/** Redirects unauthenticated visitors to Login; renders the protected subtree otherwise. */
export function AuthGuard() {
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated)
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

/** Redirects an already-authenticated visitor away from auth-only pages (e.g. Login). */
export function GuestGuard() {
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated)
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

/** Blocks a route subtree unless the current session's role is allowed. */
export function RoleGuard({ roles }: { roles: AdminRole[] }) {
  const role = useSessionStore((s) => s.user?.role)
  if (!role || !roles.includes(role)) {
    return (
      <div className="flex h-full items-center justify-center py-16">
        <EmptyState
          icon={ShieldAlert}
          title="You don't have access to this page"
          description={`This section requires the ${roles.join(' or ')} role.`}
        />
      </div>
    )
  }
  return <Outlet />
}

/**
 * Inline show/hide for a piece of UI (a nav link, a menu item, a button) —
 * renders nothing instead of an access-denied state. For gating a whole
 * route, use `RoleGuard` instead. UI/UX only, same as `RoleGuard`: the
 * backend re-checks role on every protected request regardless of this.
 */
export function RequireRole({ roles, children }: { roles: AdminRole[]; children: ReactNode }) {
  const role = useSessionStore((s) => s.user?.role)
  if (!role || !roles.includes(role)) return null
  return <>{children}</>
}

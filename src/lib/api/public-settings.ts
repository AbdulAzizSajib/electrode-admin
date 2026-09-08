/**
 * The unauthenticated slice of the store settings, for the screens that render
 * BEFORE a session exists — login and forgot-password.
 *
 * Separate from `store-settings.ts` on purpose. That module reads `GET /settings`,
 * which is `checkAuth(OWNER, ADMIN)` — calling it from the login page would 401
 * for the only visitor who will ever see that page. This one reads
 * `GET /settings/public`, the allow-listed projection the storefront uses
 * (`store-setting.route.ts` registers it above `/` so the literal segment wins).
 *
 * Only the branding fields are typed here. The public endpoint returns much more
 * — nav, footer columns, checkout config, SEO — none of which an auth screen has
 * any use for, and typing it all would duplicate `store-settings.ts` for no gain.
 * The backend's projection stays an allow-list; this is a narrower view of it, so
 * a field added there is simply not read here until someone adds it below.
 */
import { useQuery } from '@tanstack/react-query'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'
import type { Theme } from '@/lib/api/store-settings'

/**
 * What the auth screens read. Every field is non-null because the backend merges
 * its own `DEFAULT_PUBLIC_SETTINGS` over the stored row before serving — a
 * cleared column, or a fresh install before the seed runs, still yields a
 * renderable value rather than a null the UI has to defend against.
 *
 * `siteNameAccent` is the exception and is genuinely optional: an empty string
 * means the merchant has no second word, which is not the same as a missing one.
 */
export interface PublicBranding {
  storeName: string
  siteNameAccent: string | null
  logoUrl: string | null
  contact: {
    email: string | null
    phone: string | null
    address: string | null
  }
  theme: Theme | null
}

async function getPublicBranding(): Promise<PublicBranding> {
  const res = await request<PublicBranding>('/settings/public')
  return res.data
}

/**
 * Deliberately tolerant of failure at the call site rather than here: the login
 * form must work when the settings request does not, so consumers read
 * `data ?? fallback` and never gate the form on this query. Retry is off and the
 * data is held for the session — branding does not change while someone is
 * typing a password, and a login screen should not re-request it on every
 * window focus.
 */
export function usePublicBranding() {
  return useQuery({
    queryKey: queryKeys.publicBranding.detail,
    queryFn: getPublicBranding,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}

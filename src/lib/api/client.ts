/**
 * Shared types and constants for the API layer.
 *
 * The mock helpers this file used to carry (`delay`, `paginate`, `generateId`, `matchesSearch`)
 * are gone: every `src/lib/api/<resource>.ts` module now talks to the real backend through the
 * shared helper in `request.ts`. What remains is what those real modules genuinely share — the
 * base URL, the error type, and the pagination shapes.
 */

/**
 * Where the API lives when `VITE_API_BASE_URL` says nothing.
 *
 * The panel's own origin, not localhost. Two reasons, and the second is the
 * one that made this change necessary:
 *
 *   - A build with no variable set used to call `http://localhost:5000`, which
 *     works for exactly one person: the developer who built it. Everyone else
 *     got a panel asking their own machine for data. Failing against the origin
 *     fails visibly and locally instead.
 *   - The demo host serves several demonstration shops on several subdomains
 *     from ONE admin build. A baked absolute URL cannot do that; the origin can,
 *     because each demo's panel is served from that demo's own subdomain.
 *
 * `window` is guarded because this module is imported by tests that run without
 * a DOM.
 */
const originBaseUrl = () =>
  typeof window === 'undefined'
    ? 'http://localhost:5000/api/v1'
    : `${window.location.origin}/api/v1`

/**
 * Origin of the Ecom API, including the `/api/v1` path.
 *
 * `VITE_API_BASE_URL` still wins whenever it is set, and a client installation
 * sets it — CPANEL-DEPLOY.md instructs that, because there the panel and the API
 * are separate origins. Nothing about those deployments changes.
 *
 * Vite inlines the variable AT BUILD TIME, so a deployment that changes it must
 * be rebuilt — setting it in a hosting dashboard and restarting does nothing.
 * The origin fallback is the opposite: it is read in the browser, which is
 * precisely why one build can serve many subdomains.
 *
 * A trailing slash is stripped: every caller writes paths as `/products`, and
 * `…/api/v1/` + `/products` would request `//products`, which is a different
 * path and 404s.
 */
export const BASE_URL = (import.meta.env.VITE_API_BASE_URL || originBaseUrl()).replace(
  /\/+$/,
  '',
)

/**
 * The header naming which demonstration shop a request is for.
 *
 * Derived from the panel's own hostname, so one build serves every demo. The
 * API ignores it unless that deployment has a demo map configured, which is why
 * it can be sent unconditionally: a client installation receiving it behaves
 * exactly as if it had not.
 *
 * Routing, not permission — see server/src/app/lib/tenant.ts.
 */
export const DEMO_KEY_HEADER = 'x-demo-key'

/**
 * The demo key for this panel: the first label of its hostname.
 *
 * `fashion.demos.example.com` -> `fashion`. Returns null for a bare hostname or
 * localhost, where there is no demo to name and the header is simply omitted.
 */
export const demoKey = (): string | null => {
  if (typeof window === 'undefined') return null
  const [first, ...rest] = window.location.hostname.split('.')
  if (rest.length === 0 || !first) return null
  return first.toLowerCase()
}

/** Where the storefront lives when nothing says otherwise — the local dev server. */
const DEFAULT_STOREFRONT_URL = 'http://localhost:4000'

/**
 * Origin of the customer storefront, with no trailing slash.
 *
 * The panel and the storefront are SEPARATE ORIGINS, which is the whole reason
 * this exists. A bare `/offer/<slug>` href resolves against whatever origin the
 * document was served from — the panel — so "View page" navigated the admin's
 * own router to a route it does not have and rendered the admin's "Page not
 * found". The link looked broken and the landing page looked missing, when both
 * were fine.
 *
 * Every outbound link to the shop must be built from this. See
 * `storefrontUrl` below.
 */
export const STOREFRONT_URL = (
  import.meta.env.VITE_STOREFRONT_URL || DEFAULT_STOREFRONT_URL
).replace(/\/+$/, '')

/**
 * An absolute storefront URL for a path this panel wants to link out to.
 *
 * Takes the path with its leading slash (`/offer/winter-sale`) and returns
 * `https://shop.example.com/offer/winter-sale`. A missing leading slash is
 * added rather than rejected: every caller writes a rooted path, and silently
 * producing `…comoffer/…` would be worse than being forgiving here.
 */
export const storefrontUrl = (path: string): string =>
  `${STOREFRONT_URL}${path.startsWith('/') ? path : `/${path}`}`

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: PaginationMeta
}

export interface ListParams {
  page?: number
  limit?: number
  search?: string
  /**
   * Server-side ordering. Necessary rather than convenient: these listings are
   * paginated on the server, so sorting in the browser would only reorder the
   * page already fetched — "show me the least-viewed products" would silently
   * mean "of these ten".
   */
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

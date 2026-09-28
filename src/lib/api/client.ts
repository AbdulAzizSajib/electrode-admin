/**
 * Shared types and constants for the API layer.
 *
 * The mock helpers this file used to carry (`delay`, `paginate`, `generateId`, `matchesSearch`)
 * are gone: every `src/lib/api/<resource>.ts` module now talks to the real backend through the
 * shared helper in `request.ts`. What remains is what those real modules genuinely share — the
 * base URL, the error type, and the pagination shapes.
 */

/** Where the API lives when nothing says otherwise — the local dev server. */
const DEFAULT_BASE_URL = 'http://localhost:5000/api/v1'

/**
 * Origin of the Ecom API, including the `/api/v1` path.
 *
 * Configured through `VITE_API_BASE_URL` because this panel is deployed
 * separately from the API it talks to: hardcoding localhost shipped a build that
 * asked every visitor's own machine for data, which fails for everyone but the
 * developer who built it.
 *
 * Vite inlines this AT BUILD TIME, so a deployment that changes it must be
 * rebuilt — setting it in a hosting dashboard and restarting does nothing.
 *
 * A trailing slash is stripped: every caller writes paths as `/products`, and
 * `…/api/v1/` + `/products` would request `//products`, which is a different
 * path and 404s.
 */
export const BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE_URL).replace(
  /\/+$/,
  '',
)

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

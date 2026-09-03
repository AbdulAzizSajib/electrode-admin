/**
 * Shared types and constants for the API layer.
 *
 * The mock helpers this file used to carry (`delay`, `paginate`, `generateId`, `matchesSearch`)
 * are gone: every `src/lib/api/<resource>.ts` module now talks to the real backend through the
 * shared helper in `request.ts`. What remains is what those real modules genuinely share — the
 * base URL, the error type, and the pagination shapes.
 */

export const BASE_URL = 'http://localhost:5000/api/v1'

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

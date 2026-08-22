/**
 * Shared conventions for the mock API layer.
 *
 * Every `src/lib/api/<resource>.ts` module is written against this file's helpers so that a
 * future API-integration change can replace each function's body with a real `fetch` call
 * against `BASE_URL` without changing call sites, hooks, or loading/error UI — see
 * design.md, Decision 6.
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
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** Simulates network latency so loading states are exercised the same way real requests would. */
export function delay<T>(value: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

export function paginate<T>(items: T[], params: ListParams = {}): PaginatedResponse<T> {
  const page = params.page && params.page > 0 ? params.page : 1
  const limit = params.limit && params.limit > 0 ? params.limit : 10
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const start = (page - 1) * limit
  const data = items.slice(start, start + limit)
  return { data, meta: { page, limit, total, totalPages } }
}

let idCounter = 1000
export function generateId(prefix: string): string {
  idCounter += 1
  return `${prefix}_${idCounter.toString(36)}`
}

export function matchesSearch(haystack: Array<string | undefined | null>, search: string | undefined): boolean {
  if (!search || !search.trim()) return true
  const needle = search.trim().toLowerCase()
  return haystack.some((value) => value?.toLowerCase().includes(needle))
}

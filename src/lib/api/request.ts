/**
 * The one shared fetch helper every `src/lib/api/<resource>.ts` module is written against.
 *
 * Before this module existed each resource file carried its own byte-identical copy; a change to
 * error handling or credentials meant editing it in ~20 places. Behaviour is unchanged from those
 * copies: `credentials: 'include'` for the httpOnly session cookies, unwrap the backend's
 * `{ success, message, data, meta? }` envelope, and throw `ApiError` carrying the backend's own
 * message whenever the response is not ok or the envelope reports failure.
 */
import { ApiError, BASE_URL, type PaginationMeta } from '@/lib/api/client'

export interface ApiEnvelope<T> {
  success: boolean
  message: string
  data: T
  meta?: PaginationMeta
}

/**
 * Returns the whole envelope, because paginated callers need `meta` alongside `data`. Callers that
 * only want the payload read `.data` off the result (see `requestData`).
 *
 * `Content-Type: application/json` is set only when the body is not `FormData`: for multipart
 * uploads the browser has to set the header itself so it can include the multipart boundary, and
 * setting it manually makes the backend fail to parse the body. Callers can still override the
 * header explicitly — `init` is spread last.
 */
export async function request<T>(path: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData

  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    ...(isFormData ? {} : { headers: { 'Content-Type': 'application/json' } }),
    ...init,
  })

  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null
  if (!res.ok || !json?.success) {
    throw new ApiError(json?.message ?? `Request to ${path} failed`, res.status)
  }
  return json
}

/** `request` for callers that want only the payload and never read `meta`. */
export async function requestData<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await request<T>(path, init)
  return res.data
}

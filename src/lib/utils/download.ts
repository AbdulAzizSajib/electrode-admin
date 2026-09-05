import { ApiError, BASE_URL } from '@/lib/api/client'

/**
 * Downloads a file from the API to the user's disk.
 *
 * `request.ts` cannot be reused: it always `JSON.parse`s the response and
 * would throw on a CSV body.
 *
 * A plain `<a href>` cannot be used either. The admin authenticates with
 * httpOnly cookies against an API on a different origin, so whether a
 * top-level download navigation carries the session depends on that cookie's
 * SameSite value — it would work in some deployments and silently 401 in
 * others. Fetching with explicit `credentials: 'include'` behaves the same
 * everywhere (design decision 8).
 *
 * The trade-off is that the browser holds the whole file in memory. For CSV at
 * this scale that is megabytes, and it buys deployment-independent auth.
 */
export async function downloadFile(path: string, fallbackFilename: string): Promise<void> {
  const res = await fetch(`${BASE_URL}${path}`, { credentials: 'include' })

  if (!res.ok) {
    // A failed export still returns the backend's JSON envelope, so the real
    // message survives instead of becoming "download failed".
    const message = await res
      .json()
      .then((body: { message?: string }) => body?.message)
      .catch(() => null)
    throw new ApiError(message ?? `Download from ${path} failed`, res.status)
  }

  const blob = await res.blob()

  // Prefer the server's filename — it names the report and the range it
  // covers, so several exports do not collide in a downloads folder.
  const filename = filenameFromDisposition(res.headers.get('Content-Disposition')) ?? fallbackFilename

  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  } finally {
    // Revoked in a finally so a click that throws does not leak the blob for
    // the life of the tab.
    URL.revokeObjectURL(url)
  }
}

function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header)
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

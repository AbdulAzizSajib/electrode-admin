/** Real backend storage-usage calls — follows the same envelope/error pattern as `categories.ts`. */
import { useQuery } from '@tanstack/react-query'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'

export interface StorageSize {
  bytes: number
  /** Formatted server-side ("15 MB") so every surface renders the same string. */
  label: string
}

export interface DatabaseUsage {
  size: StorageSize
  reachable: true
}

export interface MediaUsage {
  plan: string
  storage: StorageSize
  /** Billing-period bandwidth; Cloudinary resets this monthly. */
  bandwidth: StorageSize
  assets: number
  /** Cloudinary's own metering. Null on plans that do not report it. */
  credits: { used: number; limit: number; percentUsed: number } | null
}

/**
 * Either half can be null with a reason beside it — the backend reads the two
 * independently so one outage cannot hide the other figure. A null half means
 * "could not read", which the page must render as unavailable, never as zero.
 */
export interface StorageUsage {
  database: DatabaseUsage | null
  databaseError: string | null
  media: MediaUsage | null
  mediaError: string | null
}

async function getStorageUsage(): Promise<StorageUsage> {
  const res = await request<StorageUsage>('/storage')
  return res.data
}

export function useStorageUsage() {
  return useQuery({
    queryKey: queryKeys.storage.usage,
    queryFn: getStorageUsage,
    /*
     * Every call hits Cloudinary's Admin API, which is rate-limited to 500/hour
     * on the free tier. A short stale window would spend that budget on a page
     * whose numbers move in hours, not seconds.
     */
    staleTime: 5 * 60_000,
  })
}

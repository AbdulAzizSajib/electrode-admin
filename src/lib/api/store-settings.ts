/** Real backend store-setting calls — follows the same envelope/error pattern as `categories.ts`. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'

/**
 * The storefront presentation blocks are `Json` columns on the backend with their own nested
 * validation schemas. This module deliberately treats them as opaque: the settings page does not
 * edit them, and `PATCH /settings` is a partial update, so leaving them out of a write preserves
 * whatever is stored. Typing them properly belongs with the editor that eventually edits them.
 */
export type StoreSettingJsonBlock = unknown

export interface StoreSettings {
  id: string
  storeName: string
  currency: string
  currencySymbol: string
  /** Percent, 0–100 — not a fraction. */
  defaultTaxRatePercent: number
  /** Null means free shipping by order value is not offered at all, which is distinct from a 0 threshold. */
  freeShippingThreshold: number | null
  contactEmail: string | null
  contactPhone: string | null
  address: string | null
  logoUrl: string | null
  siteNameAccent: string | null
  aboutText: string | null
  copyrightText: string | null
  maxPendingCodOrdersPerPhone: number
  maxGuestOrdersPerIpPerHour: number
  mainNav: StoreSettingJsonBlock
  footerColumns: StoreSettingJsonBlock
  socialLinks: StoreSettingJsonBlock
  announcementBar: StoreSettingJsonBlock
  newsletter: StoreSettingJsonBlock
  updatedAt: string
}

/**
 * Every field is optional because the backend validates it that way and applies the payload as a
 * partial upsert. A key left out is untouched — which is how the page avoids clobbering the
 * storefront JSON blocks it never shows.
 *
 * The backend rejects `null` for these (they are `.optional()`, not `.nullable()`), so "clear this
 * value" is expressed by omitting the key, never by sending null.
 */
export interface StoreSettingsInput {
  storeName?: string
  currency?: string
  currencySymbol?: string
  defaultTaxRatePercent?: number
  freeShippingThreshold?: number
  contactEmail?: string
  contactPhone?: string
  address?: string
  logoUrl?: string
  siteNameAccent?: string
  aboutText?: string
  copyrightText?: string
}

async function getStoreSettings(): Promise<StoreSettings> {
  const res = await request<StoreSettings>('/settings')
  return res.data
}

async function updateStoreSettings(input: StoreSettingsInput): Promise<StoreSettings> {
  const res = await request<StoreSettings>('/settings', { method: 'PATCH', body: JSON.stringify(input) })
  return res.data
}

export function useStoreSettings() {
  return useQuery({ queryKey: queryKeys.storeSettings.detail, queryFn: getStoreSettings })
}

export function useUpdateStoreSettings() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: updateStoreSettings,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.storeSettings.detail }),
  })
}

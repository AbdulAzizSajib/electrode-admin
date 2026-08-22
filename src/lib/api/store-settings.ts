import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { delay } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'
import { recordAuditEntry } from '@/lib/api/audit-logs'

export interface StoreSettings {
  storeName: string
  contactEmail: string
  currency: string
  taxRate: number
  freeShippingThreshold: number
}

let settings: StoreSettings = {
  storeName: 'Ecom',
  contactEmail: 'support@ecom.example.com',
  currency: 'USD',
  taxRate: 8,
  freeShippingThreshold: 50,
}

async function getStoreSettings(): Promise<StoreSettings> {
  return delay(settings)
}

async function updateStoreSettings(input: StoreSettings): Promise<StoreSettings> {
  settings = { ...input }
  recordAuditEntry({ action: 'store_settings.updated', resourceType: 'store_settings', resourceLabel: settings.storeName })
  return delay(settings)
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

/**
 * Real backend customer calls, against admin endpoints added alongside this change — the server
 * previously exposed only `/customers/me/addresses`, so there was nothing for this page to call.
 */
import { useQuery } from '@tanstack/react-query'
import { type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'

export const CUSTOMER_STATUSES = ['ACTIVE', 'INACTIVE', 'BLOCKED'] as const
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number]

export const ADDRESS_TYPES = ['SHIPPING', 'BILLING'] as const
export type AddressType = (typeof ADDRESS_TYPES)[number]

export interface CustomerAddress {
  id: string
  customerId: string
  type: AddressType
  fullName: string
  phone: string
  addressLine1: string
  addressLine2: string | null
  city: string
  state: string | null
  postalCode: string | null
  country: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface CustomerRow {
  id: string
  userId: string | null
  firstName: string
  /** Optional — a customer created from a single-word name has no last name. */
  lastName: string | null
  email: string | null
  phone: string | null
  avatar: string | null
  status: CustomerStatus
  createdAt: string
  updatedAt: string
}

export interface CustomerDetail extends CustomerRow {
  addresses: CustomerAddress[]
  /** Aggregated server-side over all non-cancelled orders, not summed from a page of results. */
  orderCount: number
  totalSpent: number
}

export interface CustomerListParams extends ListParams {
  status?: CustomerStatus
}

/** Display name from the split first/last columns. */
export function customerFullName(c: Pick<CustomerRow, 'firstName' | 'lastName'>): string {
  return [c.firstName, c.lastName].filter(Boolean).join(' ')
}

async function listCustomers(params: CustomerListParams = {}): Promise<PaginatedResponse<CustomerRow>> {
  const limit = params.limit ?? 20

  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  query.set('limit', String(limit))
  if (params.search) query.set('searchTerm', params.search)
  if (params.status) query.set('status', params.status)

  const res = await request<CustomerRow[]>(`/customers?${query}`)
  return {
    data: res.data,
    meta: res.meta ?? { page: params.page ?? 1, limit, total: res.data.length, totalPages: 1 },
  }
}

async function getCustomer(id: string): Promise<CustomerDetail> {
  const res = await request<CustomerDetail>(`/customers/${id}`)
  return res.data
}

export function useCustomers(params: CustomerListParams = {}) {
  return useQuery({ queryKey: queryKeys.customers.list(params), queryFn: () => listCustomers(params) })
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.customers.detail(id ?? ''),
    queryFn: () => getCustomer(id!),
    enabled: !!id,
  })
}

import { useQuery } from '@tanstack/react-query'
import { ApiError, delay, matchesSearch, paginate, type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'
import { _getAllUsers, _getUserById } from '@/lib/api/users'
import { _getAllOrders } from '@/lib/api/orders'
import type { Address } from '@/lib/api/shared-types'

export interface CustomerRow {
  id: string
  name: string
  email: string
  joinedAt: string
  isActive: boolean
  orderCount: number
  totalSpent: number
}

export interface CustomerDetail extends CustomerRow {
  addresses: Address[]
}

function toRow(userId: string): CustomerRow {
  const user = _getUserById(userId)!
  const orders = _getAllOrders().filter((o) => o.customerId === userId && o.fulfillmentStatus !== 'cancelled')
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    joinedAt: user.createdAt,
    isActive: user.isActive,
    orderCount: orders.length,
    totalSpent: Math.round(orders.reduce((sum, o) => sum + o.total, 0) * 100) / 100,
  }
}

async function listCustomers(params: ListParams = {}): Promise<PaginatedResponse<CustomerRow>> {
  const customers = _getAllUsers().filter((u) => u.role === 'CUSTOMER')
  const filtered = customers.filter((c) => matchesSearch([c.name, c.email], params.search))
  const rows = filtered.map((c) => toRow(c.id)).sort((a, b) => b.joinedAt.localeCompare(a.joinedAt))
  return delay(paginate(rows, params))
}

async function getCustomer(id: string): Promise<CustomerDetail> {
  const user = _getUserById(id)
  if (!user || user.role !== 'CUSTOMER') throw new ApiError('Customer not found', 404)
  return delay({ ...toRow(id), addresses: user.addresses })
}

export function useCustomers(params: ListParams = {}) {
  return useQuery({ queryKey: queryKeys.customers.list(params), queryFn: () => listCustomers(params) })
}

export function useCustomer(id: string | undefined) {
  return useQuery({ queryKey: queryKeys.customers.detail(id ?? ''), queryFn: () => getCustomer(id!), enabled: !!id })
}

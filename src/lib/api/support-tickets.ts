/** Real backend support-ticket calls — follows the same envelope/error pattern as `categories.ts`. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'

export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

export const TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const
export type TicketPriority = (typeof TICKET_PRIORITIES)[number]

/** Presentation maps, shared by the ticket list and detail pages. */
export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
}
export const TICKET_STATUS_VARIANT: Record<TicketStatus, 'secondary' | 'warning' | 'success' | 'outline'> = {
  OPEN: 'secondary',
  IN_PROGRESS: 'warning',
  RESOLVED: 'success',
  CLOSED: 'outline',
}
export const TICKET_PRIORITY_LABEL: Record<TicketPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
}
export const TICKET_PRIORITY_VARIANT: Record<TicketPriority, 'secondary' | 'outline' | 'warning' | 'destructive'> = {
  LOW: 'secondary',
  MEDIUM: 'outline',
  HIGH: 'warning',
  URGENT: 'destructive',
}

/** The customer summary embedded in ticket responses. */
export interface TicketCustomer {
  id: string
  userId: string | null
  firstName: string
  lastName: string | null
  email: string | null
}

/** A staff user summary — nullable everywhere, since the relation is `onDelete: SetNull`. */
export interface TicketUserRef {
  id: string
  name: string
  email: string
}

export interface SupportTicket {
  id: string
  ticketNumber: string
  customerId: string
  customer: TicketCustomer
  subject: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  assignedToId: string | null
  assignedTo: TicketUserRef | null
  createdAt: string
  updatedAt: string
}

export interface TicketMessage {
  id: string
  ticketId: string
  senderId: string | null
  /** Null when the sending account has since been deleted — rendered as an unknown sender. */
  sender: TicketUserRef | null
  message: string
  attachments: unknown
  createdAt: string
}

/** The customer relation carries first/last name separately, and last name is optional. */
export function customerName(ticket: SupportTicket): string {
  return [ticket.customer.firstName, ticket.customer.lastName].filter(Boolean).join(' ')
}

export interface TicketListParams extends ListParams {
  status?: TicketStatus
  priority?: TicketPriority
  assignedToId?: string
}

export interface TicketPatch {
  status?: TicketStatus
  priority?: TicketPriority
  /** Null clears the assignment; the backend accepts it explicitly here, unlike most fields. */
  assignedToId?: string | null
}

async function listTickets(params: TicketListParams = {}): Promise<PaginatedResponse<SupportTicket>> {
  const limit = params.limit ?? 20

  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  query.set('limit', String(limit))
  if (params.search) query.set('searchTerm', params.search)
  if (params.status) query.set('status', params.status)
  if (params.priority) query.set('priority', params.priority)
  if (params.assignedToId) query.set('assignedToId', params.assignedToId)

  const res = await request<SupportTicket[]>(`/support-tickets?${query}`)
  return {
    data: res.data,
    meta: res.meta ?? { page: params.page ?? 1, limit, total: res.data.length, totalPages: 1 },
  }
}

async function getTicket(id: string): Promise<SupportTicket> {
  const res = await request<SupportTicket>(`/support-tickets/${id}`)
  return res.data
}

/**
 * Messages live behind their own nested endpoint rather than riding along on the ticket, and come
 * back as a plain chronological array — there is no pagination envelope here.
 */
async function getTicketMessages(ticketId: string): Promise<TicketMessage[]> {
  const res = await request<TicketMessage[]>(`/support-tickets/${ticketId}/messages`)
  return res.data
}

async function replyToTicket(ticketId: string, message: string): Promise<TicketMessage> {
  const res = await request<TicketMessage>(`/support-tickets/${ticketId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  })
  return res.data
}

async function updateTicket(id: string, patch: TicketPatch): Promise<SupportTicket> {
  const res = await request<SupportTicket>(`/support-tickets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  return res.data
}

export function useSupportTickets(params: TicketListParams = {}) {
  return useQuery({ queryKey: queryKeys.supportTickets.list(params), queryFn: () => listTickets(params) })
}

export function useSupportTicket(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.supportTickets.detail(id ?? ''),
    queryFn: () => getTicket(id!),
    enabled: !!id,
  })
}

export function useTicketMessages(ticketId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.supportTickets.messages(ticketId ?? ''),
    queryFn: () => getTicketMessages(ticketId!),
    enabled: !!ticketId,
  })
}

export function useReplyToTicket() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ ticketId, message }: { ticketId: string; message: string }) => replyToTicket(ticketId, message),
    // Refresh the thread so the new reply appears without a manual reload.
    onSuccess: (_data, { ticketId }) =>
      client.invalidateQueries({ queryKey: queryKeys.supportTickets.messages(ticketId) }),
  })
}

export function useUpdateTicket() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TicketPatch }) => updateTicket(id, patch),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.supportTickets.all }),
  })
}

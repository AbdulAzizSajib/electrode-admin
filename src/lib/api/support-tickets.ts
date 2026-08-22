import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, delay, generateId, paginate, type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'
import { recordAuditEntry } from '@/lib/api/audit-logs'
import { _getAllUsers } from '@/lib/api/users'
import { useSessionStore } from '@/lib/store/session-store'

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface TicketMessage {
  id: string
  ticketId: string
  authorType: 'customer' | 'staff'
  authorName: string
  message: string
  createdAt: string
}

export interface SupportTicket {
  id: string
  subject: string
  customerId: string
  status: TicketStatus
  priority: TicketPriority
  createdAt: string
  updatedAt: string
}

let tickets: SupportTicket[] = []
let messages: TicketMessage[] = []

function seed() {
  const customers = _getAllUsers().filter((u) => u.role === 'CUSTOMER')
  const seeds: Array<{ subject: string; status: TicketStatus; priority: TicketPriority; thread: Array<[string, 'customer' | 'staff']> }> = [
    { subject: 'Order arrived with a damaged item', status: 'open', priority: 'high', thread: [['My order #ORD-58212 arrived with a cracked screen protector.', 'customer']] },
    { subject: 'Question about return policy', status: 'in_progress', priority: 'medium', thread: [['How many days do I have to return an item?', 'customer'], ['You have 30 days from delivery — happy to start that for you.', 'staff']] },
    { subject: 'Unable to apply coupon code', status: 'resolved', priority: 'low', thread: [['WELCOME10 says invalid at checkout.', 'customer'], ['That code requires a $0 minimum and is single-use per account — could you confirm it hasn’t been used before?', 'staff'], ['Ah, I see — it worked this time, thank you!', 'customer']] },
    { subject: 'Wrong item shipped', status: 'open', priority: 'urgent', thread: [['I ordered the 13" Ultrabook but received a monitor instead.', 'customer']] },
    { subject: 'Delayed delivery', status: 'closed', priority: 'medium', thread: [['My package has been in transit for 10 days.', 'customer'], ['Apologies for the delay — reaching out to the carrier now.', 'staff'], ['It arrived today, thanks for checking!', 'customer']] },
  ]

  seeds.forEach((s, i) => {
    const ticket: SupportTicket = {
      id: generateId('tix'),
      subject: s.subject,
      customerId: customers[i % customers.length].id,
      status: s.status,
      priority: s.priority,
      createdAt: new Date(Date.now() - (seeds.length - i) * 86_400_000).toISOString(),
      updatedAt: new Date(Date.now() - (seeds.length - i) * 43_200_000).toISOString(),
    }
    tickets.push(ticket)
    s.thread.forEach(([message, authorType], mi) => {
      messages.push({
        id: generateId('msg'),
        ticketId: ticket.id,
        authorType,
        authorName: authorType === 'customer' ? customers[i % customers.length].name : 'Support Team',
        message,
        createdAt: new Date(new Date(ticket.createdAt).getTime() + mi * 3_600_000).toISOString(),
      })
    })
  })
}
seed()

export interface TicketListParams extends ListParams {
  status?: TicketStatus
  priority?: TicketPriority
}

async function listTickets(params: TicketListParams = {}) {
  const customers = _getAllUsers()
  let filtered = [...tickets].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  if (params.status) filtered = filtered.filter((t) => t.status === params.status)
  if (params.priority) filtered = filtered.filter((t) => t.priority === params.priority)
  const rows = filtered.map((t) => ({ ...t, customerName: customers.find((c) => c.id === t.customerId)?.name ?? 'Unknown' }))
  return delay(paginate(rows, params) as PaginatedResponse<(typeof rows)[number]>)
}

async function getTicket(id: string) {
  const ticket = tickets.find((t) => t.id === id)
  if (!ticket) throw new ApiError('Ticket not found', 404)
  const customer = _getAllUsers().find((u) => u.id === ticket.customerId)
  const thread = messages.filter((m) => m.ticketId === id).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return delay({ ticket: { ...ticket, customerName: customer?.name ?? 'Unknown' }, messages: thread })
}

async function replyToTicket(ticketId: string, message: string): Promise<TicketMessage> {
  const ticket = tickets.find((t) => t.id === ticketId)
  if (!ticket) throw new ApiError('Ticket not found', 404)
  const staffName = useSessionStore.getState().user?.name ?? 'Support Team'
  const entry: TicketMessage = { id: generateId('msg'), ticketId, authorType: 'staff', authorName: staffName, message, createdAt: new Date().toISOString() }
  messages = [...messages, entry]
  tickets = tickets.map((t) => (t.id === ticketId ? { ...t, updatedAt: entry.createdAt } : t))
  return delay(entry)
}

async function updateTicket(id: string, patch: { status?: TicketStatus; priority?: TicketPriority }): Promise<SupportTicket> {
  const index = tickets.findIndex((t) => t.id === id)
  if (index === -1) throw new ApiError('Ticket not found', 404)
  const updated = { ...tickets[index], ...patch, updatedAt: new Date().toISOString() }
  tickets = tickets.map((t) => (t.id === id ? updated : t))
  recordAuditEntry({ action: 'support_ticket.updated', resourceType: 'support_ticket', resourceId: id, resourceLabel: updated.subject })
  return delay(updated)
}

export function useSupportTickets(params: TicketListParams = {}) {
  return useQuery({ queryKey: queryKeys.supportTickets.list(params), queryFn: () => listTickets(params) })
}

export function useSupportTicket(id: string | undefined) {
  return useQuery({ queryKey: queryKeys.supportTickets.detail(id ?? ''), queryFn: () => getTicket(id!), enabled: !!id })
}

function invalidateTicket(client: ReturnType<typeof useQueryClient>, id: string) {
  client.invalidateQueries({ queryKey: queryKeys.supportTickets.all })
  client.invalidateQueries({ queryKey: queryKeys.supportTickets.detail(id) })
}

export function useReplyToTicket() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ ticketId, message }: { ticketId: string; message: string }) => replyToTicket(ticketId, message),
    onSuccess: (_d, v) => invalidateTicket(client, v.ticketId),
  })
}

export function useUpdateTicket() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { status?: TicketStatus; priority?: TicketPriority } }) => updateTicket(id, patch),
    onSuccess: (_d, v) => invalidateTicket(client, v.id),
  })
}

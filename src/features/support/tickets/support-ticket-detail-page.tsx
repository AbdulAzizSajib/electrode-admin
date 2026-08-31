import * as React from 'react'
import { useNavigate, useParams } from 'react-router'
import { ArrowLeft, MessagesSquare, Send } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { toast } from '@/components/ui/use-toast'
import { useBreadcrumbLabel } from '@/components/layout/breadcrumb-context'
import {
  useReplyToTicket,
  useSupportTicket,
  useTicketMessages,
  useUpdateTicket,
  customerName,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABEL,
  TICKET_STATUSES,
  TICKET_STATUS_LABEL,
  TICKET_STATUS_VARIANT,
  type TicketPriority,
  type TicketStatus,
} from '@/lib/api/support-tickets'
import { cn } from '@/lib/utils/cn'
import { formatDateTime } from '@/lib/utils/format'

export default function SupportTicketDetailPage() {
  const { ticketId } = useParams()
  const navigate = useNavigate()
  const { data: ticket, isLoading } = useSupportTicket(ticketId)
  // Messages come from their own nested endpoint, so they load independently of the ticket.
  const { data: messages, isLoading: messagesLoading } = useTicketMessages(ticketId)
  const replyMutation = useReplyToTicket()
  const updateMutation = useUpdateTicket()
  const [message, setMessage] = React.useState('')

  useBreadcrumbLabel(ticket?.subject)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }
  if (!ticket || !ticketId) return <EmptyState title="Ticket not found" />

  const sendReply = async () => {
    if (!message.trim()) return
    try {
      await replyMutation.mutateAsync({ ticketId, message })
      setMessage('')
    } catch (err) {
      toast({ title: 'Could not send reply', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }

  const triage = async (patch: { status?: TicketStatus; priority?: TicketPriority }) => {
    try {
      await updateMutation.mutateAsync({ id: ticketId, patch })
    } catch (err) {
      toast({ title: 'Could not update ticket', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="size-7" onClick={() => navigate('/support/tickets')}>
          <ArrowLeft className="size-4" />
        </Button>
        <PageHeader
          className="flex-1"
          title={ticket.subject}
          description={`${ticket.ticketNumber} · ${customerName(ticket)}`}
          actions={<Badge variant={TICKET_STATUS_VARIANT[ticket.status]}>{TICKET_STATUS_LABEL[ticket.status]}</Badge>}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Conversation</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3">
              {/* The ticket's own description opens the thread — it is not a message row. */}
              <div className="flex flex-col gap-0.5 rounded-md bg-muted p-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">{customerName(ticket)}</span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(ticket.createdAt)}</span>
                </div>
                <p className="text-foreground">{ticket.description}</p>
              </div>

              {messagesLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : !messages || messages.length === 0 ? (
                <EmptyState icon={MessagesSquare} title="No replies yet" description="Send the first reply below." />
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn('flex flex-col gap-0.5 rounded-md p-2.5 text-sm', m.sender ? 'ml-6 bg-info-bg' : 'mr-6 bg-muted')}
                  >
                    <div className="flex items-center justify-between">
                      {/* The sender relation is nullable: the account may have been deleted. */}
                      <span className={cn('font-medium', m.sender ? 'text-foreground' : 'text-muted-foreground')}>
                        {m.sender?.name ?? 'Unknown sender'}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(m.createdAt)}</span>
                    </div>
                    <p className="text-foreground">{m.message}</p>
                  </div>
                ))
              )}
            </CardContent>
            <div className="flex flex-col gap-2 border-t border-border p-3">
              <Textarea rows={3} placeholder="Write a reply…" value={message} onChange={(e) => setMessage(e.target.value)} />
              <div className="flex justify-end">
                <Button size="sm" onClick={sendReply} loading={replyMutation.isPending} disabled={!message.trim()}>
                  <Send /> Send reply
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">Status</span>
                <Select value={ticket.status} onValueChange={(v) => triage({ status: v as TicketStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TICKET_STATUSES.map((s) => <SelectItem key={s} value={s}>{TICKET_STATUS_LABEL[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">Priority</span>
                <Select value={ticket.priority} onValueChange={(v) => triage({ priority: v as TicketPriority })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TICKET_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{TICKET_PRIORITY_LABEL[p]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Assignee</span>
                <span className={cn(!ticket.assignedTo && 'text-muted-foreground')}>
                  {ticket.assignedTo?.name ?? 'Unassigned'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Customer</span>
                <span>{customerName(ticket)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDateTime(ticket.createdAt)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

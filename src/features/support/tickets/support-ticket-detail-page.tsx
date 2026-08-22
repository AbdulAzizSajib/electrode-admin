import * as React from 'react'
import { useNavigate, useParams } from 'react-router'
import { ArrowLeft, Send } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { toast } from '@/components/ui/use-toast'
import { useBreadcrumbLabel } from '@/components/layout/breadcrumb-context'
import {
  useReplyToTicket,
  useSupportTicket,
  useUpdateTicket,
  type TicketPriority,
  type TicketStatus,
} from '@/lib/api/support-tickets'
import { cn } from '@/lib/utils/cn'
import { formatDateTime } from '@/lib/utils/format'

const STATUS_LABEL: Record<TicketStatus, string> = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' }
const PRIORITY_LABEL: Record<TicketPriority, string> = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' }

export default function SupportTicketDetailPage() {
  const { ticketId } = useParams()
  const navigate = useNavigate()
  const { data, isLoading } = useSupportTicket(ticketId)
  const replyMutation = useReplyToTicket()
  const updateMutation = useUpdateTicket()
  const [message, setMessage] = React.useState('')

  useBreadcrumbLabel(data?.ticket.subject)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }
  if (!data || !ticketId) return <EmptyState title="Ticket not found" />

  const { ticket, messages } = data

  const sendReply = async () => {
    if (!message.trim()) return
    try {
      await replyMutation.mutateAsync({ ticketId, message })
      setMessage('')
    } catch (err) {
      toast({ title: 'Could not send reply', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="size-7" onClick={() => navigate('/support/tickets')}>
          <ArrowLeft className="size-4" />
        </Button>
        <PageHeader className="flex-1" title={ticket.subject} description={ticket.customerName} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Conversation</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3">
              {messages.map((m) => (
                <div key={m.id} className={cn('flex flex-col gap-0.5 rounded-md p-2.5 text-sm', m.authorType === 'staff' ? 'ml-6 bg-info-bg' : 'mr-6 bg-muted')}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{m.authorName}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(m.createdAt)}</span>
                  </div>
                  <p className="text-foreground">{m.message}</p>
                </div>
              ))}
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
                <Select value={ticket.status} onValueChange={(v) => updateMutation.mutate({ id: ticketId, patch: { status: v as TicketStatus } })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">Priority</span>
                <Select value={ticket.priority} onValueChange={(v) => updateMutation.mutate({ id: ticketId, patch: { priority: v as TicketPriority } })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
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

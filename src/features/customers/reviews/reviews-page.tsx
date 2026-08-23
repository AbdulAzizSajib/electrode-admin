import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { CheckCircle2, EyeOff, MessageSquareReply, MoreHorizontal, Star, XCircle } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { DataTable } from '@/components/ui/data-table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/use-toast'
import { useReplyToReview, useReviews, useUpdateReviewStatus, type Review, type ReviewStatus } from '@/lib/api/reviews'
import { formatDate } from '@/lib/utils/format'

const STATUS_LABEL: Record<ReviewStatus, string> = { PENDING: 'Pending', APPROVED: 'Approved', REJECTED: 'Rejected', HIDDEN: 'Hidden' }
const STATUS_VARIANT: Record<ReviewStatus, 'secondary' | 'success' | 'destructive' | 'outline'> = {
  PENDING: 'secondary',
  APPROVED: 'success',
  REJECTED: 'destructive',
  HIDDEN: 'outline',
}

export default function ReviewsPage() {
  const [status, setStatus] = React.useState('all')
  const [rating, setRating] = React.useState('all')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)
  const [replying, setReplying] = React.useState<Review | null>(null)
  const [draft, setDraft] = React.useState('')

  const { data, isLoading, isError, refetch } = useReviews({
    page,
    limit: pageSize,
    status: status === 'all' ? undefined : (status as ReviewStatus),
    rating: rating === 'all' ? undefined : Number(rating),
  })
  const updateStatus = useUpdateReviewStatus()
  const replyMutation = useReplyToReview()

  const columns: ColumnDef<Review>[] = [
    { id: 'product', header: 'Product', cell: ({ row }) => <span className="font-medium text-foreground">{row.original.product?.name ?? '—'}</span> },
    { id: 'customer', header: 'Customer', cell: ({ row }) => `${row.original.customer.firstName} ${row.original.customer.lastName ?? ''}` },
    { id: 'rating', header: 'Rating', cell: ({ row }) => (
      <span className="inline-flex items-center gap-0.5">
        {row.original.rating}
        <Star className="size-3.5 fill-current text-warning" />
      </span>
    ) },
    { accessorKey: 'comment', header: 'Comment', cell: ({ row }) => <span className="line-clamp-1 max-w-64 text-muted-foreground">{row.original.comment ?? '—'}</span> },
    { id: 'status', header: 'Status', cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{STATUS_LABEL[row.original.status]}</Badge> },
    { accessorKey: 'createdAt', header: 'Date', cell: ({ row }) => formatDate(row.original.createdAt) },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7"><MoreHorizontal className="size-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {row.original.status !== 'APPROVED' && (
              <DropdownMenuItem onClick={() => updateStatus.mutate({ id: row.original.id, status: 'APPROVED' })}>
                <CheckCircle2 /> Approve
              </DropdownMenuItem>
            )}
            {row.original.status !== 'REJECTED' && (
              <DropdownMenuItem onClick={() => updateStatus.mutate({ id: row.original.id, status: 'REJECTED' })}>
                <XCircle /> Reject
              </DropdownMenuItem>
            )}
            {row.original.status !== 'HIDDEN' && (
              <DropdownMenuItem onClick={() => updateStatus.mutate({ id: row.original.id, status: 'HIDDEN' })}>
                <EyeOff /> Hide
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => { setReplying(row.original); setDraft(row.original.adminReply ?? '') }}>
              <MessageSquareReply /> {row.original.adminReply ? 'Edit reply' : 'Reply'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Reviews" description="Moderate product reviews submitted by customers." />

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        emptyState={{ icon: Star, title: 'No reviews found' }}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
              <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.entries(STATUS_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={rating} onValueChange={(v) => { setRating(v); setPage(1) }}>
              <SelectTrigger className="h-8 w-32"><SelectValue placeholder="Rating" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ratings</SelectItem>
                {[5, 4, 3, 2, 1].map((r) => <SelectItem key={r} value={String(r)}>{r} stars</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
        page={page}
        pageSize={pageSize}
        total={data?.meta.total ?? 0}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
      />

      <Dialog open={!!replying} onOpenChange={(open) => !open && setReplying(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reply to review</DialogTitle></DialogHeader>
          {replying && (
            <p className="text-sm text-muted-foreground">
              "{replying.comment}" — {replying.customer.firstName} {replying.customer.lastName ?? ''}
            </p>
          )}
          <Textarea rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a reply…" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplying(null)}>Cancel</Button>
            <Button
              loading={replyMutation.isPending}
              onClick={async () => {
                if (!replying) return
                try {
                  await replyMutation.mutateAsync({ id: replying.id, adminReply: draft })
                  toast({ title: 'Reply posted' })
                  setReplying(null)
                } catch (err) {
                  toast({ title: 'Could not post reply', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
                }
              }}
            >
              Post reply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

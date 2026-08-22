import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { CheckCircle2, MoreHorizontal, Pencil, Star, Trash2, XCircle } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { DataTable } from '@/components/ui/data-table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/use-toast'
import {
  useDeleteReview,
  useReviews,
  useUpdateReviewContent,
  useUpdateReviewStatus,
  type ReviewStatus,
} from '@/lib/api/reviews'
import { formatDate } from '@/lib/utils/format'

const STATUS_LABEL: Record<ReviewStatus, string> = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' }
const STATUS_VARIANT: Record<ReviewStatus, 'secondary' | 'success' | 'destructive'> = { pending: 'secondary', approved: 'success', rejected: 'destructive' }

interface ReviewRow {
  id: string
  productName: string
  customerName: string
  rating: number
  comment: string
  status: ReviewStatus
  createdAt: string
}

export default function ReviewsPage() {
  const [status, setStatus] = React.useState('all')
  const [rating, setRating] = React.useState('all')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)
  const [editing, setEditing] = React.useState<ReviewRow | null>(null)
  const [draft, setDraft] = React.useState('')

  const { data, isLoading, isError, refetch } = useReviews({
    page,
    limit: pageSize,
    status: status === 'all' ? undefined : (status as ReviewStatus),
    rating: rating === 'all' ? undefined : Number(rating),
  })
  const updateStatus = useUpdateReviewStatus()
  const updateContent = useUpdateReviewContent()
  const deleteMutation = useDeleteReview()
  const confirmDialog = useConfirmDialog()

  const columns: ColumnDef<ReviewRow>[] = [
    { accessorKey: 'productName', header: 'Product', cell: ({ row }) => <span className="font-medium text-foreground">{row.original.productName}</span> },
    { accessorKey: 'customerName', header: 'Customer' },
    { id: 'rating', header: 'Rating', cell: ({ row }) => (
      <span className="inline-flex items-center gap-0.5">
        {row.original.rating}
        <Star className="size-3.5 fill-current text-warning" />
      </span>
    ) },
    { accessorKey: 'comment', header: 'Comment', cell: ({ row }) => <span className="line-clamp-1 max-w-64 text-muted-foreground">{row.original.comment}</span> },
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
            {row.original.status !== 'approved' && (
              <DropdownMenuItem onClick={() => updateStatus.mutate({ id: row.original.id, status: 'approved' })}>
                <CheckCircle2 /> Approve
              </DropdownMenuItem>
            )}
            {row.original.status !== 'rejected' && (
              <DropdownMenuItem onClick={() => updateStatus.mutate({ id: row.original.id, status: 'rejected' })}>
                <XCircle /> Reject
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => { setEditing(row.original); setDraft(row.original.comment) }}>
              <Pencil /> Edit content
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() =>
                confirmDialog.confirm(async () => {
                  try {
                    await deleteMutation.mutateAsync(row.original.id)
                    toast({ title: 'Review removed' })
                  } catch (err) {
                    toast({ title: 'Could not remove review', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
                  }
                })
              }
            >
              <Trash2 /> Remove
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
        data={(data?.data ?? []) as ReviewRow[]}
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

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit review</DialogTitle></DialogHeader>
          <Textarea rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              loading={updateContent.isPending}
              onClick={async () => {
                if (!editing) return
                try {
                  await updateContent.mutateAsync({ id: editing.id, comment: draft })
                  toast({ title: 'Review updated' })
                  setEditing(null)
                } catch (err) {
                  toast({ title: 'Could not update review', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
                }
              }}
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={confirmDialog.setOpen}
        title="Remove this review?"
        description="This cannot be undone."
        confirmLabel="Remove"
        loading={confirmDialog.pending}
        onConfirm={confirmDialog.handleConfirm}
      />
    </div>
  )
}

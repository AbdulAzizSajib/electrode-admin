import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import {
  CheckCircle2,
  EyeOff,
  MessageSquareReply,
  MoreHorizontal,
  Pencil,
  Plus,
  Star,
  Trash2,
  XCircle,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Combobox } from '@/components/ui/combobox'
import { DataTable } from '@/components/ui/data-table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/use-toast'
import {
  useCreateAdminReview,
  useDeleteReview,
  useReplyToReview,
  useReviews,
  useUpdateAdminReview,
  useUpdateReviewStatus,
  type Review,
  type ReviewStatus,
} from '@/lib/api/reviews'
import { useProducts } from '@/lib/api/products'
import { formatDate } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'

const STATUS_LABEL: Record<ReviewStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  HIDDEN: 'Hidden',
}

const STATUS_VARIANT: Record<ReviewStatus, 'secondary' | 'success' | 'destructive' | 'outline'> = {
  PENDING: 'secondary',
  APPROVED: 'success',
  REJECTED: 'destructive',
  HIDDEN: 'outline',
}

function getReviewerName(review: Review): string {
  const custom = review.authorName?.trim()
  if (custom) return custom
  if (review.customer) {
    const full = [review.customer.firstName, review.customer.lastName].filter(Boolean).join(' ').trim()
    if (full) return full
  }
  return '—'
}

function toDatetimeLocalValue(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface ReviewFormState {
  productId: string
  authorName: string
  rating: number
  status: ReviewStatus
  title: string
  comment: string
  createdAt: string
}

const DEFAULT_FORM_STATE: ReviewFormState = {
  productId: '',
  authorName: '',
  rating: 5,
  status: 'APPROVED',
  title: '',
  comment: '',
  createdAt: '',
}

export default function ReviewsPage() {
  const [status, setStatus] = React.useState('all')
  const [rating, setRating] = React.useState('all')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  // Reply dialog state
  const [replying, setReplying] = React.useState<Review | null>(null)
  const [draft, setDraft] = React.useState('')

  // Create / Edit dialog state
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingReview, setEditingReview] = React.useState<Review | null>(null)
  const [form, setForm] = React.useState<ReviewFormState>(DEFAULT_FORM_STATE)
  const [formError, setFormError] = React.useState<string | null>(null)

  // Delete confirmation dialog state
  const [deleting, setDeleting] = React.useState<Review | null>(null)

  const { data, isLoading, isError, refetch } = useReviews({
    page,
    limit: pageSize,
    status: status === 'all' ? undefined : (status as ReviewStatus),
    rating: rating === 'all' ? undefined : Number(rating),
  })

  const productsQuery = useProducts({ limit: 100 })
  const products = productsQuery.data?.data ?? []

  const updateStatus = useUpdateReviewStatus()
  const replyMutation = useReplyToReview()
  const createMutation = useCreateAdminReview()
  const updateMutation = useUpdateAdminReview()
  const deleteMutation = useDeleteReview()

  const openCreateDialog = () => {
    setEditingReview(null)
    setForm(DEFAULT_FORM_STATE)
    setFormError(null)
    setFormOpen(true)
  }

  const openEditDialog = (review: Review) => {
    setEditingReview(review)
    setForm({
      productId: review.productId,
      authorName: getReviewerName(review) === '—' ? '' : getReviewerName(review),
      rating: review.rating,
      status: review.status,
      title: review.title ?? '',
      comment: review.comment ?? '',
      createdAt: toDatetimeLocalValue(review.createdAt),
    })
    setFormError(null)
    setFormOpen(true)
  }

  const handleSaveReview = async () => {
    setFormError(null)

    if (!form.productId) {
      setFormError('Please select a product.')
      return
    }
    if (!form.authorName.trim()) {
      setFormError('Please enter a reviewer name.')
      return
    }

    const isoCreatedAt = form.createdAt ? new Date(form.createdAt).toISOString() : undefined

    try {
      if (editingReview) {
        await updateMutation.mutateAsync({
          id: editingReview.id,
          input: {
            productId: form.productId,
            authorName: form.authorName.trim(),
            rating: form.rating,
            status: form.status,
            title: form.title.trim() || null,
            comment: form.comment.trim() || null,
            ...(isoCreatedAt ? { createdAt: isoCreatedAt } : {}),
          },
        })
        toast({ title: 'Review updated' })
      } else {
        await createMutation.mutateAsync({
          productId: form.productId,
          authorName: form.authorName.trim(),
          rating: form.rating,
          status: form.status,
          ...(form.title.trim() ? { title: form.title.trim() } : {}),
          ...(form.comment.trim() ? { comment: form.comment.trim() } : {}),
          ...(isoCreatedAt ? { createdAt: isoCreatedAt } : {}),
        })
        toast({ title: 'Review created' })
      }
      setFormOpen(false)
      setEditingReview(null)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save review.')
    }
  }

  const columns: ColumnDef<Review>[] = [
    {
      id: 'product',
      header: 'Product',
      cell: ({ row }) => <span className="font-medium text-foreground">{row.original.product?.name ?? '—'}</span>,
    },
    {
      id: 'customer',
      header: 'Customer',
      cell: ({ row }) => getReviewerName(row.original),
    },
    {
      id: 'rating',
      header: 'Rating',
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-0.5">
          {row.original.rating}
          <Star className="size-3.5 fill-current text-warning" />
        </span>
      ),
    },
    {
      accessorKey: 'comment',
      header: 'Comment',
      cell: ({ row }) => (
        <div className="max-w-64">
          {row.original.title && (
            <p className="truncate text-xs font-medium text-foreground">{row.original.title}</p>
          )}
          <span className="line-clamp-1 text-muted-foreground">{row.original.comment ?? '—'}</span>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={STATUS_VARIANT[row.original.status]}>{STATUS_LABEL[row.original.status]}</Badge>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Date',
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7">
              <MoreHorizontal className="size-4" />
            </Button>
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
            <DropdownMenuItem
              onClick={() => {
                setReplying(row.original)
                setDraft(row.original.adminReply ?? '')
              }}
            >
              <MessageSquareReply /> {row.original.adminReply ? 'Edit reply' : 'Reply'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => openEditDialog(row.original)}>
              <Pencil /> Edit review
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setDeleting(row.original)}
            >
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  const isSavingForm = createMutation.isPending || updateMutation.isPending

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Reviews"
        description="Moderate product reviews submitted by customers or add store reviews."
        actions={
          <Button onClick={openCreateDialog}>
            <Plus className="size-4" />
            Add review
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        emptyState={{ icon: Star, title: 'No reviews found' }}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v)
                setPage(1)
              }}
            >
              <SelectTrigger className="h-8 w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={rating}
              onValueChange={(v) => {
                setRating(v)
                setPage(1)
              }}
            >
              <SelectTrigger className="h-8 w-32">
                <SelectValue placeholder="Rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ratings</SelectItem>
                {[5, 4, 3, 2, 1].map((r) => (
                  <SelectItem key={r} value={String(r)}>
                    {r} stars
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
        page={page}
        pageSize={pageSize}
        total={data?.meta.total ?? 0}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(1)
        }}
      />

      {/* Create / Edit Review Dialog */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) {
            setFormOpen(false)
            setEditingReview(null)
            setFormError(null)
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingReview ? 'Edit review' : 'Add review'}</DialogTitle>
            <DialogDescription>
              {editingReview
                ? 'Update the review details, rating, or moderation status.'
                : 'Create a product review with a custom reviewer name.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="review-product">Product</Label>
              <Combobox
                id="review-product"
                placeholder="Select a product"
                searchPlaceholder="Search products…"
                aria-label="Product"
                options={products.map((p) => ({
                  value: p.id,
                  label: p.name,
                }))}
                value={form.productId || null}
                onValueChange={(next) => setForm((prev) => ({ ...prev, productId: next ?? '' }))}
                loading={productsQuery.isLoading}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="review-author">Reviewer name</Label>
              <Input
                id="review-author"
                placeholder="e.g. Rahim Uddin"
                value={form.authorName}
                onChange={(e) => setForm((prev) => ({ ...prev, authorName: e.target.value }))}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>Rating</Label>
                <div className="flex h-10 items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      aria-label={`${star} star${star > 1 ? 's' : ''}`}
                      onClick={() => setForm((prev) => ({ ...prev, rating: star }))}
                      className="rounded p-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Star
                        className={cn(
                          'size-5',
                          star <= form.rating
                            ? 'fill-current text-warning'
                            : 'text-muted-foreground/40',
                        )}
                      />
                    </button>
                  ))}
                  <span className="ml-1.5 text-sm font-medium text-muted-foreground">
                    {form.rating} / 5
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, status: v as ReviewStatus }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="review-date">Review date (optional)</Label>
              <Input
                id="review-date"
                type="datetime-local"
                value={form.createdAt}
                onChange={(e) => setForm((prev) => ({ ...prev, createdAt: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to use the current date and time.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="review-title">Title (optional)</Label>
              <Input
                id="review-title"
                placeholder="e.g. Great build quality and fast delivery"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="review-comment">Comment</Label>
              <Textarea
                id="review-comment"
                rows={4}
                placeholder="Write the customer review…"
                value={form.comment}
                onChange={(e) => setForm((prev) => ({ ...prev, comment: e.target.value }))}
              />
            </div>

            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setFormOpen(false)
                setEditingReview(null)
              }}
              disabled={isSavingForm}
            >
              Cancel
            </Button>
            <Button loading={isSavingForm} onClick={handleSaveReview}>
              {editingReview ? 'Save changes' : 'Create review'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reply Dialog */}
      <Dialog open={!!replying} onOpenChange={(open) => !open && setReplying(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reply to review</DialogTitle>
          </DialogHeader>
          {replying && (
            <p className="text-sm text-muted-foreground">
              "{replying.comment}" — {getReviewerName(replying)}
            </p>
          )}
          <Textarea
            rows={4}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a reply…"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplying(null)}>
              Cancel
            </Button>
            <Button
              loading={replyMutation.isPending}
              onClick={async () => {
                if (!replying) return
                try {
                  await replyMutation.mutateAsync({ id: replying.id, adminReply: draft })
                  toast({ title: 'Reply posted' })
                  setReplying(null)
                } catch (err) {
                  toast({
                    title: 'Could not post reply',
                    description: err instanceof Error ? err.message : undefined,
                    variant: 'destructive',
                  })
                }
              }}
            >
              Post reply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete review</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this review by{' '}
              <span className="font-medium text-foreground">
                {deleting ? getReviewerName(deleting) : ''}
              </span>
              ? The product's rating aggregate will be recalculated immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={deleteMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteMutation.isPending}
              onClick={async () => {
                if (!deleting) return
                try {
                  await deleteMutation.mutateAsync(deleting.id)
                  toast({ title: 'Review deleted' })
                  setDeleting(null)
                } catch (err) {
                  toast({
                    title: 'Could not delete review',
                    description: err instanceof Error ? err.message : undefined,
                    variant: 'destructive',
                  })
                }
              }}
            >
              Delete review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

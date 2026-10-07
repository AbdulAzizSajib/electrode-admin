import * as React from 'react'
import { Mail, Phone, ShoppingCart, Trash2, UserRound } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { SegmentedRadioGroup } from '@/components/ui/radio-group'
import { DataPagination } from '@/components/ui/pagination'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/use-toast'
import { useSessionStore } from '@/lib/store/session-store'
import { formatCurrency, formatRelativeTime } from '@/lib/utils/format'
import {
  GUEST_PURGE_AGE_DAYS,
  type AbandonedCart,
  type GuestPurgeAgeDays,
  useAbandonedCartSummary,
  useAbandonedCarts,
  useDeleteCarts,
  usePurgeCarts,
} from '@/lib/api/abandoned-carts'

/**
 * Carts shoppers filled and left — items untouched for 24 hours.
 *
 * CARDS, NOT A TABLE. A merchant following up on a cart is usually on a phone,
 * and a card shows who, how much and the number to call without sideways
 * scrolling (see server/openspec/changes/add-admin-mobile-shell). Customer carts
 * carry a `tel:` link; guest carts carry no contact because none exists.
 *
 * Every role may look. Selecting, deleting and purging are shown to OWNER and
 * ADMIN only — the backend refuses STAFF with 403 regardless, so this hides
 * what the API would reject rather than being the guard.
 *
 * See server/openspec/changes/add-abandoned-carts-admin.
 */
export default function AbandonedCartsPage() {
  const role = useSessionStore((s) => s.user?.role)
  const canDelete = role === 'OWNER' || role === 'ADMIN'

  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(20)
  const [selection, setSelection] = React.useState<string[]>([])
  const [purgeOpen, setPurgeOpen] = React.useState(false)

  const summary = useAbandonedCartSummary()
  const list = useAbandonedCarts({ page, limit: pageSize })
  const deleteMutation = useDeleteCarts()
  const confirmDialog = useConfirmDialog()

  const carts = list.data?.data ?? []
  const meta = list.data?.meta

  // A selection only ever names carts on screen: every page change clears it,
  // so a delete can never reach a cart the merchant is not looking at.
  const goToPage = (next: number) => {
    setSelection([])
    setPage(next)
  }

  const toggle = (id: string, checked: boolean) =>
    setSelection((current) => (checked ? [...current, id] : current.filter((x) => x !== id)))

  const deleteSelected = () =>
    confirmDialog.confirm(async () => {
      const count = selection.length
      try {
        const { deleted } = await deleteMutation.mutateAsync(selection)
        setSelection([])
        toast({
          title: `${deleted} ${deleted === 1 ? 'cart' : 'carts'} deleted`,
          description:
            deleted < count ? `${count - deleted} had already been removed.` : undefined,
        })
      } catch (err) {
        toast({
          title: 'Could not delete carts',
          description: err instanceof Error ? err.message : undefined,
          variant: 'destructive',
        })
      }
    })

  return (
    <div className="space-y-4">
      <PageHeader
        title="Abandoned Carts"
        description="Carts with items that nobody has touched for 24 hours."
        actions={
          canDelete ? (
            <Button variant="outline" onClick={() => setPurgeOpen(true)}>
              <Trash2 />
              Purge…
            </Button>
          ) : undefined
        }
      />

      <SummaryTiles query={summary} />

      {canDelete && selection.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
          <span className="text-sm">
            {selection.length} selected
          </span>
          <Button variant="ghost" size="sm" onClick={() => setSelection([])}>
            Clear
          </Button>
          <Button variant="destructive" size="sm" className="ml-auto" onClick={deleteSelected}>
            <Trash2 />
            Delete selected
          </Button>
        </div>
      )}

      {list.isError ? (
        <ErrorState onRetry={() => list.refetch()} />
      ) : list.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : carts.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title={page > 1 ? 'No carts on this page' : 'No abandoned carts'}
          description={
            page > 1
              ? 'Go back to the first page.'
              : 'Every cart with items has been touched in the last 24 hours.'
          }
          action={
            page > 1 ? (
              <Button variant="outline" onClick={() => goToPage(1)}>
                First page
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-3">
          {carts.map((cart) => (
            <li key={cart.id}>
              <CartCard
                cart={cart}
                selectable={canDelete}
                selected={selection.includes(cart.id)}
                onSelectedChange={(checked) => toggle(cart.id, checked)}
              />
            </li>
          ))}
        </ul>
      )}

      {meta && meta.total > 0 && (
        <DataPagination
          page={meta.page}
          pageCount={meta.totalPages}
          pageSize={pageSize}
          total={meta.total}
          onPageChange={goToPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            goToPage(1)
          }}
          pageSizeOptions={[10, 20, 50]}
        />
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={confirmDialog.setOpen}
        title={`Delete ${selection.length} ${selection.length === 1 ? 'cart' : 'carts'}?`}
        description="Their items are removed with them. A shopper who comes back simply finds an empty cart. This cannot be undone."
        confirmLabel="Delete"
        loading={confirmDialog.pending}
        onConfirm={confirmDialog.handleConfirm}
      />

      {canDelete && <PurgeDialog open={purgeOpen} onOpenChange={setPurgeOpen} />}
    </div>
  )
}

function SummaryTiles({ query }: { query: ReturnType<typeof useAbandonedCartSummary> }) {
  if (query.isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    )
  }
  if (!query.data) return null

  const { total, customer, guest, value } = query.data
  const tiles = [
    { label: 'Abandoned carts', value: String(total) },
    { label: 'Total value', value: formatCurrency(value) },
    { label: 'Customers', value: String(customer), hint: 'Can be contacted' },
    { label: 'Guests', value: String(guest), hint: 'No contact details' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((tile) => (
        <Card key={tile.label} className="p-4">
          <p className="text-xs text-muted-foreground">{tile.label}</p>
          <p className="mt-1 truncate text-xl font-semibold tabular-nums">{tile.value}</p>
          {tile.hint && <p className="mt-0.5 text-xs text-muted-foreground">{tile.hint}</p>}
        </Card>
      ))}
    </div>
  )
}

function CartCard({
  cart,
  selectable,
  selected,
  onSelectedChange,
}: {
  cart: AbandonedCart
  selectable: boolean
  selected: boolean
  onSelectedChange: (checked: boolean) => void
}) {
  const owner = cart.customer?.name || 'Guest'

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        {selectable && (
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelectedChange(checked === true)}
            aria-label={`Select ${owner}'s cart`}
            className="mt-1"
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="flex min-w-0 items-center gap-1.5 font-medium">
              <UserRound className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">{owner}</span>
            </p>
            <p className="text-base font-semibold tabular-nums">{formatCurrency(cart.total)}</p>
          </div>

          <p className="mt-0.5 text-xs text-muted-foreground">
            {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'} · last active{' '}
            {formatRelativeTime(cart.lastActivityAt)}
          </p>

          {cart.customer && (cart.customer.phone || cart.customer.email) && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {cart.customer.phone && (
                <a
                  href={`tel:${cart.customer.phone}`}
                  className="inline-flex items-center gap-1.5 text-primary hover:underline"
                >
                  <Phone className="size-3.5" aria-hidden />
                  {cart.customer.phone}
                </a>
              )}
              {cart.customer.email && (
                <a
                  href={`mailto:${cart.customer.email}`}
                  className="inline-flex min-w-0 items-center gap-1.5 text-primary hover:underline"
                >
                  <Mail className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{cart.customer.email}</span>
                </a>
              )}
            </div>
          )}

          {/* A native disclosure: keyboard and screen-reader behaviour for free. */}
          <details className="group mt-2">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              Show items
            </summary>
            <ul className="mt-2 divide-y divide-border rounded-md border border-border">
              {cart.items.map((item) => (
                <li
                  key={`${item.productId}:${item.variantId ?? ''}`}
                  className="flex items-start justify-between gap-3 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate">{item.name}</p>
                    {item.variantName && (
                      <p className="truncate text-xs text-muted-foreground">{item.variantName}</p>
                    )}
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {item.quantity} × {formatCurrency(item.unitPrice)}
                    </p>
                  </div>
                  <span className="shrink-0 tabular-nums">{formatCurrency(item.lineTotal)}</span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>
    </Card>
  )
}

function PurgeDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [days, setDays] = React.useState<GuestPurgeAgeDays>(30)
  const [guestCarts, setGuestCarts] = React.useState(true)
  const [emptyCarts, setEmptyCarts] = React.useState(true)
  const purge = usePurgeCarts()

  const nothingChosen = !guestCarts && !emptyCarts

  const run = async () => {
    try {
      const removed = await purge.mutateAsync({
        guestOlderThanDays: guestCarts ? days : undefined,
        emptyCarts: emptyCarts || undefined,
      })
      onOpenChange(false)
      toast({
        title: 'Carts purged',
        description: `${removed.guest} old guest ${removed.guest === 1 ? 'cart' : 'carts'} and ${removed.empty} empty ${removed.empty === 1 ? 'cart' : 'carts'} removed.`,
      })
    } catch (err) {
      toast({
        title: 'Could not purge carts',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !purge.isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Purge carts</DialogTitle>
          <DialogDescription>
            Removes carts nobody can come back to. A customer&apos;s cart that still holds items is
            never removed by a purge.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="purge-guest">Guest carts not touched for</Label>
              <Switch id="purge-guest" checked={guestCarts} onCheckedChange={setGuestCarts} />
            </div>
            <SegmentedRadioGroup
              aria-label="Guest cart age"
              value={String(days)}
              onValueChange={(value) => setDays(Number(value) as GuestPurgeAgeDays)}
              disabled={!guestCarts}
              options={GUEST_PURGE_AGE_DAYS.map((d) => ({ value: String(d), label: `${d} days` }))}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="purge-empty">
              Empty carts older than 24 hours
              <span className="block text-xs font-normal text-muted-foreground">
                Left behind by visitors and finished orders.
              </span>
            </Label>
            <Switch id="purge-empty" checked={emptyCarts} onCheckedChange={setEmptyCarts} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={purge.isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={run} loading={purge.isPending} disabled={nothingChosen}>
            Purge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

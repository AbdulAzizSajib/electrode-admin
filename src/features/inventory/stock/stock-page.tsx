import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { AlertTriangle, Boxes, SlidersHorizontal, Shuffle } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { DataTable } from '@/components/ui/data-table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { toast } from '@/components/ui/use-toast'
import { useStock, useAdjustStock, useReassignStockVariant, type StockRow } from '@/lib/api/stock'
import { useWarehouses } from '@/lib/api/warehouses'
import { useProduct, useProducts } from '@/lib/api/products'

const schema = z.object({
  delta: z.coerce.number().refine((v) => v !== 0, 'Enter a non-zero amount'),
  note: z.string().min(1, 'A note is required'),
})
type Values = z.input<typeof schema>
type OutputValues = z.output<typeof schema>

/*
 * Stock a customer order can never be filled from — held against a product that
 * has variants, but attributed to no variant — is diagnosed per row by
 * `VariantCell` below, which is the only place that knows how many variants a
 * product has. Orders deduct against the variant bought, so these units are
 * invisible to the storefront: the product reads out of stock however many are
 * on the shelf.
 */

/**
 * What variant a row is for — and, when it is for none, whether that is a
 * problem.
 *
 * A `variantId: null` row is perfectly normal for a simple product and unsellable
 * for a variable one, and the two are indistinguishable from `GET /stock` alone.
 * So a variantless row fetches its product to find out, and only the genuinely
 * stranded ones raise a flag. Products are cached per id by react-query, so a
 * page of rows sharing a product costs one request.
 *
 * `onDiagnosed` lifts the answer to the page, which uses it for the summary
 * banner and to decide which rows offer the repair action.
 */
function VariantCell({
  row,
  onDiagnosed,
}: {
  row: StockRow
  onDiagnosed: (stockId: string, stranded: boolean) => void
}) {
  // Only a variantless row needs the lookup; anything else already knows.
  const needsCheck = row.variantId === null
  const { data: product } = useProduct(needsCheck ? row.productId : undefined)

  const stranded = needsCheck && (product?.variants ?? []).length > 0

  React.useEffect(() => {
    if (needsCheck && product) onDiagnosed(row.id, stranded)
  }, [needsCheck, product, stranded, row.id, onDiagnosed])

  if (row.variant) {
    return <span className="text-foreground">{row.variant.name}</span>
  }

  if (stranded) {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="size-3" /> No variant
      </Badge>
    )
  }

  // Either a simple product, or the check has not landed yet.
  return <span className="text-muted-foreground">—</span>
}

/**
 * Moves stock onto the variant it actually belongs to.
 *
 * The variant list comes from the product's detail rather than the row: `GET
 * /stock` returns only the variant a row already has, which for the rows that
 * need this most is none at all.
 *
 * Quantity defaults to everything movable because the common case is a whole
 * receipt filed against no variant, but stays editable — one delivery can cover
 * several variants, and then this is run once per variant.
 */
function ReassignVariantDialog({ row, onClose }: { row: StockRow; onClose: () => void }) {
  const { data: product, isFetching } = useProduct(row.productId)
  const reassignMutation = useReassignStockVariant()

  const movable = row.quantity - row.reservedQuantity

  /*
   * Seeded at mount, not reset by an effect. The caller keys this component by
   * row id, so a different row is a different component instance with its own
   * fresh state — there is nothing to carry over and no cascading render.
   */
  const [variantId, setVariantId] = React.useState('')
  const [quantity, setQuantity] = React.useState(movable)
  const [error, setError] = React.useState<string | null>(null)

  const options = React.useMemo<ComboboxOption[]>(
    () =>
      (product?.variants ?? [])
        .filter((v): v is typeof v & { id: string } => !!v.id)
        // The row's current variant is not a destination — the backend rejects
        // a move onto where the stock already is.
        .filter((v) => v.id !== row.variantId)
        .map((v) => ({ value: v.id, label: v.name, keywords: v.sku })),
    [product, row],
  )

  const submit = async () => {
    if (!variantId) {
      setError('Choose the variant this stock belongs to.')
      return
    }
    if (quantity < 1 || quantity > movable) {
      setError(`Enter a quantity between 1 and ${movable}.`)
      return
    }
    try {
      await reassignMutation.mutateAsync({ id: row.id, variantId, quantity })
      toast({ title: 'Stock reassigned', description: 'The storefront can sell it now.' })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The stock could not be reassigned.')
    }
  }

  return (
    <Dialog open={!!row} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reassign variant — {row.product.name}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3.5">
          <p className="text-sm text-muted-foreground">
            Currently held against{' '}
            <span className="font-medium text-foreground">{row.variant?.name ?? 'no variant'}</span> at{' '}
            {row.warehouse.name}. Moving it does not change how much stock you have — only which
            variant customers can buy it as.
          </p>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">Correct variant</span>
            <Combobox
              aria-label="Correct variant"
              placeholder={isFetching ? 'Loading variants…' : 'Select a variant'}
              searchPlaceholder="Search by name or SKU…"
              options={options}
              value={variantId || null}
              loading={isFetching}
              noOptionsText="This product has no other variants"
              onValueChange={(value) => {
                setVariantId(value ?? '')
                setError(null)
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">Quantity to move</span>
            <Input
              type="number"
              min={1}
              max={movable}
              aria-label="Quantity to move"
              value={String(quantity)}
              onChange={(e) => {
                setQuantity(Number(e.target.value) || 0)
                setError(null)
              }}
            />
            <span className="text-xs text-muted-foreground">
              {movable} of {row.quantity} can be moved
              {row.reservedQuantity ? ` — ${row.reservedQuantity} reserved for existing orders` : ''}.
            </span>
          </div>

          {error && <Alert variant="destructive" title="This stock was not reassigned">{error}</Alert>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} loading={reassignMutation.isPending}>
            Move stock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function StockPage() {
  const [warehouseId, setWarehouseId] = React.useState('all')
  const [productId, setProductId] = React.useState('all')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)
  const [adjusting, setAdjusting] = React.useState<StockRow | null>(null)
  const [reassigning, setReassigning] = React.useState<StockRow | null>(null)
  /** Stock row id -> whether it holds unsellable, variantless stock. Filled in by the rows themselves. */
  const [strandedById, setStrandedById] = React.useState<Record<string, boolean>>({})
  const markStranded = React.useCallback((stockId: string, stranded: boolean) => {
    setStrandedById((prev) => (prev[stockId] === stranded ? prev : { ...prev, [stockId]: stranded }))
  }, [])

  const { data, isLoading, isError, refetch } = useStock({
    page,
    limit: pageSize,
    warehouseId: warehouseId === 'all' ? undefined : warehouseId,
    productId: productId === 'all' ? undefined : productId,
  })
  const { data: warehousesData } = useWarehouses()
  const { data: productsData } = useProducts({ limit: 200 })
  const adjustMutation = useAdjustStock()

  const form = useForm<Values, unknown, OutputValues>({ resolver: zodResolver(schema), defaultValues: { delta: 0, note: '' } })

  const onSubmit = async (values: OutputValues) => {
    if (!adjusting) return
    try {
      await adjustMutation.mutateAsync({ id: adjusting.id, quantityDelta: values.delta, note: values.note })
      toast({ title: 'Stock adjusted' })
      setAdjusting(null)
      form.reset({ delta: 0, note: '' })
    } catch (err) {
      toast({ title: 'Could not adjust stock', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }

  // Counted over the rows actually on screen, which is what the flags describe.
  const strandedCount = (data?.data ?? []).filter((row) => strandedById[row.id]).length

  const columns: ColumnDef<StockRow>[] = [
    { id: 'product', header: 'Product', cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-medium text-foreground">{row.original.product.name}</span>
        <span className="text-xs text-muted-foreground">{row.original.product.sku}</span>
      </div>
    ) },
    {
      id: 'variant',
      header: 'Variant',
      cell: ({ row }) => <VariantCell row={row.original} onDiagnosed={markStranded} />,
    },
    { id: 'warehouse', header: 'Warehouse', cell: ({ row }) => row.original.warehouse.name },
    { accessorKey: 'quantity', header: 'On hand' },
    { accessorKey: 'reservedQuantity', header: 'Reserved' },
    { accessorKey: 'available', header: 'Available', cell: ({ row }) => <span className="font-medium">{row.original.available}</span> },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          {/* Offered on any row with stock to move, but led with on the stranded
              ones — for those it is the only thing that makes the stock sellable. */}
          {strandedById[row.original.id] && (
            <Button variant="default" size="lg" onClick={() => setReassigning(row.original)}>
              <Shuffle /> Fix variant
            </Button>
          )}
          <Button variant="outline" size="lg" onClick={() => setAdjusting(row.original)}>
            <SlidersHorizontal /> Adjust
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Stock" description="Quantity on hand across your warehouses." />

      {/*
       * Named plainly, because the symptom a merchant actually notices is
       * "my product says out of stock" and nothing so far connected that to
       * these rows.
       */}
      {strandedCount > 0 && (
        <Alert variant="warning" title={`${strandedCount} stock row${strandedCount === 1 ? '' : 's'} cannot be sold`}>
          This stock is held against a product that has variants, but is not assigned to any of them.
          Customers buy a specific variant, so the storefront shows these products as out of stock
          however many units are on the shelf. Use <span className="font-medium">Fix variant</span> on
          each flagged row to move the stock onto the variant it belongs to — the quantity does not
          change.
        </Alert>
      )}

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        emptyState={{ icon: Boxes, title: 'No stock records found' }}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={productId}
              onValueChange={(v) => {
                setProductId(v)
                setPage(1)
              }}
            >
              <SelectTrigger className="h-8 w-52">
                <SelectValue placeholder="Product" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All products</SelectItem>
                {productsData?.data.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={warehouseId}
              onValueChange={(v) => {
                setWarehouseId(v)
                setPage(1)
              }}
            >
              <SelectTrigger className="h-8 w-44">
                <SelectValue placeholder="Warehouse" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All warehouses</SelectItem>
                {warehousesData?.data.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
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

      {/* Keyed by row so each correction starts from that row's own numbers,
          and unmounted between them so nothing carries over. */}
      {reassigning && (
        <ReassignVariantDialog
          key={reassigning.id}
          row={reassigning}
          onClose={() => setReassigning(null)}
        />
      )}

      <Dialog open={!!adjusting} onOpenChange={(open) => !open && setAdjusting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust stock — {adjusting?.product.name}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
              <FormField
                control={form.control}
                name="delta"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity change (use negative to remove)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} value={field.value === undefined ? '' : String(field.value)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. cycle count correction" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAdjusting(null)}>
                  Cancel
                </Button>
                <Button type="submit" loading={form.formState.isSubmitting}>
                  Save adjustment
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

import * as React from 'react'
import { useNavigate, useParams } from 'react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm } from 'react-hook-form'
import { z } from 'zod'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { useBreadcrumbLabel } from '@/components/layout/breadcrumb-context'
import { useSuppliers } from '@/lib/api/suppliers'
import { useProduct, useProducts } from '@/lib/api/products'
import {
  useAmendPurchaseOrderItems,
  useCreatePurchaseOrder,
  usePurchaseOrder,
  useUpdatePurchaseOrder,
  type PurchaseOrder,
  type PurchaseOrderCreateInput,
  type PurchaseOrderStatus,
  type PurchaseOrderUpdateInput,
} from '@/lib/api/purchase-orders'
import { formatCurrency } from '@/lib/utils/format'

const LIST_PATH = '/inventory/purchase-orders'

// Same labels and tones the detail page and the listing use, so one purchase
// order does not describe itself three different ways.
const STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'Draft',
  ORDERED: 'Ordered',
  PARTIALLY_RECEIVED: 'Partially received',
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
}
const STATUS_VARIANT: Record<PurchaseOrderStatus, 'secondary' | 'info' | 'warning' | 'success' | 'destructive'> = {
  DRAFT: 'secondary',
  ORDERED: 'info',
  PARTIALLY_RECEIVED: 'warning',
  RECEIVED: 'success',
  CANCELLED: 'destructive',
}

/**
 * The three the backend's PATCH accepts. Once stock has been received against a
 * purchase order its status is a consequence of the receipts, and offering it
 * here would let a form that never knew about them write it back.
 */
const EDITABLE_STATUSES = ['DRAFT', 'ORDERED', 'CANCELLED'] as const
type EditableStatus = (typeof EDITABLE_STATUSES)[number]
const isEditableStatus = (status: PurchaseOrderStatus): status is EditableStatus =>
  (EDITABLE_STATUSES as readonly string[]).includes(status)

// Only supplier + line items are create-only (the backend's PATCH doesn't accept them at all —
// see design.md). Kept in one schema so the form only needs one `useForm` instance; onSubmit picks
// which subset to actually send based on isEdit.
const schema = z.object({
  supplierId: z.string().min(1, 'Select a supplier'),
  notes: z.string().optional(),
  shippingCost: z.coerce.number().min(0, 'Cannot be negative').optional(),
  taxAmount: z.coerce.number().min(0, 'Cannot be negative').optional(),
  status: z.enum(EDITABLE_STATUSES),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, 'Select a product'),
        /**
         * Which variant the line replenishes. Empty for a simple product; a
         * variable product's line is rejected below until one is chosen,
         * because stock is held per (warehouse, product, variant) and orders
         * deduct against the variant bought — stock received against no variant
         * leaves every variant reading out of stock however much arrived.
         */
        variantId: z.string().optional(),
        quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
        unitCost: z.coerce.number().min(0, 'Cost cannot be negative'),
      }),
    )
    .min(1, 'Add at least one line item'),
})
type Values = z.input<typeof schema>
type OutputValues = z.output<typeof schema>

/**
 * A number input under the pointer treats the wheel as a value change. On a page
 * that is mostly money and quantities, scrolling the list would silently rewrite
 * whichever field the cursor happened to be over.
 */
const blurOnWheel = (event: React.WheelEvent<HTMLInputElement>) => event.currentTarget.blur()

/**
 * The variant picker for one line, and the only place the form learns whether a
 * product even has variants.
 *
 * It fetches the product's detail rather than reading the row already in the
 * combobox: `GET /products/admin` omits `variants` entirely (see products.ts),
 * so the list the picker is populated from cannot answer this. One query per
 * distinct product, cached and shared by react-query, and only while a row
 * actually holds a product.
 *
 * `onResolved` reports back what arrived so the parent can validate the line —
 * a variable product whose line names no variant is the bug this whole field
 * exists to prevent, and the parent cannot see it from `productId` alone.
 */
function VariantCell({
  control,
  index,
  productId,
  lineLabel,
  onResolved,
}: {
  control: ReturnType<typeof useForm<Values, unknown, OutputValues>>['control']
  index: number
  productId: string
  lineLabel: string
  onResolved: (productId: string, variantIds: string[]) => void
}) {
  const { data: product, isFetching } = useProduct(productId || undefined)
  const variants = React.useMemo(() => product?.variants ?? [], [product])

  React.useEffect(() => {
    if (product) onResolved(productId, variants.map((v) => v.id).filter((id): id is string => !!id))
  }, [product, productId, variants, onResolved])

  const options = React.useMemo<ComboboxOption[]>(
    () =>
      variants
        .filter((v): v is typeof v & { id: string } => !!v.id)
        // SKU as keywords: the packing slip in the merchant's hand names the
        // variant by SKU more often than by label.
        .map((v) => ({ value: v.id, label: v.name, keywords: v.sku })),
    [variants],
  )

  if (!productId) {
    return <span className="text-xs text-muted-foreground">Select a product first</span>
  }

  if (isFetching && !product) {
    return <Skeleton className="h-9 w-full" />
  }

  // A simple product has nothing to choose between, and the backend wants the
  // field absent rather than empty for one.
  if (options.length === 0) {
    return <span className="text-xs text-muted-foreground">No variants</span>
  }

  return (
    <FormField
      control={control}
      name={`items.${index}.variantId`}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Combobox
              aria-label={`Variant for ${lineLabel}`}
              placeholder="Select a variant"
              searchPlaceholder="Search by name or SKU…"
              options={options}
              value={field.value || null}
              noOptionsText="No variants"
              onValueChange={(value) => field.onChange(value ?? '')}
              onBlur={field.onBlur}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

/**
 * Loads the record and owns every path the form itself cannot be on: still
 * arriving, refused, gone.
 *
 * The form is a separate component below, mounted only once there is something
 * to put in it. That is not tidiness — react-hook-form's `values` prop resets
 * the form after mount, and Radix's `Select` answers a programmatic value change
 * by writing it into a hidden native `<select>` and dispatching `change`. Until
 * that select has its options, the value it reads back is `''`, and the status
 * field clears itself the moment the purchase order arrives. Handing the form
 * its values as `defaultValues` at mount means there is no reset to mirror.
 */
export default function PurchaseOrderFormPage() {
  const { poId } = useParams()
  const isEdit = !!poId
  const navigate = useNavigate()

  const { data: po, isLoading: loadingPo, error: loadError } = usePurchaseOrder(poId)

  useBreadcrumbLabel(isEdit ? (po ? `Edit ${po.purchaseNumber}` : 'Edit purchase order') : 'New purchase order')

  if (isEdit && loadingPo) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-56" />
        {/* Same 8/4 split as the loaded form, so nothing reflows when the record arrives. */}
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
          <Skeleton className="h-80 w-full xl:col-span-8" />
          <Skeleton className="h-64 w-full xl:col-span-4" />
        </div>
      </div>
    )
  }

  /*
   * A record that will not load must not fall through to an empty form: every
   * field would read as blank, and saving would write those blanks over a real
   * purchase order's notes and status.
   */
  if (isEdit && (loadError || !po)) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Edit purchase order" />
        {loadError ? (
          <Alert variant="destructive" title="This purchase order could not be opened">
            {loadError instanceof Error ? loadError.message : 'The request did not complete.'}
          </Alert>
        ) : (
          <EmptyState
            title="Purchase order not found"
            description="It may have been deleted since this link was opened."
          />
        )}
        <div>
          <Button variant="outline" onClick={() => navigate(LIST_PATH)}>
            <ArrowLeft /> Back to purchase orders
          </Button>
        </div>
      </div>
    )
  }

  return <PurchaseOrderForm po={isEdit ? po : undefined} />
}

function PurchaseOrderForm({ po }: { po?: PurchaseOrder }) {
  const isEdit = !!po
  const navigate = useNavigate()

  const { data: suppliersData, isLoading: loadingSuppliers } = useSuppliers()
  const createMutation = useCreatePurchaseOrder()
  const updateMutation = useUpdatePurchaseOrder()
  const amendMutation = useAmendPurchaseOrderItems()

  /** The scalar endpoint refuses every edit once receiving has begun. */
  const statusIsEditable = !po || isEditableStatus(po.status)

  /*
   * Line items stay amendable after a partial receipt — that is the whole point
   * of the separate endpoint. Only a cancelled order is closed to it, and a
   * received quantity is immutable within it (the backend refuses a reduction
   * below what arrived, and the row shows what has landed).
   */
  const canAmendItems = !!po && po.status !== 'CANCELLED'

  /*
   * The product list is searched on the server rather than filtered in the
   * browser: a page of options large enough to hold this merchant's whole
   * catalogue is both slow to ship and still a ceiling. Only one picker can be
   * open at a time, so a single term serves every row.
   */
  const [productTerm, setProductTerm] = React.useState('')
  const [pickedProducts, setPickedProducts] = React.useState<ComboboxOption[]>([])
  const { data: productsData, isFetching: fetchingProducts } = useProducts({
    limit: 50,
    search: productTerm || undefined,
  })

  const [saveError, setSaveError] = React.useState<string | null>(null)
  /*
   * Which variant ids each picked product owns, filled in by the rows' variant
   * pickers as their fetches land. Submit reads it to refuse a variable
   * product's line that names no variant — the one mistake this form used to
   * let through silently, and whose only symptom was a product that stayed out
   * of stock after its stock arrived.
   */
  const [variantIdsByProduct, setVariantIdsByProduct] = React.useState<Record<string, string[]>>({})
  const rememberVariants = React.useCallback((productId: string, variantIds: string[]) => {
    setVariantIdsByProduct((prev) =>
      prev[productId]?.length === variantIds.length && prev[productId]?.every((id, i) => id === variantIds[i])
        ? prev
        : { ...prev, [productId]: variantIds },
    )
  }, [])
  // Index of a row appended by "Add item", so the keyboard lands in it instead
  // of leaving the merchant to reach for the mouse on every line.
  const [focusRow, setFocusRow] = React.useState<number | null>(null)

  const form = useForm<Values, unknown, OutputValues>({
    resolver: zodResolver(schema),
    defaultValues: po
      ? {
          supplierId: po.supplierId,
          notes: po.notes ?? '',
          shippingCost: Number(po.shippingCost),
          taxAmount: Number(po.taxAmount),
          // A received purchase order has no editable status; the field below is
          // rendered read-only in that case and onSubmit leaves it out entirely.
          status: isEditableStatus(po.status) ? po.status : 'DRAFT',
          items: po.items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId ?? undefined,
            quantity: i.quantity,
            unitCost: Number(i.unitCost),
          })),
        }
      : {
          supplierId: '',
          notes: '',
          shippingCost: undefined,
          taxAmount: undefined,
          status: 'DRAFT',
          items: [{ productId: '', variantId: undefined, quantity: 1, unitCost: 0 }],
        },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' })
  const watchedItems = form.watch('items')
  const watchedShipping = form.watch('shippingCost')
  const watchedTax = form.watch('taxAmount')

  const supplierOptions = React.useMemo<ComboboxOption[]>(
    () =>
      (suppliersData?.data ?? []).map((s) => ({
        value: s.id,
        label: s.name,
        // So the merchant can find a supplier by the company on the invoice.
        keywords: s.companyName ?? undefined,
      })),
    [suppliersData],
  )

  const productOptions = React.useMemo<ComboboxOption[]>(() => {
    // No `keywords`: matching is the server's, which already covers name and SKU.
    const fetched = (productsData?.data ?? []).map((p) => ({ value: p.id, label: p.name }))
    const ids = new Set(fetched.map((option) => option.value))
    // A product already on a row stays in the list even once the search has
    // moved past it — otherwise its row would go back to reading as empty.
    return [...fetched, ...pickedProducts.filter((option) => !ids.has(option.value))]
  }, [productsData, pickedProducts])

  const rememberProduct = (id: string | null) => {
    const option = productOptions.find((o) => o.value === id)
    if (!option) return
    setPickedProducts((prev) => (prev.some((p) => p.value === option.value) ? prev : [...prev, option]))
  }

  const lineAmount = (index: number) => {
    const item = watchedItems?.[index]
    return (Number(item?.quantity) || 0) * (Number(item?.unitCost) || 0)
  }
  /** Names a row's controls by its product once one is chosen, by position until then. */
  const lineName = (index: number) =>
    productOptions.find((o) => o.value === watchedItems?.[index]?.productId)?.label ?? `line ${index + 1}`

  const subtotal = watchedItems.reduce((sum, _item, index) => sum + lineAmount(index), 0)
  const shipping = Number(watchedShipping) || 0
  const tax = Number(watchedTax) || 0
  const total = subtotal + shipping + tax

  const addItem = () => {
    setFocusRow(fields.length)
    append({ productId: '', variantId: undefined, quantity: 1, unitCost: 0 })
  }

  const onSubmit = async (values: OutputValues) => {
    setSaveError(null)
    try {
      if (po) {
        /*
         * Line items go to their own endpoint. PATCH /:id owns the scalar
         * fields and refuses any edit once receiving has begun; the items
         * endpoint is the opposite shape — it stays available after a partial
         * receipt, because what it may change is precisely what has not yet
         * arrived. Sent first: if the amendment is refused, the scalar update
         * must not land on its own and report success.
         */
        if (canAmendItems) {
          const changed =
            values.items.length !== po.items.length ||
            values.items.some((item, index) => {
              const original = po.items[index]
              return (
                !original ||
                item.productId !== original.productId ||
                (item.variantId || undefined) !== (original.variantId ?? undefined) ||
                item.quantity !== original.quantity ||
                item.unitCost !== Number(original.unitCost)
              )
            })

          if (changed) {
            await amendMutation.mutateAsync({
              id: po.id,
              input: {
                items: values.items.map((item, index) => ({
                  // An id marks an existing line; its absence adds one.
                  id: po.items[index]?.id,
                  productId: item.productId,
                  variantId: item.variantId || undefined,
                  quantity: item.quantity,
                  unitCost: item.unitCost,
                })),
              },
            })
          }
        }

        // The scalar endpoint refuses every edit once receiving has begun, so
        // sending it for such an order would fail the whole save even though
        // the line amendment above succeeded.
        if (statusIsEditable) {
          const input: PurchaseOrderUpdateInput = {
            shippingCost: values.shippingCost,
            taxAmount: values.taxAmount,
            notes: values.notes,
            // Omitted for a received or partially received order: the form never
            // offered its real status, so it must not write one back.
            status: isEditableStatus(po.status) ? values.status : undefined,
          }
          await updateMutation.mutateAsync({ id: po.id, input })
        }

        toast({ title: 'Purchase order updated' })
        navigate(`${LIST_PATH}/${po.id}`)
      } else {
        /*
         * A line on a product that has variants must name one. Enforced here
         * rather than in the schema because whether a product is variable is
         * not in the form's values — it arrives with the product detail the
         * rows fetch. The message is attached to the row's own field so it
         * appears under the picker that has to be filled in.
         */
        let missingVariant = false
        values.items.forEach((item, index) => {
          const variantIds = variantIdsByProduct[item.productId]
          if (variantIds?.length && !item.variantId) {
            missingVariant = true
            form.setError(`items.${index}.variantId`, {
              type: 'manual',
              message: 'Choose which variant this line is for',
            })
          }
        })
        if (missingVariant) {
          setSaveError(
            'Every line for a product with variants must say which variant it is for — otherwise the stock arrives against no variant and the product still reads as out of stock.',
          )
          return
        }

        const input: PurchaseOrderCreateInput = {
          supplierId: values.supplierId,
          items: values.items.map((item) => ({
            productId: item.productId,
            // Omitted, not empty-string, for a simple product.
            variantId: item.variantId || undefined,
            quantity: item.quantity,
            unitCost: item.unitCost,
          })),
          shippingCost: values.shippingCost,
          taxAmount: values.taxAmount,
          notes: values.notes,
        }
        const created = await createMutation.mutateAsync(input)
        toast({ title: 'Purchase order created' })
        navigate(`${LIST_PATH}/${created.id}`)
      }
    } catch (err) {
      // Kept on the page rather than in a toast: the submit button sits below a
      // list that can run past a screen, and a reason that disappears on its own
      // is one the merchant has to reproduce to read.
      setSaveError(err instanceof Error ? err.message : 'The purchase order could not be saved.')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={po ? 'Edit purchase order' : 'New purchase order'}
        description={po ? po.purchaseNumber : 'Order stock from a supplier. Receiving it into a warehouse comes later.'}
      />

      <Form {...form}>
        {/*
         * Line items lead the page — they are the bulk of the typing and the only part that grows
         * row by row, so they take 8 of the 12 columns and details ride alongside in the remaining
         * 4. The split waits for xl because the shell's 19rem sidebar leaves a 4-column rail too
         * narrow for a supplier name below that; under it the two cards stack in reading order.
         */}
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
          {saveError && (
            <Alert
              variant="destructive"
              title="This purchase order was not saved"
              onDismiss={() => setSaveError(null)}
              className="xl:col-span-12"
            >
              {saveError}
            </Alert>
          )}

          <Card className="xl:col-span-8">
            <CardHeader className={isEdit && !canAmendItems ? undefined : 'flex-row items-center justify-between space-y-0'}>
              <CardTitle>Line items</CardTitle>
              {isEdit && !canAmendItems ? (
                <CardDescription>A cancelled purchase order's line items can't be changed.</CardDescription>
              ) : (
                <Button type="button" size="sm" variant="outline" onClick={addItem}>
                  <Plus /> Add item
                </Button>
              )}
            </CardHeader>

            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-48">Product</TableHead>
                    <TableHead className="min-w-44">Variant</TableHead>
                    <TableHead className="w-20">Qty</TableHead>
                    <TableHead className="w-28">Unit cost</TableHead>
                    {/* Only on an existing order, and read-only: a received
                        quantity moved real stock and set a cost basis, so the
                        backend refuses to amend a line below it. */}
                    {isEdit && <TableHead className="w-24">Received</TableHead>}
                    <TableHead className="w-28 text-right">Amount</TableHead>
                    {canAmendItems || !isEdit ? <TableHead className="w-10" /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isEdit && !canAmendItems
                    ? po?.items.map((item) => (
                        <TableRow key={item.id} className="hover:bg-transparent">
                          <TableCell className="font-medium text-foreground">{item.product.name}</TableCell>
                          <TableCell className="text-muted-foreground">{item.variant?.name ?? '—'}</TableCell>
                          <TableCell className="tabular-nums">{item.quantity}</TableCell>
                          <TableCell className="tabular-nums">{formatCurrency(Number(item.unitCost))}</TableCell>
                          <TableCell className="tabular-nums">{item.receivedQuantity}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(Number(item.totalCost))}</TableCell>
                        </TableRow>
                      ))
                    : fields.map((field, index) => (
                        <TableRow key={field.id} className="hover:bg-transparent">
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`items.${index}.productId`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Combobox
                                      // The header names the column once; each control
                                      // still needs its own name out of context.
                                      aria-label={`Product for ${lineName(index)}`}
                                      placeholder="Select a product"
                                      searchPlaceholder="Search by name or SKU…"
                                      options={productOptions}
                                      value={field.value || null}
                                      loading={fetchingProducts}
                                      noOptionsText="No products yet"
                                      // The server has already narrowed the list.
                                      filter={false}
                                      onSearchChange={setProductTerm}
                                      onValueChange={(value) => {
                                        field.onChange(value ?? '')
                                        rememberProduct(value)
                                        // The old choice belongs to the product
                                        // being replaced; left in place it would
                                        // submit a variant of a different product,
                                        // which the backend rejects outright.
                                        form.setValue(`items.${index}.variantId`, undefined)
                                        form.clearErrors(`items.${index}.variantId`)
                                      }}
                                      onBlur={field.onBlur}
                                      // Focus lands here on the row "Add item" just made,
                                      // then the marker is cleared so later renders
                                      // don't steal focus back.
                                      ref={(node) => {
                                        if (node && focusRow === index) {
                                          node.focus()
                                          setFocusRow(null)
                                        }
                                      }}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <VariantCell
                              control={form.control}
                              index={index}
                              productId={watchedItems?.[index]?.productId ?? ''}
                              lineLabel={lineName(index)}
                              onResolved={rememberVariants}
                            />
                          </TableCell>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`items.${index}.quantity`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      // Never below what has already arrived: the
                                      // backend refuses it, and the stepper should
                                      // not offer a value that will be rejected.
                                      min={Math.max(1, po?.items[index]?.receivedQuantity ?? 0)}
                                      inputMode="numeric"
                                      className="tabular-nums"
                                      aria-label={`Quantity for ${lineName(index)}`}
                                      onWheel={blurOnWheel}
                                      {...field}
                                      value={field.value === undefined ? '' : String(field.value)}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`items.${index}.unitCost`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      inputMode="decimal"
                                      className="tabular-nums"
                                      aria-label={`Unit cost for ${lineName(index)}`}
                                      onWheel={blurOnWheel}
                                      {...field}
                                      value={field.value === undefined ? '' : String(field.value)}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          {isEdit && (
                            <TableCell className="tabular-nums text-muted-foreground">
                              {po?.items[index]?.receivedQuantity ?? 0}
                            </TableCell>
                          )}
                          <TableCell className="text-right tabular-nums text-foreground">
                            {formatCurrency(lineAmount(index))}
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              // A line that has received stock cannot be removed:
                              // the receipt moved real goods and set a cost basis.
                              disabled={fields.length === 1 || (po?.items[index]?.receivedQuantity ?? 0) > 0}
                              aria-label={`Remove ${lineName(index)}`}
                              title={
                                (po?.items[index]?.receivedQuantity ?? 0) > 0
                                  ? 'This line has already received stock and cannot be removed'
                                  : fields.length === 1
                                    ? 'A purchase order needs at least one line item'
                                    : undefined
                              }
                              onClick={() => remove(index)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </CardContent>

            {/* The same four lines, in the same order and weights, as the detail page's
                summary — the figures a merchant checks against the supplier's invoice. */}
            <div className="flex flex-col items-end gap-0.5 border-t border-border px-4 py-3 text-sm tabular-nums">
              <span className="text-muted-foreground">Subtotal: {formatCurrency(subtotal)}</span>
              <span className="text-muted-foreground">Shipping: {formatCurrency(shipping)}</span>
              <span className="text-muted-foreground">Tax: {formatCurrency(tax)}</span>
              <span className="font-semibold text-foreground">Total: {formatCurrency(total)}</span>
            </div>
          </Card>

          {/* Sticky from xl so the supplier, the costs that feed the total, and the status stay in
              view while a long list of items is being filled in below-left. */}
          <Card className="xl:sticky xl:top-4 xl:col-span-4">
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-1">
              {isEdit ? (
                <>
                  <div className="flex flex-col gap-1.5 text-sm sm:col-span-2 xl:col-span-1">
                    <span className="text-muted-foreground">Supplier</span>
                    <span className="font-medium text-foreground">{po?.supplier.name}</span>
                    <span className="text-xs text-muted-foreground">Supplier can't be changed after a purchase order is created.</span>
                  </div>
                  {statusIsEditable ? (
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="DRAFT">Draft</SelectItem>
                              <SelectItem value="ORDERED">Ordered</SelectItem>
                              <SelectItem value="CANCELLED">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <div className="flex flex-col items-start gap-1.5 text-sm">
                      <span className="text-muted-foreground">Status</span>
                      {po && <Badge variant={STATUS_VARIANT[po.status]}>{STATUS_LABEL[po.status]}</Badge>}
                      <span className="text-xs text-muted-foreground">
                        Set by receiving stock against this order, not from this form.
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <FormField
                  control={form.control}
                  name="supplierId"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2 xl:col-span-1">
                      <FormLabel>Supplier</FormLabel>
                      <FormControl>
                        <Combobox
                          placeholder="Select a supplier"
                          searchPlaceholder="Search suppliers"
                          options={supplierOptions}
                          value={field.value || null}
                          loading={loadingSuppliers}
                          noOptionsText="No suppliers yet"
                          onValueChange={(value) => field.onChange(value ?? '')}
                          onBlur={field.onBlur}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="shippingCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shipping cost</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        className="tabular-nums"
                        onWheel={blurOnWheel}
                        {...field}
                        value={field.value === undefined ? '' : String(field.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="taxAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax amount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        className="tabular-nums"
                        onWheel={blurOnWheel}
                        {...field}
                        value={field.value === undefined ? '' : String(field.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2 xl:col-span-1">
                    <FormLabel>Notes</FormLabel>
                    <FormControl><Textarea rows={2} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-2 xl:col-span-12">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(po ? `${LIST_PATH}/${po.id}` : LIST_PATH)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>{isEdit ? 'Save changes' : 'Create purchase order'}</Button>
          </div>
        </form>
      </Form>
    </div>
  )
}

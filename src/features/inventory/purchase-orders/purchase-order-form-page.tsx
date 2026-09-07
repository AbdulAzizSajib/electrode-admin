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
import { useProducts } from '@/lib/api/products'
import {
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
          items: po.items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitCost: Number(i.unitCost) })),
        }
      : {
          supplierId: '',
          notes: '',
          shippingCost: undefined,
          taxAmount: undefined,
          status: 'DRAFT',
          items: [{ productId: '', quantity: 1, unitCost: 0 }],
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
    append({ productId: '', quantity: 1, unitCost: 0 })
  }

  const onSubmit = async (values: OutputValues) => {
    setSaveError(null)
    try {
      if (po) {
        // Line items and supplier aren't editable once a PO exists — the backend's PATCH doesn't
        // accept them (see design.md), so only the scalar fields below are sent.
        const input: PurchaseOrderUpdateInput = {
          shippingCost: values.shippingCost,
          taxAmount: values.taxAmount,
          notes: values.notes,
          // Omitted for a received or partially received order: the form never
          // offered its real status, so it must not write one back.
          status: isEditableStatus(po.status) ? values.status : undefined,
        }
        await updateMutation.mutateAsync({ id: po.id, input })
        toast({ title: 'Purchase order updated' })
        navigate(`${LIST_PATH}/${po.id}`)
      } else {
        const input: PurchaseOrderCreateInput = {
          supplierId: values.supplierId,
          items: values.items,
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

  const statusIsEditable = !po || isEditableStatus(po.status)

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
            <CardHeader className={isEdit ? undefined : 'flex-row items-center justify-between space-y-0'}>
              <CardTitle>Line items</CardTitle>
              {isEdit ? (
                <CardDescription>Line items can't be changed after a purchase order is created.</CardDescription>
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
                    <TableHead className="w-20">Qty</TableHead>
                    <TableHead className="w-28">Unit cost</TableHead>
                    <TableHead className="w-28 text-right">Amount</TableHead>
                    {!isEdit && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isEdit
                    ? po?.items.map((item) => (
                        <TableRow key={item.id} className="hover:bg-transparent">
                          <TableCell className="font-medium text-foreground">{item.product.name}</TableCell>
                          <TableCell className="tabular-nums">{item.quantity}</TableCell>
                          <TableCell className="tabular-nums">{formatCurrency(Number(item.unitCost))}</TableCell>
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
                            <FormField
                              control={form.control}
                              name={`items.${index}.quantity`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min="1"
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
                          <TableCell className="text-right tabular-nums text-foreground">
                            {formatCurrency(lineAmount(index))}
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={fields.length === 1}
                              aria-label={`Remove ${lineName(index)}`}
                              title={fields.length === 1 ? 'A purchase order needs at least one line item' : undefined}
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

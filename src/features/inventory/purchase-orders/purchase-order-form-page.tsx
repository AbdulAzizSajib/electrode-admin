import * as React from 'react'
import { useNavigate, useParams } from 'react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm } from 'react-hook-form'
import { z } from 'zod'
import { ArrowLeft, ChevronDown, Plus, Trash2 } from 'lucide-react'
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
        /*
         * Staged selling prices: what this line PROPOSES for the item, applied
         * by a goods receipt rather than on save.
         *
         * STRINGS, NOT `coerce.number()`, and that is the point. Empty has to
         * stay distinguishable from zero: empty means "this line has no
         * opinion about that price" and sends nothing, while 0 is a real
         * staged price of zero. `z.coerce.number()` collapses '' to 0 and
         * would make every untouched line stage a free product.
         */
        stagedOfferPrice: z
          .string()
          .optional()
          .refine((v) => !v || (Number(v) >= 0 && Number.isFinite(Number(v))), 'Enter a price of 0 or more'),
        stagedSellingPrice: z
          .string()
          .optional()
          .refine((v) => !v || (Number(v) >= 0 && Number.isFinite(Number(v))), 'Enter a price of 0 or more'),
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
 * A blank line. Staged prices start EMPTY, never pre-filled with the item's
 * current prices — see design.md Decision 5: filling them would make every
 * line carry a proposal equal to the price already in place, "no opinion"
 * would become unrepresentable, and every receipt would write prices it was
 * never asked to.
 */
const NEW_LINE = {
  productId: '',
  variantId: undefined,
  quantity: 1,
  unitCost: 0,
  stagedOfferPrice: '',
  stagedSellingPrice: '',
} as const

/**
 * A staged price on its way to the API: empty means "no opinion" and is sent as
 * `undefined`, so the server writes null and the receipt changes nothing.
 *
 * NOT `Number('') === 0`. Collapsing empty to zero would make every untouched
 * line stage a free product — which is why the form holds these as strings.
 */
const stagedToPayload = (value: string | undefined): number | undefined =>
  value === undefined || value === '' ? undefined : Number(value)

/** Money is `Decimal(12, 2)`; every figure these helpers produce matches. */
const round2 = (value: number) => Math.round(value * 100) / 100

/**
 * The two price computations, MIRRORED from the server's
 * `purchase-order.cost.ts` — `markupOnCost` and `adjustByAmount`.
 *
 * THE SERVER IS THE AUTHORITY. It is mirrored here rather than fetched because
 * each is one multiplication or addition plus a round, and a round trip per
 * keystroke to compute `cost × 1.25` would be worse than the duplication.
 * `scripts/verify-cost-basis.ts` pins the server's versions, including the two
 * refusals below. If either ever grows a branch, the honest fix is an endpoint,
 * not a bigger mirror.
 *
 * `markupOnCost` returns null for a non-positive cost: a percentage of nothing
 * is nothing, and proposing 0.00 for an uncosted line would look like a
 * computed answer. `adjustByAmount` clamps at zero, because every reader of
 * these Decimal columns assumes a non-negative price.
 *
 * See openspec/changes/add-purchase-order-pricing, design.md Decision 4.
 */
const markupOnCost = (unitCost: number, percent: number): number | null =>
  unitCost <= 0 ? null : round2(unitCost * (1 + percent / 100))

const adjustByAmount = (price: number, delta: number): number => round2(Math.max(0, price + delta))

/**
 * What the form needs from a resolved product: its own prices, and its
 * variants' (each of which may override any of the three).
 */
interface ResolvedProduct {
  purchasePrice?: number | string | null
  offerPrice?: number | string | null
  sellingPrice?: number | string | null
  variants?: {
    id?: string
    purchasePrice?: number | string | null
    offerPrice?: number | string | null
    sellingPrice?: number | string | null
  }[]
}

/** One item's prices as the catalog currently holds them. */
interface ItemPrices {
  purchasePrice: number | null
  offerPrice: number | null
  sellingPrice: number | null
}

/**
 * The prices to show for a line, variant-then-parent FIELD BY FIELD.
 *
 * Mirrors `resolveItemPrices` on the server, and for the same reason it is per
 * field there: a variant may set its own offer price and inherit its parent's
 * regular price, so picking "the variant if there is one" for all three at once
 * would show blanks for the ones it does not override. Showing one precedence
 * while the receipt acts on another is the failure this avoids.
 */
const resolveItemPrices = (
  product: { purchasePrice?: number | null; offerPrice?: number | null; sellingPrice?: number | null } | undefined,
  variant: { purchasePrice?: number | null; offerPrice?: number | null; sellingPrice?: number | null } | undefined,
): ItemPrices => {
  const pick = (field: keyof ItemPrices) => variant?.[field] ?? product?.[field] ?? null

  return {
    purchasePrice: pick('purchasePrice'),
    offerPrice: pick('offerPrice'),
    sellingPrice: pick('sellingPrice'),
  }
}

/**
 * The pricing panel for one line: what the item costs and sells for today, and
 * what this order should change it to.
 *
 * ── Why a second row rather than more columns ────────────────────────
 *
 * The line table already carries seven columns. Five more per line would mean
 * horizontal scrolling to reach the delete button — making the common case
 * (cost a line, save) worse to serve the occasional one (reprice while
 * costing). A row that opens on demand keeps the table as it was, and matches
 * what repricing is: per line, occasional, absent until asked for.
 *
 * ── Current and staged are deliberately different things ───────────────
 *
 * The three figures on the left are READ-ONLY and live — they are what the
 * catalogue holds right now. The two inputs on the right are PROPOSALS, empty
 * until the merchant sets one, and applied only when the order's goods are
 * received. An empty input means "leave that price alone"; that is why they are
 * never pre-filled with the current values (design.md Decision 5).
 *
 * See openspec/changes/add-purchase-order-pricing, design.md Decisions 5 and 5a.
 */
function LinePricing({
  control,
  index,
  lineLabel,
  prices,
  unitCost,
  onCompute,
}: {
  control: ReturnType<typeof useForm<Values, unknown, OutputValues>>['control']
  index: number
  lineLabel: string
  prices: ItemPrices
  unitCost: number
  onCompute: (field: 'stagedOfferPrice' | 'stagedSellingPrice', value: number) => void
}) {
  const [markupPercent, setMarkupPercent] = React.useState('25')
  const [adjustAmount, setAdjustAmount] = React.useState('')
  const [hint, setHint] = React.useState<string | null>(null)

  const applyMarkup = () => {
    const proposed = markupOnCost(unitCost, Number(markupPercent) || 0)

    // Declines rather than proposing 0.00 — see `markupOnCost`.
    if (proposed === null) {
      setHint('Enter this line’s unit cost first — a markup needs something to mark up.')
      return
    }

    setHint(null)
    onCompute('stagedOfferPrice', proposed)
  }

  const applyAdjust = (field: 'stagedOfferPrice' | 'stagedSellingPrice', current: string | undefined) => {
    const delta = Number(adjustAmount)
    if (!adjustAmount || !Number.isFinite(delta)) return

    // Adjusts what is in the field, falling back to the price in place — so
    // "+20" on an untouched line means twenty above what it sells for today.
    const fallback = field === 'stagedOfferPrice' ? prices.offerPrice : prices.sellingPrice
    const base = current !== undefined && current !== '' ? Number(current) : (fallback ?? 0)

    setHint(null)
    onCompute(field, adjustByAmount(base, delta))
  }

  const money = (value: number | null) => (value === null ? '—' : formatCurrency(value))

  return (
    <div className="flex flex-col gap-3 bg-muted/40 px-4 py-3 md:flex-row md:items-start md:gap-8">
      <div className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-foreground">Currently in the catalogue</span>
        <div className="flex gap-4 tabular-nums text-muted-foreground">
          <span>
            Cost <span className="text-foreground">{money(prices.purchasePrice)}</span>
          </span>
          <span>
            Offer <span className="text-foreground">{money(prices.offerPrice)}</span>
          </span>
          <span>
            Regular <span className="text-foreground">{money(prices.sellingPrice)}</span>
          </span>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="text-xs font-medium text-foreground">
          New prices when this order is received{' '}
          <span className="font-normal text-muted-foreground">
            — leave blank to keep the current price
          </span>
        </span>

        <div className="flex flex-wrap items-end gap-3">
          {(
            [
              ['stagedOfferPrice', 'New offer price'],
              ['stagedSellingPrice', 'New regular price'],
            ] as const
          ).map(([name, label]) => (
            <FormField
              key={name}
              control={control}
              name={`items.${index}.${name}`}
              render={({ field }) => (
                <FormItem className="w-40">
                  <FormLabel className="text-xs font-normal text-muted-foreground">{label}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      placeholder="No change"
                      className="tabular-nums"
                      aria-label={`${label} for ${lineLabel}`}
                      onWheel={blurOnWheel}
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}

          <div className="flex items-end gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor={`markup-${index}`} className="text-xs font-normal text-muted-foreground">
                Markup on cost
              </label>
              <div className="flex items-center gap-1">
                <Input
                  id={`markup-${index}`}
                  type="number"
                  step="1"
                  min="0"
                  inputMode="decimal"
                  className="w-20 tabular-nums"
                  aria-label={`Markup percentage for ${lineLabel}`}
                  onWheel={blurOnWheel}
                  value={markupPercent}
                  onChange={(event) => setMarkupPercent(event.target.value)}
                />
                <span className="text-xs text-muted-foreground">%</span>
                <Button type="button" variant="outline" size="sm" onClick={applyMarkup}>
                  Apply
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor={`adjust-${index}`} className="text-xs font-normal text-muted-foreground">
                Adjust by
              </label>
              <div className="flex items-center gap-1">
                <Input
                  id={`adjust-${index}`}
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="±0.00"
                  className="w-24 tabular-nums"
                  aria-label={`Adjustment amount for ${lineLabel}`}
                  onWheel={blurOnWheel}
                  value={adjustAmount}
                  onChange={(event) => setAdjustAmount(event.target.value)}
                />
                <FormField
                  control={control}
                  name={`items.${index}.stagedOfferPrice`}
                  render={({ field }) => (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => applyAdjust('stagedOfferPrice', field.value)}
                    >
                      Offer
                    </Button>
                  )}
                />
                <FormField
                  control={control}
                  name={`items.${index}.stagedSellingPrice`}
                  render={({ field }) => (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => applyAdjust('stagedSellingPrice', field.value)}
                    >
                      Regular
                    </Button>
                  )}
                />
              </div>
            </div>
          </div>
        </div>

        {hint && <p className="text-xs text-destructive">{hint}</p>}
      </div>
    </div>
  )
}

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
  /**
   * Reports what arrived: the variant ids for validation, and the product row
   * itself so the parent can resolve the line's prices and seed its unit cost.
   *
   * The product is passed up rather than re-fetched in the parent because this
   * is already the one query per distinct product, cached by react-query — the
   * form learns everything it knows about a product through here.
   */
  onResolved: (productId: string, variantIds: string[], product: ResolvedProduct) => void
}) {
  const { data: product, isFetching } = useProduct(productId || undefined)
  const variants = React.useMemo(() => product?.variants ?? [], [product])

  React.useEffect(() => {
    if (product) {
      onResolved(
        productId,
        variants.map((v) => v.id).filter((id): id is string => !!id),
        product as ResolvedProduct,
      )
    }
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
  /*
   * The resolved product row per picked product, so a line can show the item's
   * current prices and seed its unit cost from the cost basis. Filled by the
   * same variant-picker fetch that fills `variantIdsByProduct` — no extra query.
   */
  const [productById, setProductById] = React.useState<Record<string, ResolvedProduct>>({})
  const rememberVariants = React.useCallback(
    (productId: string, variantIds: string[], product: ResolvedProduct) => {
      setVariantIdsByProduct((prev) =>
        prev[productId]?.length === variantIds.length && prev[productId]?.every((id, i) => id === variantIds[i])
          ? prev
          : { ...prev, [productId]: variantIds },
      )
      setProductById((prev) => (prev[productId] === product ? prev : { ...prev, [productId]: product }))
    },
    [],
  )
  // Index of a row appended by "Add item", so the keyboard lands in it instead
  // of leaving the merchant to reach for the mouse on every line.
  const [focusRow, setFocusRow] = React.useState<number | null>(null)
  /*
   * Which lines have their pricing panel open, by row index.
   *
   * Closed by default: a line that stages nothing is the common case, and the
   * panel being absent until asked for is what keeps the table readable
   * (design.md Decision 5a).
   */
  const [pricingOpen, setPricingOpen] = React.useState<Record<number, boolean>>({})

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
            // A stored proposal shows as itself; an absent one stays EMPTY
            // rather than becoming '0', which would stage a free product.
            stagedOfferPrice: i.stagedOfferPrice == null ? '' : String(Number(i.stagedOfferPrice)),
            stagedSellingPrice: i.stagedSellingPrice == null ? '' : String(Number(i.stagedSellingPrice)),
          })),
        }
      : {
          supplierId: '',
          notes: '',
          shippingCost: undefined,
          taxAmount: undefined,
          status: 'DRAFT',
          items: [NEW_LINE],
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

  /** The item a line names: its variant when it has one, else the product. */
  const linePrices = (index: number): ItemPrices => {
    const item = watchedItems?.[index]
    const product = item?.productId ? productById[item.productId] : undefined
    const variant = item?.variantId ? product?.variants?.find((v) => v.id === item.variantId) : undefined

    return resolveItemPrices(
      product && {
        purchasePrice: product.purchasePrice == null ? null : Number(product.purchasePrice),
        offerPrice: product.offerPrice == null ? null : Number(product.offerPrice),
        sellingPrice: product.sellingPrice == null ? null : Number(product.sellingPrice),
      },
      variant && {
        purchasePrice: variant.purchasePrice == null ? null : Number(variant.purchasePrice),
        offerPrice: variant.offerPrice == null ? null : Number(variant.offerPrice),
        sellingPrice: variant.sellingPrice == null ? null : Number(variant.sellingPrice),
      },
    )
  }

  /*
   * Seeds a line's Unit cost from the item's CURRENT COST BASIS when its
   * product or variant changes.
   *
   * The figure a merchant needs is the one the product already records —
   * `purchasePrice` means "what the stock on hand cost" since
   * add-weighted-average-cost-basis — and it was one field away while the form
   * opened every line at 0.
   *
   * SEEDED ONCE PER PRODUCT/VARIANT CHOICE, never re-applied. The key is what
   * the line names, so typing a cost does not re-trigger it and an unrelated
   * re-render cannot overwrite what the merchant typed. Changing the product or
   * the variant is a different item and does re-seed.
   *
   * An item with NO cost basis seeds nothing rather than writing 0 — a null
   * cost is unknown, and 0 would look like a supplier who charged nothing.
   *
   * See openspec/changes/add-purchase-order-pricing, design.md Decision 5.
   */
  const seededRef = React.useRef<Record<number, string>>({})

  React.useEffect(() => {
    watchedItems?.forEach((item, index) => {
      if (!item?.productId) return

      const key = `${item.productId}::${item.variantId ?? ''}`
      if (seededRef.current[index] === key) return

      const { purchasePrice } = linePrices(index)
      // Recorded even when there is nothing to seed, so a null-cost item is not
      // re-examined on every render.
      seededRef.current[index] = key

      if (purchasePrice !== null) {
        form.setValue(`items.${index}.unitCost`, purchasePrice, { shouldDirty: true })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedItems, productById])

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
    append({ ...NEW_LINE })
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
                item.unitCost !== Number(original.unitCost) ||
                // A staged price is part of the line's state, so editing or
                // clearing one has to count as a change — otherwise the save
                // would skip the amend and the proposal would never reach the
                // server.
                stagedToPayload(item.stagedOfferPrice) !==
                    (original.stagedOfferPrice == null ? undefined : Number(original.stagedOfferPrice)) ||
                stagedToPayload(item.stagedSellingPrice) !==
                    (original.stagedSellingPrice == null ? undefined : Number(original.stagedSellingPrice))
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
                  stagedOfferPrice: stagedToPayload(item.stagedOfferPrice),
                  stagedSellingPrice: stagedToPayload(item.stagedSellingPrice),
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
            // Absent when the merchant staged nothing — see `stagedToPayload`.
            stagedOfferPrice: stagedToPayload(item.stagedOfferPrice),
            stagedSellingPrice: stagedToPayload(item.stagedSellingPrice),
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
                <Button type="button" size="lg" variant="outline" onClick={addItem}>
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
                        /*
                         * A fragment per line: the pricing panel below is a
                         * SIBLING <TableRow>, not a cell inside this one, so it
                         * spans the full width without disturbing the columns.
                         */
                        <React.Fragment key={field.id}>
                        <TableRow className="hover:bg-transparent">
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
                            <div className="flex items-center gap-1">
                            {/*
                              Opens this line's pricing panel. Beside the delete
                              button rather than in a column of its own, so the
                              table's width is unchanged (design.md 5a).
                            */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-expanded={!!pricingOpen[index]}
                              aria-label={`${pricingOpen[index] ? 'Hide' : 'Show'} prices for ${lineName(index)}`}
                              title="Selling prices"
                              onClick={() => setPricingOpen((prev) => ({ ...prev, [index]: !prev[index] }))}
                            >
                              <ChevronDown
                                className={`size-4 transition-transform ${pricingOpen[index] ? 'rotate-180' : ''}`}
                              />
                            </Button>
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
                            </div>
                          </TableCell>
                        </TableRow>

                        {pricingOpen[index] && (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={isEdit ? 8 : 7} className="p-0">
                              <LinePricing
                                control={form.control}
                                index={index}
                                lineLabel={lineName(index)}
                                prices={linePrices(index)}
                                unitCost={Number(watchedItems?.[index]?.unitCost) || 0}
                                onCompute={(name, value) =>
                                  form.setValue(`items.${index}.${name}`, String(value), {
                                    shouldDirty: true,
                                    shouldValidate: true,
                                  })
                                }
                              />
                            </TableCell>
                          </TableRow>
                        )}
                        </React.Fragment>
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

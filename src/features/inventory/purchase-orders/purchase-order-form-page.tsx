import * as React from 'react'
import { useNavigate, useParams } from 'react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm } from 'react-hook-form'
import { z } from 'zod'
import { ArrowLeft, ChevronDown, Trash2 } from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
    /** Shown on the row and in the variant dialog. */
    name?: string
    /** Searched and shown beside the name — a packing slip names a variant by SKU. */
    sku?: string
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
 * The line table already carries seven columns. More per line would mean
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
 * ── The markup and adjust helpers were removed ─────────────────────────
 *
 * design.md Decision 4 offered two computed fills — "cost + 25%" and "±50" —
 * which wrote into these same inputs. They were removed on the merchant's
 * request: the prices here are typed from a supplier's invoice, not derived
 * from cost, so the controls cost a row of width and a reading of the panel
 * without answering a question anyone was asking.
 *
 * Only the UI went. `markupOnCost` and `adjustByAmount` remain on the server in
 * `purchase-order.cost.ts`, still covered by `verify-cost-basis.ts`, so
 * restoring the controls is a UI change rather than a re-derivation. Nothing
 * computes a staged price now: every figure here is one a merchant typed.
 *
 * See openspec/changes/add-purchase-order-pricing, design.md Decisions 5 and 5a.
 */
function LinePricing({
  control,
  index,
  lineLabel,
  prices,
}: {
  control: ReturnType<typeof useForm<Values, unknown, OutputValues>>['control']
  index: number
  lineLabel: string
  prices: ItemPrices
}) {
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
        </div>
      </div>
    </div>
  )
}

/**
 * Asks which variant of a just-picked product the order is for.
 *
 * ── Why a modal, and why before the line exists ──────────────────────
 *
 * Stock is held per (warehouse, product, variant), so a variable product's
 * line is meaningless until it names one — the backend refuses it, and the
 * older form let it through to a receipt that left every variant reading out
 * of stock. The row used to carry its own variant picker, which meant a line
 * could sit on the table in that invalid state until save.
 *
 * Asking at the moment of choice means a line never exists in that state: the
 * merchant names the product, names the variant, and the row that appears is
 * already complete. That is also what lets the table be plain text.
 *
 * Only opens for a product that HAS variants. A simple product has nothing to
 * choose between and is added directly.
 *
 * Dismissing adds nothing. A merchant who opened this by mistake gets their
 * order back as it was, rather than a line to go and delete.
 */
function VariantPickerDialog({
  product,
  productName,
  onPick,
  onCancel,
}: {
  product: ResolvedProduct | undefined
  productName: string
  onPick: (variantId: string) => void
  onCancel: () => void
}) {
  const [term, setTerm] = React.useState('')
  const [highlight, setHighlight] = React.useState(0)
  const listId = React.useId()

  const variants = React.useMemo(
    () => (product?.variants ?? []).filter((v): v is typeof v & { id: string } => !!v.id),
    [product],
  )

  // Name AND sku, because the packing slip in the merchant's hand names the
  // variant by SKU at least as often as by label.
  const visible = React.useMemo(() => {
    const needle = term.trim().toLowerCase()
    if (!needle) return variants
    return variants.filter((v) =>
      `${v.name ?? ''} ${v.sku ?? ''}`.toLowerCase().includes(needle),
    )
  }, [variants, term])

  /*
   * Keep the highlight inside the narrowed list — typing until one option is
   * left must not leave it pointing past the end.
   *
   * CLAMPED ON READ rather than corrected in an effect. Storing the correction
   * would mean a second render pass every time the list narrows, and the state
   * would briefly name an option that is not on screen; deriving it means the
   * only value anything can observe is already in range.
   */
  const active = highlight < visible.length ? highlight : 0

  /*
   * Arrows, Home/End and Enter, handled on the SEARCH FIELD rather than on the
   * options.
   *
   * The options are not focusable: focus stays in the field so typing keeps
   * narrowing while the arrows move the selection, and the highlight is
   * published through `aria-activedescendant`. This is the same contract the
   * Combobox in this kit implements, and the reason it is a contract at all is
   * that a list of focusable buttons answers arrow keys by doing nothing —
   * which is exactly how this dialog first shipped.
   *
   * Escape is Radix's, via the Dialog.
   */
  const onKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setHighlight(visible.length === 0 ? 0 : (active + 1) % visible.length)
        break
      case 'ArrowUp':
        event.preventDefault()
        setHighlight(visible.length === 0 ? 0 : (active - 1 + visible.length) % visible.length)
        break
      case 'Home':
        event.preventDefault()
        setHighlight(0)
        break
      case 'End':
        event.preventDefault()
        setHighlight(Math.max(0, visible.length - 1))
        break
      case 'Enter': {
        event.preventDefault()
        const option = visible[active]
        if (option) onPick(option.id)
        break
      }
    }
  }

  const optionId = (index: number) => `${listId}-option-${index}`

  return (
    <Dialog open onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Which variant?</DialogTitle>
          <DialogDescription>
            {productName} comes in {variants.length} variants. Stock is counted per variant, so
            the order has to name one.
          </DialogDescription>
        </DialogHeader>

        {!product ? (
          // Loading and empty are different answers, and a merchant staring at
          // a blank dialog cannot tell which they are looking at.
          <div className="flex flex-col gap-2 py-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <>
            {/* Only worth its space once the list is long enough to scan. */}
            {variants.length > 6 && (
              <Input
                autoFocus
                aria-label={`Search variants of ${productName}`}
                aria-controls={listId}
                aria-activedescendant={visible.length ? optionId(active) : undefined}
                placeholder="Search by name or SKU…"
                value={term}
                onChange={(event) => {
                  setTerm(event.target.value)
                  setHighlight(0)
                }}
                onKeyDown={onKeyDown}
              />
            )}

            <div
              id={listId}
              role="listbox"
              aria-label={`Variants of ${productName}`}
              className="flex max-h-80 flex-col gap-1 overflow-y-auto py-1 focus-visible:outline-none"
              // Focusable as a whole when there is no search field, so the
              // arrows work in the short-list case too.
              tabIndex={variants.length > 6 ? -1 : 0}
              autoFocus={variants.length <= 6}
              aria-activedescendant={visible.length ? optionId(active) : undefined}
              onKeyDown={onKeyDown}
            >
              {visible.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No variant matches “{term}”.
                </p>
              ) : (
                visible.map((variant, index) => (
                  <div
                    key={variant.id}
                    id={optionId(index)}
                    role="option"
                    aria-selected={index === active}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-sm ${
                      index === active ? 'bg-muted text-foreground' : 'text-foreground'
                    }`}
                    // Hover moves the highlight, so the pointer and the
                    // keyboard cannot disagree about what Enter will pick.
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => onPick(variant.id)}
                  >
                    <span className="font-medium">{variant.name}</span>
                    {variant.sku && (
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {variant.sku}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Resolves a product the search bar just named, so the page can decide whether
 * to ask for a variant.
 *
 * Renders nothing. It exists because `useProduct` is a hook and the decision
 * needs the product's `variants`, which `GET /products/admin` omits — the same
 * reason the row used to fetch it. One query per distinct product, cached and
 * shared with every other caller by react-query.
 */
function PendingProductResolver({
  productId,
  onResolved,
}: {
  productId: string
  onResolved: (productId: string, product: ResolvedProduct) => void
}) {
  const { data: product } = useProduct(productId || undefined)

  React.useEffect(() => {
    if (product) onResolved(productId, product as ResolvedProduct)
  }, [product, productId, onResolved])

  return null
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
  // Index of the row the search bar just added or incremented, so the keyboard
  // lands in it instead of leaving the merchant to reach for the mouse.
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

  /**
   * The prices of the item `productId`/`variantId` names, from a product row
   * given explicitly rather than read from state.
   *
   * Taking the product as an argument is what lets the seed run from the
   * choice: at that moment `productById` may not hold the row yet, and
   * `rememberVariants` has it in hand before React has re-rendered with it.
   */
  const pricesOf = React.useCallback(
    (product: ResolvedProduct | undefined, variantId: string | undefined): ItemPrices => {
      const variant = variantId ? product?.variants?.find((v) => v.id === variantId) : undefined

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
    },
    [],
  )

  /** The item a line names: its variant when it has one, else the product. */
  const linePrices = (index: number): ItemPrices => {
    const item = watchedItems?.[index]
    return pricesOf(item?.productId ? productById[item.productId] : undefined, item?.variantId)
  }

  /*
   * Seeds a line's Unit cost from the item's CURRENT COST BASIS when the line
   * is created, or when it is incremented by a fresh pick of the same item.
   *
   * The figure a merchant needs is the one the product already records —
   * `purchasePrice` means "what the stock on hand cost" since
   * add-weighted-average-cost-basis — and it was one field away while the form
   * opened every line at 0.
   *
   * ── Why this is called, not watched ──────────────────────────────────
   *
   * This was a `useEffect` over `[watchedItems, productById]`, and it dropped
   * the third selection in the sequence pick A → pick B → pick A again: the
   * line kept B's cost. `form.watch` mutates and returns the same array, and
   * re-picking a product already resolved changes neither dependency by
   * identity, so the effect never ran and the row kept the cost of the product
   * it no longer named. Seeding from the choice itself — the only event that
   * may seed at all — removes the dependency question entirely.
   *
   * See openspec/changes/add-purchase-order-pricing, design.md Decision 5.
   */
  const seededRef = React.useRef<Record<string, string>>({})
  /*
   * Every product resolved this session, as a REF beside the `productById`
   * state.
   *
   * The state drives rendering; this mirror is what the seed reads. `addItem`
   * runs in the same tick as the resolve that triggered it, before React has
   * re-rendered with the new state, so reading `productById` there would miss
   * the very product being added and skip its seed.
   */
  const productRef = React.useRef<Record<string, ResolvedProduct>>({})

  /**
   * Writes the item's cost basis into a row's Unit cost, once per choice.
   *
   * `rowId` is the field array's stable id, never the index: removing a line
   * shifts every later row down one, so an index-keyed record would carry the
   * previous occupant's item and suppress the new one's seed.
   *
   * An item with NO cost basis seeds nothing rather than writing 0 — a null
   * cost is unknown, and 0 would look like a supplier who charged nothing.
   */
  const seedFromChoice = (rowId: string, index: number, productId: string, variantId?: string) => {
    if (!productId) return

    const key = `${productId}::${variantId ?? ''}`
    if (seededRef.current[rowId] === key) return

    const { purchasePrice } = pricesOf(productRef.current[productId], variantId)
    seededRef.current[rowId] = key

    if (purchasePrice !== null) {
      form.setValue(`items.${index}.unitCost`, purchasePrice, { shouldDirty: true })
    }
  }

  const lineAmount = (index: number) => {
    const item = watchedItems?.[index]
    return (Number(item?.quantity) || 0) * (Number(item?.unitCost) || 0)
  }
  /**
   * The product name to PRINT on a row.
   *
   * Prefers the saved order's own copy over the search list: an existing line's
   * product may not be in the current page of search results, and falling back
   * to the list alone would blank the name as soon as the merchant searched for
   * something else.
   */
  const lineProductName = (index: number): string => {
    const productId = watchedItems?.[index]?.productId
    if (!productId) return '—'

    return (
      po?.items.find((i) => i.productId === productId)?.product?.name ??
      productOptions.find((o) => o.value === productId)?.label ??
      pickedProducts.find((o) => o.value === productId)?.label ??
      '—'
    )
  }

  /** The variant name to print, or null when the line names no variant. */
  const lineVariantName = (index: number): string | null => {
    const item = watchedItems?.[index]
    if (!item?.variantId) return null

    const resolved = productById[item.productId]?.variants?.find((v) => v.id === item.variantId)
    if (resolved?.name) return resolved.name

    // An existing order whose product detail has not been fetched this session.
    return po?.items.find((i) => i.variantId === item.variantId)?.variant?.name ?? null
  }

  /** Names a row's controls by its product once one is chosen, by position until then. */
  const lineName = (index: number) =>
    productOptions.find((o) => o.value === watchedItems?.[index]?.productId)?.label ?? `line ${index + 1}`

  const subtotal = watchedItems.reduce((sum, _item, index) => sum + lineAmount(index), 0)
  const shipping = Number(watchedShipping) || 0
  const tax = Number(watchedTax) || 0
  const total = subtotal + shipping + tax

  /**
   * Puts an item on the order, or bumps the line that already holds it.
   *
   * ── The duplicate rule ────────────────────────────────────────────────
   *
   * Same product AND same variant is the same item, so picking it again means
   * "one more of those" and increments that line rather than opening a second
   * one the merchant would have to reconcile. A different variant of the same
   * product is a DIFFERENT item — stock is held per (warehouse, product,
   * variant) — so it gets its own line.
   *
   * Returns the index of the affected row so the caller can draw attention to it.
   */
  const addItem = (productId: string, variantId?: string): number => {
    const existing = form
      .getValues('items')
      .findIndex(
        (item) => item?.productId === productId && (item?.variantId || undefined) === variantId,
      )

    if (existing !== -1) {
      const current = Number(form.getValues(`items.${existing}.quantity`)) || 0
      form.setValue(`items.${existing}.quantity`, current + 1, {
        shouldDirty: true,
        shouldValidate: true,
      })
      return existing
    }

    /*
     * The blank first row a new order opens with is FILLED rather than followed
     * by a second one — otherwise the first item added would leave an empty
     * line above it, failing validation on a form the merchant never touched.
     */
    const items = form.getValues('items')
    const fillsBlank = items.length === 1 && !items[0]?.productId
    const index = fillsBlank ? 0 : items.length

    if (fillsBlank) {
      form.setValue('items.0.productId', productId, { shouldDirty: true, shouldValidate: true })
      form.setValue('items.0.variantId', variantId, { shouldDirty: true })
      const rowId = fields[0]?.id
      if (rowId) seedFromChoice(rowId, 0, productId, variantId)
    } else {
      append({ ...NEW_LINE, productId, variantId })
      // `fields` has not re-rendered with the appended row yet, so its stable
      // id does not exist to key the seed by. The effect below finishes it.
      pendingAppendSeedRef.current.push({ index, productId, variantId })
    }

    return index
  }

  /*
   * Rows appended above, waiting for `fields` to include them so their seed can
   * be keyed by a stable row id. Drained by the effect below.
   */
  const pendingAppendSeedRef = React.useRef<
    { index: number; productId: string; variantId?: string }[]
  >([])

  React.useEffect(() => {
    if (pendingAppendSeedRef.current.length === 0) return

    const pending = pendingAppendSeedRef.current
    pendingAppendSeedRef.current = []
    pending.forEach(({ index, productId, variantId }) => {
      const row = fields[index]
      if (row) seedFromChoice(row.id, index, productId, variantId)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields.length])

  /*
   * The product the search bar named while the page works out whether it has
   * variants, and the dialog that asks which one when it does.
   *
   * Held as one piece of state rather than two booleans so there is a single
   * answer to "what is being added right now" — the resolver, the dialog and
   * the cancel path all read it.
   */
  const [pendingProduct, setPendingProduct] = React.useState<{ id: string; name: string } | null>(
    null,
  )

  /**
   * Records a resolved product without adding anything — used by the resolvers
   * that back an existing order's saved lines.
   */
  const rememberResolvedProduct = React.useCallback((productId: string, product: ResolvedProduct) => {
    productRef.current[productId] = product
    setProductById((prev) => (prev[productId] === product ? prev : { ...prev, [productId]: product }))
  }, [])

  /** Every distinct product the form's lines currently name, for the resolvers above. */
  const linesProductIds = React.useMemo(
    () => [...new Set((watchedItems ?? []).map((i) => i?.productId).filter((id): id is string => !!id))],
    [watchedItems],
  )

  /**
   * Called once the search bar's product has resolved.
   *
   * A simple product is added straight away. A variable one leaves
   * `pendingProduct` set, which keeps the dialog open for the merchant to name
   * a variant — a line is never created in the invalid in-between state.
   */
  const onPendingResolved = React.useCallback(
    (productId: string, product: ResolvedProduct) => {
      // The ref first, and synchronously: `addItem` below seeds from it in this
      // same tick, before the state has re-rendered.
      productRef.current[productId] = product
      setProductById((prev) => (prev[productId] === product ? prev : { ...prev, [productId]: product }))

      const variantIds = (product.variants ?? [])
        .map((v) => v.id)
        .filter((id): id is string => !!id)
      setVariantIdsByProduct((prev) =>
        prev[productId]?.length === variantIds.length ? prev : { ...prev, [productId]: variantIds },
      )

      if (variantIds.length > 0) return

      setPendingProduct((current) => {
        if (current?.id !== productId) return current
        // Deferred: `addItem` writes to the form, which must not happen while
        // React is rendering this state update.
        queueMicrotask(() => setFocusRow(addItem(productId)))
        return null
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

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
          {/*
            Resolves whatever the search bar last named. Renders nothing; it is
            here only because `useProduct` is a hook and the answer decides
            between adding a line and asking for a variant.
          */}
          {pendingProduct && (
            <PendingProductResolver productId={pendingProduct.id} onResolved={onPendingResolved} />
          )}

          {/*
            The same resolver for the products an EXISTING order already names.
            Without it a saved line has no resolved product, so its pricing
            panel would read "—" for all three prices and its variant would show
            only the name the order happened to store. One per distinct product,
            deduped, and react-query shares the fetch with everything else.
          */}
          {linesProductIds.map((id) => (
            <PendingProductResolver key={id} productId={id} onResolved={rememberResolvedProduct} />
          ))}

          {/*
            Only for a product that HAS variants — a simple one is added by the
            resolver without ever opening this.
          */}
          {pendingProduct && (variantIdsByProduct[pendingProduct.id]?.length ?? 0) > 0 && (
            <VariantPickerDialog
              product={productById[pendingProduct.id]}
              productName={pendingProduct.name}
              onPick={(variantId) => {
                const id = pendingProduct.id
                setPendingProduct(null)
                setFocusRow(addItem(id, variantId))
              }}
              onCancel={() => setPendingProduct(null)}
            />
          )}

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
            <CardHeader>
              <CardTitle>Line items</CardTitle>
              {isEdit && !canAmendItems ? (
                <CardDescription>A cancelled purchase order's line items can't be changed.</CardDescription>
              ) : (
                <>
                  <CardDescription>
                    Search for a product to put it on the order. Picking one already listed adds
                    another of it.
                  </CardDescription>
                  {/*
                    The only way to add a line. It REPLACED an "Add item" button
                    that appended a blank row for the merchant to then find the
                    product in — two steps, and the row sat failing validation
                    in between. Searching names the product first, which is the
                    order the merchant is already thinking in.

                    `value` is always null: this is an action, not a selection.
                    The Combobox clears its term and closes on commit, so the
                    bar is ready for the next product without anything to reset.
                  */}
                  <div className="pt-1">
                    <Combobox
                      aria-label="Search products to add to this order"
                      placeholder="Search products to add…"
                      searchPlaceholder="Search by name or SKU…"
                      options={productOptions}
                      value={null}
                      loading={fetchingProducts}
                      noOptionsText="No products yet"
                      // The server has already narrowed the list.
                      filter={false}
                      onSearchChange={setProductTerm}
                      onValueChange={(value) => {
                        if (!value) return
                        rememberProduct(value)
                        /*
                         * Not added yet. The product's variants decide whether
                         * a line can be created at all, and the list this bar
                         * is built from does not carry them — so the pick sets
                         * an intent and `PendingProductResolver` below settles
                         * it, adding the line or opening the variant dialog.
                         */
                        setPendingProduct({
                          id: value,
                          name: productOptions.find((o) => o.value === value)?.label ?? 'This product',
                        })
                      }}
                    />
                  </div>
                </>
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
                          {/*
                            Product and Variant are TEXT, not pickers. The
                            search bar names the product and the variant dialog
                            names the variant, both before the line exists — so
                            by the time a row is on screen there is nothing left
                            to choose, and a control here would only offer a way
                            to put the line back into a state the two of them
                            exist to prevent. Changing an item is removing the
                            line and adding the right one.

                            The ids are still registered below, hidden: they are
                            what the form actually submits, and an unregistered
                            field is one `useFieldArray` would drop on reorder.
                          */}
                          <TableCell className="font-medium text-foreground">
                            <FormField
                              control={form.control}
                              name={`items.${index}.productId`}
                              render={({ field }) => (
                                <FormItem className="space-y-0">
                                  {lineProductName(index)}
                                  <FormControl>
                                    <input type="hidden" {...field} value={field.value ?? ''} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            <FormField
                              control={form.control}
                              name={`items.${index}.variantId`}
                              render={({ field }) => (
                                <FormItem className="space-y-0">
                                  {lineVariantName(index) ?? 'No variants'}
                                  <FormControl>
                                    <input type="hidden" {...field} value={field.value ?? ''} />
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
                                      /*
                                       * Focus lands on the quantity of the row the
                                       * search bar just added or incremented — the
                                       * product is already named, so this is the
                                       * next thing to say. Selected rather than
                                       * merely focused, so typing replaces the 1
                                       * instead of appending to it.
                                       */
                                      ref={(node) => {
                                        field.ref(node)
                                        if (node && focusRow === index) {
                                          node.focus()
                                          node.select()
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

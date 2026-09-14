import * as React from 'react'
import { useNavigate } from 'react-router'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { ResourceFormPage } from '@/components/crud/resource-form-page'
import { useBreadcrumbLabel } from '@/components/layout/breadcrumb-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NumberInput } from '@/components/ui/number-input'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Thumbnail } from '@/components/ui/thumbnail'
import { Alert } from '@/components/ui/alert'
import {
  FormArrayMessage,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { optionalNumber, requiredNumber } from '@/lib/validation/numeric'
import { useProduct, useProducts } from '@/lib/api/products'
import { useStoreSettings } from '@/lib/api/store-settings'
import {
  CHANNEL_LABEL,
  MANUAL_ORDER_CHANNELS,
  useCreateManualOrder,
  useManualOrderQuote,
  type ManualOrderChannel,
  type ManualOrderQuote,
} from '@/lib/api/orders'
import { formatCurrency } from '@/lib/utils/format'

/**
 * Recording an order a customer placed off the storefront.
 *
 * The page exists because a large share of this merchant's sales are agreed in
 * a WhatsApp or Messenger conversation, and until now the only way to get one
 * into the system was to ask the customer to re-enter it on the website. An
 * order that never exists deducts no stock, joins no report, prints no invoice
 * and cannot be handed to the courier.
 *
 * Two properties matter more than anything else here, and both are about the
 * operator being on a call while they use it:
 *
 *   - The total on screen is the total the order is created with. It comes from
 *     the server, never from arithmetic in this file — see the quote below.
 *   - A refused save costs nothing. `ResourceFormPage` guarantees that every
 *     entered value survives with the reason above the fields; this page's job
 *     is to not break it.
 *
 * Prices are shown and not typed. The server prices from the catalog and
 * ignores anything else, so a control offering to change a unit price would do
 * nothing — a negotiated price is one order-level discount with a reason.
 */

const lineSchema = z.object({
  productId: z.string().min(1, 'Select a product'),
  /** Empty string rather than undefined, so the Combobox has a value to hold. */
  variantId: z.string().optional(),
  quantity: requiredNumber('How many?', { min: 1, max: 100, message: 'Between 1 and 100' }),
})

const schema = z
  .object({
    phone: z
      .string()
      .trim()
      .min(1, "The customer's phone number is required")
      /*
       * Deliberately looser than the server's `isValidPhone`. This form is used
       * while a customer is on the line; refusing a number the operator is
       * reading aloud, on a rule this file would have to duplicate and keep in
       * step, is worse than letting the server answer. The backend's refusal
       * arrives above the fields with everything still filled in.
       */
      .min(11, 'That looks too short for a Bangladeshi mobile number'),
    fullName: z.string().trim().max(200).optional(),
    addressLine1: z.string().trim().min(1, 'Where is this going?').max(255),
    addressLine2: z.string().trim().max(255).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().max(100).optional(),
    postalCode: z.string().trim().max(20).optional(),
    deliveryOptionKey: z.string().min(1, 'Choose how this is being delivered'),
    channel: z.enum(MANUAL_ORDER_CHANNELS, { message: 'Where did the customer reach you?' }),
    items: z.array(lineSchema).min(1, 'Add at least one product'),
    discountAmount: optionalNumber({ min: 0, message: 'Cannot be negative' }),
    discountReason: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  /*
   * A discount must say why, mirroring the server's own rule. Duplicated here
   * on purpose: the operator finds out while typing rather than after a round
   * trip, and the path names the reason field so the scaffold scrolls to the
   * control they have to fill in rather than to the top of the form.
   *
   * The other half of the server's rule — that a discount may not exceed the
   * subtotal — cannot live in this schema, because the subtotal is not knowable
   * until the lines have been priced. It is checked against the quote instead,
   * in `submit` below.
   */
  .refine((v) => !(v.discountAmount && v.discountAmount > 0) || !!v.discountReason, {
    message: 'Give a reason — it is what makes this discount auditable later',
    path: ['discountReason'],
  })

type Values = z.input<typeof schema>
type OutputValues = z.output<typeof schema>

/**
 * The variant picker for one line, and the only place this form learns whether
 * a product has variants at all.
 *
 * Fetches the product's detail rather than reading the row already in the
 * combobox: `GET /products/admin` omits `variants` entirely (see products.ts),
 * so the list the picker is populated from cannot answer this. One query per
 * distinct product, cached and shared by react-query.
 *
 * Lifted almost verbatim from `purchase-order-form-page.tsx`, which met the
 * same problem first. The one deliberate difference is what it reports back:
 * that form needs the variant ids to validate the line, this one needs the
 * PRICE and the IMAGE as well, because the operator reads the price aloud.
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
  const { data: product } = useProduct(productId || undefined)
  const variants = React.useMemo(() => product?.variants ?? [], [product])

  React.useEffect(() => {
    if (product) onResolved(productId, variants.map((v) => v.id).filter((id): id is string => !!id))
  }, [product, productId, variants, onResolved])

  const options = React.useMemo<ComboboxOption[]>(
    () =>
      variants
        .filter((v): v is typeof v & { id: string } => !!v.id)
        .map((v) => ({ value: v.id, label: v.name, keywords: v.sku ?? undefined })),
    [variants],
  )

  if (!productId) return <span className="text-xs text-muted-foreground">Pick a product first</span>
  if (options.length === 0) return <span className="text-xs text-muted-foreground">—</span>

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
 * A quantity control with its own − and + buttons.
 *
 * A bare number box works, but this field is used by an operator holding a
 * phone in one hand: nudging a quantity is far commoner here than typing one,
 * and a spinner's native arrows are too small to hit reliably. The box stays
 * typeable, so a quantity of 20 is still one action rather than twenty.
 *
 * Hands the raw value straight to `field.onChange`, keeping this page on the
 * panel's one numeric convention — react-hook-form holds the value and the zod
 * `preprocess` in `lib/validation/numeric` decides what an empty box means.
 * Clamping is deliberately NOT done here: the schema already bounds 1..100 and
 * saying it twice is how the two come to disagree.
 */
function QuantityStepper({
  value,
  onChange,
  onBlur,
  label,
  min = 1,
  max = 100,
}: {
  value: unknown
  onChange: (value: number) => void
  onBlur: () => void
  label: string
  min?: number
  max?: number
}) {
  const current = Number(value)
  const safe = Number.isFinite(current) ? current : min

  return (
    <div className="flex items-center">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={`One fewer ${label}`}
        className="size-9 shrink-0 rounded-r-none"
        disabled={safe <= min}
        onClick={() => onChange(Math.max(min, safe - 1))}
      >
        <Minus className="size-3.5" />
      </Button>
      <NumberInput
        aria-label={`Quantity of ${label}`}
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        onBlur={onBlur}
        // The native spinner arrows are redundant beside real buttons, and they
        // make the box narrower than the digits need.
        className="h-9 w-14 rounded-none border-x-0 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={`One more ${label}`}
        className="size-9 shrink-0 rounded-l-none"
        disabled={safe >= max}
        onClick={() => onChange(Math.min(max, safe + 1))}
      >
        <Plus className="size-3.5" />
      </Button>
    </div>
  )
}

/**
 * What one line comes to: the catalogue unit price times the quantity.
 *
 * The LINE TOTAL is the large figure and the unit price sits under it, because
 * this column is read next to the quantity — a unit price alone there is
 * indistinguishable from a line total, and reads as a price that ignores the
 * quantity entirely.
 *
 * Display only, and outside the form's values on purpose: a price this form
 * could submit is a price that has to be kept in step with the server's, which
 * ignores it anyway. It is also NOT the figure the order is created with — the
 * summary at the foot of the page is, and that comes from the server. This is
 * arithmetic the operator can check by eye, nothing more.
 *
 * The purchase-order form beside this one DOES have an editable unit cost,
 * because a supplier's price genuinely is per-order data the operator holds — a
 * sale's price is catalog data the server holds. The two forms look alike and
 * must not be made identical.
 */
function LinePrice({
  productId,
  variantId,
  quantity,
}: {
  productId: string
  variantId?: string
  quantity: unknown
}) {
  const { data: product } = useProduct(productId || undefined)
  if (!productId) return <span className="text-xs text-muted-foreground">—</span>
  if (!product) return <Skeleton className="h-4 w-16" />

  const variant = variantId ? product.variants?.find((v) => v.id === variantId) : undefined
  const unitPrice = Number(variant?.offerPrice ?? product.offerPrice)
  const image = variant?.image ?? product.images?.[0]?.url ?? null

  const count = Number(quantity)
  const safeCount = Number.isFinite(count) && count > 0 ? count : 0
  const lineTotal = unitPrice * safeCount

  return (
    <span className="flex items-center justify-end gap-2">
      <Thumbnail url={image} className="size-8" />
      <span className="flex flex-col items-end leading-tight">
        <span className="font-medium tabular-nums text-foreground">
          {formatCurrency(lineTotal)}
        </span>
        {/* The arithmetic, spelled out — so a wrong total is visibly wrong
            rather than merely surprising. */}
        <span className="text-xs tabular-nums text-muted-foreground">
          {safeCount} × {formatCurrency(unitPrice)}
        </span>
      </span>
    </span>
  )
}

export default function OrderCreatePage() {
  // Otherwise the trail reads "Orders / New", which under a section where every
  // other leaf is an order NUMBER reads like one.
  useBreadcrumbLabel('Record an order')

  const navigate = useNavigate()
  const createMutation = useCreateManualOrder()
  const quoteMutation = useManualOrderQuote()

  const { data: settings, isLoading: loadingSettings } = useStoreSettings()
  const deliveryOptions = settings?.checkoutConfig?.delivery?.options ?? []

  const [productSearch, setProductSearch] = React.useState('')
  const { data: productsData } = useProducts({ search: productSearch, limit: 20 })

  const form = useForm<Values, unknown, OutputValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      phone: '',
      fullName: '',
      addressLine1: '',
      city: '',
      deliveryOptionKey: '',
      channel: 'WHATSAPP',
      items: [{ productId: '', variantId: '', quantity: 1 }],
      discountAmount: undefined,
      discountReason: '',
      notes: '',
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' })

  /*
   * Which variants each chosen product has, reported up by `VariantCell`.
   * Guarded against writing an identical array, which would re-render every
   * line on each fetch settle.
   */
  const [variantIdsByProduct, setVariantIdsByProduct] = React.useState<Record<string, string[]>>({})
  const rememberVariants = React.useCallback((productId: string, variantIds: string[]) => {
    setVariantIdsByProduct((prev) =>
      prev[productId]?.length === variantIds.length &&
      prev[productId]?.every((id, i) => id === variantIds[i])
        ? prev
        : { ...prev, [productId]: variantIds },
    )
  }, [])

  const productOptions = React.useMemo<ComboboxOption[]>(
    () =>
      (productsData?.data ?? []).map((p) => ({
        value: p.id,
        label: p.name,
      })),
    [productsData],
  )

  /*
   * Watched BY NAME, one call per field, not as a bare `form.watch()`.
   *
   * The bare form returns a fresh object each render and does not reliably
   * re-render this component when a `useFieldArray` row changes — which showed
   * up as the running total never appearing: the lines stayed empty as far as
   * this component could see, so the quote below was never asked for, and the
   * summary sat on "Add a product…" no matter what was added.
   *
   * The purchase-order form watches by name for the same reason. Doing it any
   * other way here is a silent failure, not a loud one.
   */
  const watchedItems = form.watch('items')
  const watchedDiscount = form.watch('discountAmount')
  const watchedDeliveryKey = form.watch('deliveryOptionKey')
  const watched = React.useMemo(
    () => ({ items: watchedItems, discountAmount: watchedDiscount, deliveryOptionKey: watchedDeliveryKey }),
    [watchedItems, watchedDiscount, watchedDeliveryKey],
  )

  /*
   * Only complete lines are worth pricing. A half-typed row would otherwise
   * make the server refuse the whole quote, and the operator would watch the
   * total disappear every time they added a product.
   */
  const quotableItems = (watched.items ?? [])
    .filter((line) => line.productId && Number(line.quantity) > 0)
    .map((line) => ({
      productId: line.productId,
      ...(line.variantId ? { variantId: line.variantId } : {}),
      quantity: Number(line.quantity),
    }))

  const discountAmount = Number(watched.discountAmount) || 0
  const deliveryOptionKey = watched.deliveryOptionKey

  /*
   * The three inputs, flattened to one string.
   *
   * Computed plainly rather than through a `useMemo` chain over `watch()`
   * results. The memoized version silently stopped updating when a field-array
   * row changed — the effect below kept seeing zero lines, so the total never
   * appeared however many products were added. A string recomputed every render
   * costs nothing at this size and cannot go stale.
   */
  const quoteSignature = JSON.stringify([quotableItems, discountAmount, deliveryOptionKey])

  /*
   * The running total, and the only source of one.
   *
   * Debounced rather than fired per keystroke, and the PREVIOUS figure is held
   * while a new one is in flight rather than blanked — a total that flickers to
   * nothing every time a quantity changes is unreadable to someone reading it
   * aloud. `stale` drives both the dimming and the submit guard below, so the
   * figure sent as the operator's understanding is never one they did not see.
   */
  const [quote, setQuote] = React.useState<ManualOrderQuote | null>(null)
  const [quoteError, setQuoteError] = React.useState<string | null>(null)
  const [stale, setStale] = React.useState(false)

  const runQuote = quoteMutation.mutateAsync

  React.useEffect(() => {
    // Re-read from the signature rather than from the closure, so what is
    // priced is exactly what the dependency describes.
    const [items, discount, optionKey] = JSON.parse(quoteSignature) as [
      { productId: string; variantId?: string; quantity: number }[],
      number,
      string,
    ]

    if (!items.length || !optionKey) {
      setQuote(null)
      setStale(false)
      return
    }

    setStale(true)
    let cancelled = false
    const timer = setTimeout(() => {
      runQuote({ items, deliveryOptionKey: optionKey, discountAmount: discount })
        .then((result) => {
          if (cancelled) return
          setQuote(result)
          setQuoteError(null)
          setStale(false)
        })
        .catch((err: unknown) => {
          if (cancelled) return
          setQuoteError(err instanceof Error ? err.message : 'Could not price this order')
          setStale(false)
        })
    }, 400)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [quoteSignature, runQuote])

  /*
   * One key per order attempt, held across retries.
   *
   * Regenerated only on success — and since the page navigates away then, that
   * means by the next mount. A retry of a refused order must carry the SAME
   * key, or the retry becomes a second order: unlike a shopper double-clicking
   * checkout, there is nobody at the other end to notice a duplicate parcel.
   */
  const idempotencyKey = React.useRef(crypto.randomUUID())

  const lineLabel = (index: number) =>
    productOptions.find((o) => o.value === watched.items?.[index]?.productId)?.label ??
    `line ${index + 1}`

  const noDeliveryConfigured = !loadingSettings && deliveryOptions.length === 0

  return (
    <ResourceFormPage<Values, never, OutputValues>
      noun="Order"
      listPath="/sales/orders"
      form={form}
      toValues={() => form.getValues()}
      title="Record an order"
      description="For an order a customer placed over WhatsApp, Messenger, the phone or in person."
      onSave={async (values) => {
        /*
         * A line naming a product that HAS variants must say which one.
         *
         * Not a schema rule, and it cannot be: whether a product has variants
         * is only known once its detail has been fetched, which happens in
         * `VariantCell` and lands in `variantIdsByProduct`. The zod schema is
         * module-level and cannot see it.
         *
         * Left unchecked, the order would be placed against the bare product —
         * charging the product's price rather than the variant's, deducting
         * stock from the wrong ledger row, and leaving the packer with no way
         * to know which colour was sold.
         */
        let missingVariant = false
        values.items.forEach((line, index) => {
          if (variantIdsByProduct[line.productId]?.length && !line.variantId) {
            missingVariant = true
            form.setError(`items.${index}.variantId`, {
              type: 'manual',
              message: 'Which variant?',
            })
          }
        })
        if (missingVariant) {
          throw new Error(
            'Every line for a product with variants must say which variant it is for.',
          )
        }

        /*
         * The server's subtotal bound, checked here against the quote so the
         * refusal never reaches the customer's ear. It cannot be a schema rule:
         * the subtotal is not knowable until the lines are priced.
         */
        if (quote && values.discountAmount && values.discountAmount > quote.subtotal) {
          form.setError('discountAmount', {
            message: `The discount is more than the order's ${formatCurrency(quote.subtotal)}`,
          })
          throw new Error('The discount is more than the order itself.')
        }

        /*
         * Never submit against a figure the operator has not seen. `stale` is
         * true while a quote is in flight, so this is the window where the
         * summary still shows the previous total.
         */
        if (stale) {
          throw new Error('The total is still updating — give it a moment and try again.')
        }

        const order = await createMutation.mutateAsync({
          idempotencyKey: idempotencyKey.current,
          input: {
            phone: values.phone,
            ...(values.fullName ? { fullName: values.fullName } : {}),
            shippingAddress: {
              addressLine1: values.addressLine1,
              ...(values.addressLine2 ? { addressLine2: values.addressLine2 } : {}),
              ...(values.city ? { city: values.city } : {}),
              ...(values.state ? { state: values.state } : {}),
              ...(values.postalCode ? { postalCode: values.postalCode } : {}),
            },
            items: values.items.map((line) => ({
              productId: line.productId,
              ...(line.variantId ? { variantId: line.variantId } : {}),
              quantity: Number(line.quantity),
            })),
            deliveryOptionKey: values.deliveryOptionKey,
            channel: values.channel as ManualOrderChannel,
            ...(values.discountAmount
              ? { discountAmount: values.discountAmount, discountReason: values.discountReason }
              : {}),
            ...(values.notes ? { notes: values.notes } : {}),
          },
        })

        /*
         * Straight to the order, not back to the list: confirming it, printing
         * an invoice or dispatching it is almost always the next thing the
         * operator does. Returned rather than navigated here so the scaffold's
         * own success toast fires first.
         */
        navigate(`/sales/orders/${order.id}`, { replace: true })
      }}
    >
      {noDeliveryConfigured && (
        <Alert variant="destructive" title="No delivery options are set up">
          An order cannot be priced without one.{' '}
          <Link to="/ui/checkout-settings" className="underline underline-offset-4">
            Add a delivery option
          </Link>{' '}
          first.
        </Alert>
      )}

      <Card>
        <CardHeader><CardTitle>Customer</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone number</FormLabel>
                <FormControl>
                  <Input placeholder="01712345678" autoComplete="off" {...field} />
                </FormControl>
                <FormDescription>
                  How the customer is identified. If this number has ordered before, the order joins
                  their existing record rather than making a second one.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Rahim Uddin" autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="channel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Where did they reach you?</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose one" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {MANUAL_ORDER_CHANNELS.map((value) => (
                      <SelectItem key={value} value={value}>{CHANNEL_LABEL[value]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Delivery</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="addressLine1"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Address</FormLabel>
                <FormControl>
                  <Input placeholder="House 12, Road 5, Dhanmondi" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl><Input placeholder="Dhaka" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="postalCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Postcode</FormLabel>
                <FormControl><Input placeholder="1205" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/*
            Mounted only once the options have arrived. A Radix `Select`
            rendered before its data clears react-hook-form's value on the
            render the options land — the trap CLAUDE.md records and this panel
            has been bitten by before. A skeleton is cheaper than a silently
            empty delivery choice on a form that cannot be submitted without one.
          */}
          {loadingSettings ? (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Delivery option</span>
              <Skeleton className="h-9 w-full" />
            </div>
          ) : (
            <FormField
              control={form.control}
              name="deliveryOptionKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Delivery option</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose one" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {deliveryOptions.map((option) => (
                        <SelectItem key={option.key} value={option.key}>
                          {option.label} — {formatCurrency(option.price)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    The charge comes from this. It is not typed in.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>What they ordered</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="grid items-start gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto_auto_auto]"
            >
              <FormField
                control={form.control}
                name={`items.${index}.productId`}
                render={({ field: productField }) => (
                  <FormItem>
                    {index === 0 && <FormLabel>Product</FormLabel>}
                    <FormControl>
                      <Combobox
                        aria-label={`Product for line ${index + 1}`}
                        placeholder="Search the catalogue…"
                        searchPlaceholder="Search by name or SKU…"
                        options={productOptions}
                        value={productField.value || null}
                        onSearchChange={setProductSearch}
                        onValueChange={(value) => {
                          productField.onChange(value ?? '')
                          // A new product's variants are not the old one's.
                          form.setValue(`items.${index}.variantId`, '')
                        }}
                        onBlur={productField.onBlur}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                {/*
                  A plain label, NOT `FormLabel`: this is the column heading for
                  the variant cells, and it sits outside any `FormField`.
                  `FormLabel` calls `useFormField`, which throws outside that
                  context — and the throw takes the whole route down rather than
                  degrading, because it happens during render.

                  `VariantCell` renders its own `FormLabel` where there is a
                  field to label; for a simple product there is no control here
                  to point at, which is the other reason this cannot be one.
                */}
                {index === 0 && (
                  <span className="mb-2 block text-sm font-medium leading-none">Variant</span>
                )}
                <VariantCell
                  control={form.control}
                  index={index}
                  productId={watched.items?.[index]?.productId ?? ''}
                  lineLabel={lineLabel(index)}
                  onResolved={rememberVariants}
                />
              </div>

              <FormField
                control={form.control}
                name={`items.${index}.quantity`}
                render={({ field: qtyField }) => (
                  <FormItem>
                    {index === 0 && <FormLabel>Qty</FormLabel>}
                    <FormControl>
                      <QuantityStepper
                        value={qtyField.value}
                        onChange={qtyField.onChange}
                        onBlur={qtyField.onBlur}
                        label={lineLabel(index)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="text-right text-sm">
                {index === 0 && (
                  <span className="mb-2 block text-sm font-medium leading-none">Amount</span>
                )}
                <LinePrice
                  productId={watched.items?.[index]?.productId ?? ''}
                  variantId={watched.items?.[index]?.variantId || undefined}
                  quantity={watched.items?.[index]?.quantity}
                />
              </div>

              <Button
                type="button"
                variant="ghost"
                size="lg"
                aria-label={`Remove ${lineLabel(index)}`}
                className={index === 0 ? 'mt-7' : 'mt-1'}
                disabled={fields.length === 1}
                onClick={() => remove(index)}
              >
                <Trash2 />
              </Button>
            </div>
          ))}

          {/* A rule about the LIST, not about any one row — which is what this
              component exists for (see form-array-message.tsx). */}
          <FormArrayMessage name="items" />

          <div>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => append({ productId: '', variantId: '', quantity: 1 })}
            >
              <Plus /> Add a product
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Price agreed</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="discountAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Discount</FormLabel>
                <FormControl><NumberInput min={0} {...field} /></FormControl>
                <FormDescription>
                  Line prices come from the catalogue. Anything agreed off them goes here, once, for
                  the whole order.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="discountReason"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reason for the discount</FormLabel>
                <FormControl>
                  <Input placeholder="Agreed over WhatsApp — returning customer" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea rows={2} placeholder="Deliver after 5pm" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>

        {/*
          The figure the operator reads to the customer. Every number here comes
          from the server — see the quote effect above.
        */}
        <div className="flex justify-end border-t border-border px-4 py-3 text-sm">
          <div className="flex w-full max-w-xs flex-col gap-1">
            {quoteError ? (
              <p className="text-destructive">{quoteError}</p>
            ) : !quote ? (
              <p className="text-muted-foreground">
                Add a product and choose a delivery option to see the total.
              </p>
            ) : (
              <div className={stale ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
                <SummaryRow label="Subtotal" value={formatCurrency(quote.subtotal)} />
                {quote.discountAmount > 0 && (
                  <SummaryRow label="Discount" value={`-${formatCurrency(quote.discountAmount)}`} />
                )}
                <SummaryRow
                  label={quote.delivery?.optionLabel ?? 'Delivery'}
                  value={formatCurrency(quote.shippingAmount)}
                />
                <SummaryRow label="Tax" value={formatCurrency(quote.taxAmount)} />
                <SummaryRow
                  label="Total"
                  value={formatCurrency(quote.totalAmount)}
                  className="mt-1 border-t border-border pt-2 text-base font-semibold text-foreground"
                />
                {stale && <p className="pt-1 text-xs text-muted-foreground">Updating…</p>}
              </div>
            )}
          </div>
        </div>
      </Card>
    </ResourceFormPage>
  )
}

function SummaryRow({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${className ?? ''}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import {
  CURRENCY_DECIMALS_LIMITS,
  CURRENCY_POSITIONS,
  useStoreSettings,
  useUpdateStoreSettings,
  type StoreSettings,
  type StoreSettingsInput,
} from '@/lib/api/store-settings'

/**
 * Optional text fields are `''` in the form and omitted from the payload when blank — the backend
 * validates them as `.optional()` rather than `.nullable()`, so clearing a value means leaving the
 * key out, not sending null.
 */
const optionalText = z.string().trim()

/*
 * Commerce configuration only, and less of it than there used to be. Three
 * groups of fields have left this page, each to the screen that owns the
 * decision:
 *
 *  - branding (`storeName`, `logoUrl`, `siteNameAccent`, `aboutText`,
 *    `copyrightText`) → UI → Site Setting;
 *  - the shop-wide tax rate → GONE, superseded by Catalog → Tax Rules;
 *  - the free-shipping threshold → UI → Checkout Setting.
 *
 * What remains is how money is written and how to reach the shop.
 */
const schema = z.object({
  currency: z.string().trim().min(2, 'Currency is required').max(10),
  currencySymbol: z.string().trim().min(1, 'Currency symbol is required').max(10),
  currencyPosition: z.enum(CURRENCY_POSITIONS),
  currencyDecimals: z.coerce
    .number()
    .int('Must be a whole number')
    .min(CURRENCY_DECIMALS_LIMITS.min, `Must be between ${CURRENCY_DECIMALS_LIMITS.min} and ${CURRENCY_DECIMALS_LIMITS.max}`)
    .max(CURRENCY_DECIMALS_LIMITS.max, `Must be between ${CURRENCY_DECIMALS_LIMITS.min} and ${CURRENCY_DECIMALS_LIMITS.max}`),
  contactEmail: z.union([z.literal(''), z.string().email('Enter a valid email')]),
  contactPhone: optionalText.max(30),
  address: optionalText.max(500),
})
type Values = z.input<typeof schema>
type OutputValues = z.output<typeof schema>

/** The stored record mapped onto form fields — nulls become `''` so inputs stay controlled. */
function toFormValues(s: StoreSettings): Values {
  return {
    currency: s.currency,
    currencySymbol: s.currencySymbol,
    currencyPosition: s.currencyPosition,
    currencyDecimals: s.currencyDecimals,
    contactEmail: s.contactEmail ?? '',
    contactPhone: s.contactPhone ?? '',
    address: s.address ?? '',
  }
}

/**
 * Drops blank optional fields entirely rather than sending them as empty strings or null.
 *
 * Note what is NOT here: `mainNav`, `footerColumns`, `socialLinks`, `announcementBar`, and
 * `newsletter`. `PATCH /settings` is a partial upsert, so omitting them leaves the stored
 * storefront configuration untouched — sending them back would risk clobbering config this page
 * never shows the user.
 *
 * Those blocks are now edited under UI → Header Links (`mainNav`, `announcementBar`) and UI →
 * Footer Links (the rest). The same partial-patch property is what lets all three pages write to
 * one endpoint without overwriting each other, so this omission is load-bearing, not leftover.
 *
 * `contactEmail`/`contactPhone`/`address` ARE editable in both places: they belong to the store,
 * but a merchant looking for "the phone number in my footer" looks in the footer editor. Both send
 * the same three columns through the same patch, so the only interaction is last-write-wins.
 *
 * `freeShippingThreshold` is also NOT here any more — it moved to UI → Checkout Setting, which is
 * the one place that now writes it. Two pages writing one column was how the old bug survived: this
 * page dropped a blank field from the payload, which under a partial upsert means "leave unchanged",
 * so a merchant could set a threshold and never clear it.
 */
function toInput(values: OutputValues): StoreSettingsInput {
  const input: StoreSettingsInput = {
    currency: values.currency,
    currencySymbol: values.currencySymbol,
    currencyPosition: values.currencyPosition,
    currencyDecimals: values.currencyDecimals,
  }
  if (values.contactEmail) input.contactEmail = values.contactEmail
  if (values.contactPhone) input.contactPhone = values.contactPhone
  if (values.address) input.address = values.address
  return input
}

/**
 * The sample amount the preview renders.
 *
 * Deliberately four digits with a fractional part: it exercises the thousands separator, the symbol
 * position and the decimal count all at once, which a value like 10 would not.
 */
const PREVIEW_AMOUNT = 1200.5

/**
 * Keeps the preview renderable while the field is mid-edit.
 *
 * A half-typed or emptied decimals input is `NaN` or out of range, and `Intl.NumberFormat` throws
 * on a fraction-digit count outside 0–20. The preview must degrade to something rather than take
 * the page down with it while the merchant is still typing; the field's own validation is what
 * reports the problem.
 */
function clampDecimals(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return CURRENCY_DECIMALS_LIMITS.default
  return Math.min(CURRENCY_DECIMALS_LIMITS.max, Math.max(CURRENCY_DECIMALS_LIMITS.min, Math.trunc(n)))
}

export default function StoreSettingsPage() {
  const { data: settings, isLoading, error } = useStoreSettings()
  const updateMutation = useUpdateStoreSettings()

  const form = useForm<Values, unknown, OutputValues>({
    resolver: zodResolver(schema),
    values: settings ? toFormValues(settings) : undefined,
  })

  /*
   * Previewed from the LIVE form values, not from the saved settings, so the merchant sees the
   * effect of a change before committing it. Built with the same rules `formatCurrency` uses rather
   * than by calling it — that function reads the SAVED format, which is precisely what this is
   * showing an alternative to.
   */
  const watchedSymbol = useWatch({ control: form.control, name: 'currencySymbol' })
  const watchedPosition = useWatch({ control: form.control, name: 'currencyPosition' })
  const watchedDecimals = useWatch({ control: form.control, name: 'currencyDecimals' })

  const previewDecimals = clampDecimals(watchedDecimals)
  const previewDigits = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: previewDecimals,
    maximumFractionDigits: previewDecimals,
  }).format(PREVIEW_AMOUNT)
  const previewSymbol = String(watchedSymbol ?? '').trim() || '?'
  const preview =
    watchedPosition === 'AFTER'
      ? `${previewDigits}\u00A0${previewSymbol}`
      : `${previewSymbol}${previewDigits}`

  /** The same amount as the preview, for the sentence about display-only rounding. */
  const roundedExample = preview

  const onSubmit = async (values: OutputValues) => {
    try {
      await updateMutation.mutateAsync(toInput(values))
      toast({ title: 'Store settings saved' })
    } catch (err) {
      toast({ title: 'Something went wrong', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-72 w-full max-w-xl" />
      </div>
    )
  }

  if (error || !settings) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Store Settings" description="Store-wide configuration." />
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : 'Could not load store settings.'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Store Settings" description="Store-wide configuration." />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle>Currency</CardTitle>
              <CardDescription>How prices are written everywhere — this admin panel and your website.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3.5">
              <div className="grid grid-cols-2 gap-3.5">
                <FormField control={form.control} name="currency" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <FormControl><Input placeholder="BDT" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="currencySymbol" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Symbol</FormLabel>
                    <FormControl><Input placeholder="৳" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <FormField control={form.control} name="currencyPosition" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Symbol position</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="BEFORE">Before the amount</SelectItem>
                        <SelectItem value="AFTER">After the amount</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="currencyDecimals" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Decimal places</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="1"
                        min={CURRENCY_DECIMALS_LIMITS.min}
                        max={CURRENCY_DECIMALS_LIMITS.max}
                        {...field}
                        value={field.value === undefined ? '' : String(field.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* The result, not the recipe. Four fields whose combined effect a
                  merchant would otherwise have to assemble in their head — and
                  the one place they can see that "after the amount" comes with a
                  space without being asked to decide about spacing. */}
              <div className="rounded-md border border-dashed bg-muted/40 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">Prices will look like</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums">{preview}</p>
              </div>

              {/* Said plainly, because the alternative is a merchant setting 0
                  decimals, seeing line items that no longer visibly sum to the
                  total, and reasonably concluding the totals are broken. */}
              <p className="text-xs text-muted-foreground">
                Decimal places change how prices are <span className="text-foreground">displayed</span> only.
                Orders are still stored and charged to the exact amount — a total of 1,200.50 is charged in
                full even when shown as {roundedExample}.
              </p>
            </CardContent>
          </Card>

          <Card className="max-w-xl">
            <CardHeader><CardTitle>Tax</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {/* The shop-wide rate this page used to carry is gone, not moved.
                  It predated Tax Rules and quietly taxed anything a merchant had
                  not yet tagged — a second source of tax that the Tax Rules
                  screen gave no hint of. */}
              <p>
                Tax is set per product with{' '}
                <Link to="/catalog/tax-rules" className="font-medium text-foreground underline">
                  Catalog → Tax Rules
                </Link>
                . A product with no tax rule is not taxed.
              </p>
            </CardContent>
          </Card>

          <Card className="max-w-xl">
            <CardHeader><CardTitle>Shipping</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>
                The order value that earns free delivery is set on{' '}
                <Link to="/ui/checkout-settings" className="font-medium text-foreground underline">
                  UI → Checkout Setting
                </Link>
                , alongside the rest of what checkout asks for.
              </p>
            </CardContent>
          </Card>

          <Card className="max-w-xl">
            <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3.5">
              <FormField control={form.control} name="contactEmail" render={({ field }) => (
                <FormItem><FormLabel>Contact email</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="contactPhone" render={({ field }) => (
                <FormItem><FormLabel>Contact phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </CardContent>
          </Card>

          <Card className="max-w-xl">
            <CardHeader><CardTitle>Branding</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {/* Moved rather than duplicated: one field, one home. Editing the
                  same columns from two forms meant either could overwrite the
                  other with values it had loaded before the other's save. */}
              <p>
                The store&apos;s name, logos, SEO and theme are edited under{' '}
                <Link to="/ui/site-settings" className="font-medium text-foreground underline">
                  UI → Site Setting
                </Link>
                .
              </p>
            </CardContent>
          </Card>

          <Card className="max-w-xl">
            <CardHeader><CardTitle>Order limits</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
              <p>Pending COD orders per phone: <span className="text-foreground">{settings.maxPendingCodOrdersPerPhone}</span></p>
              <p>Guest orders per IP per hour: <span className="text-foreground">{settings.maxGuestOrdersPerIpPerHour}</span></p>
              <p className="text-xs">These abuse limits are not editable from this page.</p>
            </CardContent>
          </Card>

          <div className="flex max-w-xl justify-end">
            <Button type="submit" loading={form.formState.isSubmitting}>Save changes</Button>
          </div>
        </form>
      </Form>
    </div>
  )
}

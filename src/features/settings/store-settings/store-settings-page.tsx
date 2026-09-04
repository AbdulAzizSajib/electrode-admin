import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { useStoreSettings, useUpdateStoreSettings, type StoreSettings, type StoreSettingsInput } from '@/lib/api/store-settings'

/**
 * Optional text fields are `''` in the form and omitted from the payload when blank — the backend
 * validates them as `.optional()` rather than `.nullable()`, so clearing a value means leaving the
 * key out, not sending null.
 */
const optionalText = z.string().trim()

/** Blank -> undefined, so an emptied numeric field clears the setting rather than coercing to 0. */
const optionalNumber = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.coerce.number().min(0, 'Cannot be negative').optional(),
)

/*
 * Commerce configuration only. The branding fields this page used to carry —
 * `storeName`, `logoUrl`, `siteNameAccent`, `aboutText`, `copyrightText` — now
 * live on UI → Site Setting, which owns the store's identity end to end.
 */
const schema = z.object({
  currency: z.string().trim().min(2, 'Currency is required').max(10),
  currencySymbol: z.string().trim().min(1, 'Currency symbol is required').max(10),
  defaultTaxRatePercent: z.coerce.number().min(0, 'Cannot be negative').max(100, 'Cannot exceed 100'),
  freeShippingThreshold: optionalNumber,
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
    defaultTaxRatePercent: s.defaultTaxRatePercent,
    freeShippingThreshold: s.freeShippingThreshold ?? '',
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
 */
function toInput(values: OutputValues): StoreSettingsInput {
  const input: StoreSettingsInput = {
    currency: values.currency,
    currencySymbol: values.currencySymbol,
    defaultTaxRatePercent: values.defaultTaxRatePercent,
  }
  if (values.freeShippingThreshold !== undefined) input.freeShippingThreshold = values.freeShippingThreshold
  if (values.contactEmail) input.contactEmail = values.contactEmail
  if (values.contactPhone) input.contactPhone = values.contactPhone
  if (values.address) input.address = values.address
  return input
}

export default function StoreSettingsPage() {
  const { data: settings, isLoading, error } = useStoreSettings()
  const updateMutation = useUpdateStoreSettings()

  const form = useForm<Values, unknown, OutputValues>({
    resolver: zodResolver(schema),
    values: settings ? toFormValues(settings) : undefined,
  })

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
            <CardHeader><CardTitle>General</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3.5">
              <div className="grid grid-cols-3 gap-3.5">
                <FormField control={form.control} name="currency" render={({ field }) => (
                  <FormItem><FormLabel>Currency</FormLabel><FormControl><Input placeholder="BDT" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="currencySymbol" render={({ field }) => (
                  <FormItem><FormLabel>Symbol</FormLabel><FormControl><Input placeholder="৳" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="defaultTaxRatePercent" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax rate (%)</FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0" max="100" {...field} value={field.value === undefined ? '' : String(field.value)} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="freeShippingThreshold" render={({ field }) => (
                <FormItem>
                  <FormLabel>Free shipping over</FormLabel>
                  <FormControl><Input type="number" step="0.01" min="0" {...field} value={field.value === undefined ? '' : String(field.value)} /></FormControl>
                  <FormDescription>Leave blank to not offer free shipping by order value.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
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

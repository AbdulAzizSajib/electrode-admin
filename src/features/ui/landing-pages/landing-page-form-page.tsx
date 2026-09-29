import * as React from 'react'
import { useParams } from 'react-router'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ExternalLink, Info } from 'lucide-react'
import { ResourceFormPage } from '@/components/crud/resource-form-page'
import { Combobox } from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/ui/number-input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { RichTextEditor } from '@/components/forms/rich-text-editor'
import { EditorSection } from '@/features/ui/components/settings-editor'
import { LANDING_PAGES_PATH } from '@/features/ui/landing-pages/landing-pages-page'
import { ImageUrlField } from '@/features/ui/landing-pages/image-url-field'
import {
  FaqsListField,
  HighlightsListField,
  MediaListField,
  QuotesListField,
  TrustBadgesListField,
} from '@/features/ui/landing-pages/landing-page-lists'
import {
  PackagesListField,
  UsageIdeasListField,
  WhyUsListField,
} from '@/features/ui/landing-pages/landing-page-offer-lists'
import { ThemeTokenFields } from '@/features/ui/landing-pages/landing-page-theme-fields'
import {
  EMPTY,
  schema,
  slugify,
  type FormValues,
  type LandingPageForm,
  type OutputValues,
} from '@/features/ui/landing-pages/landing-page-schema'
import { storefrontUrl } from '@/lib/api/client'
import { useLandingPage, useCreateLandingPage, useUpdateLandingPage, type LandingPage } from '@/lib/api/landing-pages'
import { useProducts } from '@/lib/api/products'
import { useStoreSettings } from '@/lib/api/store-settings'
import { formatCurrency } from '@/lib/utils/format'

/**
 * A UTC instant as `datetime-local` wants it: `YYYY-MM-DDTHH:mm`, in LOCAL time.
 *
 * `toISOString().slice(0, 16)` looks like it does this and does not — it yields
 * UTC, so a merchant in Dhaka setting 9pm would reopen the form and read 3pm.
 * Built from the local getters instead, which is the only way to produce the
 * string that input actually expects.
 */
const toLocalDateTimeInput = (iso: string): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  const pad = (value: number) => value.toString().padStart(2, '0')

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

export default function LandingPageFormPage() {
  const { landingPageId } = useParams()
  const isEdit = Boolean(landingPageId)

  const { data, isLoading, error } = useLandingPage(landingPageId)
  const createMutation = useCreateLandingPage()
  const updateMutation = useUpdateLandingPage()

  const form = useForm<FormValues, unknown, OutputValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  })

  return (
    <ResourceFormPage<FormValues, LandingPage, OutputValues>
      noun="Landing page"
      listPath={LANDING_PAGES_PATH}
      recordId={landingPageId}
      form={form}
      record={data}
      isLoading={isLoading}
      loadError={error}
      toValues={(page) => ({
        title: page.title,
        slug: page.slug,
        status: page.status,
        productId: page.productId,
        headline: page.headline,
        subheadline: page.subheadline ?? '',
        badgeText: page.badgeText ?? '',
        bodyHtml: page.bodyHtml,
        media: page.media ?? [],
        highlights: page.highlights ?? [],
        faqs: page.faqs ?? [],
        quotes: page.quotes ?? [],
        trustBadges: page.trustBadges ?? [],
        packages: page.packages ?? [],
        whyUs: page.whyUs ?? [],
        usageIdeas: page.usageIdeas ?? [],
        /*
         * `datetime-local` wants `YYYY-MM-DDTHH:mm` in LOCAL time, while the
         * API stores and returns a UTC instant. Sliced after converting, so a
         * merchant in Dhaka sees the Dhaka time they set rather than UTC.
         */
        offerEndsAt: page.offerEndsAt ? toLocalDateTimeInput(page.offerEndsAt) : '',
        stopOrdersAtDeadline: page.stopOrdersAtDeadline,
        scarcityTarget: page.scarcityTarget ?? undefined,
        orderPhone: page.orderPhone ?? '',
        requiresAdvancePayment: page.requiresAdvancePayment,
        themeAccent: page.theme?.accent ?? '',
        themeAccentSoft: page.theme?.accentSoft ?? '',
        themeAccentContrast: page.theme?.accentContrast ?? '',
        themeSurface: page.theme?.surface ?? '',
        themeSurfaceAlt: page.theme?.surfaceAlt ?? '',
        themeText: page.theme?.text ?? '',
        themeTextMuted: page.theme?.textMuted ?? '',
        themeBorder: page.theme?.border ?? '',
        orderForm: page.orderForm,
        successHeading: page.successHeading ?? '',
        successMessage: page.successMessage ?? '',
        metaTitle: page.metaTitle ?? '',
        metaDescription: page.metaDescription ?? '',
        ogImageUrl: page.ogImageUrl ?? '',
        facebookPixelId: page.facebookPixelId ?? '',
        sortOrder: page.sortOrder,
      })}
      onSave={async (values) => {
        const input = {
          title: values.title,
          // Blank means "derive it" — the backend's own default. Sending ""
          // would try to claim the empty slug.
          slug: values.slug?.trim() || undefined,
          status: values.status,
          productId: values.productId,

          headline: values.headline,
          /*
           * Empty string, not undefined — the same spelling `facebookPixelId`
           * uses below. `undefined` means "leave unchanged", so sending it for
           * a blank field made these two IMPOSSIBLE TO CLEAR: a merchant who
           * removed the badge saved, saw it come back, and had no way to take
           * a finished discount off the page. The backend turns `""` into a
           * stored null.
           */
          subheadline: values.subheadline?.trim() ?? '',
          badgeText: values.badgeText?.trim() ?? '',
          bodyHtml: values.bodyHtml,

          /*
           * Sent as arrays even when empty, unlike the scalars above.
           * `[]` is a MEANINGFUL value here — "the merchant removed every FAQ"
           * — and `undefined` would mean "leave the stored list alone", so a
           * merchant clearing a section would find it still on their site.
           */
          media: values.media ?? [],
          highlights: values.highlights ?? [],
          faqs: values.faqs ?? [],
          quotes: values.quotes ?? [],
          trustBadges: values.trustBadges ?? [],

          packages: values.packages ?? [],
          whyUs: values.whyUs ?? [],
          usageIdeas: values.usageIdeas ?? [],
          /* Back to a UTC instant — the input gave local time. */
          offerEndsAt: values.offerEndsAt
            ? new Date(values.offerEndsAt).toISOString()
            : undefined,
          stopOrdersAtDeadline: values.stopOrdersAtDeadline,
          scarcityTarget: values.scarcityTarget,
          orderPhone: values.orderPhone?.trim() || undefined,
          requiresAdvancePayment: values.requiresAdvancePayment,
          /*
           * Reassembled from the flat fields, with BLANKS OMITTED rather than
           * sent as empty strings: an absent token means "use the default",
           * and an empty string would fail the hex validation. A theme with
           * nothing set is sent as `undefined`, which clears the column.
           */
          theme: (() => {
            const tokens = {
              accent: values.themeAccent?.trim(),
              accentSoft: values.themeAccentSoft?.trim(),
              accentContrast: values.themeAccentContrast?.trim(),
              surface: values.themeSurface?.trim(),
              surfaceAlt: values.themeSurfaceAlt?.trim(),
              text: values.themeText?.trim(),
              textMuted: values.themeTextMuted?.trim(),
              border: values.themeBorder?.trim(),
            }
            const set = Object.entries(tokens).filter(([, v]) => Boolean(v))
            return set.length > 0 ? Object.fromEntries(set) : undefined
          })(),

          orderForm: values.orderForm,

          successHeading: values.successHeading?.trim() || undefined,
          successMessage: values.successMessage?.trim() || undefined,

          metaTitle: values.metaTitle?.trim() || undefined,
          metaDescription: values.metaDescription?.trim() || undefined,
          ogImageUrl: values.ogImageUrl?.trim() || undefined,
          // Empty string, not undefined: "" is how the backend's schema spells
          // "clear the pixel", and a merchant who pastes an id then thinks
          // better of it must be able to take it back out.
          facebookPixelId: values.facebookPixelId?.trim() ?? '',

          sortOrder: values.sortOrder,
        }

        try {
          if (isEdit) {
            await updateMutation.mutateAsync({ id: landingPageId as string, input })
            return
          }
          const created = await createMutation.mutateAsync(input)
          return { id: created.id }
        } catch (err) {
          const message = err instanceof Error ? err.message : ''
          /*
           * The server's message for a slug clash, put on the slug field rather
           * than left only to the banner above the form. A conflict is about one
           * field and has one fix; reporting it page-wide leaves the merchant to
           * work out which input it means.
           *
           * Recognised by what the server actually says — see `assertSlugAvailable`.
           */
          if (message.includes('slug')) form.setError('slug', { message })
          throw err
        }
      }}
    >
      <LandingPageFields form={form} isEdit={isEdit} record={data} />
    </ResourceFormPage>
  )
}

/**
 * One of the repeatable lists, under its heading.
 *
 * The heading was a `<Label>`, which renders a real `<label>` with nothing to
 * point at: a list of gallery rows has no single control to be the label FOR,
 * and the comment beside the first one said as much while still using one. An
 * unassociated label is invalid markup, and a screen reader reaching it
 * announces a label whose control it cannot find.
 *
 * A `role="group"` named by the heading is the fix that also gains something:
 * the rows are now announced as being inside "Gallery" rather than as a run of
 * loose fields, which on a page with six of these lists is the difference
 * between structure and a wall of inputs. `<fieldset>`/`<legend>` would say the
 * same thing, but its default box and legend placement would have to be
 * unstyled back out of every list.
 */
function FieldGroup({
  label,
  children,
}: {
  label: React.ReactNode
  children: React.ReactNode
}) {
  const headingId = `${React.useId()}-heading`
  return (
    <div className="flex flex-col gap-1.5">
      <span id={headingId} className="text-xs font-medium text-foreground">
        {label}
      </span>
      <div role="group" aria-labelledby={headingId} className="flex flex-col gap-1.5">
        {children}
      </div>
    </div>
  )
}

function LandingPageFields({
  form,
  isEdit,
  record,
}: {
  form: LandingPageForm
  isEdit: boolean
  record?: LandingPage
}) {
  const { data: productsData } = useProducts({ limit: 200 })
  const products = productsData?.data ?? []

  /*
   * The slug follows the title only until the merchant takes it over, and never
   * auto-changes on an existing page: the slug is a live URL that an ad may
   * already be pointing at, and moving it mid-campaign sends paid traffic to a
   * 404.
   */
  const [slugIsManual, setSlugIsManual] = React.useState(isEdit)

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (slugIsManual) return
    form.setValue('slug', slugify(event.target.value))
  }

  const selectedProductId = useWatch({ control: form.control, name: 'productId' })
  const selectedProduct = products.find((product) => product.id === selectedProductId)

  return (
    <div className="flex flex-col gap-6">
      <EditorSection
        title="Basics"
        description="What this campaign is called internally, where it lives, and what it sells."
      >
        <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Campaign name</FormLabel>
                <FormControl>
                  {/* `field.onChange` first: the slug is derived from the title
                      the form now holds, so the write has to land before it is
                      read. */}
                  <Input
                    placeholder="শীতের অফার - হুডি"
                    {...field}
                    onChange={(event) => {
                      field.onChange(event)
                      handleTitleChange(event)
                    }}
                  />
                </FormControl>
                <FormDescription>
                  Shown in this list only — never on the page itself.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address</FormLabel>
                {/* The leading "/offer/" is a joined, non-editable prefix saying
                    the value is a path segment, not a full URL. It sits outside
                    `FormControl` so the label still points at the input rather
                    than at the wrapper.

                    `aria-hidden`: the label already reads "Address", and a
                    screen reader announcing "/offer/" as a separate stop before it
                    is noise, not context — the FormDescription carries the
                    meaning in words. */}
                <div className="flex w-full">
                  <span
                    aria-hidden
                    className="inline-flex shrink-0 items-center rounded-l-md border border-r-0 border-input bg-muted px-2.5 text-sm text-muted-foreground"
                  >
                    /offer/
                  </span>
                  <FormControl>
                    {/* `-ml-px` with `focus:z-10`: the two borders would
                        otherwise stack into a 2px seam, and the focus ring drew
                        UNDER the prefix on the left edge. */}
                    <Input
                      placeholder="winter-hoodie-offer"
                      className="-ml-px rounded-l-none focus-visible:z-10"
                      {...field}
                      onChange={(event) => {
                        field.onChange(event)
                        setSlugIsManual(true)
                      }}
                    />
                  </FormControl>
                </div>
                <FormDescription>
                  {isEdit
                    ? 'Changing this breaks any ad already pointing at the page.'
                    : 'Left blank, this is built from the campaign name.'}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="productId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Product</FormLabel>
                {/* A `Combobox` rather than a `Select`: the shop can carry
                    hundreds of products, and antd's control here was
                    `showSearch` for exactly that reason. */}
                <FormControl>
                  <Combobox
                    options={products.map((product) => ({
                      value: product.id,
                      label: product.name,
                    }))}
                    value={field.value}
                    onValueChange={(value) => field.onChange(value ?? '')}
                    onBlur={field.onBlur}
                    placeholder="Search your products…"
                    searchPlaceholder="Search products"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft — not reachable on your site</SelectItem>
                    <SelectItem value="PUBLISHED">Published — live at its address</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/*
          The price, shown read-only beside the product picker.
          A landing page cannot author a price and that is deliberate — a second
          place to write money is how a shop quotes one number and charges
          another. Said here, next to where a merchant would look for the field,
          rather than left to be discovered by its absence.
        */}
        {selectedProduct && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
            <Info className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              This page will show{' '}
              <strong className="text-foreground">
                {/* Decimal columns read back as strings from the API. */}
                {formatCurrency(Number(selectedProduct.offerPrice))}
              </strong>
              {selectedProduct.sellingPrice ? (
                <>
                  {' '}
                  with{' '}
                  <span className="line-through">
                    {formatCurrency(Number(selectedProduct.sellingPrice))}
                  </span>{' '}
                  struck through
                </>
              ) : null}
              .
            </span>
            <span className="text-muted-foreground">
              The price comes from the product — edit it there.
            </span>
            {/*
              Opens in a new tab, and is a real anchor rather than a `Link`.
              Both deliberate, for the same reason: this sits inside an unsaved
              form. A router `Link` would navigate this tab away and take every
              entered value with it, and the merchant clicked it to CHECK a
              price, not to abandon a campaign they are halfway through writing.
            */}
            <a
              href={`/catalog/products/${selectedProduct.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline"
            >
              Open product
              <ExternalLink className="size-3.5" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </div>
        )}

        {/*
          Preview, for a draft as much as a published page — the whole point is
          seeing it before it is live. Only offered once the page exists,
          because the link is built from its stored slug.
        */}
        {isEdit && record && (
          <a
            /*
              The PREVIEW route, not the public one. `/offer/<slug>` returns the
              same 404 for a draft as for a slug that never existed — on purpose,
              so unpublished campaigns cannot be probed for — which made it
              useless for the one thing this link is for. `/preview` forwards the
              merchant's session and renders any status.
            */
            href={storefrontUrl(`/offer/${record.slug}/preview`)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            <ExternalLink className="size-4" aria-hidden />
            Preview /offer/{record.slug}
            <span className="sr-only">(opens in a new tab)</span>
            {record.status === 'DRAFT' && (
              <span className="font-normal text-muted-foreground">
                (signed in as you — visitors get a 404)
              </span>
            )}
          </a>
        )}
      </EditorSection>

      <EditorSection
        title="Hero & media"
        description="The first thing someone sees after clicking your ad."
      >
        <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="headline"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Headline</FormLabel>
                <FormControl>
                  <Input placeholder="প্রিমিয়াম উইন্টার হুডি — সীমিত সময়ের অফার" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="badgeText"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Badge</FormLabel>
                <FormControl>
                  <Input placeholder="৩৫% ছাড়" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="subheadline"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Sub-headline</FormLabel>
                <FormControl>
                  <Textarea
                    rows={2}
                    placeholder="নরম ফ্লিস, ঠান্ডায় আরামদায়ক। ক্যাশ অন ডেলিভারি।"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FieldGroup label="Gallery">
          <MediaListField form={form} />
        </FieldGroup>
      </EditorSection>

      <EditorSection
        title="Content"
        description="The description, the selling points and the questions people ask."
      >
        <FormField
          control={form.control}
          name="bodyHtml"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <RichTextEditor value={field.value} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FieldGroup label="Why buy this">
          <HighlightsListField form={form} />
        </FieldGroup>

        <FieldGroup label="Questions & answers">
          <FaqsListField form={form} />
        </FieldGroup>
      </EditorSection>

      <EditorSection
        title="The offer"
        description="Packages, a deadline and a limited run. Every one of these is optional — a page that sets none of them behaves exactly as it did before they existed."
      >
        <FieldGroup label="Packages">
          <PackagesListField form={form} />

          {/*
            What each tier actually sold. Shown beside the editor rather than on
            a separate screen, because the decision it informs — which tier to
            push, which to reprice — is made while looking at them.

            Reads the captured label, so a tier removed above still reports what
            it earned.
          */}
          {record?.packageTotals && record.packageTotals.length > 0 && (
            <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <p className="mb-2 font-medium text-foreground">What each package sold</p>
              <ul className="flex flex-col gap-1">
                {record.packageTotals.map((row) => (
                  <li
                    key={row.key ?? row.label ?? 'unknown'}
                    className="flex items-baseline justify-between gap-3 text-muted-foreground"
                  >
                    <span>{row.label ?? row.key}</span>
                    <span className="tabular-nums">
                      {row.orderCount} order{row.orderCount === 1 ? '' : 's'} ·{' '}
                      <span className="font-medium text-foreground">
                        {formatCurrency(row.revenue)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </FieldGroup>

        <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="offerEndsAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Offer ends</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} />
                </FormControl>
                <FormDescription>
                  Shows a countdown to this moment. Left blank, no countdown is shown.
                  Every visitor counts down to the same time — it never restarts.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="stopOrdersAtDeadline"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stop taking orders at the deadline</FormLabel>
                <FormControl>
                  <div className="pt-2">
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </div>
                </FormControl>
                <FormDescription>
                  Off, the countdown is urgency only and orders keep coming in after
                  it reaches zero.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="scarcityTarget"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Limited run</FormLabel>
                <FormControl>
                  <NumberInput min={1} className="w-full" {...field} />
                </FormControl>
                <FormDescription>
                  e.g. 100 for &quot;first 100 buyers&quot;. Progress is counted from
                  your real orders — there is no way to set a starting number, and
                  there never will be: a figure a shopper catches you inventing costs
                  you every other claim on the page.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="orderPhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Order by phone</FormLabel>
                <FormControl>
                  <Input placeholder="01867788456" {...field} />
                </FormControl>
                <FormDescription>
                  Shown as a call button beside the form, for shoppers who will not
                  type an address. Left blank, no button appears.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <AdvancePaymentSwitch form={form} />

        <FieldGroup label="Why us">
          <WhyUsListField form={form} />
        </FieldGroup>

        <FieldGroup label="Usage ideas">
          <UsageIdeasListField form={form} />
        </FieldGroup>

        <FieldGroup label="Colours">
          <ThemeTokenFields form={form} />
        </FieldGroup>
      </EditorSection>

      <EditorSection
        title="Social proof"
        description="Quotes and badges. Each section is left off the page entirely when it is empty."
      >
        <FieldGroup label="Customer quotes">
          <QuotesListField form={form} />
        </FieldGroup>

        <FieldGroup label="Trust badges">
          <TrustBadgesListField form={form} />
        </FieldGroup>
      </EditorSection>

      <EditorSection
        title="Order form"
        description="What the page asks for, and what delivery costs. These are the words your customer reads — write them in whatever language your customers use."
      >
        <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="orderForm.heading"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Form heading</FormLabel>
                <FormControl>
                  <Input placeholder="অর্ডার করতে নিচের ফর্মটি পূরণ করুন" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="orderForm.subheading"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Form sub-heading</FormLabel>
                <FormControl>
                  <Input placeholder="আপনার তথ্য দিন, পণ্য হাতে পেয়ে টাকা পরিশোধ করুন।" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-x-6 gap-y-4 md:grid-cols-3">
          <FormField
            control={form.control}
            name="orderForm.fields.fullName.label"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name field label</FormLabel>
                <FormControl>
                  <Input placeholder="নাম" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="orderForm.fields.fullName.placeholder"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name placeholder</FormLabel>
                <FormControl>
                  <Input placeholder="আপনার সম্পূর্ণ নাম" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* The switch is not a third text field, so it does not pretend to be
              one. In the grid it inherited a stacked label and sat as a 20px
              control floating in a cell sized for an input; here the label is
              beside it, at the same height as the two inputs' boxes, and the
              row reads as one setting rather than a short third column. */}
          <FormField
            control={form.control}
            name="orderForm.fields.fullName.required"
            render={({ field }) => (
              <FormItem className="flex flex-col justify-end">
                <div className="flex h-8 items-center gap-2">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel>Ask for a name</FormLabel>
                </div>
                <FormDescription>The only field you can make optional.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="orderForm.fields.phone.label"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone field label</FormLabel>
                <FormControl>
                  <Input placeholder="মোবাইল নম্বর" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="orderForm.fields.phone.placeholder"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone placeholder</FormLabel>
                <FormControl>
                  <Input placeholder="01XXXXXXXXX" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="orderForm.fields.phone.helper"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone hint</FormLabel>
                <FormControl>
                  <Input placeholder="অর্ডার কনফার্ম করতে আমরা এই নম্বরে কল করব।" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="orderForm.fields.address.label"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address field label</FormLabel>
                <FormControl>
                  <Input placeholder="ঠিকানা" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="orderForm.fields.address.placeholder"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address placeholder</FormLabel>
                <FormControl>
                  <Input placeholder="গ্রাম/রোড, থানা, জেলা" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="orderForm.fields.address.helper"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address hint</FormLabel>
                <FormControl>
                  {/* The one input on the page that had no placeholder, which
                      read as an unfinished field beside its two siblings rather
                      than as the optional one it is. */}
                  <Input placeholder="বিস্তারিত ঠিকানা দিলে ডেলিভারি দ্রুত হয়।" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/*
          Stated rather than left to be discovered by the absence of two
          switches. A merchant looking for "make phone optional" should find the
          reason it is not there, not conclude the screen is unfinished.
        */}
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          The phone number and address are always asked for and always required. Cash on delivery
          needs a number to confirm the order on and an address to deliver to, and order tracking is
          keyed on the phone.
        </p>

        {/*
          The delivery-areas editor used to be here. A merchant who comes
          looking for it must find out where it went — an editor that silently
          vanishes reads as a feature that broke.
        */}
        <FieldGroup label="Delivery">
          <p className="text-sm text-muted-foreground">
            Delivery areas and prices are no longer set per campaign. The shopper
            picks their district and the charge comes from your shop&apos;s own
            delivery options, so the same address costs the same whether someone
            orders through your shop or through this page — and changing a price
            in{' '}
            <a
              href="/ui/checkout-settings"
              className="text-primary underline-offset-4 hover:underline"
            >
              Checkout Setting
            </a>{' '}
            changes it everywhere at once.
          </p>
        </FieldGroup>

        <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="orderForm.submitLabel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Order button</FormLabel>
                <FormControl>
                  <Input placeholder="অর্ডার কনফার্ম করুন" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="orderForm.notice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Note under the button</FormLabel>
                <FormControl>
                  <Input placeholder="ক্যাশ অন ডেলিভারি — পণ্য হাতে পেয়ে টাকা দিন।" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </EditorSection>

      <EditorSection
        title="After the order"
        description="What the customer reads once their order goes through. Shown in place — they are never sent away from your campaign."
      >
        <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="successHeading"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Thank-you heading</FormLabel>
                <FormControl>
                  <Input placeholder="ধন্যবাদ! আপনার অর্ডারটি গ্রহণ করা হয়েছে।" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="successMessage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Thank-you message</FormLabel>
                <FormControl>
                  <Textarea
                    rows={2}
                    placeholder="আমাদের প্রতিনিধি শীঘ্রই আপনার সাথে যোগাযোগ করবে।"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </EditorSection>

      <EditorSection
        title="Search & tracking"
        description="How the page appears when shared, and how you measure the ads pointing at it."
      >
        <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="metaTitle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Search title</FormLabel>
                <FormControl>
                  <Input placeholder="উইন্টার হুডি অফার" {...field} />
                </FormControl>
                <FormDescription>Left blank, the headline is used.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="metaDescription"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Search description</FormLabel>
                <FormControl>
                  <Textarea rows={2} {...field} />
                </FormControl>
                <FormDescription>
                  Left blank, the start of your description is used.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="ogImageUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Share image</FormLabel>
                <ImageUrlField value={field.value ?? ''} onChange={field.onChange} />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="facebookPixelId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Facebook Pixel ID</FormLabel>
                <FormControl>
                  <Input placeholder="1234567890" inputMode="numeric" {...field} />
                </FormControl>
                <FormDescription>
                  Digits only. Leave blank if you are not running Meta ads.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sortOrder"
            render={({ field }) => (
              <FormItem>
                <FormLabel>List order</FormLabel>
                <FormControl>
                  <NumberInput min={0} className="w-full" {...field} />
                </FormControl>
                <FormDescription>Orders this admin list only.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </EditorSection>
    </div>
  )
}


/**
 * The per-campaign advance-payment switch.
 *
 * DISABLED WHEN THE SHOP CANNOT BACK IT, with the reason shown, so the form
 * cannot express something the API will refuse — the same posture the rest of
 * the panel takes. The accounts are configured two screens away, which is
 * exactly the kind of dependency a merchant otherwise discovers as "the toggle
 * does nothing", so the link is part of the control rather than documentation.
 *
 * There is deliberately no account field here. The bKash and bank details are
 * the shop's, shared by every campaign — a merchant maintaining the same number
 * in six campaign pages will eventually update five of them, and the sixth
 * takes real money to a closed account.
 */
function AdvancePaymentSwitch({ form }: { form: LandingPageForm }) {
  const settings = useStoreSettings()
  const advance = settings.data?.checkoutConfig?.advancePayment

  const shopEnabled = Boolean(advance?.enabled)
  const hasAccount =
    (advance?.mobileAccounts?.length ?? 0) > 0 || (advance?.bankAccounts?.length ?? 0) > 0
  const available = shopEnabled && hasAccount

  return (
    <FormField
      control={form.control}
      name="requiresAdvancePayment"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Take payment in advance</FormLabel>
          <FormControl>
            <div className="pt-2">
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={!available}
              />
            </div>
          </FormControl>
          <FormDescription>
            {available ? (
              <>
                The shopper sends the delivery charge — or the full amount — before
                you ship, and an order waits until you verify it. Uses the accounts
                from{' '}
                <a
                  href="/ui/checkout-settings"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Checkout Setting
                </a>
                , shared by every campaign. Fewer orders, but far fewer refused
                parcels — which is the trade this is for.
              </>
            ) : (
              <>
                {shopEnabled
                  ? 'Add a mobile banking or bank account in '
                  : 'Turn advance payment on in '}
                <a
                  href="/ui/checkout-settings"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Checkout Setting
                </a>{' '}
                before a campaign can ask for it.
              </>
            )}
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

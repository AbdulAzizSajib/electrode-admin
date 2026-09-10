import * as React from 'react'
import { useParams } from 'react-router'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ExternalLink, Info } from 'lucide-react'
import { ResourceFormPage } from '@/components/crud/resource-form-page'
import { Combobox } from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  DeliveryZonesField,
  FaqsListField,
  HighlightsListField,
  MediaListField,
  QuotesListField,
  TrustBadgesListField,
} from '@/features/ui/landing-pages/landing-page-lists'
import {
  EMPTY,
  schema,
  slugify,
  type FormValues,
  type LandingPageForm,
  type OutputValues,
} from '@/features/ui/landing-pages/landing-page-schema'
import { useLandingPage, useCreateLandingPage, useUpdateLandingPage, type LandingPage } from '@/lib/api/landing-pages'
import { useProducts } from '@/lib/api/products'
import { formatCurrency } from '@/lib/utils/format'

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
        deliveryZones: page.deliveryZones,
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
          subheadline: values.subheadline?.trim() || undefined,
          badgeText: values.badgeText?.trim() || undefined,
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

          deliveryZones: values.deliveryZones,
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
                {/* The leading "/lp/" is antd's `addonBefore`: a joined,
                    non-editable prefix that says the value is a path segment,
                    not a full URL. It sits outside `FormControl` so the label
                    still points at the input rather than at the wrapper. */}
                <div className="flex w-full">
                  <span className="inline-flex shrink-0 items-center rounded-l-md border border-r-0 border-input bg-muted px-2.5 text-sm text-muted-foreground">
                    /lp/
                  </span>
                  <FormControl>
                    <Input
                      placeholder="winter-hoodie-offer"
                      className="rounded-l-none"
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
            <a
              href={`/catalog/products/${selectedProduct.id}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Open product
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
            href={`/lp/${record.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            <ExternalLink className="size-4" aria-hidden />
            Preview /lp/{record.slug}
            {record.status === 'DRAFT' && (
              <span className="text-muted-foreground">(signed in as you — visitors get a 404)</span>
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

        {/* A plain label, not a `FormLabel`: "Gallery" names the whole list and
            has no single field to point at. */}
        <div className="flex flex-col gap-1.5">
          <Label>Gallery</Label>
          <MediaListField form={form} />
        </div>
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

        <div className="flex flex-col gap-1.5">
          <Label>Why buy this</Label>
          <HighlightsListField form={form} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Questions &amp; answers</Label>
          <FaqsListField form={form} />
        </div>
      </EditorSection>

      <EditorSection
        title="Social proof"
        description="Quotes and badges. Each section is left off the page entirely when it is empty."
      >
        <div className="flex flex-col gap-1.5">
          <Label>Customer quotes</Label>
          <QuotesListField form={form} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Trust badges</Label>
          <TrustBadgesListField form={form} />
        </div>
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
          <FormField
            control={form.control}
            name="orderForm.fields.fullName.required"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name required</FormLabel>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
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
                  <Input {...field} />
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

        <div className="flex flex-col gap-1.5">
          <Label>Delivery areas</Label>
          <DeliveryZonesField form={form} />
          <p className="text-xs text-muted-foreground">
            What you charge for delivery to each area. This is what the customer is charged — your
            product&apos;s shipping rule and any free-delivery threshold do not apply here.
          </p>
        </div>

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

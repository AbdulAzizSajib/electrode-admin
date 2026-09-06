import * as React from 'react'
import { useParams } from 'react-router'
import { Form, Input, InputNumber, Select, Switch, type FormInstance } from 'antd'
import { ExternalLink, Info } from 'lucide-react'
import { ResourceFormPage } from '@/components/crud/resource-form-page'
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
  useLandingPage,
  useCreateLandingPage,
  useUpdateLandingPage,
  type DeliveryZone,
  type LandingPage,
  type LandingPageFaq,
  type LandingPageHighlight,
  type LandingPageMedia,
  type LandingPageOrderForm,
  type LandingPageQuote,
  type LandingPageStatus,
  type LandingPageTrustBadge,
} from '@/lib/api/landing-pages'
import { useProducts } from '@/lib/api/products'
import { formatCurrency } from '@/lib/utils/format'

interface FormValues {
  title: string
  slug?: string
  status: LandingPageStatus
  productId: string

  headline: string
  subheadline?: string
  badgeText?: string
  bodyHtml: string

  media: LandingPageMedia[]
  highlights: LandingPageHighlight[]
  faqs: LandingPageFaq[]
  quotes: LandingPageQuote[]
  trustBadges: LandingPageTrustBadge[]

  deliveryZones: DeliveryZone[]
  orderForm: LandingPageOrderForm

  successHeading?: string
  successMessage?: string

  metaTitle?: string
  metaDescription?: string
  ogImageUrl?: string
  facebookPixelId?: string

  sortOrder: number
}

/**
 * What a NEW page starts with, mirroring the backend's own seed defaults.
 *
 * Duplicated here rather than fetched because the create form has no record to
 * read them from, and a merchant should see the Bangla labels they are about to
 * publish rather than empty boxes. The backend applies the same values when a
 * create payload omits them, so the two cannot diverge in behaviour — only in
 * what the merchant is shown before saving.
 */
const DEFAULT_ZONES: DeliveryZone[] = [
  { key: 'inside-dhaka', label: 'ঢাকার ভিতরে', price: 60 },
  { key: 'outside-dhaka', label: 'ঢাকার বাইরে', price: 120 },
]

const DEFAULT_ORDER_FORM: LandingPageOrderForm = {
  heading: 'অর্ডার করতে নিচের ফর্মটি পূরণ করুন',
  subheading: 'আপনার তথ্য দিন, পণ্য হাতে পেয়ে টাকা পরিশোধ করুন।',
  fields: {
    fullName: { label: 'নাম', placeholder: 'আপনার সম্পূর্ণ নাম', required: true },
    phone: {
      label: 'মোবাইল নম্বর',
      placeholder: '01XXXXXXXXX',
      helper: 'অর্ডার কনফার্ম করতে আমরা এই নম্বরে কল করব।',
    },
    address: { label: 'ঠিকানা', placeholder: 'গ্রাম/রোড, থানা, জেলা' },
  },
  submitLabel: 'অর্ডার কনফার্ম করুন',
  notice: 'ক্যাশ অন ডেলিভারি — পণ্য হাতে পেয়ে টাকা দিন।',
}

const EMPTY: FormValues = {
  title: '',
  slug: '',
  status: 'DRAFT',
  productId: '',
  headline: '',
  subheadline: '',
  badgeText: '',
  bodyHtml: '',
  media: [],
  highlights: [],
  faqs: [],
  quotes: [],
  trustBadges: [],
  deliveryZones: DEFAULT_ZONES,
  orderForm: DEFAULT_ORDER_FORM,
  successHeading: '',
  successMessage: '',
  metaTitle: '',
  metaDescription: '',
  ogImageUrl: '',
  facebookPixelId: '',
  sortOrder: 0,
}

/** Mirrors the backend's `slugifyCampaignTitle`, so the preview matches what gets stored. */
const slugify = (title: string) =>
  title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/** Mirrors the backend's `slugPattern`. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export default function LandingPageFormPage() {
  const { landingPageId } = useParams()
  const isEdit = Boolean(landingPageId)

  const { data, isLoading, error } = useLandingPage(landingPageId)
  const createMutation = useCreateLandingPage()
  const updateMutation = useUpdateLandingPage()

  /**
   * The server's message for a slug clash, shown on the slug field rather than
   * only as a toast. A conflict is about one field and has one fix; a
   * page-level toast leaves the merchant to work out which input it means.
   */
  const [slugError, setSlugError] = React.useState<string | null>(null)

  return (
    <ResourceFormPage<FormValues, LandingPage>
      noun="Landing page"
      listPath={LANDING_PAGES_PATH}
      recordId={landingPageId}
      record={data}
      isLoading={isLoading}
      loadError={error}
      emptyValues={EMPTY}
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
        setSlugError(null)

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
          // Recognised by what the server actually says — see `assertSlugAvailable`.
          if (message.includes('slug')) setSlugError(message)
          throw err
        }
      }}
    >
      {(form) => <LandingPageFields form={form} isEdit={isEdit} record={data} slugError={slugError} />}
    </ResourceFormPage>
  )
}

function LandingPageFields({
  form,
  isEdit,
  record,
  slugError,
}: {
  form: FormInstance<FormValues>
  isEdit: boolean
  record?: LandingPage
  slugError: string | null
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
    form.setFieldValue('slug', slugify(event.target.value))
  }

  const selectedProductId = Form.useWatch('productId', form)
  const selectedProduct = products.find((product) => product.id === selectedProductId)

  return (
    <div className="flex flex-col gap-6">
      <EditorSection
        title="Basics"
        description="What this campaign is called internally, where it lives, and what it sells."
      >
        <div className="grid gap-x-6 md:grid-cols-2">
          <Form.Item
            name="title"
            label="Campaign name"
            extra="Shown in this list only — never on the page itself."
            rules={[{ required: true, message: 'Give this campaign a name' }]}
          >
            <Input placeholder="শীতের অফার - হুডি" onChange={handleTitleChange} />
          </Form.Item>

          <Form.Item
            name="slug"
            label="Address"
            validateStatus={slugError ? 'error' : undefined}
            help={slugError ?? undefined}
            extra={
              isEdit
                ? 'Changing this breaks any ad already pointing at the page.'
                : 'Left blank, this is built from the campaign name.'
            }
            rules={[
              {
                validator: async (_rule, value: string | undefined) => {
                  const slug = value?.trim()
                  if (!slug) return
                  if (!SLUG_PATTERN.test(slug)) {
                    throw new Error('Use lowercase words separated by single hyphens')
                  }
                },
              },
            ]}
          >
            <Input
              placeholder="winter-hoodie-offer"
              addonBefore="/lp/"
              onChange={() => setSlugIsManual(true)}
            />
          </Form.Item>

          <Form.Item
            name="productId"
            label="Product"
            rules={[{ required: true, message: 'Choose the product this page sells' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Search your products…"
              options={products.map((product) => ({ value: product.id, label: product.name }))}
            />
          </Form.Item>

          <Form.Item name="status" label="Status">
            <Select
              options={[
                { value: 'DRAFT', label: 'Draft — not reachable on your site' },
                { value: 'PUBLISHED', label: 'Published — live at its address' },
              ]}
            />
          </Form.Item>
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
        <div className="grid gap-x-6 md:grid-cols-2">
          <Form.Item
            name="headline"
            label="Headline"
            rules={[{ required: true, message: 'Write the headline' }]}
          >
            <Input placeholder="প্রিমিয়াম উইন্টার হুডি — সীমিত সময়ের অফার" />
          </Form.Item>

          <Form.Item name="badgeText" label="Badge">
            <Input placeholder="৩৫% ছাড়" />
          </Form.Item>

          <Form.Item name="subheadline" label="Sub-headline" className="md:col-span-2">
            <Input.TextArea rows={2} placeholder="নরম ফ্লিস, ঠান্ডায় আরামদায়ক। ক্যাশ অন ডেলিভারি।" />
          </Form.Item>
        </div>

        <Form.Item label="Gallery" className="mb-0">
          <MediaListField />
        </Form.Item>
      </EditorSection>

      <EditorSection
        title="Content"
        description="The description, the selling points and the questions people ask."
      >
        <Form.Item
          name="bodyHtml"
          label="Description"
          rules={[{ required: true, message: 'Describe what you are selling' }]}
        >
          <RichTextEditor />
        </Form.Item>

        <Form.Item label="Why buy this" className="mb-0">
          <HighlightsListField />
        </Form.Item>

        <Form.Item label="Questions & answers" className="mb-0">
          <FaqsListField />
        </Form.Item>
      </EditorSection>

      <EditorSection
        title="Social proof"
        description="Quotes and badges. Each section is left off the page entirely when it is empty."
      >
        <Form.Item label="Customer quotes" className="mb-0">
          <QuotesListField />
        </Form.Item>

        <Form.Item label="Trust badges" className="mb-0">
          <TrustBadgesListField />
        </Form.Item>
      </EditorSection>

      <EditorSection
        title="Order form"
        description="What the page asks for, and what delivery costs. These are the words your customer reads — write them in whatever language your customers use."
      >
        <div className="grid gap-x-6 md:grid-cols-2">
          <Form.Item name={['orderForm', 'heading']} label="Form heading">
            <Input placeholder="অর্ডার করতে নিচের ফর্মটি পূরণ করুন" />
          </Form.Item>
          <Form.Item name={['orderForm', 'subheading']} label="Form sub-heading">
            <Input placeholder="আপনার তথ্য দিন, পণ্য হাতে পেয়ে টাকা পরিশোধ করুন।" />
          </Form.Item>
        </div>

        <div className="grid gap-x-6 md:grid-cols-3">
          <Form.Item
            name={['orderForm', 'fields', 'fullName', 'label']}
            label="Name field label"
            rules={[{ required: true, message: 'Label the name field' }]}
          >
            <Input placeholder="নাম" />
          </Form.Item>
          <Form.Item
            name={['orderForm', 'fields', 'fullName', 'placeholder']}
            label="Name placeholder"
          >
            <Input placeholder="আপনার সম্পূর্ণ নাম" />
          </Form.Item>
          <Form.Item
            name={['orderForm', 'fields', 'fullName', 'required']}
            label="Name required"
            valuePropName="checked"
            extra="The only field you can make optional."
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name={['orderForm', 'fields', 'phone', 'label']}
            label="Phone field label"
            rules={[{ required: true, message: 'Label the phone field' }]}
          >
            <Input placeholder="মোবাইল নম্বর" />
          </Form.Item>
          <Form.Item
            name={['orderForm', 'fields', 'phone', 'placeholder']}
            label="Phone placeholder"
          >
            <Input placeholder="01XXXXXXXXX" />
          </Form.Item>
          <Form.Item name={['orderForm', 'fields', 'phone', 'helper']} label="Phone hint">
            <Input placeholder="অর্ডার কনফার্ম করতে আমরা এই নম্বরে কল করব।" />
          </Form.Item>

          <Form.Item
            name={['orderForm', 'fields', 'address', 'label']}
            label="Address field label"
            rules={[{ required: true, message: 'Label the address field' }]}
          >
            <Input placeholder="ঠিকানা" />
          </Form.Item>
          <Form.Item
            name={['orderForm', 'fields', 'address', 'placeholder']}
            label="Address placeholder"
          >
            <Input placeholder="গ্রাম/রোড, থানা, জেলা" />
          </Form.Item>
          <Form.Item name={['orderForm', 'fields', 'address', 'helper']} label="Address hint">
            <Input />
          </Form.Item>
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

        <Form.Item
          label="Delivery areas"
          extra="What you charge for delivery to each area. This is what the customer is charged — your product's shipping rule and any free-delivery threshold do not apply here."
          className="mb-0"
        >
          <DeliveryZonesField />
        </Form.Item>

        <div className="grid gap-x-6 md:grid-cols-2">
          <Form.Item
            name={['orderForm', 'submitLabel']}
            label="Order button"
            rules={[{ required: true, message: 'Label the order button' }]}
          >
            <Input placeholder="অর্ডার কনফার্ম করুন" />
          </Form.Item>
          <Form.Item name={['orderForm', 'notice']} label="Note under the button">
            <Input placeholder="ক্যাশ অন ডেলিভারি — পণ্য হাতে পেয়ে টাকা দিন।" />
          </Form.Item>
        </div>
      </EditorSection>

      <EditorSection
        title="After the order"
        description="What the customer reads once their order goes through. Shown in place — they are never sent away from your campaign."
      >
        <div className="grid gap-x-6 md:grid-cols-2">
          <Form.Item name="successHeading" label="Thank-you heading">
            <Input placeholder="ধন্যবাদ! আপনার অর্ডারটি গ্রহণ করা হয়েছে।" />
          </Form.Item>
          <Form.Item name="successMessage" label="Thank-you message">
            <Input.TextArea rows={2} placeholder="আমাদের প্রতিনিধি শীঘ্রই আপনার সাথে যোগাযোগ করবে।" />
          </Form.Item>
        </div>
      </EditorSection>

      <EditorSection
        title="Search & tracking"
        description="How the page appears when shared, and how you measure the ads pointing at it."
      >
        <div className="grid gap-x-6 md:grid-cols-2">
          <Form.Item
            name="metaTitle"
            label="Search title"
            extra="Left blank, the headline is used."
          >
            <Input placeholder="উইন্টার হুডি অফার" />
          </Form.Item>
          <Form.Item
            name="metaDescription"
            label="Search description"
            extra="Left blank, the start of your description is used."
          >
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.Item name="ogImageUrl" label="Share image">
            <ImageUrlField />
          </Form.Item>

          <Form.Item
            name="facebookPixelId"
            label="Facebook Pixel ID"
            extra="Digits only. Leave blank if you are not running Meta ads."
            rules={[
              {
                validator: async (_rule, value: string | undefined) => {
                  const id = value?.trim()
                  if (!id) return
                  if (!/^\d{5,20}$/.test(id)) {
                    throw new Error('A Pixel ID is digits only')
                  }
                },
              },
            ]}
          >
            <Input placeholder="1234567890" inputMode="numeric" />
          </Form.Item>

          <Form.Item name="sortOrder" label="List order" extra="Orders this admin list only.">
            <InputNumber min={0} className="w-full" />
          </Form.Item>
        </div>
      </EditorSection>
    </div>
  )
}

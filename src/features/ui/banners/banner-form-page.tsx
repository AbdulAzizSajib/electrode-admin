import * as React from 'react'
import { useParams } from 'react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ResourceFormPage } from '@/components/crud/resource-form-page'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { SingleImageField } from '@/components/forms/single-image-field'
import { BANNERS_PATH } from '@/features/ui/banners/banners-page'
import { PLACEMENT_LABEL } from '@/features/ui/banners/banner-labels'
import { isHeroPlacement } from '@/features/ui/home-slider/hero-slots'
import {
  useBanner,
  useCreateBanner,
  useUpdateBanner,
  BANNER_PLACEMENTS,
  BANNER_STATUSES,
  BANNER_TYPES,
  type Banner,
  type BannerInput,
  type BannerType,
} from '@/lib/api/banners'
import { useProducts } from '@/lib/api/products'

/**
 * Optional text stays a plain `string` rather than transforming blanks to `undefined`: a schema
 * whose input and output types differ makes react-hook-form's `Control` generics diverge and stop
 * being assignable to `FormField`. Blank-stripping happens in `toBannerPayload` instead, which has
 * to make those decisions per-field anyway.
 */
const optionalText = z.string().trim()
const optionalNumber = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.coerce.number().nonnegative('Cannot be negative').optional(),
)
const optionalHex = z
  .string()
  .trim()
  .refine((v) => !v || /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v), 'Must be a hex color, e.g. #FF5733')

/**
 * Mirrors the backend's per-type contract: a DYNAMIC banner requires a title, and an IMAGE banner
 * requires artwork. The image check accepts either a URL or a newly picked file, so it is applied
 * in `save` where the file state is in scope rather than here.
 */
const schema = z
  .object({
    type: z.enum(BANNER_TYPES),
    placement: z.enum(BANNER_PLACEMENTS),
    status: z.enum(BANNER_STATUSES),
    sortOrder: z.coerce.number().int('Must be a whole number'),
    image: optionalText,
    mobileImage: optionalText,
    title: z.string().trim(),
    subtitle: optionalText,
    description: optionalText,
    price: optionalNumber,
    discountPrice: optionalNumber,
    buttonText: optionalText,
    bgColor: optionalHex,
    textColor: optionalHex,
    linkMode: z.enum(['url', 'product']),
    link: optionalText,
    productId: optionalText,
    startsAt: z.string(),
    endsAt: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.type === 'DYNAMIC' && !v.title) {
      ctx.addIssue({ code: 'custom', message: 'Title is required for a dynamic banner', path: ['title'] })
    }
    if (v.startsAt && v.endsAt && v.endsAt < v.startsAt) {
      ctx.addIssue({ code: 'custom', message: 'End must be after start', path: ['endsAt'] })
    }
  })
type Values = z.input<typeof schema>
type OutputValues = z.output<typeof schema>

const EMPTY_VALUES: Values = {
  type: 'IMAGE',
  // Not a hero placement: those belong to the Home Slider manager, and a new
  // banner defaulting into one would be saved somewhere this form's list can no
  // longer show it.
  placement: 'MID',
  status: 'DRAFT',
  sortOrder: 0,
  image: '',
  mobileImage: '',
  title: '',
  subtitle: '',
  description: '',
  price: '',
  discountPrice: '',
  buttonText: '',
  bgColor: '',
  textColor: '',
  linkMode: 'url',
  link: '',
  productId: '',
  startsAt: '',
  endsAt: '',
}

function toFormValues(b: Banner): Values {
  return {
    type: b.type,
    placement: b.placement,
    status: b.status,
    sortOrder: b.sortOrder,
    image: b.image ?? '',
    mobileImage: b.mobileImage ?? '',
    title: b.title ?? '',
    subtitle: b.subtitle ?? '',
    description: b.description ?? '',
    price: b.price ?? '',
    discountPrice: b.discountPrice ?? '',
    buttonText: b.buttonText ?? '',
    bgColor: b.bgColor ?? '',
    textColor: b.textColor ?? '',
    linkMode: b.productId ? 'product' : 'url',
    link: b.link ?? '',
    productId: b.productId ?? '',
    startsAt: b.startsAt ? b.startsAt.slice(0, 16) : '',
    endsAt: b.endsAt ? b.endsAt.slice(0, 16) : '',
  }
}

/**
 * Builds the payload the backend will accept.
 *
 * The important part is the IMAGE branch: the backend *rejects* an IMAGE banner carrying any
 * DYNAMIC-only field rather than ignoring it, so those keys must be absent — not empty strings —
 * whenever the type is IMAGE. Sending them is a 400, not a silent no-op.
 */
function toBannerPayload(v: OutputValues): BannerInput {
  const input: BannerInput = {
    type: v.type,
    placement: v.placement,
    status: v.status,
    sortOrder: v.sortOrder,
  }

  if (v.image) input.image = v.image
  if (v.mobileImage) input.mobileImage = v.mobileImage

  if (v.type === 'DYNAMIC') {
    if (v.title) input.title = v.title
    if (v.subtitle) input.subtitle = v.subtitle
    if (v.description) input.description = v.description
    if (v.price !== undefined) input.price = v.price
    if (v.discountPrice !== undefined) input.discountPrice = v.discountPrice
    if (v.buttonText) input.buttonText = v.buttonText
    if (v.bgColor) input.bgColor = v.bgColor
    if (v.textColor) input.textColor = v.textColor
  }

  // The two link targets are alternatives; sending both would leave which one wins to the backend.
  if (v.linkMode === 'product') {
    if (v.productId) input.productId = v.productId
  } else if (v.link) {
    input.link = v.link
  }

  // `datetime-local` yields "YYYY-MM-DDTHH:mm"; the backend validates full ISO datetimes.
  if (v.startsAt) input.startsAt = new Date(v.startsAt).toISOString()
  if (v.endsAt) input.endsAt = new Date(v.endsAt).toISOString()

  return input
}

export default function BannerFormPage() {
  const { bannerId } = useParams()

  const { data, isLoading, error } = useBanner(bannerId)
  const { data: productsData } = useProducts({ limit: 100 })
  const createMutation = useCreateBanner()
  const updateMutation = useUpdateBanner()

  // The picked files are component state, not form fields — an upload is not a
  // value the schema validates, and the stored URL fields cover the other route
  // to the same artwork.
  const [imageFile, setImageFile] = React.useState<File | null>(null)
  const [mobileImageFile, setMobileImageFile] = React.useState<File | null>(null)

  const form = useForm<Values, unknown, OutputValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_VALUES,
  })

  const bannerType = form.watch('type') as BannerType
  const linkMode = form.watch('linkMode')
  const isDynamic = bannerType === 'DYNAMIC'

  const save = async (values: OutputValues) => {
    // The backend requires artwork on an IMAGE banner; a freshly picked file satisfies that just
    // as a stored URL does, so this check lives here where the file state is visible. It marks the
    // field *and* throws — the throw is what stops the shell reporting a save that never happened.
    if (values.type === 'IMAGE' && !values.image && !imageFile) {
      const message = 'An image banner needs artwork — upload a file or give a URL'
      form.setError('image', { message })
      throw new Error(message)
    }

    const input = toBannerPayload(values)

    if (bannerId) {
      await updateMutation.mutateAsync({ id: bannerId, input, imageFile, mobileImageFile })
      // The files have been sent; keeping them selected would re-upload the same
      // bytes on the next save from this page.
      setImageFile(null)
      setMobileImageFile(null)
      return
    }

    const created = await createMutation.mutateAsync({ input, imageFile, mobileImageFile })
    setImageFile(null)
    setMobileImageFile(null)
    return { id: created.id }
  }

  const products = productsData?.data ?? []

  return (
    <ResourceFormPage<Values, Banner, OutputValues>
      noun="Banner"
      listPath={BANNERS_PATH}
      recordId={bannerId}
      form={form}
      record={data}
      isLoading={isLoading}
      loadError={error}
      toValues={toFormValues}
      onSave={save}
    >
      <div className="grid gap-3.5 md:grid-cols-2">
        <FormField control={form.control} name="type" render={({ field }) => (
          <FormItem>
            <FormLabel>Type</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                {BANNER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <FormDescription>
              {isDynamic
                ? 'Text, price, and button drawn over a background.'
                : 'Artwork only — text fields are not stored for this type.'}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="placement" render={({ field }) => (
          <FormItem>
            <FormLabel>Placement</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                {/* The banner's own placement is kept in the list even when it
                    is a hero one, so opening an existing hero banner by URL
                    renders its current value instead of a blank select. */}
                {BANNER_PLACEMENTS.filter(
                  (p) => !isHeroPlacement(p) || p === field.value,
                ).map((p) => <SelectItem key={p} value={p}>{PLACEMENT_LABEL[p]}</SelectItem>)}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
      </div>

      <div className="grid gap-3.5 md:grid-cols-2">
        {/*
          Plain markup, not FormItem/FormLabel: those call useFormField(), which throws
          outside a FormField. The picked file is component state rather than a form field,
          so there is no FormField to sit inside.
        */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Desktop artwork</span>
          <SingleImageField value={imageFile} onChange={setImageFile} currentUrl={data?.image} />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Mobile artwork</span>
          <SingleImageField value={mobileImageFile} onChange={setMobileImageFile} currentUrl={data?.mobileImage} />
        </div>
      </div>

      <FormField control={form.control} name="image" render={({ field }) => (
        <FormItem>
          <FormLabel>…or image URL</FormLabel>
          <FormControl><Input placeholder="https://…" {...field} disabled={!!imageFile} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />

      {isDynamic && (
        <>
          <FormField control={form.control} name="title" render={({ field }) => (
            <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="subtitle" render={({ field }) => (
            <FormItem><FormLabel>Subtitle</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="description" render={({ field }) => (
            <FormItem><FormLabel>Description</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <div className="grid gap-3.5 md:grid-cols-2">
            <FormField control={form.control} name="price" render={({ field }) => (
              <FormItem><FormLabel>Price</FormLabel><FormControl><Input type="number" step="0.01" min="0" {...field} value={field.value === undefined ? '' : String(field.value)} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="discountPrice" render={({ field }) => (
              <FormItem><FormLabel>Discount price</FormLabel><FormControl><Input type="number" step="0.01" min="0" {...field} value={field.value === undefined ? '' : String(field.value)} /></FormControl><FormMessage /></FormItem>
            )} />
          </div>
          <FormField control={form.control} name="buttonText" render={({ field }) => (
            <FormItem><FormLabel>Button text</FormLabel><FormControl><Input placeholder="Shop Now" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <div className="grid gap-3.5 md:grid-cols-2">
            <FormField control={form.control} name="bgColor" render={({ field }) => (
              <FormItem><FormLabel>Background</FormLabel><FormControl><Input placeholder="#FF5733" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="textColor" render={({ field }) => (
              <FormItem><FormLabel>Text color</FormLabel><FormControl><Input placeholder="#FFFFFF" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
          </div>
        </>
      )}

      <div className="grid gap-3.5 md:grid-cols-2">
        <FormField control={form.control} name="linkMode" render={({ field }) => (
          <FormItem>
            <FormLabel>Link target</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="url">Manual URL</SelectItem>
                <SelectItem value="product">A product</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        {linkMode === 'product' ? (
          <FormField control={form.control} name="productId" render={({ field }) => (
            <FormItem>
              <FormLabel>Product</FormLabel>
              <Select value={field.value ?? ''} onValueChange={field.onChange}>
                <FormControl><SelectTrigger><SelectValue placeholder="Choose a product" /></SelectTrigger></FormControl>
                <SelectContent>
                  {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        ) : (
          <FormField control={form.control} name="link" render={({ field }) => (
            <FormItem><FormLabel>Link URL</FormLabel><FormControl><Input placeholder="https://…" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
        )}
      </div>

      <div className="grid gap-3.5 md:grid-cols-2">
        <FormField control={form.control} name="startsAt" render={({ field }) => (
          <FormItem><FormLabel>Starts at</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="endsAt" render={({ field }) => (
          <FormItem><FormLabel>Ends at</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
      </div>

      <div className="grid gap-3.5 md:grid-cols-2">
        <FormField control={form.control} name="status" render={({ field }) => (
          <FormItem>
            <FormLabel>Status</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                {BANNER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="sortOrder" render={({ field }) => (
          <FormItem>
            <FormLabel>Sort order</FormLabel>
            <FormControl><Input type="number" step="1" {...field} value={field.value === undefined ? '' : String(field.value)} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>
    </ResourceFormPage>
  )
}

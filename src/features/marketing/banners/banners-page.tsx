import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { GalleryHorizontal, ImageOff, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { SingleImageField } from '@/components/forms/single-image-field'
import { toast } from '@/components/ui/use-toast'
import {
  useBanners,
  useCreateBanner,
  useDeleteBanner,
  useUpdateBanner,
  BANNER_PLACEMENTS,
  BANNER_STATUSES,
  BANNER_TYPES,
  type Banner,
  type BannerInput,
  type BannerPlacement,
  type BannerStatus,
  type BannerType,
} from '@/lib/api/banners'
import { useProducts } from '@/lib/api/products'

const PLACEMENT_LABEL: Record<BannerPlacement, string> = {
  HEADER: 'Header',
  MID: 'Mid page',
  FOOTER: 'Footer',
  SIDEBAR: 'Sidebar',
  POPUP: 'Popup',
  HERO_SLIDER: 'Hero slider',
  HERO_SIDE: 'Hero side',
  HERO_PROMO: 'Hero promo',
}

const STATUS_VARIANT: Record<BannerStatus, 'success' | 'secondary' | 'warning'> = {
  ACTIVE: 'success',
  DRAFT: 'secondary',
  INACTIVE: 'secondary',
  SCHEDULED: 'warning',
}

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
 * in `onSubmit` where the file state is in scope rather than here.
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
  placement: 'HERO_SLIDER',
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

export default function BannersPage() {
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Banner | null>(null)
  const [imageFile, setImageFile] = React.useState<File | null>(null)
  const [mobileImageFile, setMobileImageFile] = React.useState<File | null>(null)
  const [placementFilter, setPlacementFilter] = React.useState<'all' | BannerPlacement>('all')
  const [statusFilter, setStatusFilter] = React.useState<'all' | BannerStatus>('all')

  const { data, isLoading, error } = useBanners({
    placement: placementFilter === 'all' ? undefined : placementFilter,
    status: statusFilter === 'all' ? undefined : statusFilter,
  })
  const { data: productsData } = useProducts({ limit: 100 })
  const createMutation = useCreateBanner()
  const updateMutation = useUpdateBanner()
  const deleteMutation = useDeleteBanner()
  const confirmDialog = useConfirmDialog()

  const form = useForm<Values, unknown, OutputValues>({
    resolver: zodResolver(schema),
    values: editing ? toFormValues(editing) : EMPTY_VALUES,
  })

  const bannerType = form.watch('type') as BannerType
  const linkMode = form.watch('linkMode')
  const isDynamic = bannerType === 'DYNAMIC'

  const openSheet = (banner: Banner | null) => {
    setEditing(banner)
    setImageFile(null)
    setMobileImageFile(null)
    setSheetOpen(true)
  }

  const closeSheet = () => {
    setImageFile(null)
    setMobileImageFile(null)
    setSheetOpen(false)
  }

  const onSubmit = async (values: OutputValues) => {
    // The backend requires artwork on an IMAGE banner; a freshly picked file satisfies that just
    // as a stored URL does, so this check lives here where the file state is visible.
    if (values.type === 'IMAGE' && !values.image && !imageFile) {
      form.setError('image', { message: 'An image banner needs artwork — upload a file or give a URL' })
      return
    }

    try {
      const input = toBannerPayload(values)
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, input, imageFile, mobileImageFile })
        toast({ title: 'Banner updated' })
      } else {
        await createMutation.mutateAsync({ input, imageFile, mobileImageFile })
        toast({ title: 'Banner created' })
      }
      closeSheet()
    } catch (err) {
      toast({ title: 'Something went wrong', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }

  const banners = data?.data ?? []
  const products = productsData?.data ?? []

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Banners"
        description="Promotional banners shown across the storefront."
        actions={
          <Button size="sm" onClick={() => openSheet(null)}>
            <Plus /> New banner
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={placementFilter} onValueChange={(v) => setPlacementFilter(v as 'all' | BannerPlacement)}>
          <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Placement" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All placements</SelectItem>
            {BANNER_PLACEMENTS.map((p) => <SelectItem key={p} value={p}>{PLACEMENT_LABEL[p]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | BannerStatus)}>
          <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {BANNER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : error ? (
        <p className="text-sm text-destructive">{error instanceof Error ? error.message : 'Could not load banners.'}</p>
      ) : banners.length === 0 ? (
        <EmptyState icon={GalleryHorizontal} title="No banners yet" description="Add a banner to promote something on the storefront." />
      ) : (
        <div className="flex flex-col gap-2">
          {banners.map((banner) => (
            <Card key={banner.id} className="flex items-center gap-3 p-2.5">
              {banner.image ? (
                <img src={banner.image} alt="" className="h-14 w-24 shrink-0 rounded-md border border-border object-cover" />
              ) : (
                <div className="flex h-14 w-24 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
                  <ImageOff className="size-4" />
                </div>
              )}
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="font-medium text-foreground">{banner.title ?? <span className="text-muted-foreground">Untitled</span>}</span>
                <span className="text-xs text-muted-foreground">
                  {PLACEMENT_LABEL[banner.placement]} · {banner.type} · order {banner.sortOrder}
                </span>
              </div>
              <Badge variant={STATUS_VARIANT[banner.status]}>{banner.status}</Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-7"><MoreHorizontal className="size-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openSheet(banner)}>
                    <Pencil /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() =>
                      confirmDialog.confirm(async () => {
                        try {
                          await deleteMutation.mutateAsync(banner.id)
                          toast({ title: 'Banner deleted' })
                        } catch (err) {
                          toast({ title: 'Could not delete banner', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
                        }
                      })
                    }
                  >
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={(open) => (open ? setSheetOpen(true) : closeSheet())}>
        <SheetContent>
          <SheetHeader><SheetTitle>{editing ? 'Edit banner' : 'New banner'}</SheetTitle></SheetHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-1 flex-col gap-3.5 overflow-y-auto">
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
                      {BANNER_PLACEMENTS.map((p) => <SelectItem key={p} value={p}>{PLACEMENT_LABEL[p]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {/*
                Plain markup, not FormItem/FormLabel: those call useFormField(), which throws
                outside a FormField. The picked file is component state rather than a form field,
                so there is no FormField to sit inside.
              */}
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Desktop artwork</span>
                <SingleImageField value={imageFile} onChange={setImageFile} currentUrl={editing?.image} />
              </div>
              <FormField control={form.control} name="image" render={({ field }) => (
                <FormItem>
                  <FormLabel>…or image URL</FormLabel>
                  <FormControl><Input placeholder="https://…" {...field} disabled={!!imageFile} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Mobile artwork</span>
                <SingleImageField value={mobileImageFile} onChange={setMobileImageFile} currentUrl={editing?.mobileImage} />
              </div>

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
                  <div className="grid grid-cols-2 gap-3.5">
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
                  <div className="grid grid-cols-2 gap-3.5">
                    <FormField control={form.control} name="bgColor" render={({ field }) => (
                      <FormItem><FormLabel>Background</FormLabel><FormControl><Input placeholder="#FF5733" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="textColor" render={({ field }) => (
                      <FormItem><FormLabel>Text color</FormLabel><FormControl><Input placeholder="#FFFFFF" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                </>
              )}

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

              <div className="grid grid-cols-2 gap-3.5">
                <FormField control={form.control} name="startsAt" render={({ field }) => (
                  <FormItem><FormLabel>Starts at</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="endsAt" render={({ field }) => (
                  <FormItem><FormLabel>Ends at</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
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

              <SheetFooter>
                <Button type="button" variant="outline" onClick={closeSheet}>Cancel</Button>
                <Button type="submit" loading={form.formState.isSubmitting}>{editing ? 'Save changes' : 'Create banner'}</Button>
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={confirmDialog.setOpen}
        title="Delete this banner?"
        description="This cannot be undone."
        confirmLabel="Delete"
        loading={confirmDialog.pending}
        onConfirm={confirmDialog.handleConfirm}
      />
    </div>
  )
}

import * as React from 'react'
import { useNavigate, useParams } from 'react-router'
import { Form, Input, InputNumber, Select, Switch, Button as AntButton } from 'antd'
import { ArrowLeft, ArrowRight, Image as ImageIcon, Plus, Trash2, Wand2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { useBreadcrumbLabel } from '@/components/layout/breadcrumb-context'
import { useProduct, useCreateProduct, useUpdateProduct, type ProductInput, type ProductStatus, type ProductType } from '@/lib/api/products'
import { useCategoryTree } from '@/lib/api/categories'
import { useBrands } from '@/lib/api/brands'
import { ImageUploadField, SHARED_VARIANT_KEY, type PendingImage } from '@/features/catalog/products/components/image-upload-field'
import { FormStepper, type StepDefinition } from '@/features/catalog/products/components/form-stepper'
import { CategoryParentPicker } from '@/features/catalog/categories/category-parent-picker'
import { slugify } from '@/lib/utils/slug'

/**
 * Mints a local key for a variant that has no backend id yet.
 *
 * Monotonic and never derived from the row's position: a key built from the
 * list length (`__new_${fields.length}`) is reused as soon as any earlier row
 * is deleted, and two rows sharing a key silently send an image to the wrong
 * variant — the exact failure a stable key exists to prevent.
 */
let variantKeySeq = 0
const nextVariantKey = () => `__new_${(variantKeySeq += 1)}`

interface ImageValue {
  id?: string
  url: string
  altText?: string
  isPrimary: boolean
  variantKey?: string
}

interface AttributeValue {
  id?: string
  name: string
  value: string
}

interface VariantAttributeValue {
  name: string
  value: string
}

interface VariantValue {
  id?: string
  variantKey: string
  name: string
  sku: string
  price: number
  stockQuantity: number
  attributes: VariantAttributeValue[]
}

interface FormValues {
  name: string
  sku: string
  shortDescription?: string
  description: string
  type: ProductType
  status: ProductStatus
  categoryId: string | null
  brandId: string
  price: number
  compareAtPrice?: number
  stockQuantity: number
  lowStockThreshold: number
  isFeatured: boolean
  images: ImageValue[]
  attributes: AttributeValue[]
  variants: VariantValue[]
}

const EMPTY_VALUES: FormValues = {
  name: '',
  sku: '',
  shortDescription: '',
  description: '',
  type: 'SIMPLE',
  status: 'DRAFT',
  categoryId: null,
  brandId: '',
  price: 0,
  compareAtPrice: undefined,
  stockQuantity: 0,
  lowStockThreshold: 5,
  isFeatured: false,
  images: [],
  attributes: [],
  variants: [],
}

/**
 * Wizard steps, in fill-in order. Variants deliberately precede Images: an
 * image row can be assigned to a variant, so the variants have to exist before
 * the picker on each image row has anything to offer.
 */
const STEPS: StepDefinition[] = [
  { key: 'basics', title: 'Basics', description: 'Name, SKU & description' },
  { key: 'organization', title: 'Organization', description: 'Category, brand & type' },
  { key: 'pricing', title: 'Pricing', description: 'Price & inventory' },
  { key: 'variants', title: 'Variants', description: 'Options & attributes' },
  { key: 'images', title: 'Images', description: 'Photos & gallery' },
  { key: 'review', title: 'Review', description: 'Confirm & save' },
]

/**
 * Fields validated before "Next" advances past each step, so an error surfaces
 * on the step that owns it instead of at final submit.
 *
 * Nested list fields (`images`, `variants`, `attributes`) are omitted: naming a
 * `Form.List` here validates the list-level rule but not its rows, and the rows
 * are covered by the whole-form validation that `onFinish` runs anyway.
 */
const STEP_FIELDS: Record<string, (keyof FormValues)[]> = {
  basics: ['name', 'sku', 'description'],
  organization: ['categoryId', 'brandId', 'type', 'status'],
  pricing: ['price', 'compareAtPrice', 'stockQuantity', 'lowStockThreshold'],
  variants: [],
  images: [],
  review: [],
}

/**
 * Live thumbnail for a URL-based image row, keyed by url so a new address remounts with a clean
 * slate — otherwise one broken value would latch the placeholder on even after it's corrected.
 */
function ImagePreviewThumb({ url }: { url?: string }) {
  const [failed, setFailed] = React.useState(false)

  if (!url || failed) {
    return (
      <div className="flex size-16 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
        <ImageIcon className="size-5 text-muted-foreground" />
      </div>
    )
  }

  return (
    <img
      src={url}
      alt=""
      className="size-16 shrink-0 rounded-md border border-border object-cover"
      onError={() => setFailed(true)}
    />
  )
}

/** One label/value line in the review summary. */
function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-2 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-xs font-medium text-foreground">{value || '—'}</span>
    </div>
  )
}

export default function ProductFormPage() {
  const { productId } = useParams()
  const isEdit = !!productId
  const navigate = useNavigate()
  const [form] = Form.useForm<FormValues>()

  const { data: product, isLoading: loadingProduct } = useProduct(productId)
  const { data: categoryTree } = useCategoryTree()
  const { data: brandsData } = useBrands()
  const createMutation = useCreateProduct()
  const updateMutation = useUpdateProduct()

  useBreadcrumbLabel(isEdit ? (product ? `Edit ${product.name}` : 'Edit product') : 'New product')

  const [stepIndex, setStepIndex] = React.useState(0)
  // Every step the user has reached. Editing an existing product unlocks all of
  // them up front — its fields are already filled, so gating navigation behind
  // a forward walk would only be friction.
  const [visitedSteps, setVisitedSteps] = React.useState<Set<number>>(
    () => new Set(isEdit ? STEPS.map((_, i) => i) : [0]),
  )

  /**
   * Whether SKU still mirrors the name. Cleared the moment the user types their
   * own SKU, so auto-fill never overwrites a hand-entered value — and left off
   * entirely when editing, where the saved SKU is authoritative.
   */
  const [skuAutoFill, setSkuAutoFill] = React.useState(!isEdit)

  // Locally-picked files pending upload — separate from the `images` field (URL rows only).
  // Keyed by product id so switching products starts from an empty upload list without an effect.
  const [uploadsFor, setUploadsFor] = React.useState<string | undefined>(productId)
  const [pendingImagesState, setPendingImages] = React.useState<PendingImage[]>([])
  const pendingImages = uploadsFor === productId ? pendingImagesState : []
  if (uploadsFor !== productId) {
    setUploadsFor(productId)
    setPendingImages([])
  }

  // Re-sync the form to the loaded product whenever it changes, so navigating between products
  // never leaves the previous one's values in the fields.
  React.useEffect(() => {
    if (!product) {
      form.setFieldsValue(EMPTY_VALUES)
      return
    }
    const loadedVariants = (product.variants ?? []).map((v) => ({
      id: v.id,
      // A saved variant always has an id, so that IS its key — no local key is
      // minted here, which is what keeps saved and unsaved keys from colliding.
      variantKey: v.id,
      name: v.name,
      sku: v.sku,
      price: v.price === undefined ? 0 : Number(v.price),
      stockQuantity: v.stockQuantity ?? 0,
      attributes: Object.entries(v.attributes ?? {}).map(([name, value]) => ({ name, value })),
    }))
    const savedVariantKeys = new Set(loadedVariants.map((v) => v.variantKey))
    form.setFieldsValue({
      name: product.name,
      sku: product.sku ?? '',
      shortDescription: product.shortDescription ?? '',
      description: product.description ?? '',
      type: product.type,
      status: product.status,
      categoryId: product.categoryId ?? null,
      brandId: product.brandId ?? '',
      price: Number(product.price),
      compareAtPrice: product.compareAtPrice === null ? undefined : Number(product.compareAtPrice),
      stockQuantity: product.stockQuantity,
      lowStockThreshold: product.lowStockThreshold,
      isFeatured: product.isFeatured,
      images: (product.images ?? []).map((img) => ({
        id: img.id,
        url: img.url,
        altText: img.altText ?? '',
        isPrimary: img.isPrimary,
        // A saved variant's key IS its id. Guarded so an id that no longer
        // matches any variant falls back to shared rather than to a dead key.
        variantKey:
          img.variantId && savedVariantKeys.has(img.variantId)
            ? img.variantId
            : SHARED_VARIANT_KEY,
      })),
      attributes: (product.attributes ?? []).map((a) => ({ id: a.id, name: a.name, value: a.value })),
      variants: loadedVariants,
    })
  }, [product, form])

  const type = Form.useWatch('type', form)
  /** Uploads filed under a specific variant, surfaced as context on the Images step. */
  const variantImageCount = pendingImages.filter(
    (p) => (p.variantKey ?? SHARED_VARIANT_KEY) !== SHARED_VARIANT_KEY,
  ).length

  /**
   * Mirrors the product name into SKU as a slug ("Sony xyz" -> "sony-xyz"),
   * until the user edits SKU by hand.
   */
  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!skuAutoFill) return
    form.setFieldValue('sku', slugify(event.target.value))
    // The field was flagged invalid while empty; a programmatic set doesn't
    // re-run its rules, so clear the stale error explicitly.
    form.setFields([{ name: 'sku', errors: [] }])
  }

  /**
   * Any manual SKU edit takes ownership of the field for good — including
   * clearing it, otherwise the next keystroke in Name would silently refill a
   * box the user just emptied on purpose.
   */
  const handleSkuChange = () => {
    if (skuAutoFill) setSkuAutoFill(false)
  }

  /** Re-derives SKU from the current name on demand, after manual edits. */
  const regenerateSku = () => {
    const name = (form.getFieldValue('name') as string | undefined) ?? ''
    if (!name.trim()) {
      toast({ title: 'Enter a product name first', variant: 'destructive' })
      return
    }
    form.setFieldValue('sku', slugify(name))
    form.setFields([{ name: 'sku', errors: [] }])
  }

  /**
   * Turns a picker value into the field the API expects: `variantId` for a
   * saved variant, `variantIndex` for one being created in this same request,
   * neither for shared.
   *
   * `submittedVariants` MUST be the exact array going out in this request, not
   * the raw form value — a `variantIndex` is a position in the payload, so
   * resolving it against a different list (one that still holds variants a
   * SIMPLE product drops) sends an index the server cannot honor.
   */
  const resolveVariantKey = React.useCallback(
    (
      variantKey: string | undefined,
      submittedVariants: { id?: string; variantKey: string }[],
    ): { variantId?: string; variantIndex?: number } => {
      if (!variantKey || variantKey === SHARED_VARIANT_KEY) return {}
      const index = submittedVariants.findIndex((v) => v.variantKey === variantKey)
      if (index === -1) return {}
      const variant = submittedVariants[index]
      if (variant.id) return { variantId: variant.id }
      return { variantIndex: index }
    },
    [],
  )

  /** Keeps at most one primary image across both the URL rows and the pending uploads. */
  const setPrimaryUrlRow = (index: number) => {
    const images = (form.getFieldValue('images') as ImageValue[] | undefined) ?? []
    form.setFieldValue(
      'images',
      images.map((img, i) => ({ ...img, isPrimary: i === index })),
    )
    setPendingImages((prev) => prev.map((p) => ({ ...p, isPrimary: false })))
  }

  /**
   * Releases every image pointing at a variant that is about to be removed, so
   * the form never submits a reference to a variant absent from the payload.
   *
   * Reads the row's key straight from the form rather than from the watched
   * `variants` value: `Form.useWatch` lags a render behind, and an `undefined`
   * key here would match — and wrongly clear — every image that has no
   * assignment at all.
   */
  const handleVariantRemove = (rowIndex: number) => {
    const current = (form.getFieldValue('variants') as VariantValue[] | undefined) ?? []
    const variantKey = current[rowIndex]?.variantKey
    if (!variantKey) return

    // Uploads made inside a variant row depict that specific variant, so they go
    // with it. Promoting them to shared would silently turn a "Black / 128GB"
    // photo into a product-level image the user never chose to add.
    const dropped = pendingImages.filter((p) => p.variantKey === variantKey)
    if (dropped.length > 0) {
      setPendingImages((prev) => prev.filter((p) => p.variantKey !== variantKey))
      toast({
        title: `Removed ${dropped.length} variant ${dropped.length === 1 ? 'image' : 'images'}`,
        description: 'They belonged to the deleted variant.',
      })
    }

    // Saved URL rows are release-to-shared rather than deleted: those the user
    // typed against the product, and losing a URL they entered is not recoverable.
    const images = (form.getFieldValue('images') as ImageValue[] | undefined) ?? []
    form.setFieldValue(
      'images',
      images.map((img) =>
        img.variantKey === variantKey ? { ...img, variantKey: SHARED_VARIANT_KEY } : img,
      ),
    )
  }

  const goToStep = (index: number) => {
    setStepIndex(index)
    setVisitedSteps((prev) => new Set(prev).add(index))
  }

  /**
   * Validates only the current step's own fields before advancing, so the user
   * is never blocked by a field belonging to a step they haven't reached.
   */
  const handleNext = async () => {
    const step = STEPS[stepIndex]
    const fields = STEP_FIELDS[step.key] ?? []
    try {
      if (fields.length > 0) await form.validateFields(fields)
    } catch {
      // Ant Design already renders the per-field messages and scrolls to them.
      return
    }
    if (stepIndex < STEPS.length - 1) goToStep(stepIndex + 1)
  }

  const handleBack = () => {
    if (stepIndex > 0) goToStep(stepIndex - 1)
  }

  const handleSubmit = async () => {
    /*
     * Read the whole store rather than trusting `onFinish`'s argument.
     *
     * `onFinish` only hands back fields that have a rendered `Form.Item`, and
     * `id`/`variantKey` deliberately have none — they are bookkeeping written by
     * `setFieldsValue`, never edited by hand. Taking the argument would strip a
     * saved variant's `id`, so the backend would read an update as an insert and
     * reject it with "Variant SKU ... is already in use". The same strip drops
     * each image's `id`, re-uploading rows that already exist.
     */
    const values = form.getFieldsValue(true) as FormValues

    // Built once, and the single source of truth for `variantIndex` resolution
    // below. A SIMPLE product submits no variants, so any assignment made while
    // it was VARIABLE resolves to "shared" rather than a dangling index.
    const submittedVariants =
      values.type === 'VARIABLE'
        ? (values.variants ?? []).map((v) => ({
            ...(v.id ? { id: v.id } : {}),
            variantKey: v.variantKey,
            name: v.name,
            sku: v.sku,
            price: v.price,
            stockQuantity: v.stockQuantity,
            attributes: Object.fromEntries((v.attributes ?? []).map((a) => [a.name, a.value])),
          }))
        : []

    // `variantKey` is form-local bookkeeping — build the payload without it.
    const variants = submittedVariants.map((v) => ({
      ...(v.id ? { id: v.id } : {}),
      name: v.name,
      sku: v.sku,
      price: v.price,
      stockQuantity: v.stockQuantity,
      attributes: v.attributes,
    }))

    const images = (values.images ?? []).map((img, index) => ({
      ...(img.id ? { id: img.id } : {}),
      url: img.url,
      altText: img.altText || undefined,
      sortOrder: index,
      isPrimary: !!img.isPrimary,
      ...resolveVariantKey(img.variantKey, submittedVariants),
    }))
    /*
     * Exactly one image must end up primary, or the product renders with no
     * thumbnail in the list (which returns only the primary image).
     *
     * The fallback has to consider uploads too, not just URL rows: a product
     * whose only images are uploaded files has an empty `images` array, so
     * promoting `images[0]` would promote nothing at all. Prefer a shared image
     * over a variant-scoped one — a variant photo is a poor cover shot.
     */
    const hasPrimary = images.some((img) => img.isPrimary) || pendingImages.some((p) => p.isPrimary)
    let promotedUploadKey: string | undefined
    if (!hasPrimary) {
      if (images.length > 0) {
        images[0].isPrimary = true
      } else {
        const shared = pendingImages.find(
          (p) => (p.variantKey ?? SHARED_VARIANT_KEY) === SHARED_VARIANT_KEY,
        )
        promotedUploadKey = (shared ?? pendingImages[0])?.key
      }
    }

    const input: ProductInput = {
      name: values.name,
      sku: values.sku,
      description: values.description,
      shortDescription: values.shortDescription || undefined,
      type: values.type,
      status: values.status,
      categoryId: values.categoryId ?? undefined,
      brandId: values.brandId,
      price: values.price,
      compareAtPrice: values.compareAtPrice,
      stockQuantity: values.stockQuantity,
      lowStockThreshold: values.lowStockThreshold,
      isFeatured: values.isFeatured,
      images,
      attributes: (values.attributes ?? []).map((a) => ({ ...(a.id ? { id: a.id } : {}), name: a.name, value: a.value })),
      variants,
    }

    // Positional match to `imageSlots[i]` <-> `files[i]` — see ProductImageUpload in lib/api/products.ts.
    const upload =
      pendingImages.length > 0
        ? {
            files: pendingImages.map((p) => p.file),
            imageSlots: pendingImages.map((p) => ({
              altText: p.altText || undefined,
              isPrimary: p.isPrimary || p.key === promotedUploadKey,
              ...resolveVariantKey(p.variantKey, submittedVariants),
            })),
          }
        : undefined

    try {
      if (isEdit && productId) {
        await updateMutation.mutateAsync({ id: productId, input, upload })
        toast({ title: 'Product updated' })
        navigate(`/catalog/products/${productId}`)
      } else {
        await createMutation.mutateAsync({ input, upload })
        toast({ title: 'Product created' })
        navigate('/catalog/products')
      }
    } catch (err) {
      toast({ title: 'Something went wrong', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }

  /**
   * A validation failure raised on a step the user isn't looking at would show
   * no visible message — jump to the step that owns the first bad field.
   */
  const handleSubmitFailed = ({ errorFields }: { errorFields: { name: (string | number)[] }[] }) => {
    const firstField = errorFields[0]?.name?.[0]
    if (firstField === undefined) return
    const owner = STEPS.findIndex((step) =>
      step.key === 'variants'
        ? firstField === 'variants'
        : step.key === 'images'
          ? firstField === 'images'
          : (STEP_FIELDS[step.key] as string[]).includes(String(firstField)),
    )
    if (owner !== -1 && owner !== stepIndex) {
      goToStep(owner)
      toast({ title: 'Some fields need attention', description: `Check the ${STEPS[owner].title} step.`, variant: 'destructive' })
    }
  }

  if (isEdit && loadingProduct) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  const submitting = createMutation.isPending || updateMutation.isPending
  const currentStep = STEPS[stepIndex]
  const isLastStep = stepIndex === STEPS.length - 1

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={isEdit ? 'Edit product' : 'New product'}
        description={`Step ${stepIndex + 1} of ${STEPS.length} — ${currentStep.description}.`}
      />

      <Card>
        <CardContent className="p-3">
          <FormStepper steps={STEPS} current={stepIndex} visited={visitedSteps} onStepClick={goToStep} />
        </CardContent>
      </Card>

      <Form
        form={form}
        layout="vertical"
        initialValues={EMPTY_VALUES}
        onFinish={handleSubmit}
        onFinishFailed={handleSubmitFailed}
        scrollToFirstError
      >
        <div className="flex flex-col gap-4">
          {/* Every step stays mounted and is hidden with CSS rather than unmounted:
              Ant Design drops a field's value when its Form.Item unmounts, so
              conditional rendering here would wipe earlier steps on navigation. */}
          <div className={currentStep.key === 'basics' ? 'flex flex-col gap-4' : 'hidden'}>
            <Card>
              <CardHeader>
                <CardTitle>General</CardTitle>
                <CardDescription>Name the product — the SKU fills in automatically from it.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-1">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
                    <Input placeholder="Sony xyz" onChange={handleNameChange} />
                  </Form.Item>
                  <Form.Item
                    name="sku"
                    label="SKU"
                    rules={[{ required: true, message: 'SKU is required' }]}
                    extra={skuAutoFill ? 'Auto-generated from the name. Type here to set your own.' : 'Custom SKU — use the wand to re-sync it with the name.'}
                  >
                    <Input
                      placeholder="sony-xyz"
                      onChange={handleSkuChange}
                      suffix={
                        <button
                          type="button"
                          onClick={regenerateSku}
                          title="Generate from name"
                          className="text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <Wand2 className="size-3.5" />
                        </button>
                      }
                    />
                  </Form.Item>
                </div>
                <Form.Item name="shortDescription" label="Short description">
                  <Input placeholder="One-line summary shown in listings" />
                </Form.Item>
                <Form.Item name="description" label="Description" rules={[{ required: true, message: 'Description is required' }]}>
                  <Input.TextArea rows={5} placeholder="Full product description shown on the product page" />
                </Form.Item>
              </CardContent>
            </Card>
          </div>

          <div className={currentStep.key === 'organization' ? 'flex flex-col gap-4' : 'hidden'}>
            <Card>
              <CardHeader>
                <CardTitle>Organization</CardTitle>
                <CardDescription>Where this product sits in the catalog, and how it is sold.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                {/* Cascading parent -> child picker (same component/behavior as the Category
                    admin page), not a flat list mixing every depth together. */}
                <Form.Item name="categoryId" label="Category" rules={[{ required: true, message: 'Select a category' }]}>
                  <CategoryParentPicker tree={categoryTree ?? []} />
                </Form.Item>
                <Form.Item name="brandId" label="Brand" rules={[{ required: true, message: 'Select a brand' }]}>
                  <Select
                    placeholder="Select a brand"
                    options={(brandsData?.data ?? []).map((b) => ({ value: b.id, label: b.name }))}
                    showSearch
                    optionFilterProp="label"
                  />
                </Form.Item>
                <Form.Item
                  name="type"
                  label="Type"
                  extra="Variable products get their own variant rows in the next steps."
                >
                  <Select
                    options={[
                      { value: 'SIMPLE', label: 'Simple' },
                      { value: 'VARIABLE', label: 'Variable' },
                    ]}
                  />
                </Form.Item>
                <Form.Item name="status" label="Status">
                  <Select
                    options={[
                      { value: 'DRAFT', label: 'Draft' },
                      { value: 'ACTIVE', label: 'Active' },
                      { value: 'ARCHIVED', label: 'Archived' },
                    ]}
                  />
                </Form.Item>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Visibility</CardTitle>
                <CardDescription>Featured products are highlighted on the storefront.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form.Item name="isFeatured" label="Featured" valuePropName="checked" className="mb-0!">
                  <Switch />
                </Form.Item>
              </CardContent>
            </Card>
          </div>

          <div className={currentStep.key === 'pricing' ? 'flex flex-col gap-4' : 'hidden'}>
            <Card>
              <CardHeader>
                <CardTitle>Pricing &amp; Inventory</CardTitle>
                <CardDescription>Base price and stock levels. Variants can override these later.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                <Form.Item
                  name="price"
                  label="Price"
                  rules={[
                    { required: true, message: 'Price is required' },
                    { type: 'number', min: 0, message: 'Price cannot be negative' },
                  ]}
                >
                  <InputNumber className="w-full" min={0} step={0.01} stringMode={false} />
                </Form.Item>
                <Form.Item
                  name="compareAtPrice"
                  label="Compare-at price"
                  rules={[{ type: 'number', min: 0, message: 'Cannot be negative' }]}
                  extra="Shown struck through next to the price."
                >
                  <InputNumber className="w-full" min={0} step={0.01} />
                </Form.Item>
                <Form.Item name="stockQuantity" label="Stock quantity" rules={[{ type: 'number', min: 0, message: 'Cannot be negative' }]}>
                  <InputNumber className="w-full" min={0} />
                </Form.Item>
                <Form.Item
                  name="lowStockThreshold"
                  label="Low stock threshold"
                  rules={[{ type: 'number', min: 0, message: 'Cannot be negative' }]}
                  extra="Flags the product once stock drops to this level."
                >
                  <InputNumber className="w-full" min={0} />
                </Form.Item>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Attributes</CardTitle>
                <CardDescription>Product-wide specs such as warranty or material.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form.List name="attributes">
                  {(fields, { add, remove }) => (
                    <div className="flex flex-col gap-1">
                      {fields.map((field) => (
                        <div key={field.key} className="grid grid-cols-[1fr_1fr_32px] items-start gap-2">
                          <Form.Item name={[field.name, 'name']} rules={[{ required: true, message: 'Name is required' }]}>
                            <Input placeholder="Warranty" />
                          </Form.Item>
                          <Form.Item name={[field.name, 'value']} rules={[{ required: true, message: 'Value is required' }]}>
                            <Input placeholder="1 year" />
                          </Form.Item>
                          <Button type="button" variant="ghost" size="icon" onClick={() => remove(field.name)}>
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ))}
                      {fields.length === 0 && <p className="pb-2 text-sm text-muted-foreground">No attributes added yet.</p>}
                      <AntButton type="dashed" onClick={() => add({ name: '', value: '' })} className="self-start" icon={<Plus className="size-4" />}>
                        Add attribute
                      </AntButton>
                    </div>
                  )}
                </Form.List>
              </CardContent>
            </Card>
          </div>

          <div className={currentStep.key === 'variants' ? 'flex flex-col gap-4' : 'hidden'}>
            <Card>
              <CardHeader>
                <CardTitle>Variants</CardTitle>
                <CardDescription>
                  {type === 'VARIABLE'
                    ? 'Add every sellable combination. Images can be assigned to these in the next step.'
                    : 'Only variable products have variants.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {type !== 'VARIABLE' ? (
                  <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-border p-4">
                    <p className="text-sm text-muted-foreground">
                      This is a <span className="font-medium text-foreground">Simple</span> product, so it has no variants.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Change Type to “Variable” in the Organization step to add them.
                    </p>
                  </div>
                ) : (
                  <Form.List
                    name="variants"
                    rules={[
                      {
                        validator: async (_, variants) => {
                          if (!variants || variants.length === 0) {
                            return Promise.reject(new Error('Add at least one variant for a variable product'))
                          }
                        },
                      },
                    ]}
                  >
                    {(fields, { add, remove }, { errors }) => (
                      <div className="flex flex-col gap-2.5">
                        {fields.map((field, position) => (
                          <div key={field.key} className="flex flex-col gap-1 rounded-md border border-border p-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-muted-foreground">Variant {position + 1}</span>
                              <Button type="button" variant="ghost" size="icon" onClick={() => { handleVariantRemove(field.name); remove(field.name) }}>
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-1 gap-x-2 sm:grid-cols-[1fr_1fr_110px_110px] sm:items-start">
                              <Form.Item name={[field.name, 'name']} label="Variant name" rules={[{ required: true, message: 'Variant name is required' }]}>
                                <Input placeholder="128GB / Black" />
                              </Form.Item>
                              <Form.Item name={[field.name, 'sku']} label="SKU" rules={[{ required: true, message: 'Variant SKU is required' }]}>
                                <Input placeholder="sony-xyz-128gb-black" />
                              </Form.Item>
                              <Form.Item name={[field.name, 'price']} label="Price" rules={[{ type: 'number', min: 0, message: 'Cannot be negative' }]}>
                                <InputNumber className="w-full" min={0} step={0.01} />
                              </Form.Item>
                              <Form.Item name={[field.name, 'stockQuantity']} label="Stock" rules={[{ type: 'number', min: 0, message: 'Cannot be negative' }]}>
                                <InputNumber className="w-full" min={0} />
                              </Form.Item>
                            </div>

                            <span className="text-xs font-medium text-muted-foreground">Attributes (e.g. storage, color)</span>
                            <Form.List name={[field.name, 'attributes']}>
                              {(attrFields, { add: addAttr, remove: removeAttr }) => (
                                <div className="flex flex-col gap-1">
                                  {attrFields.map((attrField) => (
                                    <div key={attrField.key} className="grid grid-cols-[1fr_1fr_32px] items-start gap-2">
                                      <Form.Item name={[attrField.name, 'name']} rules={[{ required: true, message: 'Name is required' }]}>
                                        <Input placeholder="storage" />
                                      </Form.Item>
                                      <Form.Item name={[attrField.name, 'value']} rules={[{ required: true, message: 'Value is required' }]}>
                                        <Input placeholder="128GB" />
                                      </Form.Item>
                                      <Button type="button" variant="ghost" size="icon" onClick={() => removeAttr(attrField.name)}>
                                        <Trash2 className="size-4" />
                                      </Button>
                                    </div>
                                  ))}
                                  <AntButton size="small" type="dashed" onClick={() => addAttr({ name: '', value: '' })} className="self-start" icon={<Plus className="size-3.5" />}>
                                    Add attribute
                                  </AntButton>
                                </div>
                              )}
                            </Form.List>

                            {/* Images picked here are stamped with this variant's key on
                                the way in, which is what removes the need for a variant
                                picker on the Images step. */}
                            <Form.Item noStyle shouldUpdate>
                              {() => {
                                const rowKey = (form.getFieldValue(['variants', field.name, 'variantKey']) as string | undefined)
                                if (!rowKey) return null
                                return (
                                  <ImageUploadField
                                    label="Images for this variant"
                                    variantKey={rowKey}
                                    compact
                                    showPrimary={false}
                                    pending={pendingImages}
                                    onChange={setPendingImages}
                                    hasPrimaryElsewhere
                                  />
                                )
                              }}
                            </Form.Item>
                          </div>
                        ))}
                        {fields.length === 0 && <p className="text-sm text-muted-foreground">No variants added yet.</p>}
                        <Form.ErrorList errors={errors} />
                        <AntButton
                          type="dashed"
                          onClick={() => add({ variantKey: nextVariantKey(), name: '', sku: '', price: 0, stockQuantity: 0, attributes: [] })}
                          className="self-start"
                          icon={<Plus className="size-4" />}
                        >
                          Add variant
                        </AntButton>
                      </div>
                    )}
                  </Form.List>
                )}
              </CardContent>
            </Card>
          </div>

          <div className={currentStep.key === 'images' ? 'flex flex-col gap-4' : 'hidden'}>
            <Card>
              <CardHeader>
                <CardTitle>Images</CardTitle>
                <CardDescription>
                  {type === 'VARIABLE'
                    ? 'These images represent the product as a whole. Variant-specific photos are added on each variant in the previous step.'
                    : 'Upload files or add image URLs. One image is the primary.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {type === 'VARIABLE' && variantImageCount > 0 && (
                  <p className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                    {variantImageCount} variant {variantImageCount === 1 ? 'image' : 'images'} already added in the Variants step.
                  </p>
                )}
                <div className="flex flex-col gap-2.5">
                  <span className="text-xs font-semibold text-muted-foreground">Upload from your device</span>
                  <ImageUploadField
                    pending={pendingImages}
                    onChange={(next) => {
                      setPendingImages(next)
                      if (next.some((p) => p.isPrimary)) {
                        const images = (form.getFieldValue('images') as ImageValue[] | undefined) ?? []
                        form.setFieldValue('images', images.map((img) => ({ ...img, isPrimary: false })))
                      }
                    }}
                    hasPrimaryElsewhere={((form.getFieldValue('images') as ImageValue[] | undefined) ?? []).some((img) => img.isPrimary)}
                  />
                </div>

                <div className="flex flex-col gap-2.5 border-t border-border pt-4">
                  <span className="text-xs font-semibold text-muted-foreground">Or link by URL</span>
                  <Form.List name="images">
                    {(fields, { add, remove }) => (
                      <div className="flex flex-col gap-2.5">
                        {fields.map((field) => (
                          <div key={field.key} className="flex items-start gap-2 rounded-md border border-border p-2.5">
                            {/* Thumbnail of the current URL, so editing a product shows its actual
                                images instead of just their addresses. */}
                            <Form.Item noStyle shouldUpdate>
                              {() => <ImagePreviewThumb key={form.getFieldValue(['images', field.name, 'url'])} url={form.getFieldValue(['images', field.name, 'url'])} />}
                            </Form.Item>
                            <div className="grid flex-1 grid-cols-1 gap-x-2 sm:grid-cols-2">
                              <Form.Item
                                name={[field.name, 'url']}
                                label="Image URL"
                                rules={[
                                  { required: true, message: 'Image URL is required' },
                                  { type: 'url', message: 'Must be a valid URL' },
                                ]}
                              >
                                <Input placeholder="https://…" />
                              </Form.Item>
                              <Form.Item name={[field.name, 'altText']} label="Alt text">
                                <Input />
                              </Form.Item>
                            </div>
                            <div className="flex items-center gap-2 pt-7">
                              <Form.Item name={[field.name, 'isPrimary']} valuePropName="checked" noStyle>
                                <Switch
                                  size="small"
                                  onChange={(checked) => {
                                    if (checked) setPrimaryUrlRow(field.name)
                                  }}
                                />
                              </Form.Item>
                              <span className="text-sm text-foreground">Primary</span>
                              <Button type="button" variant="ghost" size="icon" onClick={() => remove(field.name)}>
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        {fields.length === 0 && <p className="text-sm text-muted-foreground">No image URLs added yet.</p>}
                        <AntButton
                          type="dashed"
                          onClick={() => add({ url: '', altText: '', isPrimary: fields.length === 0, variantKey: SHARED_VARIANT_KEY })}
                          className="self-start"
                          icon={<Plus className="size-4" />}
                        >
                          Add image URL
                        </AntButton>
                      </div>
                    )}
                  </Form.List>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className={currentStep.key === 'review' ? 'flex flex-col gap-4' : 'hidden'}>
            <Card>
              <CardHeader>
                <CardTitle>Review</CardTitle>
                <CardDescription>Check everything below, then save.</CardDescription>
              </CardHeader>
              {/* shouldUpdate re-reads the form on every change, so the summary
                  can't go stale against fields edited on an earlier step. */}
              <Form.Item noStyle shouldUpdate>
                {() => {
                  const values = form.getFieldsValue(true) as FormValues
                  const brandName = (brandsData?.data ?? []).find((b) => b.id === values.brandId)?.name
                  const imageCount = (values.images ?? []).length + pendingImages.length
                  const variantCount = values.type === 'VARIABLE' ? (values.variants ?? []).length : 0

                  return (
                    <CardContent className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                      <div className="flex flex-col">
                        <SummaryRow label="Name" value={values.name} />
                        <SummaryRow label="SKU" value={values.sku} />
                        <SummaryRow label="Brand" value={brandName} />
                        <SummaryRow label="Type" value={values.type === 'VARIABLE' ? 'Variable' : 'Simple'} />
                        <SummaryRow label="Status" value={values.status} />
                      </div>
                      <div className="flex flex-col">
                        <SummaryRow label="Price" value={values.price != null ? String(values.price) : undefined} />
                        <SummaryRow label="Compare-at" value={values.compareAtPrice != null ? String(values.compareAtPrice) : undefined} />
                        <SummaryRow label="Stock" value={values.stockQuantity != null ? String(values.stockQuantity) : undefined} />
                        <SummaryRow label="Variants" value={values.type === 'VARIABLE' ? `${variantCount}` : 'None'} />
                        <SummaryRow label="Images" value={`${imageCount}`} />
                      </div>
                    </CardContent>
                  )
                }}
              </Form.Item>
            </Card>
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <div className="flex items-center gap-2">
              {stepIndex > 0 && (
                <Button type="button" variant="outline" onClick={handleBack}>
                  <ArrowLeft className="size-4" /> Back
                </Button>
              )}
              {!isLastStep && (
                <Button type="button" onClick={handleNext}>
                  Next <ArrowRight className="size-4" />
                </Button>
              )}
              {isLastStep && (
                <Button type="submit" loading={submitting}>
                  {isEdit ? 'Save changes' : 'Create product'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </Form>
    </div>
  )
}

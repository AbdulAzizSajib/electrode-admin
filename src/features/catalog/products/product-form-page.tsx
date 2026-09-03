import * as React from 'react'
import { useNavigate, useParams } from 'react-router'
import { Alert, Form, Input, InputNumber, Radio, Select, Switch } from 'antd'
import { Wand2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { useBreadcrumbLabel } from '@/components/layout/breadcrumb-context'
import { RichTextEditor } from '@/components/forms/rich-text-editor'
import { TagInput } from '@/components/forms/tag-input'
import {
  useProduct,
  useCreateProduct,
  useUpdateProduct,
  type ProductInput,
  type ProductStatus,
  type ProductType,
} from '@/lib/api/products'
import { useCategoryTree } from '@/lib/api/categories'
import { useBrands } from '@/lib/api/brands'
import { useAllAttributes } from '@/lib/api/attributes'
import { useAllTaxRules } from '@/lib/api/tax-rules'
import { useAllShippingRules } from '@/lib/api/shipping-rules'
import { useAllCollections } from '@/lib/api/collections'
import { useAllBundleDeals } from '@/lib/api/bundle-deals'
import {
  SHARED_VARIANT_KEY,
  type PendingImage,
} from '@/features/catalog/products/components/image-upload-field'
import { MediaSidebar, type ImageRow } from '@/features/catalog/products/components/media-sidebar'
import { VariantEditor } from '@/features/catalog/products/components/variant-editor'
import type { CombinationRow } from '@/features/catalog/products/components/variant-combinations'
import { CategoryParentPicker } from '@/features/catalog/categories/category-parent-picker'
import { slugify } from '@/lib/utils/slug'

/**
 * One scrolling page, not a six-step wizard.
 *
 * The wizard demanded everything at once — basics, organization, pricing,
 * variants, images, review — before anything could be saved, and hid fields
 * behind clicks without reducing what had to be filled in. Here every field is
 * present and fillable in any order, with media in a sidebar beside the copy it
 * describes.
 *
 * The inventory half — attribute selection, combinations, gallery — appears
 * only once the product exists, because each attaches to a product and cannot
 * reference one that has not been created. That gating is what removes the
 * wizard's need to hold every variant in memory before the first save.
 *
 * See `admin/product-authoring`, and design.md "The form is one page; the
 * inventory section is gated on existence".
 */

/**
 * Mints a local key for a combination row with no backend id yet.
 *
 * Monotonic and never derived from the row's position: a key built from the
 * list length is reused as soon as an earlier row is deleted, and two rows
 * sharing a key silently send an image to the wrong variant.
 */
let variantKeySeq = 0
const nextVariantKey = () => `__new_${(variantKeySeq += 1)}`

interface ProductAttributeRow {
  id?: string
  name: string
  value: string
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

  taxRuleId?: string
  shippingRuleId?: string
  bundleDealId?: string | null
  collectionIds: string[]
  tags: string[]

  unit?: string
  badge?: string
  /** Tri-state: `null` is "not said", which is not the same as "No". */
  isRefundable: boolean | null
  hasWarranty: boolean | null

  attributes: ProductAttributeRow[]
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
  taxRuleId: undefined,
  shippingRuleId: undefined,
  bundleDealId: null,
  collectionIds: [],
  tags: [],
  unit: '',
  badge: '',
  isRefundable: null,
  hasWarranty: null,
  attributes: [],
}

/** Yes / No / not said, as three radio options rather than a two-state switch. */
function TriStateField({
  value,
  onChange,
}: {
  value?: boolean | null
  onChange?: (value: boolean | null) => void
}) {
  return (
    <Radio.Group
      value={value === null || value === undefined ? 'unset' : value ? 'yes' : 'no'}
      onChange={(event) => {
        const next = event.target.value as 'yes' | 'no' | 'unset'
        onChange?.(next === 'unset' ? null : next === 'yes')
      }}
      optionType="button"
      options={[
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
        { value: 'unset', label: 'Not stated' },
      ]}
    />
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
  const { data: attributes = [] } = useAllAttributes()
  const { data: taxRules = [] } = useAllTaxRules()
  const { data: shippingRules = [] } = useAllShippingRules()
  const { data: collections = [] } = useAllCollections()
  const { data: bundleDeals = [] } = useAllBundleDeals()

  const createMutation = useCreateProduct()
  const updateMutation = useUpdateProduct()

  useBreadcrumbLabel(isEdit ? (product ? `Edit ${product.name}` : 'Edit product') : 'New product')

  const [saveError, setSaveError] = React.useState<string | null>(null)

  /*
   * Watched rather than read with `getFieldValue`: a new combination starts
   * from the product's price and code, and antd does not re-render this
   * component when a field changes — so reading them directly would hand the
   * variant editor whatever they were when the page first drew, which on a
   * create is 0 and "".
   */
  const watchedPrice = Form.useWatch('price', form)
  const watchedSku = Form.useWatch('sku', form)

  /**
   * Whether SKU still mirrors the name. Cleared the moment the merchant types
   * their own, so auto-fill never overwrites a hand-entered value — and off
   * entirely when editing, where the saved SKU is authoritative.
   */
  const [skuAutoFill, setSkuAutoFill] = React.useState(!isEdit)

  /*
   * The inventory half lives in React state rather than in antd fields.
   *
   * Combination rows are derived from the attribute selection by
   * `rebuildCombinations`, and a derived table driven by `Form.List` would mean
   * two owners of the same data — the exact ambiguity the old generator button
   * created. The form owns the product; this owns the combinations.
   */
  const [selectedValueIds, setSelectedValueIds] = React.useState<string[]>([])
  const [rows, setRows] = React.useState<CombinationRow[]>([])
  const [images, setImages] = React.useState<ImageRow[]>([])
  const [video, setVideo] = React.useState<{ url: string | null; thumbnailUrl: string | null }>({
    url: null,
    thumbnailUrl: null,
  })

  // Keyed by product id so switching products starts from an empty upload list
  // without an effect.
  const [uploadsFor, setUploadsFor] = React.useState<string | undefined>(productId)
  const [pendingImagesState, setPendingImages] = React.useState<PendingImage[]>([])
  const pendingImages = uploadsFor === productId ? pendingImagesState : []
  if (uploadsFor !== productId) {
    setUploadsFor(productId)
    setPendingImages([])
  }

  /*
   * Re-sync the inventory half to the loaded product.
   *
   * Adjusted during render rather than in an effect, matching how `uploadsFor`
   * above resets the upload list: these are values derived from the product, and
   * an effect would render one frame of the previous product's variants before
   * replacing them. Keyed on `updatedAt` as well as `id`, so a save that returns
   * fresh server values — new variant ids, a generated slug — is reflected back
   * rather than leaving the form describing the request instead of the result.
   */
  const productKey = product ? `${product.id}:${product.updatedAt}` : undefined
  const [syncedProductKey, setSyncedProductKey] = React.useState<string | undefined>(productKey)
  if (product && productKey !== syncedProductKey) {
    setSyncedProductKey(productKey)

    const loadedRows: CombinationRow[] = (product.variants ?? []).map((variant) => ({
      id: variant.id,
      // A saved variant always has an id, so that IS its key — no local key is
      // minted here, which keeps saved and unsaved keys from colliding.
      variantKey: variant.id as string,
      valueIds: (variant.optionValues ?? []).map((selection) => selection.valueId),
      name: variant.name,
      sku: variant.sku,
      price: variant.price === undefined ? 0 : Number(variant.price),
      compareAtPrice:
        variant.compareAtPrice === null || variant.compareAtPrice === undefined
          ? undefined
          : Number(variant.compareAtPrice),
      stockQuantity: variant.stockQuantity ?? 0,
    }))

    const savedKeys = new Set(loadedRows.map((row) => row.variantKey))

    setRows(loadedRows)
    // The selection is whatever the existing variants already sell. Derived
    // rather than stored, exactly as the backend derives `options`.
    setSelectedValueIds([...new Set(loadedRows.flatMap((row) => row.valueIds))])
    setImages(
      (product.images ?? []).map((image) => ({
        id: image.id,
        url: image.url,
        altText: image.altText ?? '',
        isPrimary: image.isPrimary,
        // A saved variant's key IS its id. Guarded so an id no longer matching
        // any variant falls back to shared rather than to a dead key.
        variantKey:
          image.variantId && savedKeys.has(image.variantId)
            ? image.variantId
            : SHARED_VARIANT_KEY,
      })),
    )
    setVideo({ url: product.video, thumbnailUrl: product.videoThumbnail })
  }

  /**
   * The antd fields, filled from the same product. Kept in an effect because
   * `form` is an external store rather than React state — writing to it during
   * render would mutate something React does not own mid-pass.
   */
  React.useEffect(() => {
    if (!product) {
      form.setFieldsValue(EMPTY_VALUES)
      return
    }

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
      compareAtPrice:
        product.compareAtPrice === null ? undefined : Number(product.compareAtPrice),
      stockQuantity: product.stockQuantity,
      lowStockThreshold: product.lowStockThreshold,
      isFeatured: product.isFeatured,
      taxRuleId: product.taxRuleId ?? undefined,
      shippingRuleId: product.shippingRuleId ?? undefined,
      bundleDealId: product.bundleDealId ?? null,
      collectionIds: (product.collections ?? []).map((row) => row.collection.id),
      tags: (product.tags ?? []).map((row) => row.tag.name),
      unit: product.unit ?? '',
      badge: product.badge ?? '',
      isRefundable: product.isRefundable,
      hasWarranty: product.hasWarranty,
      attributes: (product.attributes ?? []).map((attribute) => ({
        id: attribute.id,
        name: attribute.name,
        value: attribute.value,
      })),
    })
  }, [product, form])

  /** Mirrors the product name into SKU as a slug, until the merchant edits SKU. */
  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!skuAutoFill) return
    form.setFieldValue('sku', slugify(event.target.value))
    // A programmatic set does not re-run the field's rules, so clear the stale
    // "required" error explicitly.
    form.setFields([{ name: 'sku', errors: [] }])
  }

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
   * Releases everything pointing at a combination that is about to disappear,
   * so the form never submits a reference to a variant absent from the payload.
   *
   * Uploads made inside a combination row depict that specific combination, so
   * they go with it — promoting them to shared would silently turn a "Black /
   * 128GB" photo into a product-level image nobody chose. A URL row is released
   * to shared instead: the merchant typed that address, and losing it is not
   * recoverable.
   */
  const releaseVariantMedia = (variantKey: string) => {
    const dropped = pendingImages.filter((p) => p.variantKey === variantKey)
    if (dropped.length > 0) {
      setPendingImages((prev) => prev.filter((p) => p.variantKey !== variantKey))
      toast({
        title: `Removed ${dropped.length} variant ${dropped.length === 1 ? 'image' : 'images'}`,
        description: 'They belonged to a combination that no longer exists.',
      })
    }

    setImages((prev) =>
      prev.map((image) =>
        image.variantKey === variantKey ? { ...image, variantKey: SHARED_VARIANT_KEY } : image,
      ),
    )
  }

  /**
   * `variantId` for a saved combination, `variantIndex` for one being created in
   * this same request, neither for shared.
   *
   * `submitted` MUST be the exact array going out in this request — a
   * `variantIndex` is a position in the payload, so resolving it against a
   * different list sends an index the server cannot honour.
   */
  const resolveVariantKey = (
    variantKey: string | undefined,
    submitted: CombinationRow[],
  ): { variantId?: string; variantIndex?: number } => {
    if (!variantKey || variantKey === SHARED_VARIANT_KEY) return {}
    const index = submitted.findIndex((row) => row.variantKey === variantKey)
    if (index === -1) return {}
    const row = submitted[index]
    return row.id ? { variantId: row.id } : { variantIndex: index }
  }

  const handleSubmit = async (values: FormValues) => {
    setSaveError(null)

    /*
     * The attributes this product sells, in shop order, with only the values it
     * sells. `valueIds` order is what `optionValueIndexes` indexes into, so the
     * two are built from the same list and cannot disagree.
     */
    const selected = new Set(selectedValueIds)
    const options = attributes
      .map((attribute) => ({
        attributeId: attribute.id,
        name: attribute.name,
        valueIds: attribute.values.filter((value) => selected.has(value.id)).map((v) => v.id),
      }))
      .filter((option) => option.valueIds.length > 0)

    const variants = rows.map((row) => ({
      ...(row.id ? { id: row.id } : {}),
      name: row.name,
      sku: row.sku,
      price: row.price,
      ...(row.compareAtPrice === undefined ? {} : { compareAtPrice: row.compareAtPrice }),
      stockQuantity: row.stockQuantity,
      attributes: {},
      // Sent only when options exist; the backend rejects a selection on a
      // product that has none.
      ...(options.length > 0
        ? {
            optionValueIndexes: options.map((option) =>
              option.valueIds.findIndex((valueId) => row.valueIds.includes(valueId)),
            ),
          }
        : {}),
    }))

    const imageInputs = images
      .filter((image) => image.url.trim())
      .map((image, index) => ({
        ...(image.id ? { id: image.id } : {}),
        url: image.url.trim(),
        altText: image.altText || undefined,
        sortOrder: index,
        isPrimary: !!image.isPrimary,
        ...resolveVariantKey(image.variantKey, rows),
      }))

    /*
     * Exactly one image must end up primary, or the product renders with no
     * thumbnail in the list, which returns only the primary image. The fallback
     * has to consider uploads too: a product whose only images are files has an
     * empty `images` array, so promoting `images[0]` would promote nothing.
     */
    const hasPrimary =
      imageInputs.some((image) => image.isPrimary) || pendingImages.some((p) => p.isPrimary)
    let promotedUploadKey: string | undefined
    if (!hasPrimary) {
      if (imageInputs.length > 0) {
        imageInputs[0].isPrimary = true
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

      taxRuleId: values.taxRuleId,
      shippingRuleId: values.shippingRuleId,
      // Null clears the offer; the backend distinguishes that from omission.
      bundleDealId: values.bundleDealId ?? null,
      collectionIds: values.collectionIds ?? [],
      tags: values.tags ?? [],

      unit: values.unit?.trim() || undefined,
      badge: values.badge?.trim() || undefined,
      isRefundable: values.isRefundable,
      hasWarranty: values.hasWarranty,
      video: video.url,
      videoThumbnail: video.thumbnailUrl,

      attributes: (values.attributes ?? []).map((attribute) => ({
        ...(attribute.id ? { id: attribute.id } : {}),
        name: attribute.name,
        value: attribute.value,
      })),

      images: imageInputs,
      // Only sent once the product exists — before that there is nothing to
      // attach a variant to, and the sections producing them are not offered.
      ...(isEdit ? { options, variants } : {}),
    }

    // Positional match to `imageSlots[i]` <-> `files[i]`.
    const upload =
      pendingImages.length > 0
        ? {
            files: pendingImages.map((p) => p.file),
            imageSlots: pendingImages.map((p) => ({
              altText: p.altText || undefined,
              isPrimary: p.isPrimary || p.key === promotedUploadKey,
              ...resolveVariantKey(p.variantKey, rows),
            })),
          }
        : undefined

    try {
      if (isEdit && productId) {
        await updateMutation.mutateAsync({ id: productId, input, upload })
        toast({ title: 'Product updated' })
        return
      }

      const created = await createMutation.mutateAsync({ input, upload })
      toast({ title: 'Product created' })
      // Straight onto its own edit route, so the inventory sections become
      // available without navigating away and coming back — and so pressing
      // Save again updates this product rather than creating a second one.
      navigate(`/catalog/products/${created.id}/edit`, { replace: true })
    } catch (err) {
      // Nothing is reset: everything the merchant entered stays on the page,
      // and the reason appears at the top of the form.
      setSaveError(err instanceof Error ? err.message : 'Something went wrong')
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

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={isEdit ? 'Edit product' : 'New product'}
        description={
          isEdit
            ? 'Everything about this product, on one page.'
            : 'Fill in what identifies and prices it. Variants, gallery and stock become available once it is saved.'
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/catalog/products')}>
              Cancel
            </Button>
            <Button size="sm" variant="outline" onClick={() => form.submit()} loading={submitting}>
              {isEdit ? 'Save' : 'Create'} and continue editing
            </Button>
            <Button
              size="sm"
              loading={submitting}
              onClick={async () => {
                await form.validateFields().then(
                  async (values) => {
                    await handleSubmit(values as FormValues)
                    navigate('/catalog/products')
                  },
                  () => {
                    // antd renders the per-field messages and scrolls to the
                    // first; nothing more to say here.
                  },
                )
              }}
            >
              {isEdit ? 'Save' : 'Create'} and return
            </Button>
          </div>
        }
      />

      {saveError && (
        <Alert type="error" showIcon message={saveError} closable onClose={() => setSaveError(null)} />
      )}

      <Form
        form={form}
        layout="vertical"
        initialValues={EMPTY_VALUES}
        onFinish={handleSubmit}
        scrollToFirstError
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          {/* --- The product itself, one column, scrolled top to bottom --- */}
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>General</CardTitle>
                <CardDescription>
                  Name the product — the product code fills in from it until you type your own.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-1">
                <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
                  <Form.Item
                    name="name"
                    label="Name"
                    rules={[{ required: true, message: 'Name is required' }]}
                  >
                    <Input placeholder="Sony xyz" onChange={handleNameChange} />
                  </Form.Item>
                  <Form.Item
                    name="sku"
                    label="Product code"
                    rules={[{ required: true, message: 'Product code is required' }]}
                    extra={
                      skuAutoFill
                        ? 'Built from the name. Type here to set your own.'
                        : 'Your own code — use the wand to re-sync it with the name.'
                    }
                  >
                    <Input
                      placeholder="sony-xyz"
                      onChange={() => skuAutoFill && setSkuAutoFill(false)}
                      suffix={
                        <button
                          type="button"
                          onClick={regenerateSku}
                          title="Build from name"
                          className="text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <Wand2 className="size-3.5" />
                        </button>
                      }
                    />
                  </Form.Item>
                </div>

                <Form.Item
                  name="shortDescription"
                  label="Overview"
                  extra="A short summary. Shown in listings and above the full description."
                >
                  <RichTextEditor
                    minHeight="min-h-24"
                    placeholder="One or two lines a shopper reads first"
                  />
                </Form.Item>

                <Form.Item
                  name="description"
                  label="Description"
                  rules={[{ required: true, message: 'Description is required' }]}
                >
                  <RichTextEditor placeholder="What this product is, what it does, what is in the box" />
                </Form.Item>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Organization</CardTitle>
                <CardDescription>Where this product sits in the catalogue.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                <Form.Item
                  name="categoryId"
                  label="Category"
                  rules={[{ required: true, message: 'Select a category' }]}
                >
                  <CategoryParentPicker tree={categoryTree ?? []} />
                </Form.Item>
                <Form.Item
                  name="brandId"
                  label="Brand"
                  rules={[{ required: true, message: 'Select a brand' }]}
                >
                  <Select
                    placeholder="Select a brand"
                    options={(brandsData?.data ?? []).map((b) => ({ value: b.id, label: b.name }))}
                    showSearch
                    optionFilterProp="label"
                  />
                </Form.Item>
                <Form.Item
                  name="collectionIds"
                  label="Collections"
                  extra="Merchandising groups. A product keeps its category whichever it joins."
                >
                  <Select
                    mode="multiple"
                    allowClear
                    placeholder="None"
                    options={collections.map((c) => ({ value: c.id, label: c.name }))}
                    optionFilterProp="label"
                  />
                </Form.Item>
                <Form.Item name="tags" label="Keywords">
                  <TagInput />
                </Form.Item>
                <Form.Item name="type" label="Type">
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
                <Form.Item name="isFeatured" label="Featured" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pricing &amp; rules</CardTitle>
                <CardDescription>
                  What it costs, how it is taxed, and how it gets to the shopper.
                </CardDescription>
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
                  <InputNumber className="w-full" min={0} step={0.01} />
                </Form.Item>
                <Form.Item
                  name="compareAtPrice"
                  label="Compare-at price"
                  rules={[{ type: 'number', min: 0, message: 'Cannot be negative' }]}
                  extra="Shown struck through next to the price."
                >
                  <InputNumber className="w-full" min={0} step={0.01} />
                </Form.Item>
                <Form.Item
                  name="taxRuleId"
                  label="Tax rule"
                  rules={[{ required: true, message: 'A product must be taxable' }]}
                >
                  <Select
                    placeholder="Select a tax rule"
                    options={taxRules.map((rule) => ({
                      value: rule.id,
                      label: `${rule.name} — ${rule.type === 'PERCENT' ? `${Number(rule.value)}%` : Number(rule.value)}`,
                    }))}
                    optionFilterProp="label"
                    showSearch
                  />
                </Form.Item>
                <Form.Item
                  name="shippingRuleId"
                  label="Shipping rule"
                  rules={[{ required: true, message: 'A product must be deliverable' }]}
                >
                  <Select
                    placeholder="Select a shipping rule"
                    options={shippingRules.map((rule) => ({ value: rule.id, label: rule.name }))}
                    optionFilterProp="label"
                    showSearch
                  />
                </Form.Item>
                <Form.Item
                  name="bundleDealId"
                  label="Bundle deal"
                  extra="Optional. A product with none is sold without an offer."
                >
                  <Select
                    allowClear
                    placeholder="No offer"
                    options={bundleDeals.map((deal) => ({
                      value: deal.id,
                      label: `${deal.name} — buy ${deal.buyQuantity}, get ${deal.freeQuantity} free`,
                    }))}
                    optionFilterProp="label"
                    showSearch
                  />
                </Form.Item>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Product facts</CardTitle>
                <CardDescription>
                  What a shopper needs to know before buying. Anything left unset shows nothing at
                  all rather than an empty label.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                <Form.Item name="unit" label="Sold in" extra="“1 kg”, “500 ml”, “pack of 12”.">
                  <Input placeholder="1 kg" />
                </Form.Item>
                <Form.Item name="badge" label="Badge" extra="A short label on the product card.">
                  <Input placeholder="New" maxLength={40} />
                </Form.Item>
                <Form.Item name="isRefundable" label="Refundable">
                  <TriStateField />
                </Form.Item>
                <Form.Item name="hasWarranty" label="Warranty">
                  <TriStateField />
                </Form.Item>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Specifications</CardTitle>
                <CardDescription>
                  Free-form details — material, model number, whatever this kind of product needs.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form.List name="attributes">
                  {(fields, { add, remove }) => (
                    <div className="flex flex-col gap-1">
                      {fields.map((field) => (
                        <div
                          key={field.key}
                          className="grid grid-cols-[1fr_1fr_32px] items-start gap-2"
                        >
                          <Form.Item
                            name={[field.name, 'name']}
                            rules={[{ required: true, message: 'Name is required' }]}
                          >
                            <Input placeholder="Material" />
                          </Form.Item>
                          <Form.Item
                            name={[field.name, 'value']}
                            rules={[{ required: true, message: 'Value is required' }]}
                          >
                            <Input placeholder="Aluminium" />
                          </Form.Item>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => remove(field.name)}
                            aria-label="Remove specification"
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="self-start"
                        onClick={() => add({ name: '', value: '' })}
                      >
                        Add specification
                      </Button>
                    </div>
                  )}
                </Form.List>
              </CardContent>
            </Card>

            {/* --- Gated on the product existing --- */}
            <Card>
              <CardHeader>
                <CardTitle>Variants &amp; stock</CardTitle>
                <CardDescription>
                  Tick the attribute values this product sells. Every combination becomes a row you
                  can price and stock.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!isEdit ? (
                  <Alert
                    type="info"
                    showIcon
                    message="Available after saving"
                    description="A variant attaches to a product, so this becomes available once the product exists. Save it and this section opens on the same page — nothing you have typed is lost."
                  />
                ) : (
                  <VariantEditor
                    attributes={attributes}
                    selectedValueIds={selectedValueIds}
                    onSelectedValueIdsChange={setSelectedValueIds}
                    rows={rows}
                    onRowsChange={setRows}
                    basePrice={watchedPrice ?? 0}
                    skuPrefix={watchedSku ?? ''}
                    nextVariantKey={nextVariantKey}
                    pendingImages={pendingImages}
                    onPendingImagesChange={setPendingImages}
                    onRowRemoved={releaseVariantMedia}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Inventory</CardTitle>
                <CardDescription>
                  The product's own stock. A product selling attribute values counts its stock per
                  combination above instead.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                <Form.Item
                  name="stockQuantity"
                  label="Stock quantity"
                  rules={[{ type: 'number', min: 0, message: 'Cannot be negative' }]}
                >
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
          </div>

          {/* --- Media, beside the copy it illustrates --- */}
          <MediaSidebar
            images={images}
            onImagesChange={setImages}
            pendingImages={pendingImages}
            onPendingImagesChange={setPendingImages}
            video={video.url}
            videoThumbnail={video.thumbnailUrl}
            onVideoChange={setVideo}
            productExists={isEdit}
          />
        </div>
      </Form>
    </div>
  )
}

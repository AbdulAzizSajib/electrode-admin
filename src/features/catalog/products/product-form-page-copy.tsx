import * as React from 'react'
import { useNavigate, useParams } from 'react-router'
import { Alert, Form, Input, InputNumber, Radio, Select, Switch } from 'antd'
import { ArrowLeft, Trash2, Wand2 } from 'lucide-react'
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

/**
 * What antd rejects a failed `validateFields()` with, and hands `onFinishFailed`.
 *
 * Declared here rather than imported: the type lives in `@rc-component/form`,
 * antd's own transitive dependency, which this package does not depend on and
 * cannot resolve. Only the two members read below are described.
 */
interface ValidationFailure {
  errorFields: { name: (string | number)[]; errors: string[] }[]
}

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
  /** What the customer pays — the required one. */
  offerPrice: number
  /** The struck-through regular price; absent when nothing is on offer. */
  sellingPrice?: number
  /** Supplier cost, admin-only. */
  purchasePrice?: number
  /*
   * No `stockQuantity`. Stock is owned by the Stock ledger and only moves via a
   * StockMovement — receive a purchase order, or adjust stock. Editing it here
   * asserted a quantity no ledger row backed, which the storefront advertised
   * and checkout then rejected.
   */
  lowStockThreshold: number
  isFeatured: boolean

  taxRuleId?: string
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
  offerPrice: 0,
  sellingPrice: undefined,
  purchasePrice: undefined,
  lowStockThreshold: 5,
  isFeatured: false,
  taxRuleId: undefined,
  bundleDealId: null,
  collectionIds: [],
  tags: [],
  unit: '',
  badge: '',
  isRefundable: null,
  hasWarranty: null,
  attributes: [],
}

/** "categories, brands and tax rules" — for naming which lists failed to load. */
const formatList = (items: string[]): string =>
  items.length <= 1
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`

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

  const { data: product, isLoading: loadingProduct, error: loadError } = useProduct(productId)

  /*
   * Kept as whole queries rather than destructured data, because a field whose
   * options are still arriving and a field whose options failed are two
   * different things to a merchant, and both were previously indistinguishable
   * from "there are none".
   */
  const categoriesQuery = useCategoryTree()
  const brandsQuery = useBrands()
  const attributesQuery = useAllAttributes()
  const taxRulesQuery = useAllTaxRules()
  const collectionsQuery = useAllCollections()
  const bundleDealsQuery = useAllBundleDeals()

  const categoryTree = categoriesQuery.data
  const brandsData = brandsQuery.data
  const attributes = React.useMemo(() => attributesQuery.data ?? [], [attributesQuery.data])
  const taxRules = taxRulesQuery.data ?? []
  const collections = collectionsQuery.data ?? []
  const bundleDeals = bundleDealsQuery.data ?? []

  /*
   * A required Select whose options never arrived is a dead end: the field
   * cannot be filled, so nothing can be saved, and antd draws an empty dropdown
   * that reads as "there are none" rather than "this failed". Naming the lists
   * that failed is the difference between a merchant reloading the page and a
   * merchant reporting a form that will not save.
   */
  const failedLists = [
    categoriesQuery.isError && 'categories',
    brandsQuery.isError && 'brands',
    taxRulesQuery.isError && 'tax rules',
    attributesQuery.isError && 'attributes',
    collectionsQuery.isError && 'collections',
    bundleDealsQuery.isError && 'bundle deals',
  ].filter((name): name is string => typeof name === 'string')

  const createMutation = useCreateProduct()
  const updateMutation = useUpdateProduct()

  useBreadcrumbLabel(isEdit ? (product ? `Edit ${product.name}` : 'Edit product') : 'New product')

  const [saveError, setSaveError] = React.useState<string | null>(null)

  /**
   * Surfaces a rejected validation instead of letting the click look like a
   * no-op.
   *
   * antd renders each message beneath its own field, but this form is long and
   * the buttons live in the header — so a required field left empty far down
   * the page produced a header button that appeared frozen, with the only
   * feedback off-screen. `scrollToFirstError` on `<Form>` does not cover this:
   * it applies to the `onFinish` path, not to a rejected `validateFields()`.
   *
   * So: scroll to the first offending field, and say at the top of the form how
   * many there are, using the same banner a failed save already uses.
   */
  const reportValidationFailure = (error: unknown) => {
    const fields = (error as ValidationFailure | undefined)?.errorFields ?? []
    if (fields.length === 0) return

    // `focus` as well as scroll: scrolling alone leaves the caret wherever it
    // was, so a keyboard user was shown the problem and then had to tab back to
    // it from the header button they had just pressed.
    form.scrollToField(fields[0].name, { behavior: 'smooth', block: 'center', focus: true })
    setSaveError(
      fields.length === 1
        ? `${fields[0].errors[0] ?? 'A field needs attention'} — it is highlighted below.`
        : `${fields.length} fields need attention before this can be saved. The first is highlighted below.`,
    )
  }

  /*
   * Watched rather than read with `getFieldValue`: a new combination starts
   * from the product's price and code, and antd does not re-render this
   * component when a field changes — so reading them directly would hand the
   * variant editor whatever they were when the page first drew, which on a
   * create is 0 and "".
   */
  const watchedPrice = Form.useWatch('offerPrice', form)
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
  /*
   * Deliberately starts as `undefined`, NOT as `productKey`.
   *
   * `useState(productKey)` only honours its argument on the first render — and
   * when the detail query is already warm (arriving from the products list, or
   * back on this page after a save invalidated it) `product` is non-undefined
   * on that very first render. Seeding the key from it therefore marked the
   * product as "already synced" before anything had been read out of it, so the
   * block below never ran and `images`/`rows`/`video` kept their empty
   * defaults. The gallery looked empty, and — because the form submits
   * `images` as the complete intended set — saving then deleted every image
   * row the product had. Starting at `undefined` makes the first render always
   * a cache miss, so the sync runs exactly once per product either way.
   */
  const [syncedProductKey, setSyncedProductKey] = React.useState<string | undefined>(undefined)
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
      offerPrice: variant.offerPrice === undefined ? 0 : Number(variant.offerPrice),
      sellingPrice:
        variant.sellingPrice === null || variant.sellingPrice === undefined
          ? undefined
          : Number(variant.sellingPrice),
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
      offerPrice: Number(product.offerPrice),
      sellingPrice:
        product.sellingPrice === null ? undefined : Number(product.sellingPrice),
      purchasePrice:
        product.purchasePrice === null || product.purchasePrice === undefined
          ? undefined
          : Number(product.purchasePrice),
      lowStockThreshold: product.lowStockThreshold,
      isFeatured: product.isFeatured,
      taxRuleId: product.taxRuleId ?? undefined,
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

  /**
   * Saves, and then decides where the merchant lands — but only ever after a
   * save that actually succeeded.
   *
   * `andReturn` is a parameter rather than a second function because the
   * destination is the only thing the two buttons disagree about, and the
   * caller used to own that navigation: it awaited this, which resolves whether
   * the save worked or not, and then left for the list regardless. A refused
   * save therefore threw the merchant back to the products table with the
   * reason rendered on a page they were no longer looking at, and everything
   * they had typed gone with it. Now nothing navigates unless the request came
   * back clean.
   *
   * antd calls `onFinish` with values alone, so the default keeps this usable
   * as the form's own submit handler.
   */
  const handleSubmit = async (values: FormValues, andReturn = false) => {
    setSaveError(null)

    /*
     * Refuse to submit a gallery the form never managed to load.
     *
     * `images` is sent as the COMPLETE intended set — the server deletes every
     * row not resubmitted — so an empty array is indistinguishable from "the
     * merchant removed them all". If the product on record has images and this
     * form is holding none, that is a load failure, not an intention, and
     * saving would silently destroy them. Deleting the last image is still
     * possible: it goes through the gallery's own remove control, which leaves
     * the product's `images` empty on the next load too.
     */
    if (isEdit && (product?.images?.length ?? 0) > 0 && images.length === 0) {
      setSaveError(
        'This product has images on record but none are loaded here, so saving would delete them. Reload the page and try again.',
      )
      return
    }

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
      offerPrice: row.offerPrice,
      ...(row.sellingPrice === undefined ? {} : { sellingPrice: row.sellingPrice }),
      // No `stockQuantity` — the ledger owns it, and the backend no longer
      // accepts one here. The row still carries it, to display.
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
      offerPrice: values.offerPrice,
      sellingPrice: values.sellingPrice,
      purchasePrice: values.purchasePrice,
      lowStockThreshold: values.lowStockThreshold,
      isFeatured: values.isFeatured,

      taxRuleId: values.taxRuleId,
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
        if (andReturn) navigate('/catalog/products')
        return
      }

      const created = await createMutation.mutateAsync({ input, upload })
      toast({ title: 'Product created' })
      if (andReturn) {
        navigate('/catalog/products')
        return
      }
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
    // Shaped like the page it is standing in for — two columns from `xl`, the
    // same card rhythm — so the layout does not jump the moment it resolves.
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3 w-72" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-7 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <div className="flex flex-col gap-4">
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    )
  }

  /*
   * A product that will not load must not fall through to the empty form.
   *
   * The fields would render blank under an "Edit product" heading with nothing
   * saying anything had gone wrong, and `images`, `rows` and `selectedValueIds`
   * would all still be at their empty defaults. Since this form submits those
   * as the COMPLETE intended set, a merchant who retyped the required fields
   * and saved would delete every image, variant, collection, tag and
   * specification the product had. The load-failure guard in
   * `ResourceFormLayout` exists for exactly this reason; this page is bespoke
   * and had been missing it.
   */
  if (isEdit && loadError) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Edit product" />
        <Alert
          type="error"
          showIcon
          role="alert"
          message="Could not load this product"
          description={
            loadError instanceof Error
              ? loadError.message
              : 'The product could not be read, so it cannot be edited safely.'
          }
        />
        <div>
          <Button variant="outline" onClick={() => navigate('/catalog/products')}>
            <ArrowLeft /> Back to products
          </Button>
        </div>
      </div>
    )
  }

  const submitting = createMutation.isPending || updateMutation.isPending

  return (
    <div className="relative flex flex-col gap-4">
      {/*
       * Pinned to the top of the scroll port.
       *
       * This page is seven sections and a gallery tall, and every way out of it
       * lives up here. Unpinned, a merchant working on the specifications at the
       * bottom had no Save within reach and no sight of the banner explaining
       * why the last one was refused — the page told them where the problem was
       * from a screen and a half above it. The shell's `<main>` is the scroll
       * container, so `top-0` pins against the top of the visible area; the
       * negative margins reach out through that container's padding so scrolled
       * content passes behind the bar rather than beside it.
       */}
      <div className="flex flex-col gap-3 bg-background px-4 pb-4 ">
        <PageHeader
          title={isEdit ? 'Edit product' : 'New product'}
          // description={
          //   isEdit
          //     ? 'Edit the product details.'
          //     : 'Create a new product.'
          // }
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="lg"
                disabled={submitting}
                onClick={() => navigate('/catalog/products')}
              >
                Cancel
              </Button>
              <Button size="lg" variant="outline" onClick={() => form.submit()} loading={submitting}>
                {isEdit ? 'Save' : 'Create'} and continue editing
              </Button>
              <Button
                size="lg"
                loading={submitting}
                onClick={() => {
                  void form
                    .validateFields()
                    .then(
                      (values) => handleSubmit(values as FormValues, true),
                      reportValidationFailure,
                    )
                }}
              >
                {isEdit ? 'Save' : 'Create'} and return
              </Button>
            </div>
          }
        />

        {saveError && (
          <Alert
            type="error"
            showIcon
            role="alert"
            message={saveError}
            closable
            onClose={() => setSaveError(null)}
          />
        )}

        {failedLists.length > 0 && (
          <Alert
            type="warning"
            showIcon
            role="alert"
            message={`Could not load ${formatList(failedLists)}.`}
            description="Those fields stay empty until the lists load, and a product cannot be saved without a category, brand and tax rule. Reload the page."
          />
        )}
      </div>

      <Form
        form={form}
        layout="vertical"
        initialValues={EMPTY_VALUES}
        onFinish={handleSubmit}
        // The "…and continue editing" button submits through here, so its
        // failures need the same banner the "…and return" button gets — without
        // this they are silent too, for the same reason.
        onFinishFailed={reportValidationFailure}
        scrollToFirstError={{ behavior: 'smooth', block: 'center', focus: true }}
        className="[&_.ant-form-item]:mb-0!"
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
         
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>General</CardTitle>
                {/* <CardDescription>
                  Name the product. The product code fills in from it until you type your own.
                </CardDescription> */}
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
                  <Form.Item
                    name="name"
                    label="Name"
                    rules={[{ required: true, message: 'Name is required' }]}
                  >
                    <Input placeholder="65W USB-C Fast Charger" onChange={handleNameChange} />
                  </Form.Item>
                  <Form.Item
                    name="sku"
                    label="Product code"
                    rules={[{ required: true, message: 'Product code is required' }]}
                    // extra={
                    //   skuAutoFill
                    //     ? 'Built from the name. Type here to set your own.'
                    //     : 'Your own code — use the wand to re-sync it with the name.'
                    // }
                  >
                    <Input
                      placeholder="65w-usb-c-fast-charger"
                      onChange={() => skuAutoFill && setSkuAutoFill(false)}
                      suffix={
                        <button
                          type="button"
                          onClick={regenerateSku}
                          title="Build from name"
                          aria-label="Build the product code from the name"
                          className="rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
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
                 
                >
                  <RichTextEditor
                    minHeight="min-h-24"
                    
                  />
                </Form.Item>

                <Form.Item
                  name="description"
                  label="Description"
                  rules={[{ required: true }]}
                >
                  <RichTextEditor  />
                </Form.Item>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Organization</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
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
                    // Otherwise a list still in flight is drawn as an empty one,
                    // and the merchant reads "no brands exist" from "not here
                    // yet". Same for every reference list below.
                    loading={brandsQuery.isLoading}
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
                    loading={collectionsQuery.isLoading}
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
              <CardContent className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
                {/* `tabular-nums` on all three prices, so they read as a column
                    of comparable amounts rather than three ragged strings. */}
                <Form.Item
                  name="purchasePrice"
                  label="Purchase price"
                  rules={[{ type: 'number', min: 0, message: 'Cannot be negative' }]}
                  extra="What you paid your supplier. Never shown to customers."
                >
                  <InputNumber className="w-full tabular-nums" min={0} step={0.01} />
                </Form.Item>
                <Form.Item
                  name="offerPrice"
                  label="Offer price"
                  rules={[
                    { required: true, message: 'Offer price is required' },
                    { type: 'number', min: 0, message: 'Offer price cannot be negative' },
                  ]}
                  extra="What the customer actually pays."
                >
                  <InputNumber className="w-full tabular-nums" min={0} step={0.01} />
                </Form.Item>
                <Form.Item
                  name="sellingPrice"
                  label="Regular price"
                  rules={[{ type: 'number', min: 0, message: 'Cannot be negative' }]}
                  /*
                   * The required field is the OFFER price, not this one, which
                   * reads oddly without saying so — see design.md Decision 3.
                   */
                  extra="Shown struck through above the offer price. Leave empty if this product is not on offer."
                >
                  <InputNumber className="w-full tabular-nums" min={0} step={0.01} />
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
                    loading={taxRulesQuery.isLoading}
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
                    loading={bundleDealsQuery.isLoading}
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
              <CardContent className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
                <Form.Item name="unit" label="Sold in" extra="“1 piece”, “pack of 2”, “500 ml”.">
                  <Input placeholder="1 piece" />
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
                    <div className="flex flex-col gap-3">
                      {/* Two bare inputs in a row say nothing about which is
                          which. The header names them once, and only exists
                          when there is a row to name. */}
                      {fields.length > 0 && (
                        <div className="grid grid-cols-[1fr_1fr_32px] gap-2 text-xs font-medium text-muted-foreground">
                          <span>Detail</span>
                          <span>Value</span>
                          <span className="sr-only">Remove</span>
                        </div>
                      )}
                      {fields.map((field) => (
                        <div
                          key={field.key}
                          className="grid grid-cols-[1fr_1fr_32px] items-start gap-2"
                        >
                          {/* The visible header is not a `<label>`, so each input
                              still has to name itself for a screen reader — a
                              placeholder is not an accessible name, and it
                              disappears as soon as the field is typed in. */}
                          <Form.Item
                            name={[field.name, 'name']}
                            rules={[{ required: true, message: 'Name is required' }]}
                          >
                            <Input placeholder="Battery life" aria-label="Specification detail" />
                          </Form.Item>
                          <Form.Item
                            name={[field.name, 'value']}
                            rules={[{ required: true, message: 'Value is required' }]}
                          >
                            <Input placeholder="40 hours" aria-label="Specification value" />
                          </Form.Item>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => remove(field.name)}
                            aria-label="Remove specification"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
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
                {/* The description has to describe what is actually in the card.
                    On a create there are no checkboxes to tick, so telling the
                    merchant to tick them named a control that is not there. */}
                <CardDescription>
                  {isEdit
                    ? 'Tick the attribute values this product sells. Every combination becomes a row you can price and stock.'
                    : 'Colours, sizes and capacities — each combination priced and stocked separately.'}
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
                  Stock is not set here. It moves when you receive a purchase order or adjust stock,
                  so every change leaves a record of where the units came from.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
                {/* Read-only: the ledger is the only writer. Shown so this page
                    still answers "how many are there?" without implying it can
                    change the answer.

                    A `Form.Item` with a label but no `name` — the same thing
                    `category-form-page` does for its upload fields. antd only
                    injects `value`/`onChange` into a NAMED item's child, so a
                    nameless one is just a label and its content, and this row
                    inherits antd's own label height and spacing instead of
                    approximating them. It previously hand-rolled both, which is
                    why it needed an arbitrary `mb-6` to line up with the field
                    beside it and stopped lining up as soon as anything moved. */}
                <Form.Item label="In stock">
                  {/* 32px is antd's `controlHeight`, not a round number picked
                      by eye — this project's `--spacing` is 0.22rem, so `h-8`
                      here would be 28px and sit two pixels off the number in
                      the field beside it. */}
                  <p className="flex h-[32px] items-center text-sm tabular-nums">
                    {isEdit ? (product?.stockQuantity ?? 0) : 0}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {isEdit ? 'across all warehouses' : 'until stock is received'}
                    </span>
                  </p>
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

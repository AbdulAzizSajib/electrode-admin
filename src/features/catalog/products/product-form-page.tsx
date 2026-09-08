import * as React from 'react'
import { useNavigate, useParams } from 'react-router'
import { useFieldArray, useForm, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Trash2, Wand2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Combobox } from '@/components/ui/combobox'
import { MultiSelect } from '@/components/ui/multi-select'
import { SegmentedRadioGroup } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { toast } from '@/components/ui/use-toast'
import { useBreadcrumbLabel } from '@/components/layout/breadcrumb-context'
import { RichTextEditor } from '@/components/forms/rich-text-editor'
import { TagInput } from '@/components/forms/tag-input'
import {
  useProduct,
  useCreateProduct,
  useUpdateProduct,
  type ProductInput,
} from '@/lib/api/products'
import { useCategoryTree, type Category } from '@/lib/api/categories'
import { useBrands, type Brand } from '@/lib/api/brands'
import { useAllAttributes, type Attribute } from '@/lib/api/attributes'
import { useAllTaxRules, type TaxRule } from '@/lib/api/tax-rules'
import { useAllCollections, type Collection } from '@/lib/api/collections'
import { useAllBundleDeals, type BundleDeal } from '@/lib/api/bundle-deals'
import { QuickCreateBrand } from '@/features/catalog/products/components/quick-create-brand'
import { QuickCreateCategory } from '@/features/catalog/products/components/quick-create-category'
import { QuickCreateCollection } from '@/features/catalog/products/components/quick-create-collection'
import { QuickCreateTaxRule } from '@/features/catalog/products/components/quick-create-tax-rule'
import { QuickCreateBundleDeal } from '@/features/catalog/products/components/quick-create-bundle-deal'
import { QuickCreateAttribute } from '@/features/catalog/products/components/quick-create-attribute'
import {
  SHARED_VARIANT_KEY,
  type PendingImage,
} from '@/features/catalog/products/components/image-upload-field'
import { MediaSidebar, type ImageRow } from '@/features/catalog/products/components/media-sidebar'
import { VariantEditor } from '@/features/catalog/products/components/variant-editor'
import {
  rebuildCombinations,
  type CombinationRow,
} from '@/features/catalog/products/components/variant-combinations'
import { EditAttributeValues } from '@/features/catalog/products/components/edit-attribute-values'
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
 * Runs on react-hook-form + zod over the shadcn primitives in `components/ui`,
 * as the other eighteen form pages in this panel do. See the change
 * `migrate-product-form-to-shadcn`.
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
 * An optional amount, where "left empty" and "zero" are different answers.
 *
 * antd's `InputNumber` handed back `null` for an emptied field. A native number
 * input hands back `''`, and `z.coerce.number()` turns `''` into 0 — which
 * would save a cleared "Regular price" as a regular price of zero rather than
 * as "this product is not on offer". See design.md Decision 2.
 */
const optionalNumber = (message = 'Cannot be negative') =>
  z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().min(0, message).optional(),
  )

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  sku: z.string().min(1, 'Product code is required'),
  shortDescription: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  type: z.enum(['SIMPLE', 'VARIABLE']),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']),
  categoryId: z
    .string()
    .nullable()
    .refine((value) => !!value, { message: 'Select a category' }),
  brandId: z.string().min(1, 'Select a brand'),

  /** What the customer pays — the required one. */
  offerPrice: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number({ message: 'Offer price is required' }).min(0, 'Offer price cannot be negative'),
  ),
  /** The struck-through regular price; absent when nothing is on offer. */
  sellingPrice: optionalNumber(),
  /** Supplier cost, admin-only. */
  purchasePrice: optionalNumber(),
  /*
   * No `stockQuantity`. Stock is owned by the Stock ledger and only moves via a
   * StockMovement — receive a purchase order, or adjust stock. Editing it here
   * asserted a quantity no ledger row backed, which the storefront advertised
   * and checkout then rejected.
   */
  lowStockThreshold: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? 5 : value),
    z.coerce.number().min(0, 'Cannot be negative'),
  ),
  isFeatured: z.boolean(),

  taxRuleId: z.string().min(1, 'A product must be taxable'),
  bundleDealId: z.string().nullable(),
  collectionIds: z.array(z.string()),
  tags: z.array(z.string()),

  unit: z.string().optional(),
  badge: z.string().optional(),
  /** Tri-state: `null` is "not said", which is not the same as "No". */
  isRefundable: z.boolean().nullable(),
  hasWarranty: z.boolean().nullable(),

  attributes: z.array(
    z.object({
      id: z.string().optional(),
      name: z.string().min(1, 'Name is required'),
      value: z.string().min(1, 'Value is required'),
    }),
  ),
})

type FormValues = z.input<typeof schema>
type OutputValues = z.output<typeof schema>

const EMPTY_VALUES: FormValues = {
  name: '',
  sku: '',
  shortDescription: '',
  description: '',
  seoTitle: '',
  seoDescription: '',
  type: 'SIMPLE',
  status: 'DRAFT',
  categoryId: null,
  brandId: '',
  offerPrice: 0,
  sellingPrice: undefined,
  purchasePrice: undefined,
  lowStockThreshold: 5,
  isFeatured: false,
  taxRuleId: '',
  bundleDealId: null,
  collectionIds: [],
  tags: [],
  unit: '',
  badge: '',
  isRefundable: null,
  hasWarranty: null,
  attributes: [],
}

/**
 * The fields in the order they appear on the page.
 *
 * react-hook-form's `errors` object is keyed, not ordered, so "the first field
 * that needs attention" has to be decided against the layout rather than
 * against object key order — otherwise the banner points at the Description
 * while the Name above it is the empty one.
 */
const FIELD_ORDER: (keyof FormValues)[] = [
  'name',
  'sku',
  'shortDescription',
  'description',
  'categoryId',
  'brandId',
  'collectionIds',
  'tags',
  'type',
  'status',
  'isFeatured',
  'purchasePrice',
  'offerPrice',
  'sellingPrice',
  'taxRuleId',
  'bundleDealId',
  'unit',
  'badge',
  'isRefundable',
  'hasWarranty',
  'attributes',
  'lowStockThreshold',
]

/**
 * Which quick-create dialog is open. `parentId` belongs to the category one
 * only: it carries the level the action was invoked from, so a category
 * created from the third dropdown becomes a child of the second's selection.
 */
type QuickCreateTarget =
  | null
  | { kind: 'brand' }
  | { kind: 'collection' }
  | { kind: 'taxRule' }
  | { kind: 'bundleDeal' }
  | { kind: 'attribute' }
  | { kind: 'category'; parentId: string | null }

/** A picker's fetched options plus what was created from it, without duplicates. */
function withCreated<T extends { id: string }>(fetched: T[], created: T[]): T[] {
  if (created.length === 0) return fetched
  const known = new Set(fetched.map((row) => row.id))
  return [...fetched, ...created.filter((row) => !known.has(row.id))]
}

/** "categories, brands and tax rules" — for naming which lists failed to load. */
const formatList = (items: string[]): string =>
  items.length <= 1
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`

/** Counts every leaf message, so a bad specification row counts as one field, not one section. */
function countErrors(errors: unknown): number {
  if (!errors || typeof errors !== 'object') return 0
  const node = errors as Record<string, unknown>
  if (typeof node.message === 'string') return 1
  return Object.values(node).reduce<number>((total, child) => total + countErrors(child), 0)
}

/** The first leaf message under a field, for the single-error wording. */
function firstMessage(errors: unknown): string | undefined {
  if (!errors || typeof errors !== 'object') return undefined
  const node = errors as Record<string, unknown>
  if (typeof node.message === 'string') return node.message
  for (const child of Object.values(node)) {
    const found = firstMessage(child)
    if (found) return found
  }
  return undefined
}

/** Yes / No / not said, as three options rather than a two-state switch. */
function TriStateField({
  value,
  onChange,
  label,
}: {
  value?: boolean | null
  onChange?: (value: boolean | null) => void
  label: string
}) {
  return (
    <SegmentedRadioGroup
      aria-label={label}
      value={value === null || value === undefined ? 'unset' : value ? 'yes' : 'no'}
      onValueChange={(next) => onChange?.(next === 'unset' ? null : next === 'yes')}
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

  /*
   * Records created from a picker, without leaving this page.
   *
   * `mutateAsync` resolves before the invalidation it triggers has refetched
   * the list, so for a moment the created record is the field's value but not
   * one of its options — and a `Combobox` whose value matches no option draws
   * its placeholder. The merchant creates "Nike" and the field reads "Select a
   * brand", which reads as a create that failed. Merging here closes that gap,
   * and self-heals: once the refetch lands the entry is a duplicate and drops
   * out. Patching the query cache instead is not open to us — these lists are
   * keyed by their params object, so there is no single entry to patch.
   */
  const [createdCategories, setCreatedCategories] = React.useState<Category[]>([])
  const [createdBrands, setCreatedBrands] = React.useState<Brand[]>([])
  const [createdCollections, setCreatedCollections] = React.useState<Collection[]>([])
  const [createdTaxRules, setCreatedTaxRules] = React.useState<TaxRule[]>([])
  const [createdBundleDeals, setCreatedBundleDeals] = React.useState<BundleDeal[]>([])
  const [createdAttributes, setCreatedAttributes] = React.useState<Attribute[]>([])

  /** Which quick-create dialog is open, if any — one piece of state, not six flags. */
  const [quickCreate, setQuickCreate] = React.useState<QuickCreateTarget>(null)

  /**
   * The attribute whose values are being edited, if any.
   *
   * Held as an id rather than as the attribute itself, so the dialog re-reads
   * it from `attributes` on every render: each edit inside it invalidates the
   * attributes query, and a captured copy would go on drawing the values as
   * they were before the merchant's own change landed.
   */
  const [editingAttributeId, setEditingAttributeId] = React.useState<string | null>(null)

  const categoryTree = categoriesQuery.data
  const brands = React.useMemo(
    () => withCreated(brandsQuery.data?.data ?? [], createdBrands),
    [brandsQuery.data, createdBrands],
  )
  const attributes = React.useMemo(
    () => withCreated(attributesQuery.data ?? [], createdAttributes),
    [attributesQuery.data, createdAttributes],
  )
  const editingAttribute = React.useMemo(
    () => attributes.find((attribute) => attribute.id === editingAttributeId) ?? null,
    [attributes, editingAttributeId],
  )
  const taxRules = withCreated(taxRulesQuery.data ?? [], createdTaxRules)
  const collections = withCreated(collectionsQuery.data ?? [], createdCollections)
  const bundleDeals = withCreated(bundleDealsQuery.data ?? [], createdBundleDeals)

  /*
   * A required picker whose options never arrived is a dead end: the field
   * cannot be filled, so nothing can be saved, and an empty dropdown reads as
   * "there are none" rather than "this failed". Naming the lists that failed is
   * the difference between a merchant reloading the page and a merchant
   * reporting a form that will not save.
   */
  const failedLists = [
    categoriesQuery.isError && 'categories',
    brandsQuery.isError && 'brands',
    taxRulesQuery.isError && 'tax rules',
    attributesQuery.isError && 'attributes',
    collectionsQuery.isError && 'collections',
    bundleDealsQuery.isError && 'bundle deals',
  ].filter((name): name is string => typeof name === 'string')

  const closeQuickCreate = React.useCallback(() => setQuickCreate(null), [])

  /** Names what was created, in the same voice a saved record is confirmed in. */
  const announceCreated = (noun: string, name: string) =>
    toast({ title: `${noun} created`, description: name, variant: 'success' })

  const createMutation = useCreateProduct()
  const updateMutation = useUpdateProduct()

  useBreadcrumbLabel(isEdit ? (product ? `Edit ${product.name}` : 'Edit product') : 'New product')

  const [saveError, setSaveError] = React.useState<string | null>(null)

  /**
   * The product as form values.
   *
   * Memoised because react-hook-form's `values` option resets the form whenever
   * this reference changes — building it inline would reset on every render and
   * throw away whatever was being typed. `EMPTY_VALUES` is a module constant for
   * the same reason, and it is what resets the fields when the route goes from
   * an edit URL to `/new` without unmounting.
   */
  const values = React.useMemo<FormValues>(() => {
    if (!product) return EMPTY_VALUES
    return {
      name: product.name,
      sku: product.sku ?? '',
      shortDescription: product.shortDescription ?? '',
      seoTitle: product.seoTitle ?? '',
      seoDescription: product.seoDescription ?? '',
      description: product.description ?? '',
      type: product.type,
      status: product.status,
      categoryId: product.categoryId ?? null,
      brandId: product.brandId ?? '',
      offerPrice: Number(product.offerPrice),
      sellingPrice: product.sellingPrice === null ? undefined : Number(product.sellingPrice),
      purchasePrice:
        product.purchasePrice === null || product.purchasePrice === undefined
          ? undefined
          : Number(product.purchasePrice),
      lowStockThreshold: product.lowStockThreshold,
      isFeatured: product.isFeatured,
      taxRuleId: product.taxRuleId ?? '',
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
    }
  }, [product])

  const form = useForm<FormValues, unknown, OutputValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_VALUES,
    values,
  })

  const specifications = useFieldArray({ control: form.control, name: 'attributes' })

  /*
   * Watched rather than read with `getValues`: a new combination starts from
   * the product's price and code, and reading them directly would hand the
   * variant editor whatever they were when the page first drew, which on a
   * create is 0 and "".
   */
  const watchedPrice = form.watch('offerPrice')
  const watchedSku = form.watch('sku')

  /**
   * Whether SKU still mirrors the name. Cleared the moment the merchant types
   * their own, so auto-fill never overwrites a hand-entered value — and off
   * entirely when editing, where the saved SKU is authoritative.
   */
  const [skuAutoFill, setSkuAutoFill] = React.useState(!isEdit)

  /*
   * The inventory half lives in React state rather than in form fields.
   *
   * Combination rows are derived from the attribute selection by
   * `rebuildCombinations`, and a derived table driven by a form array would
   * mean two owners of the same data — the exact ambiguity the old generator
   * button created. The form owns the product; this owns the combinations.
   */
  const [selectedValueIds, setSelectedValueIds] = React.useState<string[]>([])
  const [rows, setRows] = React.useState<CombinationRow[]>([])
  const [images, setImages] = React.useState<ImageRow[]>([])
  /*
   * Whether the empty gallery below is something the merchant did.
   *
   * The save guard cannot read intent off `images` alone: "removed every image"
   * and "the gallery never loaded" both leave it empty while the product on
   * record still has rows. Without this the guard refused both, which made
   * deleting a product's last image impossible through the UI — the removal
   * could never be saved, so `product.images` never emptied.
   *
   * Set from the setter wrapper rather than a dedicated MediaSidebar callback:
   * removal there is an `onImagesChange(filter(...))` like any other edit, and
   * a shrinking list is exactly the signal, whatever control produced it.
   */
  const [imagesRemoved, setImagesRemoved] = React.useState(false)

  const handleImagesChange = React.useCallback((next: ImageRow[]) => {
    setImages((prev) => {
      if (next.length < prev.length) setImagesRemoved(true)
      return next
    })
  }, [])
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
    // Fresh server state: whatever was removed before is either saved or gone.
    setImagesRemoved(false)
  }

  /** Mirrors the product name into SKU as a slug, until the merchant edits SKU. */
  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!skuAutoFill) return
    form.setValue('sku', slugify(event.target.value))
    // A programmatic set does not re-run the field's rules, so clear the stale
    // "required" error explicitly.
    form.clearErrors('sku')
  }

  const regenerateSku = () => {
    const name = form.getValues('name') ?? ''
    if (!name.trim()) {
      toast({ title: 'Enter a product name first', variant: 'destructive' })
      return
    }
    form.setValue('sku', slugify(name))
    form.clearErrors('sku')
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
   * Drops a value the merchant deleted shop-wide out of this product.
   *
   * The deletion has already happened by the time this runs, so this is not a
   * choice to offer — untick and rebuild, no confirm. The dialog asked the
   * question that mattered ("products still sell this — remove anyway?") before
   * sending it. Leaving the id selected would mean a saved product referencing
   * a value the backend no longer has.
   */
  const dropDeletedValue = (valueId: string) => {
    if (!selectedValueIds.includes(valueId)) return

    const nextValueIds = selectedValueIds.filter((id) => id !== valueId)
    const nextSelected = new Set(nextValueIds)
    const nextAttributes = attributes
      .map((attribute) => ({
        attributeId: attribute.id,
        name: attribute.name,
        valueIds: attribute.values.filter((v) => nextSelected.has(v.id)).map((v) => v.id),
        labelById: Object.fromEntries(attribute.values.map((v) => [v.id, v.label])),
      }))
      .filter((attribute) => attribute.valueIds.length > 0)

    const result = rebuildCombinations(
      nextAttributes,
      rows.map((row) => ({
        id: row.id,
        variantKey: row.variantKey,
        name: row.name,
        sku: row.sku,
        offerPrice: row.offerPrice,
        sellingPrice: row.sellingPrice,
        stockQuantity: row.stockQuantity,
        valueIds: row.valueIds,
      })),
      {
        offerPrice: Number(watchedPrice) || 0,
        skuPrefix: watchedSku ?? '',
        nextKey: nextVariantKey,
      },
    )

    result.removed.forEach((variant) => releaseVariantMedia(variant.variantKey))
    setSelectedValueIds(nextValueIds)
    setRows(result.rows)
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
   * Which button was pressed. `handleSubmit` runs its handler asynchronously and
   * cannot be told which submitter fired it.
   */
  const returnAfterSave = React.useRef(false)

  /**
   * Surfaces a rejected validation instead of letting the click look like a
   * no-op.
   *
   * Each message is rendered beneath its own field, but this form is long and
   * the buttons live in the header — so a required field left empty far down
   * the page produced a header button that appeared frozen, with the only
   * feedback off-screen.
   *
   * react-hook-form focuses the first errored field on its own, but only where
   * that field's `ref` reaches a focusable node. `description`, `categoryId` and
   * `tags` are custom controls that do not forward one, so the offending field
   * is scrolled into view explicitly — without this they are exactly as silent
   * as before. See design.md Decision 4.
   */
  const reportValidationFailure = (errors: FieldErrors<FormValues>) => {
    const total = countErrors(errors)
    if (total === 0) return

    const firstField = FIELD_ORDER.find((name) => name in errors)

    setSaveError(
      total === 1
        ? `${firstMessage(errors) ?? 'A field needs attention'} — it is highlighted below.`
        : `${total} fields need attention before this can be saved. The first is highlighted below.`,
    )

    if (firstField) {
      document
        .querySelector(`[data-field="${firstField}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  /**
   * Saves, and then decides where the merchant lands — but only ever after a
   * save that actually succeeded.
   *
   * The destination is the only thing the two buttons disagree about, and the
   * caller used to own that navigation: it awaited this, which resolves whether
   * the save worked or not, and then left for the list regardless. A refused
   * save therefore threw the merchant back to the products table with the
   * reason rendered on a page they were no longer looking at, and everything
   * they had typed gone with it. Now nothing navigates unless the request came
   * back clean.
   */
  const handleSave = async (values: OutputValues) => {
    const andReturn = returnAfterSave.current
    setSaveError(null)

    /*
     * Refuse to submit a gallery the form never managed to load.
     *
     * `images` is sent as the COMPLETE intended set — the server deletes every
     * row not resubmitted — so an empty array on its own is ambiguous: it means
     * either "the merchant removed them all" or "the load failed". `imagesRemoved`
     * is what tells the two apart, because only a removal the merchant performed
     * sets it. An empty gallery nobody emptied is a load failure, and saving it
     * would silently destroy every image on record.
     *
     * Both halves are load-bearing: without the flag this also blocked deleting
     * a product's last image, since that save could never go through to make
     * `product.images` empty on the next load.
     */
    if (isEdit && (product?.images?.length ?? 0) > 0 && images.length === 0 && !imagesRemoved) {
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
      seoTitle: values.seoTitle ?? '',
      seoDescription: values.seoDescription ?? '',
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

  const submit = (andReturn: boolean) => {
    returnAfterSave.current = andReturn
    void form.handleSubmit(handleSave, reportValidationFailure)()
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
        <Alert variant="destructive" title="Could not load this product">
          {loadError instanceof Error
            ? loadError.message
            : 'The product could not be read, so it cannot be edited safely.'}
        </Alert>
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
      <div className="flex flex-col gap-3 bg-background px-4 pb-4 ">
        <PageHeader
          title={isEdit ? 'Edit product' : 'New product'}
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
              <Button size="lg" variant="outline" onClick={() => submit(false)} loading={submitting}>
                {isEdit ? 'Save' : 'Create'} and continue editing
              </Button>
              <Button size="lg" loading={submitting} onClick={() => submit(true)}>
                {isEdit ? 'Save' : 'Create'} and return
              </Button>
            </div>
          }
        />

        {saveError && (
          <Alert variant="destructive" title={saveError} onDismiss={() => setSaveError(null)} />
        )}

        {failedLists.length > 0 && (
          <Alert variant="warning" title={`Could not load ${formatList(failedLists)}.`}>
            Those fields stay empty until the lists load, and a product cannot be saved without a
            category, brand and tax rule. Reload the page.
          </Alert>
        )}
      </div>

      <Form {...form}>
        {/* A real form element so Enter still submits from inside a text field.
            The save buttons live in the page header, outside it, and call
            `submit` directly — pressing Enter takes the "stay on the form"
            branch. */}
        <form
          onSubmit={(event) => {
            event.preventDefault()
            submit(false)
          }}
        >
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>General</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem data-field="name">
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="65W USB-C Fast Charger"
                              {...field}
                              onChange={(event) => {
                                field.onChange(event)
                                handleNameChange(event)
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="sku"
                      render={({ field }) => (
                        <FormItem data-field="sku">
                          <FormLabel>Product code</FormLabel>
                          <div className="relative">
                            <FormControl>
                              <Input
                                placeholder="65w-usb-c-fast-charger"
                                className="pr-8"
                                {...field}
                                onChange={(event) => {
                                  field.onChange(event)
                                  if (skuAutoFill) setSkuAutoFill(false)
                                }}
                              />
                            </FormControl>
                            <button
                              type="button"
                              onClick={regenerateSku}
                              title="Build from name"
                              aria-label="Build the product code from the name"
                              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                            >
                              <Wand2 className="size-3.5" />
                            </button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="shortDescription"
                    render={({ field }) => (
                      <FormItem data-field="shortDescription">
                        <FormLabel>Overview</FormLabel>
                        <FormControl>
                          <RichTextEditor
                            minHeight="min-h-24"
                            value={field.value}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem data-field="description">
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <RichTextEditor value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/*
                These two columns existed on the model and were accepted by the
                backend long before anything rendered them — a merchant could not
                set a product's search title from anywhere in the panel. The same
                two fields are also editable in bulk from SEO → Page SEO; both
                write these columns through this same endpoint.
              */}
              <Card>
                <CardHeader>
                  <CardTitle>Search engine listing</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <FormField
                    control={form.control}
                    name="seoTitle"
                    render={({ field }) => (
                      <FormItem data-field="seoTitle">
                        <FormLabel>Search result title</FormLabel>
                        <FormControl>
                          <Input maxLength={200} {...field} />
                        </FormControl>
                        <FormDescription>
                          Shown as the heading in Google. Leave blank to use the product name.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="seoDescription"
                    render={({ field }) => (
                      <FormItem data-field="seoDescription">
                        <FormLabel>Search result description</FormLabel>
                        <FormControl>
                          <Textarea rows={3} maxLength={500} {...field} />
                        </FormControl>
                        <FormDescription>
                          The sentence under the link in search results. Around 160 characters.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Organization</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="categoryId"
                    render={({ field }) => (
                      <FormItem data-field="categoryId">
                        <FormLabel>Category</FormLabel>
                        <CategoryParentPicker
                          tree={categoryTree ?? []}
                          extraCategories={createdCategories}
                          value={field.value}
                          onChange={field.onChange}
                          onCreate={(parentId) => setQuickCreate({ kind: 'category', parentId })}
                          aria-label="Category"
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="brandId"
                    render={({ field }) => (
                      <FormItem data-field="brandId">
                        <FormLabel>Brand</FormLabel>
                        <FormControl>
                          <Combobox
                            placeholder="Select a brand"
                            searchPlaceholder="Search brands"
                            aria-label="Brand"
                            options={brands.map((b) => ({
                              value: b.id,
                              label: b.name,
                            }))}
                            value={field.value || null}
                            onValueChange={(next) => field.onChange(next ?? '')}
                            onBlur={field.onBlur}
                            // Otherwise a list still in flight is drawn as an
                            // empty one, and the merchant reads "no brands
                            // exist" from "not here yet". Same for every
                            // reference list below.
                            loading={brandsQuery.isLoading}
                            createAction={{
                              label: 'Add brand',
                              onSelect: () => setQuickCreate({ kind: 'brand' }),
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="collectionIds"
                    render={({ field }) => (
                      <FormItem data-field="collectionIds">
                        <FormLabel>Collections</FormLabel>
                        <FormControl>
                          <MultiSelect
                            placeholder="None"
                            searchPlaceholder="Search collections"
                            aria-label="Collections"
                            options={collections.map((c) => ({ value: c.id, label: c.name }))}
                            value={field.value}
                            onValueChange={field.onChange}
                            onBlur={field.onBlur}
                            loading={collectionsQuery.isLoading}
                            createAction={{
                              label: 'Add collection',
                              onSelect: () => setQuickCreate({ kind: 'collection' }),
                            }}
                          />
                        </FormControl>
                        <FormDescription>
                          Merchandising groups. A product keeps its category whichever it joins.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tags"
                    render={({ field }) => (
                      <FormItem data-field="tags">
                        <FormLabel>Keywords</FormLabel>
                        <FormControl>
                          <TagInput
                            aria-label="Keywords"
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem data-field="type">
                        <FormLabel>Type</FormLabel>
                        {/*
                         * The empty-value guard is not defensive padding.
                         *
                         * Inside a real `<form>` Radix renders a hidden native
                         * `<select>` to carry the value, and that select emits a
                         * change with `''` while its options are still mounting —
                         * so an unguarded `onValueChange` writes `''` over the
                         * loaded product's value, and the enum then rejects the
                         * save with "Invalid option". Radix forbids an item whose
                         * value is `''`, so `''` is never a real choice here and
                         * ignoring it loses nothing.
                         */}
                        <Select
                          value={field.value}
                          onValueChange={(next) => next && field.onChange(next)}
                        >
                          <FormControl>
                            <SelectTrigger aria-label="Type">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="SIMPLE">Simple</SelectItem>
                            <SelectItem value="VARIABLE">Variable</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem data-field="status">
                        <FormLabel>Status</FormLabel>
                        {/* Same empty-value guard as Type above. */}
                        <Select
                          value={field.value}
                          onValueChange={(next) => next && field.onChange(next)}
                        >
                          <FormControl>
                            <SelectTrigger aria-label="Status">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="DRAFT">Draft</SelectItem>
                            <SelectItem value="ACTIVE">Active</SelectItem>
                            <SelectItem value="ARCHIVED">Archived</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="isFeatured"
                    render={({ field }) => (
                      <FormItem data-field="isFeatured">
                        <FormLabel>Featured</FormLabel>
                        <FormControl>
                          <Switch
                            aria-label="Featured"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                  <FormField
                    control={form.control}
                    name="purchasePrice"
                    render={({ field }) => (
                      <FormItem data-field="purchasePrice">
                        <FormLabel>Purchase price</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            className="w-full tabular-nums"
                            {...field}
                            value={
                              field.value === undefined || field.value === null
                                ? ''
                                : String(field.value)
                            }
                          />
                        </FormControl>
                        <FormDescription>
                          What you paid your supplier. Never shown to customers.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="offerPrice"
                    render={({ field }) => (
                      <FormItem data-field="offerPrice">
                        <FormLabel>Offer price</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            className="w-full tabular-nums"
                            {...field}
                            value={
                              field.value === undefined || field.value === null
                                ? ''
                                : String(field.value)
                            }
                          />
                        </FormControl>
                        <FormDescription>What the customer actually pays.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sellingPrice"
                    render={({ field }) => (
                      <FormItem data-field="sellingPrice">
                        <FormLabel>Regular price</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            className="w-full tabular-nums"
                            {...field}
                            value={
                              field.value === undefined || field.value === null
                                ? ''
                                : String(field.value)
                            }
                          />
                        </FormControl>
                        {/*
                         * The required field is the OFFER price, not this one,
                         * which reads oddly without saying so.
                         */}
                        <FormDescription>
                          Shown struck through above the offer price. Leave empty if this product is
                          not on offer.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="taxRuleId"
                    render={({ field }) => (
                      <FormItem data-field="taxRuleId">
                        <FormLabel>Tax rule</FormLabel>
                        <FormControl>
                          <Combobox
                            placeholder="Select a tax rule"
                            searchPlaceholder="Search tax rules"
                            aria-label="Tax rule"
                            options={taxRules.map((rule) => ({
                              value: rule.id,
                              label: `${rule.name} — ${rule.type === 'PERCENT' ? `${Number(rule.value)}%` : Number(rule.value)}`,
                            }))}
                            value={field.value || null}
                            onValueChange={(next) => field.onChange(next ?? '')}
                            onBlur={field.onBlur}
                            loading={taxRulesQuery.isLoading}
                            createAction={{
                              label: 'Add tax rule',
                              onSelect: () => setQuickCreate({ kind: 'taxRule' }),
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bundleDealId"
                    render={({ field }) => (
                      <FormItem data-field="bundleDealId">
                        <FormLabel>Bundle deal</FormLabel>
                        <FormControl>
                          <Combobox
                            placeholder="No offer"
                            searchPlaceholder="Search bundle deals"
                            aria-label="Bundle deal"
                            clearable
                            options={bundleDeals.map((deal) => ({
                              value: deal.id,
                              label: `${deal.name} — buy ${deal.buyQuantity}, get ${deal.freeQuantity} free`,
                            }))}
                            value={field.value}
                            onValueChange={field.onChange}
                            onBlur={field.onBlur}
                            loading={bundleDealsQuery.isLoading}
                            createAction={{
                              label: 'Add bundle deal',
                              onSelect: () => setQuickCreate({ kind: 'bundleDeal' }),
                            }}
                          />
                        </FormControl>
                        <FormDescription>
                          Optional. A product with none is sold without an offer.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                  <FormField
                    control={form.control}
                    name="unit"
                    render={({ field }) => (
                      <FormItem data-field="unit">
                        <FormLabel>Sold in</FormLabel>
                        <FormControl>
                          <Input placeholder="1 piece" {...field} />
                        </FormControl>
                        <FormDescription>“1 piece”, “pack of 2”, “500 ml”.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="badge"
                    render={({ field }) => (
                      <FormItem data-field="badge">
                        <FormLabel>Badge</FormLabel>
                        <FormControl>
                          <Input placeholder="New" maxLength={40} {...field} />
                        </FormControl>
                        <FormDescription>A short label on the product card.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="isRefundable"
                    render={({ field }) => (
                      <FormItem data-field="isRefundable">
                        <FormLabel>Refundable</FormLabel>
                        <TriStateField
                          label="Refundable"
                          value={field.value}
                          onChange={field.onChange}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="hasWarranty"
                    render={({ field }) => (
                      <FormItem data-field="hasWarranty">
                        <FormLabel>Warranty</FormLabel>
                        <TriStateField
                          label="Warranty"
                          value={field.value}
                          onChange={field.onChange}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                  <div className="flex flex-col gap-3" data-field="attributes">
                    {/* Two bare inputs in a row say nothing about which is
                        which. The header names them once, and only exists
                        when there is a row to name. */}
                    {specifications.fields.length > 0 && (
                      <div className="grid grid-cols-[1fr_1fr_32px] gap-2 text-xs font-medium text-muted-foreground">
                        <span>Detail</span>
                        <span>Value</span>
                        <span className="sr-only">Remove</span>
                      </div>
                    )}
                    {specifications.fields.map((row, index) => (
                      <div key={row.id} className="grid grid-cols-[1fr_1fr_32px] items-start gap-2">
                        {/* The visible header is not a `<label>`, so each input
                            still has to name itself for a screen reader — a
                            placeholder is not an accessible name, and it
                            disappears as soon as the field is typed in. */}
                        <FormField
                          control={form.control}
                          name={`attributes.${index}.name`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  placeholder="Battery life"
                                  aria-label="Specification detail"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`attributes.${index}.value`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  placeholder="40 hours"
                                  aria-label="Specification value"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => specifications.remove(index)}
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
                      onClick={() => specifications.append({ name: '', value: '' })}
                    >
                      Add specification
                    </Button>
                  </div>
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
                    <Alert title="Available after saving">
                      A variant attaches to a product, so this becomes available once the product
                      exists. Save it and this section opens on the same page — nothing you have
                      typed is lost.
                    </Alert>
                  ) : (
                    <VariantEditor
                      attributes={attributes}
                      selectedValueIds={selectedValueIds}
                      onSelectedValueIdsChange={setSelectedValueIds}
                      rows={rows}
                      onRowsChange={setRows}
                      basePrice={Number(watchedPrice) || 0}
                      skuPrefix={watchedSku ?? ''}
                      nextVariantKey={nextVariantKey}
                      pendingImages={pendingImages}
                      onPendingImagesChange={setPendingImages}
                      onRowRemoved={releaseVariantMedia}
                      onCreateAttribute={() => setQuickCreate({ kind: 'attribute' })}
                      onEditAttribute={(attribute) => setEditingAttributeId(attribute.id)}
                    />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Inventory</CardTitle>
                  <CardDescription>
                    Stock is not set here. It moves when you receive a purchase order or adjust
                    stock, so every change leaves a record of where the units came from.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
                  {/* Read-only: the ledger is the only writer. Shown so this page
                      still answers "how many are there?" without implying it can
                      change the answer.

                      A plain `Label`, not `FormLabel`: this row has no field, and
                      `FormLabel` reads the field context that only `FormField`
                      provides — it throws outside one. The wrapper repeats
                      `FormItem`'s own `gap-1.5` so the row still lines up with the
                      real field beside it. It previously hand-rolled both, which
                      is why it needed an arbitrary `mb-6` to line up and stopped
                      lining up as soon as anything moved. */}
                  <div className="flex flex-col gap-1.5">
                    <Label>In stock</Label>
                    <p className="flex h-8 items-center text-sm tabular-nums">
                      {isEdit ? (product?.stockQuantity ?? 0) : 0}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {isEdit ? 'across all warehouses' : 'until stock is received'}
                      </span>
                    </p>
                  </div>
                  <FormField
                    control={form.control}
                    name="lowStockThreshold"
                    render={({ field }) => (
                      <FormItem data-field="lowStockThreshold">
                        <FormLabel>Low stock threshold</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            className="w-full"
                            {...field}
                            value={
                              field.value === undefined || field.value === null
                                ? ''
                                : String(field.value)
                            }
                          />
                        </FormControl>
                        <FormDescription>
                          Flags the product once stock drops to this level.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>

            {/* --- Media, beside the copy it illustrates --- */}
            <MediaSidebar
              images={images}
              onImagesChange={handleImagesChange}
              pendingImages={pendingImages}
              onPendingImagesChange={setPendingImages}
              video={video.url}
              videoThumbnail={video.thumbnailUrl}
              onVideoChange={setVideo}
              productExists={isEdit}
            />
          </div>
        </form>
      </Form>

      {/*
       * Outside the <form>, so nothing here can be mistaken for part of it —
       * belt to the braces of the shell's own stopPropagation. Each is mounted
       * only while open, which is what resets its fields between openings.
       */}
      {quickCreate?.kind === 'brand' && (
        <QuickCreateBrand
          open
          onOpenChange={closeQuickCreate}
          onCreated={(brand) => {
            setCreatedBrands((current) => [...current, brand])
            form.setValue('brandId', brand.id, { shouldValidate: true, shouldDirty: true })
            announceCreated('Brand', brand.name)
          }}
        />
      )}

      {quickCreate?.kind === 'category' && (
        <QuickCreateCategory
          open
          onOpenChange={closeQuickCreate}
          tree={categoryTree ?? []}
          defaultParentId={quickCreate.parentId}
          onCreated={(category) => {
            setCreatedCategories((current) => [...current, category])
            // The picker derives its chain by walking `parentId` upwards, so
            // setting the leaf is enough — the levels above rebuild themselves.
            form.setValue('categoryId', category.id, { shouldValidate: true, shouldDirty: true })
            announceCreated('Category', category.name)
          }}
        />
      )}

      {quickCreate?.kind === 'collection' && (
        <QuickCreateCollection
          open
          onOpenChange={closeQuickCreate}
          onCreated={(collection) => {
            setCreatedCollections((current) => [...current, collection])
            // Added to the selection, not replacing it.
            form.setValue('collectionIds', [...form.getValues('collectionIds'), collection.id], {
              shouldValidate: true,
              shouldDirty: true,
            })
            announceCreated('Collection', collection.name)
          }}
        />
      )}

      {quickCreate?.kind === 'taxRule' && (
        <QuickCreateTaxRule
          open
          onOpenChange={closeQuickCreate}
          onCreated={(taxRule) => {
            setCreatedTaxRules((current) => [...current, taxRule])
            form.setValue('taxRuleId', taxRule.id, { shouldValidate: true, shouldDirty: true })
            announceCreated('Tax rule', taxRule.name)
          }}
        />
      )}

      {quickCreate?.kind === 'bundleDeal' && (
        <QuickCreateBundleDeal
          open
          onOpenChange={closeQuickCreate}
          onCreated={(bundleDeal) => {
            setCreatedBundleDeals((current) => [...current, bundleDeal])
            form.setValue('bundleDealId', bundleDeal.id, {
              shouldValidate: true,
              shouldDirty: true,
            })
            announceCreated('Bundle deal', bundleDeal.name)
          }}
        />
      )}

      {quickCreate?.kind === 'attribute' && (
        <QuickCreateAttribute
          open
          onOpenChange={closeQuickCreate}
          onCreated={(attribute) => {
            setCreatedAttributes((current) => [...current, attribute])
            /*
             * Every value ticked, not none: the merchant just authored exactly
             * the values they intend to sell, so making them tick each one
             * again is a step with no decision in it. The editor's existing
             * rebuild reacts to the changed selection and carries over the
             * rows already priced and stocked for other attributes.
             */
            setSelectedValueIds((current) => [
              ...current,
              ...attribute.values.map((value) => value.id),
            ])
            announceCreated('Attribute', attribute.name)
          }}
        />
      )}

      {editingAttribute && (
        <EditAttributeValues
          attribute={editingAttribute}
          open
          onOpenChange={(next) => {
            if (!next) setEditingAttributeId(null)
          }}
          onValueCreated={(value) => {
            /*
             * Ticked on arrival, for the same reason a quick-created
             * attribute's values are: the merchant added this value in order to
             * sell it here. The editor's rebuild reacts to the changed
             * selection and carries the rows already priced over.
             *
             * Note this only handles values created from within the dialog —
             * `createdAttributes` is not touched, because unlike a quick-create
             * the attribute already exists and the invalidated query brings its
             * new value back on the next fetch.
             */
            setSelectedValueIds((current) => [...current, value.id])
          }}
          onValueDeleted={dropDeletedValue}
        />
      )}
    </div>
  )
}

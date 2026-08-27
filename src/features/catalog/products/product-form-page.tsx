import * as React from 'react'
import { useNavigate, useParams } from 'react-router'
import { Form, Input, InputNumber, Select, Switch, Button as AntButton } from 'antd'
import { Image as ImageIcon, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { useBreadcrumbLabel } from '@/components/layout/breadcrumb-context'
import { useProduct, useCreateProduct, useUpdateProduct, type ProductInput, type ProductStatus, type ProductType } from '@/lib/api/products'
import { useCategoryTree } from '@/lib/api/categories'
import { useBrands } from '@/lib/api/brands'
import { ImageUploadField, type PendingImage } from '@/features/catalog/products/components/image-upload-field'
import { CategoryParentPicker } from '@/features/catalog/categories/category-parent-picker'

interface ImageValue {
  id?: string
  url: string
  altText?: string
  isPrimary: boolean
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
      })),
      attributes: (product.attributes ?? []).map((a) => ({ id: a.id, name: a.name, value: a.value })),
      variants: (product.variants ?? []).map((v) => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        price: v.price === undefined ? 0 : Number(v.price),
        stockQuantity: v.stockQuantity ?? 0,
        attributes: Object.entries(v.attributes ?? {}).map(([name, value]) => ({ name, value })),
      })),
    })
  }, [product, form])

  const type = Form.useWatch('type', form)

  /** Keeps at most one primary image across both the URL rows and the pending uploads. */
  const setPrimaryUrlRow = (index: number) => {
    const images = (form.getFieldValue('images') as ImageValue[] | undefined) ?? []
    form.setFieldValue(
      'images',
      images.map((img, i) => ({ ...img, isPrimary: i === index })),
    )
    setPendingImages((prev) => prev.map((p) => ({ ...p, isPrimary: false })))
  }

  const handleSubmit = async (values: FormValues) => {
    const images = (values.images ?? []).map((img, index) => ({
      ...(img.id ? { id: img.id } : {}),
      url: img.url,
      altText: img.altText || undefined,
      sortOrder: index,
      isPrimary: !!img.isPrimary,
    }))
    // Exactly one image must be primary once there's at least one (across URL rows AND pending
    // uploads) — default to the first URL row only when no upload already claimed it either.
    if (images.length > 0 && !images.some((img) => img.isPrimary) && !pendingImages.some((p) => p.isPrimary)) {
      images[0].isPrimary = true
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
      variants:
        values.type === 'VARIABLE'
          ? (values.variants ?? []).map((v) => ({
              ...(v.id ? { id: v.id } : {}),
              name: v.name,
              sku: v.sku,
              price: v.price,
              stockQuantity: v.stockQuantity,
              attributes: Object.fromEntries((v.attributes ?? []).map((a) => [a.name, a.value])),
            }))
          : [],
    }

    // Positional match to `imageSlots[i]` <-> `files[i]` — see ProductImageUpload in lib/api/products.ts.
    const upload =
      pendingImages.length > 0
        ? {
            files: pendingImages.map((p) => p.file),
            imageSlots: pendingImages.map((p) => ({ altText: p.altText || undefined, isPrimary: p.isPrimary })),
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
      <PageHeader title={isEdit ? 'Edit product' : 'New product'} description="Fill in the product details below." />

      <Form form={form} layout="vertical" initialValues={EMPTY_VALUES} onFinish={handleSubmit} scrollToFirstError>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="flex flex-col gap-4 lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>General</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-1">
                  <div className="grid grid-cols-2 gap-3">
                    <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
                      <Input />
                    </Form.Item>
                    <Form.Item name="sku" label="SKU" rules={[{ required: true, message: 'SKU is required' }]}>
                      <Input />
                    </Form.Item>
                  </div>
                  <Form.Item name="shortDescription" label="Short description">
                    <Input placeholder="One-line summary shown in listings" />
                  </Form.Item>
                  <Form.Item name="description" label="Description" rules={[{ required: true, message: 'Description is required' }]}>
                    <Input.TextArea rows={4} />
                  </Form.Item>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pricing &amp; Inventory</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-x-3">
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
                  <Form.Item name="compareAtPrice" label="Compare-at price" rules={[{ type: 'number', min: 0, message: 'Cannot be negative' }]}>
                    <InputNumber className="w-full" min={0} step={0.01} />
                  </Form.Item>
                  <Form.Item name="stockQuantity" label="Stock quantity" rules={[{ type: 'number', min: 0, message: 'Cannot be negative' }]}>
                    <InputNumber className="w-full" min={0} />
                  </Form.Item>
                  <Form.Item name="lowStockThreshold" label="Low stock threshold" rules={[{ type: 'number', min: 0, message: 'Cannot be negative' }]}>
                    <InputNumber className="w-full" min={0} />
                  </Form.Item>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle>Images</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2.5">
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
                        {fields.length === 0 && <p className="text-sm text-muted-foreground">No images added yet.</p>}
                        <AntButton
                          type="dashed"
                          onClick={() => add({ url: '', altText: '', isPrimary: fields.length === 0 })}
                          className="self-start"
                          icon={<Plus className="size-4" />}
                        >
                          Add image
                        </AntButton>
                      </div>
                    )}
                  </Form.List>

                  <ImageUploadField
                    pending={pendingImages}
                    onChange={(next) => {
                      setPendingImages(next)
                      // At most one primary image across both lists — a newly-checked upload wins.
                      if (next.some((p) => p.isPrimary)) {
                        const images = (form.getFieldValue('images') as ImageValue[] | undefined) ?? []
                        form.setFieldValue('images', images.map((img) => ({ ...img, isPrimary: false })))
                      }
                    }}
                    hasPrimaryElsewhere={((form.getFieldValue('images') as ImageValue[] | undefined) ?? []).some((img) => img.isPrimary)}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Attributes</CardTitle>
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

              {type === 'VARIABLE' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Variants</CardTitle>
                  </CardHeader>
                  <CardContent>
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
                          {fields.map((field) => (
                            <div key={field.key} className="flex flex-col gap-1 rounded-md border border-border p-2.5">
                              <div className="grid grid-cols-1 gap-x-2 sm:grid-cols-[1fr_1fr_100px_100px_32px] sm:items-start">
                                <Form.Item name={[field.name, 'name']} label="Variant name" rules={[{ required: true, message: 'Variant name is required' }]}>
                                  <Input placeholder="128GB / Black" />
                                </Form.Item>
                                <Form.Item name={[field.name, 'sku']} label="SKU" rules={[{ required: true, message: 'Variant SKU is required' }]}>
                                  <Input />
                                </Form.Item>
                                <Form.Item name={[field.name, 'price']} label="Price" rules={[{ type: 'number', min: 0, message: 'Cannot be negative' }]}>
                                  <InputNumber className="w-full" min={0} step={0.01} />
                                </Form.Item>
                                <Form.Item name={[field.name, 'stockQuantity']} label="Stock" rules={[{ type: 'number', min: 0, message: 'Cannot be negative' }]}>
                                  <InputNumber className="w-full" min={0} />
                                </Form.Item>
                                <div className="pt-7">
                                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(field.name)}>
                                    <Trash2 className="size-4" />
                                  </Button>
                                </div>
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
                            </div>
                          ))}
                          {fields.length === 0 && <p className="text-sm text-muted-foreground">No variants added yet.</p>}
                          <Form.ErrorList errors={errors} />
                          <AntButton
                            type="dashed"
                            onClick={() => add({ name: '', sku: '', price: 0, stockQuantity: 0, attributes: [] })}
                            className="self-start"
                            icon={<Plus className="size-4" />}
                          >
                            Add variant
                          </AntButton>
                        </div>
                      )}
                    </Form.List>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Organization</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-1">
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Visibility</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form.Item name="isFeatured" label="Featured" valuePropName="checked" className="mb-0!">
                    <Switch />
                  </Form.Item>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {isEdit ? 'Save changes' : 'Create product'}
            </Button>
          </div>
        </div>
      </Form>
    </div>
  )
}

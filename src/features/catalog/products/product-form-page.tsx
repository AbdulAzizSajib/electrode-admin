import * as React from 'react'
import { useNavigate, useParams } from 'react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm, type Control } from 'react-hook-form'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { useBreadcrumbLabel } from '@/components/layout/breadcrumb-context'
import { useProduct, useCreateProduct, useUpdateProduct, type ProductInput } from '@/lib/api/products'
import { useCategoryTree } from '@/lib/api/categories'
import { useBrands } from '@/lib/api/brands'
import { ImageUploadField, type PendingImage } from '@/features/catalog/products/components/image-upload-field'
import { CategoryParentPicker } from '@/features/catalog/categories/category-parent-picker'

const imageSchema = z.object({
  id: z.string().optional(),
  url: z.string().min(1, 'Image URL is required').url('Must be a valid URL'),
  altText: z.string().optional(),
  isPrimary: z.boolean(),
})

const attributeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  value: z.string().min(1, 'Value is required'),
})

const variantAttributeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  value: z.string().min(1, 'Value is required'),
})

const variantSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Variant name is required'),
  sku: z.string().min(1, 'Variant SKU is required'),
  price: z.coerce.number().min(0, 'Price cannot be negative'),
  stockQuantity: z.coerce.number().min(0, 'Stock cannot be negative'),
  attributes: z.array(variantAttributeSchema),
})

const schema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    sku: z.string().min(1, 'SKU is required'),
    shortDescription: z.string().optional(),
    description: z.string().min(1, 'Description is required'),
    type: z.enum(['SIMPLE', 'VARIABLE']),
    status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']),
    categoryId: z.string().min(1, 'Select a category'),
    brandId: z.string().min(1, 'Select a brand'),
    price: z.coerce.number().min(0, 'Price cannot be negative'),
    compareAtPrice: z.coerce.number().optional(),
    stockQuantity: z.coerce.number().min(0),
    lowStockThreshold: z.coerce.number().min(0),
    isFeatured: z.boolean(),
    images: z.array(imageSchema),
    attributes: z.array(attributeSchema),
    variants: z.array(variantSchema),
  })
  .superRefine((values, ctx) => {
    if (values.type === 'VARIABLE' && values.variants.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Add at least one variant for a variable product',
        path: ['variants'],
      })
    }
  })

type Values = z.input<typeof schema>
type OutputValues = z.output<typeof schema>

/** One variant row plus its own nested attribute (storage, color, …) editor — a separate
 * component because a nested `useFieldArray` can't be called from inside the parent's `.map()`. */
function VariantRow({ control, index, onRemove }: { control: Control<Values>; index: number; onRemove: () => void }) {
  const { fields, append, remove } = useFieldArray({ control, name: `variants.${index}.attributes` })

  return (
    <div className="flex flex-col gap-2.5 rounded-md border border-border p-2.5">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_100px_100px_32px] sm:items-end">
        <FormField
          control={control}
          name={`variants.${index}.name`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Variant name</FormLabel>
              <FormControl>
                <Input placeholder="128GB / Black" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`variants.${index}.sku`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>SKU</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`variants.${index}.price`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Price</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" min="0" {...field} value={field.value === undefined ? '' : String(field.value)} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`variants.${index}.stockQuantity`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Stock</FormLabel>
              <FormControl>
                <Input type="number" min="0" {...field} value={field.value === undefined ? '' : String(field.value)} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="button" variant="ghost" size="icon" onClick={onRemove}>
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Attributes (e.g. storage, color)</span>
        {fields.map((field, attrIndex) => (
          <div key={field.id} className="grid grid-cols-[1fr_1fr_32px] gap-2">
            <FormField
              control={control}
              name={`variants.${index}.attributes.${attrIndex}.name`}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder="storage" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`variants.${index}.attributes.${attrIndex}.value`}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder="128GB" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="button" variant="ghost" size="icon" onClick={() => remove(attrIndex)}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button type="button" size="sm" variant="outline" className="self-start" onClick={() => append({ name: '', value: '' })}>
          <Plus /> Add attribute
        </Button>
      </div>
    </div>
  )
}

export default function ProductFormPage() {
  const { productId } = useParams()
  const isEdit = !!productId
  const navigate = useNavigate()

  const { data: product, isLoading: loadingProduct } = useProduct(productId)
  const { data: categoryTree } = useCategoryTree()
  const { data: brandsData } = useBrands()
  const createMutation = useCreateProduct()
  const updateMutation = useUpdateProduct()

  useBreadcrumbLabel(isEdit ? (product ? `Edit ${product.name}` : 'Edit product') : 'New product')

  const form = useForm<Values, unknown, OutputValues>({
    resolver: zodResolver(schema),
    values: product
      ? {
          name: product.name,
          sku: product.sku ?? '',
          shortDescription: product.shortDescription ?? '',
          description: product.description ?? '',
          type: product.type,
          status: product.status,
          categoryId: product.categoryId ?? '',
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
        }
      : undefined,
    defaultValues: {
      name: '',
      sku: '',
      shortDescription: '',
      description: '',
      type: 'SIMPLE',
      status: 'DRAFT',
      categoryId: '',
      brandId: '',
      price: 0,
      compareAtPrice: undefined,
      stockQuantity: 0,
      lowStockThreshold: 5,
      isFeatured: false,
      images: [],
      attributes: [],
      variants: [],
    },
  })

  const type = form.watch('type')

  const imageArray = useFieldArray({ control: form.control, name: 'images' })
  const attributeArray = useFieldArray({ control: form.control, name: 'attributes' })
  const variantArray = useFieldArray({ control: form.control, name: 'variants' })

  // Locally-picked files pending upload — separate from `imageArray` (URL-based rows only).
  // Reset whenever the product being edited changes, same as the form's own `values` re-sync.
  const [pendingImages, setPendingImages] = React.useState<PendingImage[]>([])
  React.useEffect(() => {
    setPendingImages([])
  }, [product?.id])

  const onSubmit = async (values: OutputValues) => {
    const images = values.images.map((img, index) => ({
      ...(img.id ? { id: img.id } : {}),
      url: img.url,
      altText: img.altText || undefined,
      sortOrder: index,
      isPrimary: img.isPrimary,
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
      categoryId: values.categoryId,
      brandId: values.brandId,
      price: values.price,
      compareAtPrice: values.compareAtPrice,
      stockQuantity: values.stockQuantity,
      lowStockThreshold: values.lowStockThreshold,
      isFeatured: values.isFeatured,
      images,
      attributes: values.attributes.map((a) => ({ ...(a.id ? { id: a.id } : {}), name: a.name, value: a.value })),
      variants:
        values.type === 'VARIABLE'
          ? values.variants.map((v) => ({
              ...(v.id ? { id: v.id } : {}),
              name: v.name,
              sku: v.sku,
              price: v.price,
              stockQuantity: v.stockQuantity,
              attributes: Object.fromEntries(v.attributes.map((a) => [a.name, a.value])),
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
        const created = await createMutation.mutateAsync({ input, upload })
        toast({ title: 'Product created' })
        navigate(`/catalog/products/${created.id}`)
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

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={isEdit ? 'Edit product' : 'New product'} description="Fill in the product details below." />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="flex flex-col gap-4 lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>General</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3.5">
                  <div className="grid grid-cols-2 gap-3.5">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="sku"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SKU</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="shortDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Short description</FormLabel>
                        <FormControl>
                          <Input placeholder="One-line summary shown in listings" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea rows={4} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pricing & Inventory</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3.5">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" min="0" {...field} value={field.value === undefined ? '' : String(field.value)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="compareAtPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Compare-at price</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" min="0" {...field} value={field.value === undefined ? '' : String(field.value)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="stockQuantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stock quantity</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" {...field} value={field.value === undefined ? '' : String(field.value)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lowStockThreshold"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Low stock threshold</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" {...field} value={field.value === undefined ? '' : String(field.value)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle>Images</CardTitle>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => imageArray.append({ url: '', altText: '', isPrimary: imageArray.fields.length === 0 })}
                  >
                    <Plus /> Add image
                  </Button>
                </CardHeader>
                <CardContent className="flex flex-col gap-2.5">
                  {imageArray.fields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-1 gap-2 rounded-md border border-border p-2.5 sm:grid-cols-[1fr_1fr_90px_32px] sm:items-end">
                      <FormField
                        control={form.control}
                        name={`images.${index}.url`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Image URL</FormLabel>
                            <FormControl>
                              <Input placeholder="https://…" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`images.${index}.altText`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Alt text</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`images.${index}.isPrimary`}
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center gap-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={(checked) => {
                                  if (!checked) return
                                  imageArray.fields.forEach((_, i) => form.setValue(`images.${i}.isPrimary`, i === index))
                                  // At most one primary image across both URL rows and pending uploads.
                                  setPendingImages((prev) => prev.map((p) => ({ ...p, isPrimary: false })))
                                }}
                              />
                            </FormControl>
                            <FormLabel className="text-sm font-normal text-foreground">Primary</FormLabel>
                          </FormItem>
                        )}
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => imageArray.remove(index)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  {imageArray.fields.length === 0 && <p className="text-sm text-muted-foreground">No images added yet.</p>}

                  <ImageUploadField
                    pending={pendingImages}
                    onChange={(next) => {
                      setPendingImages(next)
                      // At most one primary image across both lists — a newly-checked upload wins.
                      if (next.some((p) => p.isPrimary)) {
                        imageArray.fields.forEach((_, i) => form.setValue(`images.${i}.isPrimary`, false))
                      }
                    }}
                    hasPrimaryElsewhere={imageArray.fields.some((_, i) => form.getValues(`images.${i}.isPrimary`))}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle>Attributes</CardTitle>
                  <Button type="button" size="sm" variant="outline" onClick={() => attributeArray.append({ name: '', value: '' })}>
                    <Plus /> Add attribute
                  </Button>
                </CardHeader>
                <CardContent className="flex flex-col gap-2.5">
                  {attributeArray.fields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-[1fr_1fr_32px] gap-2">
                      <FormField
                        control={form.control}
                        name={`attributes.${index}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input placeholder="Warranty" {...field} />
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
                              <Input placeholder="1 year" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => attributeArray.remove(index)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  {attributeArray.fields.length === 0 && <p className="text-sm text-muted-foreground">No attributes added yet.</p>}
                </CardContent>
              </Card>

              {type === 'VARIABLE' && (
                <Card>
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <CardTitle>Variants</CardTitle>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => variantArray.append({ name: '', sku: '', price: 0, stockQuantity: 0, attributes: [] })}
                    >
                      <Plus /> Add variant
                    </Button>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2.5">
                    {variantArray.fields.map((field, index) => (
                      <VariantRow key={field.id} control={form.control} index={index} onRemove={() => variantArray.remove(index)} />
                    ))}
                    {variantArray.fields.length === 0 && <p className="text-sm text-muted-foreground">No variants added yet.</p>}
                    {form.formState.errors.variants?.root?.message && (
                      <p className="text-sm text-destructive">{form.formState.errors.variants.root.message}</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Organization</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3.5">
                  <FormField
                    control={form.control}
                    name="categoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <FormControl>
                          {/* Cascading parent -> child picker (same component/behavior as the
                              Category admin page), not a flat list mixing every depth together. */}
                          <CategoryParentPicker
                            tree={categoryTree ?? []}
                            value={field.value || null}
                            onChange={(id) => field.onChange(id ?? '')}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="brandId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Brand</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a brand" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {brandsData?.data.map((b) => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
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
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Visibility</CardTitle>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="isFeatured"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between gap-2">
                        <FormLabel className="text-sm font-normal text-foreground">Featured</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              {isEdit ? 'Save changes' : 'Create product'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}

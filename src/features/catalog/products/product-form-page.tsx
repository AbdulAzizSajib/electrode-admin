import { useNavigate, useParams } from 'react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
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
import { useProduct, useCreateProduct, useUpdateProduct } from '@/lib/api/products'
import { useCategories } from '@/lib/api/categories'
import { useBrands } from '@/lib/api/brands'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  sku: z.string().min(1, 'SKU is required'),
  price: z.coerce.number().min(0, 'Price cannot be negative'),
  compareAtPrice: z.coerce.number().optional(),
  brandId: z.string().min(1, 'Select a brand'),
  categoryIds: z.array(z.string()).min(1, 'Select at least one category'),
  images: z.string().min(1, 'Add at least one image URL'),
  isPublished: z.boolean(),
  stockQuantity: z.coerce.number().min(0),
  lowStockThreshold: z.coerce.number().min(0),
})

type Values = z.input<typeof schema>
type OutputValues = z.output<typeof schema>

export default function ProductFormPage() {
  const { productId } = useParams()
  const isEdit = !!productId
  const navigate = useNavigate()

  const { data: product, isLoading: loadingProduct } = useProduct(productId)
  const { data: categoriesData } = useCategories()
  const { data: brandsData } = useBrands()
  const createMutation = useCreateProduct()
  const updateMutation = useUpdateProduct()

  useBreadcrumbLabel(isEdit ? (product ? `Edit ${product.name}` : 'Edit product') : 'New product')

  const form = useForm<Values, unknown, OutputValues>({
    resolver: zodResolver(schema),
    values: product
      ? {
          name: product.name,
          slug: product.slug,
          description: product.description,
          sku: product.sku,
          price: product.price,
          compareAtPrice: product.compareAtPrice,
          brandId: product.brandId,
          categoryIds: product.categoryIds,
          images: product.images.join('\n'),
          isPublished: product.isPublished,
          stockQuantity: product.stockQuantity,
          lowStockThreshold: product.lowStockThreshold,
        }
      : undefined,
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      sku: '',
      price: 0,
      compareAtPrice: undefined,
      brandId: '',
      categoryIds: [],
      images: '',
      isPublished: false,
      stockQuantity: 0,
      lowStockThreshold: 10,
    },
  })

  const onSubmit = async (values: OutputValues) => {
    const input = {
      ...values,
      images: values.images
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    }
    try {
      if (isEdit && productId) {
        await updateMutation.mutateAsync({ id: productId, input })
        toast({ title: 'Product updated' })
        navigate(`/catalog/products/${productId}`)
      } else {
        const created = await createMutation.mutateAsync(input)
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
                  <div className="grid grid-cols-2 gap-3.5">
                    <FormField
                      control={form.control}
                      name="slug"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Slug</FormLabel>
                          <FormControl>
                            <Input placeholder="auto-generated" {...field} />
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
                  <FormField
                    control={form.control}
                    name="images"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Image URLs (one per line)</FormLabel>
                        <FormControl>
                          <Textarea rows={3} placeholder="https://…" {...field} />
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
            </div>

            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Organization</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3.5">
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
                    name="categoryIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categories</FormLabel>
                        <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto rounded-md border border-input p-2">
                          {categoriesData?.data.map((c) => {
                            const checked = field.value.includes(c.id)
                            return (
                              <label key={c.id} className="flex items-center gap-2 text-sm">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(v) =>
                                    field.onChange(v ? [...field.value, c.id] : field.value.filter((id) => id !== c.id))
                                  }
                                />
                                {c.name}
                              </label>
                            )
                          })}
                        </div>
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
                    name="isPublished"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between gap-2">
                        <FormLabel className="text-sm font-normal text-foreground">Published</FormLabel>
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

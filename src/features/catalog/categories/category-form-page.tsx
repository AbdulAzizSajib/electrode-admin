import * as React from 'react'
import { useLocation, useParams, useSearchParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ResourceFormPage } from '@/components/crud/resource-form-page'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { NumberInput } from '@/components/ui/number-input'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { SingleImageField } from '@/components/forms/single-image-field'
import { CategoryParentPicker } from '@/features/catalog/categories/category-parent-picker'
import { CATEGORIES_PATH } from '@/features/catalog/categories/categories-page'
import { SUB_CATEGORIES_PATH } from '@/features/catalog/sub-categories/sub-categories-page'
import { numberWithDefault } from '@/lib/validation/numeric'
import {
  useCategory,
  useCategoryTree,
  useCreateCategory,
  useUpdateCategory,
  type Category,
  type CategoryInput,
} from '@/lib/api/categories'

/**
 * One form for categories and sub-categories.
 *
 * A sub-category is a category with a parent — the same record, reached from a
 * different list — so it gets the same form. Only where Cancel and
 * "Save and return" land differs, and that is decided by which route matched:
 * the merchant goes back to the list they came from, not to the other one.
 */

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  image: z.string().optional(),
  parentId: z.string().nullable(),
  status: z.boolean(),
  // No floor: a sort order is a position, and a merchant may want one to sit
  // above whatever is currently at zero.
  sortOrder: numberWithDefault(0, { min: null }),
  /**
   * The same two columns the SEO menu's Page SEO table writes. They existed on
   * the model and were accepted by the backend's validation long before this
   * form rendered them — so a merchant could not set them from anywhere.
   */
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
})
/**
 * `sortOrder` runs through a `z.preprocess`, so what the form holds and what a
 * valid submit produces are different types — the box carries whatever was
 * typed, the payload carries a number. The two are named separately and
 * threaded through `useForm` and `ResourceFormPage`, as on the product and
 * voucher forms.
 */
type FormValues = z.input<typeof schema>
type OutputValues = z.output<typeof schema>

const EMPTY_VALUES: FormValues = {
  name: '',
  description: '',
  image: '',
  parentId: null,
  status: true,
  sortOrder: 0,
  seoTitle: '',
  seoDescription: '',
}

const toValues = (category: Category): FormValues => ({
  name: category.name,
  description: category.description ?? '',
  image: category.image ?? '',
  parentId: category.parentId,
  status: category.status,
  sortOrder: category.sortOrder,
  seoTitle: category.seoTitle ?? '',
  seoDescription: category.seoDescription ?? '',
})

function toInput(values: OutputValues): CategoryInput {
  const input: CategoryInput = {
    name: values.name,
    description: values.description || undefined,
    image: values.image || undefined,
    status: values.status,
    sortOrder: values.sortOrder,
    /*
     * Sent even when empty, unlike `description` above. An omitted key means
     * "leave unchanged" under the partial upsert, so omitting a blank field
     * would make clearing an SEO title impossible from this form.
     */
    seoTitle: values.seoTitle ?? '',
    seoDescription: values.seoDescription ?? '',
  }
  // Only send parentId when a real parent is picked — the backend rejects `null`
  // for top-level categories, it wants the key left out entirely.
  if (values.parentId) {
    input.parentId = values.parentId
  }
  return input
}

export default function CategoryFormPage() {
  const { categoryId } = useParams()
  const { pathname } = useLocation()

  /**
   * "Add child" from the tree, and creating from the sub-categories list, both
   * imply a parent. It travels as a query parameter rather than router state so
   * that reloading the page — or opening the link a second time — still lands on
   * the right parent instead of silently creating a top-level category.
   */
  const [searchParams] = useSearchParams()
  const defaultParentId = searchParams.get('parentId')

  const listPath = pathname.startsWith(SUB_CATEGORIES_PATH) ? SUB_CATEGORIES_PATH : CATEGORIES_PATH

  const { data, isLoading, error } = useCategory(categoryId)
  const { data: categoryTree = [] } = useCategoryTree()
  const createMutation = useCreateCategory()
  const updateMutation = useUpdateCategory()

  const form = useForm<FormValues, unknown, OutputValues>({
    resolver: zodResolver(schema),
    defaultValues: { ...EMPTY_VALUES, parentId: defaultParentId ?? null },
  })

  // Picked files are component state, not form fields — the URL fields are the
  // other route to the same artwork.
  const [imageFile, setImageFile] = React.useState<File | null>(null)
  const [bannerFile, setBannerFile] = React.useState<File | null>(null)

  const save = async (values: OutputValues) => {
    if (categoryId) {
      await updateMutation.mutateAsync({ id: categoryId, input: toInput(values), imageFile, bannerFile })
      // The files have been sent; keeping them selected would re-upload the same
      // bytes on the next save from this page.
      setImageFile(null)
      setBannerFile(null)
      return
    }
    const created = await createMutation.mutateAsync({ input: toInput(values), imageFile, bannerFile })
    setImageFile(null)
    setBannerFile(null)
    return { id: created.id }
  }

  const noun = listPath === SUB_CATEGORIES_PATH ? 'Sub category' : 'Category'

  return (
    <ResourceFormPage<FormValues, Category, OutputValues>
      noun={noun}
      listPath={listPath}
      recordId={categoryId}
      form={form}
      record={data}
      isLoading={isLoading}
      loadError={error}
      toValues={toValues}
      onSave={save}
    >
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
        name="parentId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Parent category</FormLabel>
            <CategoryParentPicker
              tree={categoryTree}
              excludeId={categoryId}
              value={field.value}
              onChange={field.onChange}
            />
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
              <Textarea rows={3} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Upload and URL are alternatives, not a pair — the backend accepts
          either. Not form fields: the files never enter the schema. */}
      <div className="flex flex-col gap-1.5">
        <Label>Image</Label>
        <SingleImageField
          value={imageFile}
          onChange={setImageFile}
          currentUrl={data?.image}
          label="Upload image"
        />
      </div>

      <FormField
        control={form.control}
        name="image"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Image URL</FormLabel>
            <FormControl>
              <Input
                placeholder="https://example.com/image.jpg"
                disabled={!!imageFile}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="flex flex-col gap-1.5">
        <Label>Banner</Label>
        <SingleImageField
          value={bannerFile}
          onChange={setBannerFile}
          currentUrl={data?.banner}
          label="Upload banner"
        />
      </div>

      <FormField
        control={form.control}
        name="sortOrder"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Sort order</FormLabel>
            <FormControl>
              <NumberInput className="w-full" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="status"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between gap-2">
            <FormLabel className="text-sm font-normal text-foreground">Active</FormLabel>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )}
      />

      {/* Editable here AND from SEO → Page SEO. Both write these same two
          columns through this same endpoint, so there is no copy to sync. */}
      <FormField
        control={form.control}
        name="seoTitle"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Search result title</FormLabel>
            <FormControl>
              <Input maxLength={200} {...field} />
            </FormControl>
            <FormDescription>
              Shown as the heading in Google. Leave blank to use the category name.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="seoDescription"
        render={({ field }) => (
          <FormItem>
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
    </ResourceFormPage>
  )
}

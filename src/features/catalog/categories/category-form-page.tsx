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
import { FormSection } from '@/components/forms/form-section'
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
      <FormSection title="Details">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              {/* The slug is derived from this by the backend and never entered
                  here, so without saying so the merchant has no way to know the
                  storefront URL follows the name they are typing. */}
              <FormDescription>
                The storefront web address is built from this name automatically.
              </FormDescription>
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
      </FormSection>

      <FormSection
        title="Artwork"
        description="The image represents the category in listings; the banner runs across the top of its page."
      >
        {/*
         * Upload and URL are two routes to the same artwork, not two fields, so
         * they are grouped and the URL box is disabled while a file is picked.
         * Neither is a form field on the file side: the files never enter the
         * schema.
         */}
        <div className="flex flex-col gap-3">
          <Label>Image</Label>
          <SingleImageField
            value={imageFile}
            onChange={setImageFile}
            currentUrl={data?.image}
            label="Upload image"
          />
          <FormField
            control={form.control}
            name="image"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-normal text-muted-foreground">
                  Or paste an image address
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="https://example.com/image.jpg"
                    disabled={!!imageFile}
                    {...field}
                  />
                </FormControl>
                {imageFile && (
                  <FormDescription>
                    Not used while a file is selected. Remove the file to paste an address instead.
                  </FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex flex-col gap-3">
          <Label>Banner</Label>
          <SingleImageField
            value={bannerFile}
            onChange={setBannerFile}
            currentUrl={data?.banner}
            label="Upload banner"
          />
        </div>
      </FormSection>

      <FormSection
        title="Placement"
        description="Where this category sits in the storefront, and whether shoppers can see it at all."
      >
        <FormField
          control={form.control}
          name="sortOrder"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sort order</FormLabel>
              <FormControl>
                {/* A position is two or three digits. Full width put a
                    three-character value in a box the width of the page. */}
                <NumberInput className="w-32" {...field} />
              </FormControl>
              <FormDescription>Lower numbers appear first. May be negative.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Visibility</FormLabel>
              {/*
               * The switch sits beside its own label in a bounded row rather
               * than being pushed to the far edge of the card: `justify-between`
               * on a full-width form left the word "Active" and its control at
               * opposite ends of the page with nothing between them, and no
               * clear reading order at a glance.
               */}
              <FormControl>
                <label className="flex w-fit cursor-pointer items-center gap-2.5 rounded-md border border-border px-3 py-2">
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                  <span className="text-sm text-foreground">
                    {field.value ? 'Visible in the storefront' : 'Hidden from the storefront'}
                  </span>
                </label>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </FormSection>

      {/* Editable here AND from SEO → Page SEO. Both write these same two
          columns through this same endpoint, so there is no copy to sync. */}
      <FormSection
        title="Search engine listing"
        description="How this category appears in Google results."
      >
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
      </FormSection>
    </ResourceFormPage>
  )
}

import * as React from 'react'
import { useLocation, useParams, useSearchParams } from 'react-router'
import { Form, Input, InputNumber, Switch } from 'antd'
import { ResourceFormPage } from '@/components/crud/resource-form-page'
import { SingleImageField } from '@/components/forms/single-image-field'
import { CategoryParentPicker } from '@/features/catalog/categories/category-parent-picker'
import { CATEGORIES_PATH } from '@/features/catalog/categories/categories-page'
import { SUB_CATEGORIES_PATH } from '@/features/catalog/sub-categories/sub-categories-page'
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

interface FormValues {
  name: string
  description?: string
  image?: string
  parentId: string | null
  status: boolean
  sortOrder: number
  /**
   * The same two columns the SEO menu's Page SEO table writes. They existed on
   * the model and were accepted by the backend's validation long before this
   * form rendered them — so a merchant could not set them from anywhere.
   */
  seoTitle?: string
  seoDescription?: string
}

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

function toInput(values: FormValues): CategoryInput {
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

  // Picked files are component state, not form fields — the URL fields are the
  // other route to the same artwork.
  const [imageFile, setImageFile] = React.useState<File | null>(null)
  const [bannerFile, setBannerFile] = React.useState<File | null>(null)

  const save = async (values: FormValues) => {
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
    <ResourceFormPage<FormValues, Category>
      noun={noun}
      listPath={listPath}
      recordId={categoryId}
      record={data}
      isLoading={isLoading}
      loadError={error}
      toValues={toValues}
      emptyValues={{ ...EMPTY_VALUES, parentId: defaultParentId ?? null }}
      onSave={save}
    >
      {() => (
        <>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="parentId" label="Parent category">
            <CategoryParentPicker tree={categoryTree} excludeId={categoryId} />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
          {/* Upload and URL are alternatives, not a pair — the backend accepts either. */}
          <Form.Item label="Image">
            <SingleImageField
              value={imageFile}
              onChange={setImageFile}
              currentUrl={data?.image}
              label="Upload image"
            />
          </Form.Item>
          <Form.Item name="image" label="Image URL">
            <Input placeholder="https://example.com/image.jpg" disabled={!!imageFile} />
          </Form.Item>
          <Form.Item label="Banner">
            <SingleImageField
              value={bannerFile}
              onChange={setBannerFile}
              currentUrl={data?.banner}
              label="Upload banner"
            />
          </Form.Item>
          <Form.Item name="sortOrder" label="Sort order">
            <InputNumber className="w-full" />
          </Form.Item>
          <Form.Item name="status" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>

          {/* Editable here AND from SEO → Page SEO. Both write these same two
              columns through this same endpoint, so there is no copy to sync. */}
          <Form.Item
            name="seoTitle"
            label="Search result title"
            extra="Shown as the heading in Google. Leave blank to use the category name."
          >
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item
            name="seoDescription"
            label="Search result description"
            extra="The sentence under the link in search results. Around 160 characters."
          >
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>
        </>
      )}
    </ResourceFormPage>
  )
}

import { Modal, Form, Input, InputNumber, Switch } from 'antd'
import { toast } from '@/components/ui/use-toast'
import { useCreateCategory, useUpdateCategory, type Category, type CategoryInput } from '@/lib/api/categories'
import { CategoryParentPicker } from '@/features/catalog/categories/category-parent-picker'

export interface CategoryFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: Category | null
  /** Full hierarchy from useCategoryTree() — drives the cascading parent picker. */
  categoryTree: Category[]
  /** Pre-selects a parent for a new category (e.g. "Add subcategory" from a tree node). Ignored when editing. */
  defaultParentId?: string | null
}

interface FormValues {
  name: string
  description?: string
  image?: string
  parentId: string | null
  status: boolean
  sortOrder: number
}

export function CategoryFormModal({ open, onOpenChange, category, categoryTree, defaultParentId }: CategoryFormModalProps) {
  const isEdit = !!category
  const [form] = Form.useForm<FormValues>()
  const createMutation = useCreateCategory()
  const updateMutation = useUpdateCategory()

  const handleSubmit = async (values: FormValues) => {
    const input: CategoryInput = {
      name: values.name,
      description: values.description || undefined,
      image: values.image || undefined,
      status: values.status,
      sortOrder: values.sortOrder,
    }
    // Only send parentId when a real parent is picked — the backend rejects `null`
    // for top-level categories, it wants the key left out entirely.
    if (values.parentId) {
      input.parentId = values.parentId
    }

    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: category.id, input })
        toast({ title: 'Category updated' })
      } else {
        await createMutation.mutateAsync(input)
        toast({ title: 'Category created' })
      }
      onOpenChange(false)
    } catch (err) {
      toast({ title: 'Something went wrong', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }

  return (
    <Modal
      title={isEdit ? 'Edit category' : 'New category'}
      open={open}
      onCancel={() => onOpenChange(false)}
      onOk={() => form.submit()}
      okText={isEdit ? 'Save changes' : 'Create category'}
      confirmLoading={createMutation.isPending || updateMutation.isPending}
      destroyOnHidden
    >
      {/*
        Keyed by the edit session so the form (including the parent picker's local chain state)
        starts fresh each time a different category — or none — is opened. `destroyOnHidden`
        already unmounts this while the modal is closed; the key additionally forces a remount
        when switching straight from editing one category to another (or to "New category")
        without the modal closing in between.
      */}
      <Form
        key={category?.id ?? defaultParentId ?? 'new'}
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          name: category?.name ?? '',
          description: category?.description ?? '',
          image: category?.image ?? '',
          parentId: category?.parentId ?? defaultParentId ?? null,
          status: category?.status ?? true,
          sortOrder: category?.sortOrder ?? 0,
        }}
      >
        <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="parentId" label="Parent category">
          <CategoryParentPicker tree={categoryTree} excludeId={category?.id} />
        </Form.Item>
        <Form.Item name="description" label="Description">
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item name="image" label="Image URL">
          <Input placeholder="https://example.com/image.jpg" />
        </Form.Item>
        <Form.Item name="sortOrder" label="Sort order">
          <InputNumber className="w-full" />
        </Form.Item>
        <Form.Item name="status" label="Active" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  )
}

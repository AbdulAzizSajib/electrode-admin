import * as React from 'react'
import { Modal, Form, Input, InputNumber, Switch } from 'antd'
import { toast } from '@/components/ui/use-toast'
import { useCreateCategory, useUpdateCategory, type Category, type CategoryInput } from '@/lib/api/categories'
import { CategoryParentPicker } from '@/features/catalog/categories/category-parent-picker'

interface FormValues {
  name: string
  description?: string
  image?: string
  parentId: string | null
  status: boolean
  sortOrder: number
}

const EMPTY_VALUES: FormValues = {
  name: '',
  description: '',
  image: '',
  parentId: null,
  status: true,
  sortOrder: 0,
}

function toInput(values: FormValues): CategoryInput {
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
  return input
}

/** The six fields shared by both the create and edit modals. */
function CategoryFormFields({ categoryTree, excludeId }: { categoryTree: Category[]; excludeId?: string }) {
  return (
    <>
      <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
        <Input />
      </Form.Item>
      <Form.Item name="parentId" label="Parent category">
        <CategoryParentPicker tree={categoryTree} excludeId={excludeId} />
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
    </>
  )
}

export interface CategoryCreateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Full hierarchy from useCategoryTree() — drives the cascading parent picker. */
  categoryTree: Category[]
  /** Pre-selects a parent (e.g. "Add subcategory" from a tree node). */
  defaultParentId?: string | null
}

/** Always-blank form for creating a new category. Never touched by edit state. */
export function CategoryCreateModal({ open, onOpenChange, categoryTree, defaultParentId }: CategoryCreateModalProps) {
  const [form] = Form.useForm<FormValues>()
  const createMutation = useCreateCategory()

  // Re-blank the form every time the modal opens (not just on mount) — covers opening it twice in a
  // row with the same defaultParentId, where a key-based remount wouldn't fire.
  React.useEffect(() => {
    if (open) {
      form.resetFields()
      form.setFieldsValue({ ...EMPTY_VALUES, parentId: defaultParentId ?? null })
    }
  }, [open, defaultParentId, form])

  const handleSubmit = async (values: FormValues) => {
    try {
      await createMutation.mutateAsync(toInput(values))
      toast({ title: 'Category created' })
      onOpenChange(false)
    } catch (err) {
      toast({ title: 'Something went wrong', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }

  return (
    <Modal
      title="New category"
      open={open}
      onCancel={() => onOpenChange(false)}
      onOk={() => form.submit()}
      okText="Create category"
      confirmLoading={createMutation.isPending}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={EMPTY_VALUES}>
        <CategoryFormFields categoryTree={categoryTree} />
      </Form>
    </Modal>
  )
}

export interface CategoryEditModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: Category | null
  /** Full hierarchy from useCategoryTree() — drives the cascading parent picker. */
  categoryTree: Category[]
}

/** Form for editing an existing category. Always re-syncs to `category` on open, never leaks create-form state. */
export function CategoryEditModal({ open, onOpenChange, category, categoryTree }: CategoryEditModalProps) {
  const [form] = Form.useForm<FormValues>()
  const updateMutation = useUpdateCategory()

  // Re-sync to the category being edited every time the modal opens — covers switching straight from
  // editing one category to another, and re-opening the same category after a previous edit, where a
  // key-based remount wouldn't fire.
  React.useEffect(() => {
    if (open && category) {
      form.resetFields()
      form.setFieldsValue({
        name: category.name,
        description: category.description ?? '',
        image: category.image ?? '',
        parentId: category.parentId,
        status: category.status,
        sortOrder: category.sortOrder,
      })
    }
  }, [open, category, form])

  const handleSubmit = async (values: FormValues) => {
    if (!category) return
    try {
      await updateMutation.mutateAsync({ id: category.id, input: toInput(values) })
      toast({ title: 'Category updated' })
      onOpenChange(false)
    } catch (err) {
      toast({ title: 'Something went wrong', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }

  return (
    <Modal
      title="Edit category"
      open={open}
      onCancel={() => onOpenChange(false)}
      onOk={() => form.submit()}
      okText="Save changes"
      confirmLoading={updateMutation.isPending}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={EMPTY_VALUES}>
        <CategoryFormFields categoryTree={categoryTree} excludeId={category?.id} />
      </Form>
    </Modal>
  )
}

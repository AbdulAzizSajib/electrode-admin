import { useEffect } from 'react'
import { Modal, Form, Input, InputNumber, Select, Switch } from 'antd'
import { toast } from '@/components/ui/use-toast'
import { useCreateCategory, useUpdateCategory, type Category, type CategoryInput } from '@/lib/api/categories'

export interface CategoryFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: Category | null
  categories: Category[]
}

interface FormValues {
  name: string
  description?: string
  image?: string
  parentId: string
  status: boolean
  sortOrder: number
}

export function CategoryFormModal({ open, onOpenChange, category, categories }: CategoryFormModalProps) {
  const isEdit = !!category
  const [form] = Form.useForm<FormValues>()
  const createMutation = useCreateCategory()
  const updateMutation = useUpdateCategory()

  // Re-fill the form each time the modal opens, from the category being edited (or blank for create).
  useEffect(() => {
    if (!open) return
    form.setFieldsValue({
      name: category?.name ?? '',
      description: category?.description ?? '',
      image: category?.image ?? '',
      parentId: category?.parentId ?? 'none',
      status: category?.status ?? true,
      sortOrder: category?.sortOrder ?? 0,
    })
  }, [open, category, form])

  const availableParents = categories.filter((c) => c.id !== category?.id)

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
    if (values.parentId !== 'none') {
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
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="parentId" label="Parent category">
          <Select
            options={[
              { value: 'none', label: 'No parent (top-level)' },
              ...availableParents.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
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

import * as React from 'react'
import { Modal, Form, Input, Switch, Alert } from 'antd'
import { toast } from '@/components/ui/use-toast'
import { SingleImageField } from '@/components/forms/single-image-field'
import { useCreateBrand, useUpdateBrand, useBulkCreateBrands, type Brand, type BrandInput } from '@/lib/api/brands'

interface FormValues {
  name: string
  logo?: string
  description?: string
  status: boolean
}

const EMPTY_VALUES: FormValues = {
  name: '',
  logo: '',
  description: '',
  status: true,
}

function toInput(values: FormValues): BrandInput {
  return {
    name: values.name,
    logo: values.logo || undefined,
    description: values.description || undefined,
    status: values.status,
  }
}

interface BrandFormFieldsProps {
  logoFile: File | null
  onLogoFileChange: (file: File | null) => void
  /** The brand's existing logo, shown in the picker when editing and no new file is chosen. */
  currentLogo?: string | null
}

/** The fields shared by both the create and edit modals. */
function BrandFormFields({ logoFile, onLogoFileChange, currentLogo }: BrandFormFieldsProps) {
  return (
    <>
      <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
        <Input />
      </Form.Item>
      {/* Upload and URL are alternatives, not a pair — the backend accepts either. */}
      <Form.Item label="Logo">
        <SingleImageField
          value={logoFile}
          onChange={onLogoFileChange}
          currentUrl={currentLogo}
          label="Upload logo"
        />
      </Form.Item>
      <Form.Item name="logo" label="Logo URL">
        <Input placeholder="https://…" disabled={!!logoFile} />
      </Form.Item>
      <Form.Item name="description" label="Description">
        <Input.TextArea rows={3} />
      </Form.Item>
      <Form.Item name="status" label="Active" valuePropName="checked">
        <Switch />
      </Form.Item>
    </>
  )
}

export interface BrandCreateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Always-blank form for creating a new brand. Never touched by edit state. */
export function BrandCreateModal({ open, onOpenChange }: BrandCreateModalProps) {
  const [form] = Form.useForm<FormValues>()
  const [logoFile, setLogoFile] = React.useState<File | null>(null)
  const createMutation = useCreateBrand()

  // Re-blank the form every time the modal opens (not just on mount) — covers opening it twice
  // in a row, where a key-based remount wouldn't fire. The picked file is cleared alongside it in
  // the close/submit paths rather than here, since it is React state and resetting it from an
  // effect would cascade an extra render.
  React.useEffect(() => {
    if (open) {
      form.resetFields()
      form.setFieldsValue(EMPTY_VALUES)
    }
  }, [open, form])

  const close = () => {
    setLogoFile(null)
    onOpenChange(false)
  }

  const handleSubmit = async (values: FormValues) => {
    try {
      await createMutation.mutateAsync({ input: toInput(values), logoFile })
      toast({ title: 'Brand created' })
      close()
    } catch (err) {
      toast({ title: 'Something went wrong', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }

  return (
    <Modal
      title="New brand"
      open={open}
      onCancel={close}
      onOk={() => form.submit()}
      okText="Create brand"
      confirmLoading={createMutation.isPending}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={EMPTY_VALUES}>
        <BrandFormFields logoFile={logoFile} onLogoFileChange={setLogoFile} />
      </Form>
    </Modal>
  )
}

interface BulkFormValues {
  namesText: string
}

export interface BrandBulkCreateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Fast-entry path for adding many brands at once: one name per line, no other fields (matches
 * `BrandService.bulkCreateBrands` — each row becomes `status: true`, no description/logo). Rows
 * that are blank, duplicated within the list, or already exist are skipped, not failed — the
 * modal reports which after submit rather than blocking the whole batch over one bad line.
 */
export function BrandBulkCreateModal({ open, onOpenChange }: BrandBulkCreateModalProps) {
  const [form] = Form.useForm<BulkFormValues>()
  const bulkMutation = useBulkCreateBrands()
  const [result, setResult] = React.useState<{ created: number; skipped: { name: string; reason: string }[] } | null>(null)

  // Re-blank the form every time the modal opens, same as the single-create modal.
  React.useEffect(() => {
    if (open) {
      form.resetFields()
      form.setFieldsValue({ namesText: '' })
    }
  }, [open, form])

  // `result` is cleared on close (not on open, to avoid setState-in-effect) — `destroyOnHidden`
  // means the Form itself is already fresh next time the modal opens either way.
  const close = () => {
    setResult(null)
    onOpenChange(false)
  }

  const handleSubmit = async (values: BulkFormValues) => {
    const names = values.namesText
      .split('\n')
      .map((n) => n.trim())
      .filter(Boolean)

    if (names.length === 0) {
      toast({ title: 'Enter at least one brand name', variant: 'destructive' })
      return
    }

    try {
      const res = await bulkMutation.mutateAsync(names)
      setResult({ created: res.created.length, skipped: res.skipped })
      if (res.created.length > 0) {
        toast({ title: `${res.created.length} brand(s) created` })
      }
      // Only auto-close when everything went through clean — if something was skipped, leave the
      // modal open so the admin can see why and decide whether to fix and retry.
      if (res.skipped.length === 0) {
        close()
      }
    } catch (err) {
      toast({ title: 'Something went wrong', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }

  return (
    <Modal
      title="Bulk add brands"
      open={open}
      onCancel={close}
      onOk={() => form.submit()}
      okText="Create brands"
      confirmLoading={bulkMutation.isPending}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ namesText: '' }}>
        <Form.Item name="namesText" label="Brand names" extra="One brand name per line.">
          <Input.TextArea rows={8} placeholder={'Samsung\nApple\nSony'} />
        </Form.Item>
      </Form>
      {result && (
        <div className="flex flex-col gap-2">
          {result.created > 0 && <Alert type="success" showIcon message={`${result.created} brand(s) created`} />}
          {result.skipped.length > 0 && (
            <Alert
              type="warning"
              showIcon
              message={`${result.skipped.length} skipped`}
              description={
                <ul className="list-disc pl-4">
                  {result.skipped.map((s, i) => (
                    <li key={i}>
                      {s.name} — {s.reason}
                    </li>
                  ))}
                </ul>
              }
            />
          )}
        </div>
      )}
    </Modal>
  )
}

export interface BrandEditModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  brand: Brand | null
}

/** Form for editing an existing brand. Always re-syncs to `brand` on open, never leaks create-form state. */
export function BrandEditModal({ open, onOpenChange, brand }: BrandEditModalProps) {
  const [form] = Form.useForm<FormValues>()
  const [logoFile, setLogoFile] = React.useState<File | null>(null)
  const updateMutation = useUpdateBrand()

  // Re-sync to the brand being edited every time the modal opens — covers switching straight
  // from editing one brand to another, and re-opening the same brand after a previous edit,
  // where a key-based remount wouldn't fire.
  React.useEffect(() => {
    if (open && brand) {
      form.resetFields()
      form.setFieldsValue({
        name: brand.name,
        logo: brand.logo ?? '',
        description: brand.description ?? '',
        status: brand.status,
      })
    }
  }, [open, brand, form])

  const close = () => {
    setLogoFile(null)
    onOpenChange(false)
  }

  const handleSubmit = async (values: FormValues) => {
    if (!brand) return
    try {
      await updateMutation.mutateAsync({ id: brand.id, input: toInput(values), logoFile })
      toast({ title: 'Brand updated' })
      close()
    } catch (err) {
      toast({ title: 'Something went wrong', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }

  return (
    <Modal
      title="Edit brand"
      open={open}
      onCancel={close}
      onOk={() => form.submit()}
      okText="Save changes"
      confirmLoading={updateMutation.isPending}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={EMPTY_VALUES}>
        <BrandFormFields logoFile={logoFile} onLogoFileChange={setLogoFile} currentLogo={brand?.logo} />
      </Form>
    </Modal>
  )
}

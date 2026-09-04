import * as React from 'react'
import { useParams } from 'react-router'
import { Form, Input, Switch } from 'antd'
import { ResourceFormPage } from '@/components/crud/resource-form-page'
import { SingleImageField } from '@/components/forms/single-image-field'
import { BRANDS_PATH } from '@/features/catalog/brands/brands-page'
import {
  useBrand,
  useCreateBrand,
  useUpdateBrand,
  type Brand,
  type BrandInput,
} from '@/lib/api/brands'

interface FormValues {
  name: string
  logo?: string
  description?: string
  status: boolean
}

const EMPTY_VALUES: FormValues = { name: '', logo: '', description: '', status: true }

const toValues = (brand: Brand): FormValues => ({
  name: brand.name,
  logo: brand.logo ?? '',
  description: brand.description ?? '',
  status: brand.status,
})

function toInput(values: FormValues): BrandInput {
  return {
    name: values.name,
    logo: values.logo || undefined,
    description: values.description || undefined,
    status: values.status,
  }
}

export default function BrandFormPage() {
  const { brandId } = useParams()

  const { data, isLoading, error } = useBrand(brandId)
  const createMutation = useCreateBrand()
  const updateMutation = useUpdateBrand()

  // The picked file is component state, not a form field — the schema has no
  // say over an upload, and the logo URL field is the other route to the same
  // artwork.
  const [logoFile, setLogoFile] = React.useState<File | null>(null)

  const save = async (values: FormValues) => {
    if (brandId) {
      await updateMutation.mutateAsync({ id: brandId, input: toInput(values), logoFile })
      // The file has been sent; keeping it selected would re-upload the same
      // bytes on the next save from this page.
      setLogoFile(null)
      return
    }
    const created = await createMutation.mutateAsync({ input: toInput(values), logoFile })
    setLogoFile(null)
    return { id: created.id }
  }

  return (
    <ResourceFormPage<FormValues, Brand>
      noun="Brand"
      listPath={BRANDS_PATH}
      recordId={brandId}
      record={data}
      isLoading={isLoading}
      loadError={error}
      toValues={toValues}
      emptyValues={EMPTY_VALUES}
      onSave={save}
    >
      {() => (
        <>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input />
          </Form.Item>
          {/* Upload and URL are alternatives, not a pair — the backend accepts either. */}
          <Form.Item label="Logo">
            <SingleImageField
              value={logoFile}
              onChange={setLogoFile}
              currentUrl={data?.logo}
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
      )}
    </ResourceFormPage>
  )
}

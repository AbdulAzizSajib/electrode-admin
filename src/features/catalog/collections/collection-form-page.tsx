import { useParams } from 'react-router'
import { Form, Input, Switch } from 'antd'
import { ResourceFormPage } from '@/components/crud/resource-form-page'
import { COLLECTIONS_PATH } from '@/features/catalog/collections/collections-page'
import {
  useCollection,
  useCreateCollection,
  useUpdateCollection,
  type Collection,
} from '@/lib/api/collections'

interface FormValues {
  name: string
  slug?: string
  isVisible: boolean
}

const EMPTY: FormValues = { name: '', slug: '', isVisible: true }

export default function CollectionFormPage() {
  const { collectionId } = useParams()
  const isEdit = Boolean(collectionId)

  const { data, isLoading, error } = useCollection(collectionId)
  const createMutation = useCreateCollection()
  const updateMutation = useUpdateCollection()

  return (
    <ResourceFormPage<FormValues, Collection>
      noun="Collection"
      listPath={COLLECTIONS_PATH}
      recordId={collectionId}
      record={data}
      isLoading={isLoading}
      loadError={error}
      emptyValues={EMPTY}
      toValues={(collection) => ({
        name: collection.name,
        slug: collection.slug,
        isVisible: collection.isVisible,
      })}
      onSave={async (values) => {
        // A blank slug means "derive it from the name", which is the backend's
        // default — sending "" would try to claim the empty slug.
        const input = { ...values, slug: values.slug?.trim() || undefined }
        if (isEdit) {
          await updateMutation.mutateAsync({ id: collectionId as string, input })
          return
        }
        const created = await createMutation.mutateAsync(input)
        return { id: created.id }
      }}
    >
      {() => (
        <div className="grid gap-x-6 md:grid-cols-2">
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Give this collection a name' }]}
          >
            <Input placeholder="e.g. Top selling" />
          </Form.Item>

          <Form.Item
            name="slug"
            label="Address"
            extra="Left blank, this is built from the name."
          >
            <Input placeholder="top-selling" addonBefore="/" />
          </Form.Item>

          <Form.Item
            name="isVisible"
            label="Visible on the storefront"
            valuePropName="checked"
            extra="Hiding a collection keeps its products in it — nothing is lost."
          >
            <Switch />
          </Form.Item>
        </div>
      )}
    </ResourceFormPage>
  )
}

import { useParams } from 'react-router'
import { Form, Input, InputNumber } from 'antd'
import { ResourceFormPage } from '@/components/crud/resource-form-page'
import { BUNDLE_DEALS_PATH, offerLabel } from '@/features/catalog/bundle-deals/bundle-deal-labels'
import {
  useBundleDeal,
  useCreateBundleDeal,
  useUpdateBundleDeal,
  type BundleDeal,
} from '@/lib/api/bundle-deals'

interface FormValues {
  name: string
  buyQuantity: number
  freeQuantity: number
}

const EMPTY: FormValues = { name: '', buyQuantity: 2, freeQuantity: 1 }

export default function BundleDealFormPage() {
  const { bundleDealId } = useParams()
  const isEdit = Boolean(bundleDealId)

  const { data, isLoading, error } = useBundleDeal(bundleDealId)
  const createMutation = useCreateBundleDeal()
  const updateMutation = useUpdateBundleDeal()

  return (
    <ResourceFormPage<FormValues, BundleDeal>
      noun="Bundle deal"
      listPath={BUNDLE_DEALS_PATH}
      recordId={bundleDealId}
      record={data}
      isLoading={isLoading}
      loadError={error}
      emptyValues={EMPTY}
      toValues={(deal) => ({
        name: deal.name,
        buyQuantity: deal.buyQuantity,
        freeQuantity: deal.freeQuantity,
      })}
      onSave={async (values) => {
        if (isEdit) {
          await updateMutation.mutateAsync({ id: bundleDealId as string, input: values })
          return
        }
        const created = await createMutation.mutateAsync(values)
        return { id: created.id }
      }}
    >
      {(form) => (
        <div className="grid gap-x-6 md:grid-cols-3">
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Give this offer a name' }]}
            className="md:col-span-3"
          >
            <Input placeholder="e.g. Buy 2 get 1 free" />
          </Form.Item>

          {/* Both floors are enforced by the backend too. Stating them here as
              well is what turns a rejected save into a message beside the field
              that caused it. */}
          <Form.Item
            name="buyQuantity"
            label="Units bought"
            rules={[
              { required: true, message: 'How many must be bought?' },
              { type: 'number', min: 1, message: 'An offer requiring nothing bought is not an offer' },
            ]}
          >
            <InputNumber className="w-full" min={1} />
          </Form.Item>

          <Form.Item
            name="freeQuantity"
            label="Units free"
            rules={[
              { required: true, message: 'How many are then free?' },
              { type: 'number', min: 1, message: 'An offer giving nothing away is not an offer' },
            ]}
          >
            <InputNumber className="w-full" min={1} />
          </Form.Item>

          <Form.Item label=" " colon={false}>
            <Form.Item
              noStyle
              shouldUpdate={(prev, next) =>
                prev.buyQuantity !== next.buyQuantity || prev.freeQuantity !== next.freeQuantity
              }
            >
              {() => (
                <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                  {offerLabel({
                    buyQuantity: form.getFieldValue('buyQuantity') ?? 0,
                    freeQuantity: form.getFieldValue('freeQuantity') ?? 0,
                  })}
                </p>
              )}
            </Form.Item>
          </Form.Item>
        </div>
      )}
    </ResourceFormPage>
  )
}

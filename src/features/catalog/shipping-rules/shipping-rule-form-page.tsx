import { useParams } from 'react-router'
import { Button as AntButton, Form, Input, InputNumber, Switch, Tooltip } from 'antd'
import { Plus, Trash2 } from 'lucide-react'
import { ResourceFormPage } from '@/components/crud/resource-form-page'
import { SHIPPING_RULES_PATH } from '@/features/catalog/shipping-rules/shipping-rule-labels'
import {
  useCreateShippingRule,
  useShippingRule,
  useUpdateShippingRule,
  type ShippingRule,
} from '@/lib/api/shipping-rules'

interface PlaceRow {
  id?: string
  name?: string
  country?: string
  state?: string
  price: number
  deliveryDays: number
  offersPickup: boolean
  pickupPrice: number
}

interface FormValues {
  name: string
  places: PlaceRow[]
}

/** A new rule starts with a catch-all, which is what makes it deliver anywhere. */
const EMPTY_PLACE: PlaceRow = {
  name: '',
  country: '',
  state: '',
  price: 0,
  deliveryDays: 0,
  offersPickup: false,
  pickupPrice: 0,
}

const EMPTY: FormValues = { name: '', places: [{ ...EMPTY_PLACE }] }

export default function ShippingRuleFormPage() {
  const { shippingRuleId } = useParams()
  const isEdit = Boolean(shippingRuleId)

  const { data, isLoading, error } = useShippingRule(shippingRuleId)
  const createMutation = useCreateShippingRule()
  const updateMutation = useUpdateShippingRule()

  return (
    <ResourceFormPage<FormValues, ShippingRule>
      noun="Shipping rule"
      listPath={SHIPPING_RULES_PATH}
      recordId={shippingRuleId}
      record={data}
      isLoading={isLoading}
      loadError={error}
      emptyValues={EMPTY}
      description="Places are matched most specific first: a region beats a country, which beats everywhere else."
      toValues={(rule) => ({
        name: rule.name,
        places: rule.places.map((place) => ({
          id: place.id,
          name: place.name ?? '',
          country: place.country ?? '',
          state: place.state ?? '',
          price: Number(place.price),
          deliveryDays: place.deliveryDays,
          offersPickup: place.offersPickup,
          pickupPrice: Number(place.pickupPrice),
        })),
      })}
      onSave={async (values) => {
        const input = {
          name: values.name,
          places: values.places.map((place) => ({
            id: place.id,
            name: place.name?.trim() || undefined,
            // Blank means "anywhere", which the backend expresses as null — an
            // empty string would be a country literally named "".
            country: place.country?.trim() || undefined,
            state: place.state?.trim() || undefined,
            price: place.price,
            deliveryDays: place.deliveryDays,
            offersPickup: place.offersPickup,
            // Ignored by the backend unless pickup is offered; not sent at all
            // when it is not, since it also rejects a price without the offer.
            pickupPrice: place.offersPickup ? place.pickupPrice : undefined,
          })),
        }

        if (isEdit) {
          await updateMutation.mutateAsync({ id: shippingRuleId as string, input })
          return
        }
        const created = await createMutation.mutateAsync(input)
        return { id: created.id }
      }}
    >
      {() => (
        <>
          <div className="grid gap-x-6 md:grid-cols-2">
            <Form.Item
              name="name"
              label="Name"
              rules={[{ required: true, message: 'Give this rule a name' }]}
            >
              <Input placeholder="e.g. Standard delivery" />
            </Form.Item>
          </div>

          <Form.Item
            label="Places"
            required
            extra="Leave the country blank for a place covering everywhere a more specific one does not."
          >
            <Form.List
              name="places"
              rules={[
                {
                  validator: async (_, places: PlaceRow[]) => {
                    if (!places?.length) {
                      throw new Error('A rule matching nowhere can charge nothing — add a place')
                    }
                    // A region without a country cannot be matched: "Dhaka" in
                    // which country? The backend rejects it too; catching it
                    // here puts the message beside the row.
                    const orphan = places.find((p) => p?.state?.trim() && !p?.country?.trim())
                    if (orphan) {
                      throw new Error(
                        `“${orphan.state}” names a region but no country — matching needs both`,
                      )
                    }
                    const keys = places.map(
                      (p) => `${p?.country?.trim() || '*'}|${p?.state?.trim() || '*'}`,
                    )
                    if (new Set(keys).size !== keys.length) {
                      throw new Error('Two places cover the same destination')
                    }
                  },
                },
              ]}
            >
              {(fields, { add, remove }, { errors }) => (
                <div className="flex flex-col gap-3">
                  {fields.map((field) => (
                    <div
                      key={field.key}
                      className="grid gap-x-3 rounded-lg border border-border p-3 md:grid-cols-12"
                    >
                      <Form.Item
                        name={[field.name, 'name']}
                        label="Label"
                        className="mb-2 md:col-span-3"
                      >
                        <Input placeholder="Inside Dhaka" />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, 'country']}
                        label="Country"
                        className="mb-2 md:col-span-2"
                      >
                        <Input placeholder="Any" />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, 'state']}
                        label="Region"
                        className="mb-2 md:col-span-2"
                      >
                        <Input placeholder="Any" />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, 'price']}
                        label="Price"
                        className="mb-2 md:col-span-2"
                        rules={[{ required: true, message: 'Required' }]}
                      >
                        <InputNumber className="w-full" min={0} />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, 'deliveryDays']}
                        label="Days"
                        className="mb-2 md:col-span-2"
                      >
                        <InputNumber className="w-full" min={0} />
                      </Form.Item>

                      <div className="flex items-end justify-end pb-2 md:col-span-1">
                        {/* The last place cannot go: a rule matching nowhere
                            makes every product using it undeliverable. */}
                        <Tooltip
                          title={
                            fields.length === 1
                              ? 'A rule must keep at least one place'
                              : 'Remove this place'
                          }
                        >
                          <AntButton
                            type="text"
                            danger
                            aria-label="Remove place"
                            disabled={fields.length === 1}
                            onClick={() => remove(field.name)}
                            icon={<Trash2 className="size-4" />}
                          />
                        </Tooltip>
                      </div>

                      <Form.Item
                        name={[field.name, 'offersPickup']}
                        label="Collection in person"
                        valuePropName="checked"
                        className="mb-0 md:col-span-3"
                      >
                        <Switch />
                      </Form.Item>

                      <Form.Item
                        noStyle
                        shouldUpdate={(prev, next) =>
                          prev.places?.[field.name]?.offersPickup !==
                          next.places?.[field.name]?.offersPickup
                        }
                      >
                        {(form) =>
                          form.getFieldValue(['places', field.name, 'offersPickup']) ? (
                            <Form.Item
                              name={[field.name, 'pickupPrice']}
                              label="Collection price"
                              className="mb-0 md:col-span-3"
                              extra="Charged instead of the delivery price."
                            >
                              <InputNumber className="w-full" min={0} />
                            </Form.Item>
                          ) : null
                        }
                      </Form.Item>
                    </div>
                  ))}

                  <div>
                    <AntButton
                      onClick={() => add({ ...EMPTY_PLACE })}
                      icon={<Plus className="size-4" />}
                    >
                      Add place
                    </AntButton>
                  </div>

                  <Form.ErrorList errors={errors} />
                </div>
              )}
            </Form.List>
          </Form.Item>
        </>
      )}
    </ResourceFormPage>
  )
}

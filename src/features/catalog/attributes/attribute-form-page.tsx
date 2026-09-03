import * as React from 'react'
import { useParams } from 'react-router'
import { Alert, Button as AntButton, ColorPicker, Form, Input, Select } from 'antd'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { ResourceFormPage } from '@/components/crud/resource-form-page'
import { ATTRIBUTES_PATH } from '@/features/catalog/attributes/attributes-page'
import {
  useAttribute,
  useCreateAttribute,
  useUpdateAttribute,
  type Attribute,
  type AttributePresentation,
} from '@/lib/api/attributes'
import { ApiError } from '@/lib/api/client'

interface ValueRow {
  /** Present for a value that already exists; absent for one being added. */
  id?: string
  label: string
  swatch?: string
}

interface FormValues {
  name: string
  presentation: AttributePresentation
  values: ValueRow[]
}

const EMPTY: FormValues = { name: '', presentation: 'LABEL', values: [{ label: '' }] }

export default function AttributeFormPage() {
  const { attributeId } = useParams()
  const isEdit = Boolean(attributeId)

  const { data, isLoading, error } = useAttribute(attributeId)
  const createMutation = useCreateAttribute()
  const updateMutation = useUpdateAttribute()

  /**
   * Set when the backend refuses an edit that would remove values products
   * still sell. Confirming re-sends the same payload with `force`, so nothing
   * the merchant arranged has to be re-entered.
   */
  const [removalWarning, setRemovalWarning] = React.useState<string | null>(null)
  const pendingValues = React.useRef<FormValues | null>(null)

  const save = async (values: FormValues, force?: boolean) => {
    // Position comes from array order, so the list as arranged on screen *is*
    // the authored order. Nothing carries an explicit position.
    const input = {
      name: values.name,
      presentation: values.presentation,
      values: values.values
        .filter((value) => value.label.trim())
        .map((value) => ({
          id: value.id,
          label: value.label.trim(),
          swatch: values.presentation === 'SWATCH' ? value.swatch : undefined,
        })),
    }

    if (!isEdit) {
      const created = await createMutation.mutateAsync(input)
      return { id: created.id }
    }

    await updateMutation.mutateAsync({ id: attributeId as string, input, force })
  }

  return (
    <ResourceFormPage<FormValues, Attribute>
      noun="Attribute"
      listPath={ATTRIBUTES_PATH}
      recordId={attributeId}
      record={data}
      isLoading={isLoading}
      loadError={error}
      emptyValues={EMPTY}
      description="An axis of choice a product sells values from. Define it once; every product reuses it."
      toValues={(attribute) => ({
        name: attribute.name,
        presentation: attribute.presentation,
        values: attribute.values.map((value) => ({
          id: value.id,
          label: value.label,
          swatch: value.swatch ?? undefined,
        })),
      })}
      onSave={async (values) => {
        try {
          return await save(values)
        } catch (err) {
          // A 409 here is the "products still sell values you are removing"
          // guard, which is a decision for the merchant rather than a failure.
          if (err instanceof ApiError && err.status === 409) {
            pendingValues.current = values
            setRemovalWarning(err.message)
            // Swallowed deliberately: the shared page would otherwise render
            // this as a plain error, when what is needed is the confirmation
            // below.
            return
          }
          throw err
        }
      }}
      footer={
        removalWarning && (
          <Alert
            type="warning"
            showIcon
            message="Some products still sell the values you removed"
            description={
              <div className="flex flex-col items-start gap-3">
                <span>{removalWarning}</span>
                <AntButton
                  danger
                  onClick={async () => {
                    if (!pendingValues.current) return
                    await save(pendingValues.current, true)
                    setRemovalWarning(null)
                    pendingValues.current = null
                  }}
                >
                  Remove them anyway
                </AntButton>
              </div>
            }
          />
        )
      }
    >
      {(form) => (
        <>
          <div className="grid gap-x-6 md:grid-cols-2">
            <Form.Item
              name="name"
              label="Name"
              rules={[{ required: true, message: 'Give this attribute a name' }]}
              extra="Whatever the shop calls it. The storefront renders it as written."
            >
              <Input placeholder="e.g. Colour" />
            </Form.Item>

            <Form.Item
              name="presentation"
              label="Shown as"
              extra="Declared here rather than guessed from the name, so “Color” behaves like “Colour”."
            >
              <Select
                options={[
                  { value: 'LABEL', label: 'Labelled chips' },
                  { value: 'SWATCH', label: 'Colour swatches' },
                ]}
              />
            </Form.Item>
          </div>

          <Form.Item
            label="Values"
            required
            extra="In the order a shopper should see them — S, M, XL reads wrong alphabetically."
          >
            <Form.List
              name="values"
              rules={[
                {
                  validator: async (_, values: ValueRow[]) => {
                    const labels = (values ?? [])
                      .map((v) => v?.label?.trim().toLowerCase())
                      .filter(Boolean)
                    if (labels.length === 0) {
                      throw new Error('An attribute needs at least one value')
                    }
                    if (new Set(labels).size !== labels.length) {
                      // Two identical chips would make a variant's selection
                      // ambiguous, so this is caught before the request.
                      throw new Error('Two values read as the same choice')
                    }
                  },
                },
              ]}
            >
              {(fields, { add, remove, move }, { errors }) => (
                <div className="flex flex-col gap-2">
                  {fields.map((field, index) => (
                    <div key={field.key} className="flex items-start gap-2">
                      <Form.Item
                        name={[field.name, 'label']}
                        className="mb-0 flex-1"
                        rules={[{ required: true, message: 'A value needs a label' }]}
                      >
                        <Input placeholder="e.g. Red" />
                      </Form.Item>

                      {/* Only meaningful for a swatch attribute; hidden rather
                          than disabled so the row does not carry a control that
                          does nothing. */}
                      <Form.Item
                        noStyle
                        shouldUpdate={(prev, next) => prev.presentation !== next.presentation}
                      >
                        {() =>
                          form.getFieldValue('presentation') === 'SWATCH' ? (
                            <Form.Item
                              name={[field.name, 'swatch']}
                              className="mb-0"
                              getValueFromEvent={(_, hex: string) => hex}
                            >
                              <ColorPicker showText format="hex" />
                            </Form.Item>
                          ) : null
                        }
                      </Form.Item>

                      <AntButton
                        type="text"
                        aria-label="Move up"
                        disabled={index === 0}
                        onClick={() => move(index, index - 1)}
                        icon={<ArrowUp className="size-4" />}
                      />
                      <AntButton
                        type="text"
                        aria-label="Move down"
                        disabled={index === fields.length - 1}
                        onClick={() => move(index, index + 1)}
                        icon={<ArrowDown className="size-4" />}
                      />
                      <AntButton
                        type="text"
                        danger
                        aria-label="Remove value"
                        onClick={() => remove(field.name)}
                        icon={<Trash2 className="size-4" />}
                      />
                    </div>
                  ))}

                  <div>
                    <AntButton onClick={() => add({ label: '' })} icon={<Plus className="size-4" />}>
                      Add value
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

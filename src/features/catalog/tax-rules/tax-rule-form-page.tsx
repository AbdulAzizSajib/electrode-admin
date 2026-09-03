import { useParams } from 'react-router'
import { Form, Input, InputNumber, Select } from 'antd'
import { ResourceFormPage } from '@/components/crud/resource-form-page'
import { TAX_RULES_PATH } from '@/features/catalog/tax-rules/tax-rules-page'
import {
  useCreateTaxRule,
  useTaxRule,
  useUpdateTaxRule,
  type ChargeType,
  type TaxRule,
} from '@/lib/api/tax-rules'

interface FormValues {
  name: string
  type: ChargeType
  value: number
}

const EMPTY: FormValues = { name: '', type: 'PERCENT', value: 0 }

export default function TaxRuleFormPage() {
  const { taxRuleId } = useParams()
  const isEdit = Boolean(taxRuleId)

  const { data, isLoading, error } = useTaxRule(taxRuleId)
  const createMutation = useCreateTaxRule()
  const updateMutation = useUpdateTaxRule()

  return (
    <ResourceFormPage<FormValues, TaxRule>
      noun="Tax rule"
      listPath={TAX_RULES_PATH}
      recordId={taxRuleId}
      record={data}
      isLoading={isLoading}
      loadError={error}
      emptyValues={EMPTY}
      toValues={(rule) => ({ name: rule.name, type: rule.type, value: Number(rule.value) })}
      onSave={async (values) => {
        if (isEdit) {
          await updateMutation.mutateAsync({ id: taxRuleId as string, input: values })
          return
        }
        const created = await createMutation.mutateAsync(values)
        return { id: created.id }
      }}
    >
      {(form) => (
        <div className="grid gap-x-6 md:grid-cols-2">
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Give this rule a name' }]}
            extra="What a merchant will recognise it by — “VAT”, “Zero-rated”."
          >
            <Input placeholder="e.g. VAT" />
          </Form.Item>

          <Form.Item name="type" label="Type" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'PERCENT', label: 'Percentage of the price' },
                { value: 'FLAT', label: 'Fixed amount' },
              ]}
            />
          </Form.Item>

          {/* The label follows the type, because "Value: 5" means two entirely
              different charges depending on it. */}
          <Form.Item noStyle shouldUpdate={(prev, next) => prev.type !== next.type}>
            {() => {
              const isPercent = form.getFieldValue('type') === 'PERCENT'
              return (
                <Form.Item
                  name="value"
                  label={isPercent ? 'Percentage' : 'Amount'}
                  rules={[
                    { required: true, message: 'Enter what this rule charges' },
                    {
                      type: 'number',
                      min: 0,
                      max: isPercent ? 100 : undefined,
                      message: isPercent
                        ? 'A percentage is between 0 and 100'
                        : 'An amount cannot be negative',
                    },
                  ]}
                  extra={
                    isPercent
                      ? 'Applied to the price actually charged, so a discounted product is taxed on the discounted amount.'
                      : 'Charged per unit bought, whatever the price.'
                  }
                >
                  <InputNumber
                    className="w-full"
                    min={0}
                    max={isPercent ? 100 : undefined}
                    step={isPercent ? 0.5 : 1}
                    addonAfter={isPercent ? '%' : undefined}
                  />
                </Form.Item>
              )
            }}
          </Form.Item>
        </div>
      )}
    </ResourceFormPage>
  )
}

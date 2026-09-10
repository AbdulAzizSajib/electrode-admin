import { useParams } from 'react-router'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ResourceFormPage } from '@/components/crud/resource-form-page'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/ui/number-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { TAX_RULES_PATH } from '@/features/catalog/tax-rules/tax-rules-page'
import { requiredNumber } from '@/lib/validation/numeric'
import {
  useCreateTaxRule,
  useTaxRule,
  useUpdateTaxRule,
  type TaxRule,
} from '@/lib/api/tax-rules'

/**
 * What the charge means — and therefore what a valid one is — follows `type`.
 *
 * So the bound cannot sit on the field: a percentage stops at 100, a flat amount
 * does not stop at all. It goes in a `superRefine` over the whole object, the
 * only place both fields are in scope at once, and each branch keeps the wording
 * the antd rule showed.
 */
const schema = z
  .object({
    name: z.string().min(1, 'Give this rule a name'),
    type: z.enum(['PERCENT', 'FLAT']),
    // `min: null` turns off the shared rule's own floor — the floor is stated
    // once below, with the ceiling, so the two messages cannot disagree.
    value: requiredNumber('Enter what this rule charges', { min: null }),
  })
  .superRefine((values, ctx) => {
    const isPercent = values.type === 'PERCENT'
    if (values.value < 0 || (isPercent && values.value > 100)) {
      ctx.addIssue({
        code: 'custom',
        message: isPercent ? 'A percentage is between 0 and 100' : 'An amount cannot be negative',
        path: ['value'],
      })
    }
  })

/**
 * `value` runs through a `z.preprocess`, so what the box holds and what a valid
 * submit produces are different types — the same split the category and product
 * forms carry.
 */
type FormValues = z.input<typeof schema>
type OutputValues = z.output<typeof schema>

const EMPTY: FormValues = { name: '', type: 'PERCENT', value: 0 }

export default function TaxRuleFormPage() {
  const { taxRuleId } = useParams()
  const isEdit = Boolean(taxRuleId)

  const { data, isLoading, error } = useTaxRule(taxRuleId)
  const createMutation = useCreateTaxRule()
  const updateMutation = useUpdateTaxRule()

  const form = useForm<FormValues, unknown, OutputValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  })

  // The label, the bound, the step, the help text and the `%` all follow the
  // type, and must follow it as it is picked rather than after a save.
  const type = useWatch({ control: form.control, name: 'type' })
  const isPercent = type === 'PERCENT'

  return (
    <ResourceFormPage<FormValues, TaxRule, OutputValues>
      noun="Tax rule"
      listPath={TAX_RULES_PATH}
      recordId={taxRuleId}
      form={form}
      record={data}
      isLoading={isLoading}
      loadError={error}
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
      <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. VAT" {...field} />
              </FormControl>
              <FormDescription>
                What a merchant will recognise it by — “VAT”, “Zero-rated”.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="PERCENT">Percentage of the price</SelectItem>
                  <SelectItem value="FLAT">Fixed amount</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* The label follows the type, because "Value: 5" means two entirely
            different charges depending on it. */}
        <FormField
          control={form.control}
          name="value"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{isPercent ? 'Percentage' : 'Amount'}</FormLabel>
              <FormControl>
                <NumberInput
                  className="w-full"
                  min={0}
                  max={isPercent ? 100 : undefined}
                  step={isPercent ? 0.5 : 1}
                  suffix={isPercent ? '%' : undefined}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                {isPercent
                  ? 'Applied to the price actually charged, so a discounted product is taxed on the discounted amount.'
                  : 'Charged per unit bought, whatever the price.'}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </ResourceFormPage>
  )
}

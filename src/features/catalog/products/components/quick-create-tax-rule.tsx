import * as React from 'react'
import { Input } from '@/components/ui/input'
import { SegmentedRadioGroup } from '@/components/ui/radio-group'
import {
  QuickCreateDialog,
  QuickCreateField,
} from '@/features/catalog/products/components/quick-create-dialog'
import { errorMessage } from '@/lib/utils/error-message'
import { useCreateTaxRule, type ChargeType, type TaxRule } from '@/lib/api/tax-rules'

/**
 * Creates a tax rule from the product form's Tax rule picker. The rule is
 * required on every product, so this is the picker whose missing record blocks
 * a save outright.
 */
export function QuickCreateTaxRule({
  open,
  onOpenChange,
  onCreated,
  initialName = '',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (taxRule: TaxRule) => void
  initialName?: string
}) {
  // Seeded once, from the mount — see the note in `quick-create-brand.tsx`.
  const [name, setName] = React.useState(initialName)
  const [type, setType] = React.useState<ChargeType>('PERCENT')
  const [value, setValue] = React.useState('0')
  const [nameError, setNameError] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const mutation = useCreateTaxRule()

  const submit = async () => {
    if (!name.trim()) return setNameError('Name is required')
    setNameError(null)
    setError(null)
    try {
      const created = await mutation.mutateAsync({
        name: name.trim(),
        type,
        value: Number(value) || 0,
      })
      onCreated(created)
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <QuickCreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New tax rule"
      description="Added to this product straight away. Edit the rest on the tax rule's own page."
      submitLabel="Create tax rule"
      pending={mutation.isPending}
      error={error}
      onSubmit={submit}
    >
      <QuickCreateField label="Name" htmlFor="quick-tax-rule-name" error={nameError}>
        <Input
          id="quick-tax-rule-name"
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </QuickCreateField>

      <QuickCreateField label="Charge">
        <SegmentedRadioGroup
          aria-label="Charge type"
          value={type}
          onValueChange={(next) => setType(next as ChargeType)}
          options={[
            { value: 'PERCENT', label: 'Percentage' },
            { value: 'FLAT', label: 'Flat' },
          ]}
        />
      </QuickCreateField>

      <QuickCreateField label={type === 'PERCENT' ? 'Rate (%)' : 'Amount'} htmlFor="quick-tax-rule-value">
        <Input
          id="quick-tax-rule-value"
          type="number"
          min={0}
          step="0.01"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </QuickCreateField>
    </QuickCreateDialog>
  )
}

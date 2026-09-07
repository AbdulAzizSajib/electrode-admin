import * as React from 'react'
import { Input } from '@/components/ui/input'
import {
  QuickCreateDialog,
  QuickCreateField,
} from '@/features/catalog/products/components/quick-create-dialog'
import { errorMessage } from '@/lib/utils/error-message'
import { useCreateBundleDeal, type BundleDeal } from '@/lib/api/bundle-deals'

/** Creates a "buy N, get M free" offer from the product form's Bundle deal picker. */
export function QuickCreateBundleDeal({
  open,
  onOpenChange,
  onCreated,
  initialName = '',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (bundleDeal: BundleDeal) => void
  initialName?: string
}) {
  // Seeded once, from the mount — see the note in `quick-create-brand.tsx`.
  const [name, setName] = React.useState(initialName)
  const [buyQuantity, setBuyQuantity] = React.useState('2')
  const [freeQuantity, setFreeQuantity] = React.useState('1')
  const [nameError, setNameError] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const mutation = useCreateBundleDeal()

  const submit = async () => {
    if (!name.trim()) return setNameError('Name is required')
    setNameError(null)
    setError(null)
    try {
      const created = await mutation.mutateAsync({
        name: name.trim(),
        buyQuantity: Number(buyQuantity) || 1,
        freeQuantity: Number(freeQuantity) || 1,
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
      title="New bundle deal"
      description="Added to this product straight away. Edit the rest on the bundle deal's own page."
      submitLabel="Create bundle deal"
      pending={mutation.isPending}
      error={error}
      onSubmit={submit}
    >
      <QuickCreateField label="Name" htmlFor="quick-bundle-name" error={nameError}>
        <Input
          id="quick-bundle-name"
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </QuickCreateField>

      <div className="grid grid-cols-2 gap-3">
        <QuickCreateField label="Buy quantity" htmlFor="quick-bundle-buy">
          <Input
            id="quick-bundle-buy"
            type="number"
            min={1}
            value={buyQuantity}
            onChange={(event) => setBuyQuantity(event.target.value)}
          />
        </QuickCreateField>
        <QuickCreateField label="Free quantity" htmlFor="quick-bundle-free">
          <Input
            id="quick-bundle-free"
            type="number"
            min={1}
            value={freeQuantity}
            onChange={(event) => setFreeQuantity(event.target.value)}
          />
        </QuickCreateField>
      </div>
    </QuickCreateDialog>
  )
}

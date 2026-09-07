import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  QuickCreateDialog,
  QuickCreateField,
} from '@/features/catalog/products/components/quick-create-dialog'
import { errorMessage } from '@/lib/utils/error-message'
import { useCreateCollection, type Collection } from '@/lib/api/collections'

/**
 * Creates a collection from the product form's Collections picker. The slug is
 * derived from the name by the backend, as it is on the collection's own page.
 */
export function QuickCreateCollection({
  open,
  onOpenChange,
  onCreated,
  initialName = '',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (collection: Collection) => void
  initialName?: string
}) {
  // Seeded once, from the mount — see the note in `quick-create-brand.tsx`.
  const [name, setName] = React.useState(initialName)
  const [isVisible, setIsVisible] = React.useState(true)
  const [nameError, setNameError] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const mutation = useCreateCollection()

  const submit = async () => {
    if (!name.trim()) return setNameError('Name is required')
    setNameError(null)
    setError(null)
    try {
      const created = await mutation.mutateAsync({ name: name.trim(), isVisible })
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
      title="New collection"
      description="Added to this product straight away. Edit the rest on the collection's own page."
      submitLabel="Create collection"
      pending={mutation.isPending}
      error={error}
      onSubmit={submit}
    >
      <QuickCreateField label="Name" htmlFor="quick-collection-name" error={nameError}>
        <Input
          id="quick-collection-name"
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </QuickCreateField>

      <div className="flex items-center gap-2">
        <Switch id="quick-collection-visible" checked={isVisible} onCheckedChange={setIsVisible} />
        <label htmlFor="quick-collection-visible" className="text-sm text-foreground">
          Visible in the storefront
        </label>
      </div>
    </QuickCreateDialog>
  )
}

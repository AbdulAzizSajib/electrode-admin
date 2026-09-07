import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Combobox } from '@/components/ui/combobox'
import { SingleImageField } from '@/components/forms/single-image-field'
import {
  QuickCreateDialog,
  QuickCreateField,
} from '@/features/catalog/products/components/quick-create-dialog'
import { errorMessage } from '@/lib/utils/error-message'
import { useCreateCategory, type Category } from '@/lib/api/categories'

/** Every category in the tree, flattened, for the parent picker. */
function flatten(tree: Category[]): Category[] {
  const out: Category[] = []
  const walk = (nodes: Category[]) => {
    for (const node of nodes) {
      out.push(node)
      if (node.children?.length) walk(node.children)
    }
  }
  walk(tree)
  return out
}

/**
 * Creates a category from the product form's Category picker.
 *
 * The picker is one dropdown per level, so where the action was invoked
 * decides the parent: `defaultParentId` is the category selected at the level
 * above, or null at the top level. The merchant can still change it here —
 * getting this wrong files a subcategory at the top of the tree, which they
 * would then have to go and fix on another page.
 */
export function QuickCreateCategory({
  open,
  onOpenChange,
  onCreated,
  tree,
  defaultParentId = null,
  initialName = '',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (category: Category) => void
  /** The hierarchy, for choosing a different parent than the default. */
  tree: Category[]
  defaultParentId?: string | null
  initialName?: string
}) {
  // Seeded once, from the mount — see the note in `quick-create-brand.tsx`.
  // The parent comes in already resolved to the level the action was invoked
  // from, so this is where that decision lands.
  const [name, setName] = React.useState(initialName)
  const [parentId, setParentId] = React.useState<string | null>(defaultParentId)
  const [description, setDescription] = React.useState('')
  const [imageFile, setImageFile] = React.useState<File | null>(null)
  const [status, setStatus] = React.useState(true)
  const [nameError, setNameError] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const mutation = useCreateCategory()

  const parentOptions = React.useMemo(
    () => [
      { value: 'none', label: 'No parent (top-level)' },
      ...flatten(tree).map((category) => ({ value: category.id, label: category.name })),
    ],
    [tree],
  )

  const submit = async () => {
    if (!name.trim()) return setNameError('Name is required')
    setNameError(null)
    setError(null)
    try {
      const created = await mutation.mutateAsync({
        input: {
          name: name.trim(),
          description: description.trim() || undefined,
          status,
          // The backend rejects a null here — it wants the key left out.
          ...(parentId ? { parentId } : {}),
        },
        imageFile,
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
      title="New category"
      description="Added to this product straight away. Edit the rest on the category's own page."
      submitLabel="Create category"
      pending={mutation.isPending}
      error={error}
      onSubmit={submit}
    >
      <QuickCreateField label="Name" htmlFor="quick-category-name" error={nameError}>
        <Input
          id="quick-category-name"
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </QuickCreateField>

      <QuickCreateField label="Parent">
        <Combobox
          aria-label="Parent category"
          searchPlaceholder="Search categories"
          options={parentOptions}
          value={parentId ?? 'none'}
          onValueChange={(next) => setParentId(next === null || next === 'none' ? null : next)}
        />
      </QuickCreateField>

      <QuickCreateField label="Description" htmlFor="quick-category-description">
        <Textarea
          id="quick-category-description"
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </QuickCreateField>

      <QuickCreateField label="Image">
        <SingleImageField value={imageFile} onChange={setImageFile} label="Upload image" />
      </QuickCreateField>

      <div className="flex items-center gap-2">
        <Switch id="quick-category-status" checked={status} onCheckedChange={setStatus} />
        <label htmlFor="quick-category-status" className="text-sm text-foreground">
          Active
        </label>
      </div>
    </QuickCreateDialog>
  )
}

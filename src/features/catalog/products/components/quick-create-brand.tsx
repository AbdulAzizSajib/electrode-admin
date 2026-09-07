import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { SingleImageField } from '@/components/forms/single-image-field'
import {
  QuickCreateDialog,
  QuickCreateField,
} from '@/features/catalog/products/components/quick-create-dialog'
import { errorMessage } from '@/lib/utils/error-message'
import { useCreateBrand, type Brand } from '@/lib/api/brands'

/**
 * Creates a brand from the product form's Brand picker.
 *
 * Carries the fields that make a brand usable on a product and no more — SEO
 * and everything else stays on `/catalog/brands/new`, which this does not
 * replace. Payload built exactly as `brand-form-page.tsx` builds it, so the
 * record is indistinguishable from one created there.
 */
export function QuickCreateBrand({
  open,
  onOpenChange,
  onCreated,
  initialName = '',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (brand: Brand) => void
  /** What the merchant had typed into the picker's search when they gave up on it. */
  initialName?: string
}) {
  /*
   * Seeded once, from the mount. The product form renders this only while it
   * is open, so every opening is a fresh mount and there is nothing to reset —
   * and nothing that could wipe what was typed when a create is rejected and
   * the dialog stays open.
   */
  const [name, setName] = React.useState(initialName)
  const [description, setDescription] = React.useState('')
  const [logoUrl, setLogoUrl] = React.useState('')
  const [logoFile, setLogoFile] = React.useState<File | null>(null)
  const [status, setStatus] = React.useState(true)
  const [nameError, setNameError] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const mutation = useCreateBrand()

  const submit = async () => {
    if (!name.trim()) return setNameError('Name is required')
    setNameError(null)
    setError(null)
    try {
      const created = await mutation.mutateAsync({
        input: {
          name: name.trim(),
          description: description.trim() || undefined,
          logo: logoUrl.trim() || undefined,
          status,
        },
        logoFile,
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
      title="New brand"
      description="Added to this product straight away. Edit the rest on the brand's own page."
      submitLabel="Create brand"
      pending={mutation.isPending}
      error={error}
      onSubmit={submit}
    >
      <QuickCreateField label="Name" htmlFor="quick-brand-name" error={nameError}>
        <Input
          id="quick-brand-name"
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </QuickCreateField>

      <QuickCreateField label="Description" htmlFor="quick-brand-description">
        <Textarea
          id="quick-brand-description"
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </QuickCreateField>

      {/* Upload and URL are alternatives, not a pair — the backend accepts either. */}
      <QuickCreateField label="Logo">
        <SingleImageField value={logoFile} onChange={setLogoFile} label="Upload logo" />
      </QuickCreateField>

      <QuickCreateField label="Logo URL" htmlFor="quick-brand-logo-url">
        <Input
          id="quick-brand-logo-url"
          placeholder="https://…"
          disabled={!!logoFile}
          value={logoUrl}
          onChange={(event) => setLogoUrl(event.target.value)}
        />
      </QuickCreateField>

      <div className="flex items-center gap-2">
        <Switch id="quick-brand-status" checked={status} onCheckedChange={setStatus} />
        <label htmlFor="quick-brand-status" className="text-sm text-foreground">
          Active
        </label>
      </div>
    </QuickCreateDialog>
  )
}

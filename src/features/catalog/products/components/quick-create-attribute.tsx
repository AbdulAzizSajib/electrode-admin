import * as React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SegmentedRadioGroup } from '@/components/ui/radio-group'
import {
  QuickCreateDialog,
  QuickCreateField,
} from '@/features/catalog/products/components/quick-create-dialog'
import { errorMessage } from '@/lib/utils/error-message'
import {
  useCreateAttribute,
  type Attribute,
  type AttributePresentation,
} from '@/lib/api/attributes'

interface ValueRow {
  /** Local only — the backend mints the real ids. Keys the row across edits. */
  key: string
  label: string
  swatch: string
}

const emptyRow = (index: number): ValueRow => ({ key: `v${index}`, label: '', swatch: '' })

/**
 * Creates a shop attribute, with its values, from the variant editor.
 *
 * Values are collected here rather than left for later because an attribute
 * with none cannot produce a variant — creating one would leave the merchant
 * with a checkbox group containing nothing to tick, which is the dead end this
 * whole change exists to remove.
 */
export function QuickCreateAttribute({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (attribute: Attribute) => void
}) {
  const [name, setName] = React.useState('')
  const [presentation, setPresentation] = React.useState<AttributePresentation>('LABEL')
  const [rows, setRows] = React.useState<ValueRow[]>([emptyRow(0), emptyRow(1)])
  const [nameError, setNameError] = React.useState<string | null>(null)
  const [valuesError, setValuesError] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const mutation = useCreateAttribute()

  const setRow = (key: string, patch: Partial<ValueRow>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))

  const submit = async () => {
    const values = rows
      .filter((row) => row.label.trim())
      .map((row) => ({
        label: row.label.trim(),
        ...(presentation === 'SWATCH' && row.swatch.trim() ? { swatch: row.swatch.trim() } : {}),
      }))

    setNameError(name.trim() ? null : 'Name is required')
    setValuesError(values.length ? null : 'At least one value is required')
    if (!name.trim() || !values.length) return

    setError(null)
    try {
      const created = await mutation.mutateAsync({ name: name.trim(), presentation, values })
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
      title="New attribute"
      description="Its values are selected on this product straight away, and the combinations rebuilt."
      submitLabel="Create attribute"
      pending={mutation.isPending}
      error={error}
      onSubmit={submit}
    >
      <QuickCreateField label="Name" htmlFor="quick-attribute-name" error={nameError}>
        <Input
          id="quick-attribute-name"
          autoFocus
          placeholder="Colour"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </QuickCreateField>

      <QuickCreateField label="Shown as">
        <SegmentedRadioGroup
          aria-label="Presentation"
          value={presentation}
          onValueChange={(next) => setPresentation(next as AttributePresentation)}
          options={[
            { value: 'LABEL', label: 'Labels' },
            { value: 'SWATCH', label: 'Swatches' },
          ]}
        />
      </QuickCreateField>

      <QuickCreateField label="Values" error={valuesError}>
        <div className="flex flex-col gap-2">
          {rows.map((row, index) => (
            <div key={row.key} className="flex items-center gap-2">
              <Input
                aria-label={`Value ${index + 1}`}
                placeholder="Red"
                value={row.label}
                onChange={(event) => setRow(row.key, { label: event.target.value })}
              />
              {presentation === 'SWATCH' && (
                <Input
                  aria-label={`Swatch ${index + 1}`}
                  type="color"
                  className="w-12 shrink-0 px-1"
                  value={row.swatch || '#000000'}
                  onChange={(event) => setRow(row.key, { swatch: event.target.value })}
                />
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove value ${index + 1}`}
                // Never below one row: an attribute needs a value, so leaving
                // the merchant with no field to type it into is a dead end.
                disabled={rows.length === 1}
                onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="self-start"
            onClick={() =>
              setRows((current) => [...current, emptyRow(Number(current.at(-1)?.key.slice(1)) + 1)])
            }
          >
            <Plus className="size-4" /> Add value
          </Button>
        </div>
      </QuickCreateField>
    </QuickCreateDialog>
  )
}

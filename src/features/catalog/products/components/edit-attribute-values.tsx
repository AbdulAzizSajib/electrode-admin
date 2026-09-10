import * as React from 'react'
import { Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { SegmentedRadioGroup } from '@/components/ui/radio-group'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { QuickCreateField } from '@/features/catalog/products/components/quick-create-dialog'
import { errorMessage } from '@/lib/utils/error-message'
import {
  useCreateAttributeValue,
  useDeleteAttributeValue,
  useUpdateAttribute,
  useUpdateAttributeValue,
  type Attribute,
  type AttributePresentation,
  type AttributeValue,
} from '@/lib/api/attributes'

/**
 * Edits one existing attribute — its name, how it is shown, and its values —
 * from the product form.
 *
 * `QuickCreateAttribute` beside this covers the case where the attribute does
 * not exist yet. This covers the more common one: Colour exists, the merchant
 * is stocking a product in a shade nobody has sold before, and the only route
 * forward today is to abandon a part-filled product, go to Catalog →
 * Attributes, add the colour, come back and start over. That round-trip is what
 * this removes.
 *
 * Every edit here saves on the spot, against the value-scoped endpoints rather
 * than `PATCH /attributes/:id`. That is not a convenience: the whole-attribute
 * PATCH reconciles against the `values` array it is given and deletes anything
 * missing from it, so sending a list built from a page loaded minutes ago would
 * drop any value another admin added meanwhile. One value in the path, one
 * value touched.
 *
 * The reach is worth stating plainly, and the dialog does: attributes are
 * shop-wide, so renaming Black here renames it on every product that sells it.
 */

/** A value being renamed — held apart so cancelling restores the saved label. */
interface Draft {
  label: string
  swatch: string
}

export function EditAttributeValues({
  attribute,
  open,
  onOpenChange,
  onValueCreated,
  onValueDeleted,
}: {
  attribute: Attribute
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Newly added values are ticked on the product straight away. */
  onValueCreated?: (value: AttributeValue) => void
  /** A deleted value must also leave the product's selection and its rows. */
  onValueDeleted?: (valueId: string) => void
}) {
  const [name, setName] = React.useState(attribute.name)
  const [presentation, setPresentation] = React.useState<AttributePresentation>(
    attribute.presentation,
  )

  const [newLabel, setNewLabel] = React.useState('')
  const [newSwatch, setNewSwatch] = React.useState('#000000')

  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState<Draft>({ label: '', swatch: '' })

  const [error, setError] = React.useState<string | null>(null)
  /** A delete the backend refused, waiting on the merchant to confirm. */
  const [pendingDelete, setPendingDelete] = React.useState<{
    value: AttributeValue
    message: string
  } | null>(null)

  const updateAttribute = useUpdateAttribute()
  const createValue = useCreateAttributeValue()
  const updateValue = useUpdateAttributeValue()
  const deleteValue = useDeleteAttributeValue()

  /*
   * Re-seed the header fields when a different attribute is opened.
   *
   * The dialog outlives one opening, so without this its fields would still
   * hold the previous attribute's name — and a stale name is a rename waiting
   * to be submitted by accident on blur. Adjusted during render rather than in
   * an effect, matching how the product form resets its upload list: these are
   * values derived from the attribute, and an effect would render one frame of
   * the previous one's name before replacing it.
   *
   * Keyed on the id alone, NOT on the name. Renaming saves and refetches, so a
   * name-keyed reset would fire on the merchant's own edit landing — harmless
   * for the header, but it would also close a rename they had open on a value.
   */
  const [seededFor, setSeededFor] = React.useState<string | null>(null)
  if (open && seededFor !== attribute.id) {
    setSeededFor(attribute.id)
    setName(attribute.name)
    setPresentation(attribute.presentation)
    setNewLabel('')
    setNewSwatch('#000000')
    setEditingId(null)
    setError(null)
  }

  /** Closes, dropping the seed so reopening this same attribute starts fresh. */
  const close = () => {
    setSeededFor(null)
    onOpenChange(false)
  }

  const busy =
    updateAttribute.isPending ||
    createValue.isPending ||
    updateValue.isPending ||
    deleteValue.isPending

  /** Saves the header fields, but only what actually changed. */
  const saveHeader = async () => {
    const trimmed = name.trim()
    const nameChanged = trimmed && trimmed !== attribute.name
    const presentationChanged = presentation !== attribute.presentation
    if (!nameChanged && !presentationChanged) return true

    setError(null)
    try {
      await updateAttribute.mutateAsync({
        id: attribute.id,
        // `values` is deliberately absent: including it would hand the backend
        // a complete-set payload and make this reconcile — and delete — the
        // very values the rest of this dialog is editing one at a time.
        input: {
          ...(nameChanged ? { name: trimmed } : {}),
          ...(presentationChanged ? { presentation } : {}),
        },
      })
      return true
    } catch (err) {
      setError(errorMessage(err))
      return false
    }
  }

  const addValue = async () => {
    const label = newLabel.trim()
    if (!label) return

    setError(null)
    try {
      const created = await createValue.mutateAsync({
        attributeId: attribute.id,
        input: {
          label,
          ...(presentation === 'SWATCH' && newSwatch ? { swatch: newSwatch } : {}),
        },
      })
      // Ticked on arrival: the merchant added this colour in order to sell it,
      // so making them tick it afterwards is a step with no decision in it.
      onValueCreated?.(created)
      setNewLabel('')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const startEditing = (value: AttributeValue) => {
    setEditingId(value.id)
    setDraft({ label: value.label, swatch: value.swatch ?? '#000000' })
  }

  const saveEditing = async (value: AttributeValue) => {
    const label = draft.label.trim()
    if (!label) return

    const swatchChanged = presentation === 'SWATCH' && draft.swatch !== (value.swatch ?? '')
    if (label === value.label && !swatchChanged) {
      setEditingId(null)
      return
    }

    setError(null)
    try {
      await updateValue.mutateAsync({
        attributeId: attribute.id,
        valueId: value.id,
        input: {
          ...(label !== value.label ? { label } : {}),
          ...(swatchChanged ? { swatch: draft.swatch } : {}),
        },
      })
      setEditingId(null)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  /** Deletes, or surfaces the backend's refusal for the merchant to confirm. */
  const removeValue = async (value: AttributeValue, force = false) => {
    setError(null)
    try {
      await deleteValue.mutateAsync({ attributeId: attribute.id, valueId: value.id, force })
      // The product may be selling this value right now; its selection and any
      // combination row built from it have to go with it.
      onValueDeleted?.(value.id)
      setPendingDelete(null)
    } catch (err) {
      const message = errorMessage(err)
      /*
       * Two different 409s come back from here and they are not both a
       * question. "Products still sell this" is one the merchant can answer by
       * confirming; "an attribute needs at least one value" is a refusal with
       * no yes on the other side of it, and offering "Remove anyway" for it
       * would promise something the retry cannot deliver.
       */
      if (!force && /still sell/i.test(message)) {
        setPendingDelete({ value, message })
        return
      }
      setPendingDelete(null)
      setError(message)
    }
  }

  return (
    <>
      <Dialog
        open={open}
        // Covers the close button and Escape as well as the Done button.
        onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      >
        <DialogContent
          className="max-h-[85vh] overflow-y-auto"
          // Rendered over the product form; a click in here is never a click on it.
          onClick={(event) => event.stopPropagation()}
        >
          {/*
           * Not a <form>. The quick-create dialogs submit once and close; this
           * one saves each edit as it is made, so there is no single submit for
           * a form element to carry — and nesting one inside the product form's
           * would put an Enter keypress one stray bubble away from saving a
           * half-filled product.
           */}
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Edit {attribute.name}</DialogTitle>
              <DialogDescription>
                Attributes are shop-wide. Adding a value here makes it available on every product;
                renaming or removing one changes it everywhere it is already sold.
              </DialogDescription>
            </DialogHeader>

            {error && <Alert variant="destructive" title={error} />}

            <div className="flex flex-col gap-3">
              <QuickCreateField label="Name" htmlFor="edit-attribute-name">
                <Input
                  id="edit-attribute-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  // Saved on blur rather than per keystroke: a rename touches
                  // every product selling this attribute, and firing one per
                  // character would be both a storm of writes and a trail of
                  // half-typed names in the audit log.
                  onBlur={saveHeader}
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

              <QuickCreateField label="Values">
                <div className="flex flex-col gap-2">
                  {attribute.values.map((value) =>
                    editingId === value.id ? (
                      <div key={value.id} className="flex items-center gap-2">
                        <Input
                          autoFocus
                          aria-label={`Rename ${value.label}`}
                          value={draft.label}
                          onChange={(event) => setDraft((d) => ({ ...d, label: event.target.value }))}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              void saveEditing(value)
                            }
                            if (event.key === 'Escape') setEditingId(null)
                          }}
                        />
                        {presentation === 'SWATCH' && (
                          <Input
                            aria-label={`Colour for ${value.label}`}
                            type="color"
                            className="w-12 shrink-0 px-1"
                            value={draft.swatch || '#000000'}
                            onChange={(event) =>
                              setDraft((d) => ({ ...d, swatch: event.target.value }))
                            }
                          />
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Save ${value.label}`}
                          disabled={busy}
                          onClick={() => void saveEditing(value)}
                        >
                          {updateValue.isPending ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Check className="size-4" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Cancel renaming ${value.label}`}
                          onClick={() => setEditingId(null)}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    ) : (
                      <div
                        key={value.id}
                        className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5"
                      >
                        {presentation === 'SWATCH' && value.swatch && (
                          <span
                            aria-hidden
                            className="size-3 shrink-0 rounded-full border border-border"
                            style={{ backgroundColor: value.swatch }}
                          />
                        )}
                        <span className="flex-1 truncate text-sm">{value.label}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${value.label}`}
                          disabled={busy}
                          onClick={() => startEditing(value)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${value.label}`}
                          // The last value cannot go: an attribute with none
                          // leaves a checkbox group with nothing to tick. The
                          // backend refuses it too; disabling here is what
                          // stops the merchant meeting that as an error.
                          disabled={busy || attribute.values.length <= 1}
                          title={
                            attribute.values.length <= 1
                              ? 'An attribute needs at least one value'
                              : undefined
                          }
                          onClick={() => void removeValue(value)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ),
                  )}

                  <div className="flex items-center gap-2">
                    <Input
                      aria-label="New value"
                      placeholder={presentation === 'SWATCH' ? 'Navy' : 'XL'}
                      value={newLabel}
                      onChange={(event) => setNewLabel(event.target.value)}
                      onKeyDown={(event) => {
                        // Enter adds the value rather than reaching the product
                        // form's submit — which is what it would do by default.
                        if (event.key !== 'Enter') return
                        event.preventDefault()
                        void addValue()
                      }}
                    />
                    {presentation === 'SWATCH' && (
                      <Input
                        aria-label="New value colour"
                        type="color"
                        className="w-12 shrink-0 px-1"
                        value={newSwatch}
                        onChange={(event) => setNewSwatch(event.target.value)}
                      />
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="shrink-0"
                      disabled={busy || !newLabel.trim()}
                      onClick={() => void addValue()}
                    >
                      {createValue.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Plus className="size-4" />
                      )}
                      Add value
                    </Button>
                  </div>
                </div>
              </QuickCreateField>
            </div>

            <DialogFooter>
              {/*
               * "Done", not "Save": everything here is already saved by the
               * time this is reached, and a Save button would imply the edits
               * are still pending — and that closing without it discards them.
               */}
              <Button
                type="button"
                disabled={busy}
                onClick={async () => {
                  // The name field may still hold an unsaved edit if the
                  // merchant clicked straight through from it to here without
                  // the blur landing first.
                  if (await saveHeader()) close()
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null)
        }}
        title="Products still sell this value"
        description={pendingDelete?.message}
        confirmLabel="Remove anyway"
        cancelLabel="Keep it"
        variant="destructive"
        onConfirm={() => {
          if (pendingDelete) void removeValue(pendingDelete.value, true)
        }}
      />
    </>
  )
}

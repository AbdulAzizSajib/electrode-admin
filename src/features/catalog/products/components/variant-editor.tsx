import * as React from 'react'
import { Link as LinkIcon, Pencil, Plus, Trash2 } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'
import {
  ImageUploadField,
  SHARED_VARIANT_KEY,
  type PendingImage,
} from '@/features/catalog/products/components/image-upload-field'
import {
  describeCarryOverLoss,
  rebuildCombinations,
  type CombinationRow,
  type ExistingVariant,
  type SelectedAttribute,
} from '@/features/catalog/products/components/variant-combinations'
import type { Attribute } from '@/lib/api/attributes'

/**
 * Attribute-value checkboxes plus a combination table — what replaces the
 * "Generate variants" button.
 *
 * The button was the problem, not just an inconvenience: it made regenerating
 * an explicit act that rebuilt every row, so a merchant adding one size had no
 * way to add it without also rebuilding the rows they had already stocked. Here
 * ticking a value *is* the edit, and every surviving row carries over whole.
 *
 * All the matching logic lives in `variant-editor.ts` beside this file.
 */

export interface VariantEditorProps {
  /** Every shop attribute, for the checkbox groups. */
  attributes: Attribute[]
  /** Value ids currently selected, across all attributes. */
  selectedValueIds: string[]
  onSelectedValueIdsChange: (valueIds: string[]) => void

  rows: CombinationRow[]
  onRowsChange: (rows: CombinationRow[]) => void

  /** The product's own offer price, used as the starting price for a new combination. */
  basePrice: number
  /** Prefix for a generated variant SKU. */
  skuPrefix: string
  /** Mints a key for a row that has no backend id yet. */
  nextVariantKey: () => string

  pendingImages: PendingImage[]
  onPendingImagesChange: (pending: PendingImage[]) => void

  /** Called when a row disappears, so its images can be released. */
  onRowRemoved?: (variantKey: string) => void

  /**
   * Offers "create an attribute" beside the checkbox groups.
   *
   * The other five reference pickers on the product form hang this off their
   * dropdown; attributes are picked as checkbox groups, so there is no option
   * list to hang it from and it becomes a button of its own. The page owns the
   * dialog, as it does for the other five.
   */
  onCreateAttribute?: () => void

  /**
   * Offers "edit this attribute" on each checkbox group.
   *
   * `onCreateAttribute` covers the attribute that does not exist yet; this
   * covers the far more common case of one that does but is missing a value —
   * a colour the shop has never stocked before. Without it the merchant's only
   * route is to abandon a part-filled product for the Attributes page, which is
   * the same dead end quick-create was built to close. The page owns the
   * dialog, as it does the create one.
   */
  onEditAttribute?: (attribute: Attribute) => void
}

/** The rows as the matcher wants them. */
function toExisting(rows: CombinationRow[]): ExistingVariant[] {
  return rows.map((row) => ({
    id: row.id,
    variantKey: row.variantKey,
    name: row.name,
    sku: row.sku,
    offerPrice: row.offerPrice,
    sellingPrice: row.sellingPrice,
    stockQuantity: row.stockQuantity,
    valueIds: row.valueIds,
  }))
}

export function VariantEditor({
  attributes,
  selectedValueIds,
  onSelectedValueIdsChange,
  rows,
  onRowsChange,
  basePrice,
  skuPrefix,
  nextVariantKey,
  pendingImages,
  onPendingImagesChange,
  onRowRemoved,
  onCreateAttribute,
  onEditAttribute,
}: VariantEditorProps) {
  /** A change waiting on the merchant's agreement, held until they answer. */
  const [pendingChange, setPendingChange] = React.useState<{
    valueIds: string[]
    rows: CombinationRow[]
    removed: ExistingVariant[]
    message: string
  } | null>(null)

  const selected = new Set(selectedValueIds)

  /** Which attributes the product sells, in shop order, with their selections. */
  const selectedAttributes: SelectedAttribute[] = attributes
    .map((attribute) => ({
      attributeId: attribute.id,
      name: attribute.name,
      valueIds: attribute.values.filter((v) => selected.has(v.id)).map((v) => v.id),
      labelById: Object.fromEntries(attribute.values.map((v) => [v.id, v.label])),
    }))
    .filter((attribute) => attribute.valueIds.length > 0)

  /**
   * Applies a new selection, rebuilding the table around it.
   *
   * When rows would be lost that could not be carried over, this stops and
   * asks first — the spec requires the merchant be told before a change that
   * cannot carry existing combinations over, and silently applying it is
   * exactly the failure this change exists to fix.
   */
  const applySelection = (nextValueIds: string[]) => {
    const nextSelected = new Set(nextValueIds)
    const nextAttributes: SelectedAttribute[] = attributes
      .map((attribute) => ({
        attributeId: attribute.id,
        name: attribute.name,
        valueIds: attribute.values.filter((v) => nextSelected.has(v.id)).map((v) => v.id),
        labelById: Object.fromEntries(attribute.values.map((v) => [v.id, v.label])),
      }))
      .filter((attribute) => attribute.valueIds.length > 0)

    const result = rebuildCombinations(nextAttributes, toExisting(rows), {
      offerPrice: basePrice,
      skuPrefix,
      nextKey: nextVariantKey,
    })

    const warning = describeCarryOverLoss(result)
    if (warning) {
      setPendingChange({
        valueIds: nextValueIds,
        rows: result.rows,
        removed: result.removed,
        message: warning,
      })
      return
    }

    result.removed.forEach((variant) => onRowRemoved?.(variant.variantKey))
    onSelectedValueIdsChange(nextValueIds)
    onRowsChange(result.rows)
  }

  const toggleValue = (valueId: string, checked: boolean) => {
    applySelection(
      checked ? [...selectedValueIds, valueId] : selectedValueIds.filter((id) => id !== valueId),
    )
  }

  /** Selling every colour is the common case, so it is one action. */
  const toggleWholeAttribute = (attribute: Attribute, checked: boolean) => {
    const ids = attribute.values.map((v) => v.id)
    applySelection(
      checked
        ? [...selectedValueIds, ...ids.filter((id) => !selected.has(id))]
        : selectedValueIds.filter((id) => !ids.includes(id)),
    )
  }

  const updateRow = (index: number, patch: Partial<CombinationRow>) => {
    onRowsChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  /** Not every combination is a real product; the merchant may drop one. */
  const removeRow = (index: number) => {
    const row = rows[index]
    onRowRemoved?.(row.variantKey)
    onRowsChange(rows.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        {attributes.length === 0 ? (
          <Alert title="No attributes defined yet">
            Attributes are shop-wide. Define Colour or Size once under Catalog → Attributes, then
            tick its values here — or add one from here without leaving this product.
          </Alert>
        ) : (
          attributes.map((attribute) => {
            const ids = attribute.values.map((v) => v.id)
            const chosen = ids.filter((id) => selected.has(id))
            // Some but not all is a third state, and it has to be drawn as one:
            // showing it as unchecked invites a click that selects everything
            // when the merchant meant to clear the few already ticked.
            const allChosen = chosen.length > 0 && chosen.length === ids.length
            const someChosen = chosen.length > 0 && chosen.length < ids.length
            return (
              <div key={attribute.id} className="rounded-md border border-border p-3">
                <div className="mb-2 flex items-center gap-2">
                  {/* Radix takes the label as a sibling rather than as children,
                      so each box is paired with its own `htmlFor` — which is
                      also what makes the label clickable. */}
                  <Checkbox
                    id={`attribute-${attribute.id}`}
                    checked={someChosen ? 'indeterminate' : allChosen}
                    onCheckedChange={(next) => toggleWholeAttribute(attribute, next === true)}
                  />
                  <label
                    htmlFor={`attribute-${attribute.id}`}
                    className="cursor-pointer text-sm font-medium text-foreground"
                  >
                    {attribute.name}
                  </label>
                  {chosen.length > 0 && (
                    <Badge variant="secondary">
                      {chosen.length} of {ids.length}
                    </Badge>
                  )}
                  {/* Pushed to the far end, so it reads as acting on the group
                      rather than as another thing to tick. */}
                  {onEditAttribute && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="lg"
                      className="ml-auto text-muted-foreground"
                      aria-label={`Edit ${attribute.name} values`}
                      onClick={() => onEditAttribute(attribute)}
                    >
                      <Pencil className="size-3.5" /> Edit
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {/* Authored order, so S / M / XL reads correctly. */}
                  {attribute.values.map((value) => (
                    <div key={value.id} className="flex items-center gap-1.5">
                      <Checkbox
                        id={`value-${value.id}`}
                        checked={selected.has(value.id)}
                        onCheckedChange={(next) => toggleValue(value.id, next === true)}
                      />
                      <label
                        htmlFor={`value-${value.id}`}
                        className="inline-flex cursor-pointer items-center gap-1.5 text-sm"
                      >
                        {attribute.presentation === 'SWATCH' && value.swatch && (
                          <span
                            aria-hidden
                            className="size-3 rounded-full border border-border"
                            style={{ backgroundColor: value.swatch }}
                          />
                        )}
                        {value.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )
          })
        )}

        {/*
         * Beside the groups rather than inside one, and offered whether or not
         * any attribute exists — "there are none yet" is the state where it is
         * needed most.
         */}
        {onCreateAttribute && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="self-start"
            onClick={onCreateAttribute}
          >
            <Plus className="size-4" /> Add attribute
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No combinations yet"
          description={
            selectedAttributes.length === 0
              ? 'Tick the values this product sells and its combinations appear here. A product selling none is sold as a single item with its own price and stock.'
              : 'Tick at least one value on each attribute.'
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Combination</TableHead>
                <TableHead className="w-44">Product code</TableHead>
                <TableHead className="w-28">Offer price</TableHead>
                <TableHead className="w-28">Regular price</TableHead>
                <TableHead className="w-24">Stock</TableHead>
                <TableHead className="w-40">Images</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={row.variantKey} className="hover:bg-transparent">
                  <TableCell className="align-top">
                    <div className="flex items-center gap-2 pt-1.5">
                      <span className="font-medium text-foreground">{row.name}</span>
                      {/* A row with an id already exists in the database, and
                          keeping it is what preserves its images and its links
                          from past orders. Worth saying out loud. */}
                      {row.id && (
                        <span title="Already saved — its stock, code and images are kept">
                          <LinkIcon className="size-3 text-muted-foreground" />
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <Input
                      value={row.sku}
                      onChange={(e) => updateRow(index, { sku: e.target.value })}
                      placeholder="sku-red-xl"
                      aria-label={`Product code for ${row.name}`}
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <Input
                      type="number"
                      className="w-full tabular-nums"
                      min={0}
                      step={0.01}
                      value={row.offerPrice}
                      aria-label={`Offer price for ${row.name}`}
                      onChange={(e) =>
                        updateRow(index, {
                          offerPrice: e.target.value === '' ? 0 : Number(e.target.value),
                        })
                      }
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    {/*
                     * `''` maps to `undefined`, NOT to 0.
                     *
                     * antd's `InputNumber` handed back `null` for an emptied
                     * field; a native number input hands back `''`, and
                     * `Number('')` is 0. Left unguarded, clearing this field
                     * would save the variant as "on offer, regular price zero"
                     * rather than as "not on offer". See design.md Decision 2.
                     */}
                    <Input
                      type="number"
                      className="w-full tabular-nums"
                      min={0}
                      step={0.01}
                      value={row.sellingPrice ?? ''}
                      aria-label={`Regular price for ${row.name}`}
                      onChange={(e) =>
                        updateRow(index, {
                          sellingPrice: e.target.value === '' ? undefined : Number(e.target.value),
                        })
                      }
                    />
                  </TableCell>
                  {/* Read-only: a variant's stock is owned by the Stock ledger
                      and moves only via a StockMovement (receive a purchase
                      order, or adjust stock). A new row reads 0 until then. */}
                  <TableCell className="align-top">
                    <p className="tabular-nums pt-2 text-sm">{row.stockQuantity}</p>
                  </TableCell>
                  <TableCell className="align-top">
                    {/* Files picked here are stamped with this row's key, which
                        is what links an upload to a variant that has no id yet. */}
                    <ImageUploadField
                      variantKey={row.variantKey}
                      compact
                      showPrimary={false}
                      pending={pendingImages}
                      onChange={onPendingImagesChange}
                      hasPrimaryElsewhere
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-1"
                      onClick={() => removeRow(index)}
                      aria-label={`Remove ${row.name}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingChange)}
        // Covers the close button and Escape as well as the cancel button —
        // every one of them must leave the selection and the table alone.
        onOpenChange={(open) => {
          if (!open) setPendingChange(null)
        }}
        title="Some combinations cannot be carried over"
        description={pendingChange?.message}
        confirmLabel="Apply anyway"
        cancelLabel="Leave things as they are"
        variant="destructive"
        onConfirm={() => {
          if (!pendingChange) return
          pendingChange.removed.forEach((variant) => onRowRemoved?.(variant.variantKey))
          onSelectedValueIdsChange(pendingChange.valueIds)
          onRowsChange(pendingChange.rows)
          setPendingChange(null)
        }}
      />
    </div>
  )
}

/** Re-exported so the form can release a removed row's shared-image assignments. */
export { SHARED_VARIANT_KEY }

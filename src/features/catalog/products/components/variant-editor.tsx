import * as React from 'react'
import { Alert, Checkbox, Input, InputNumber, Modal } from 'antd'
import { Link as LinkIcon, Trash2 } from 'lucide-react'
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
          <Alert
            type="info"
            showIcon
            message="No attributes defined yet"
            description="Attributes are shop-wide. Define Colour or Size once under Catalog → Attributes, then tick its values here."
          />
        ) : (
          attributes.map((attribute) => {
            const ids = attribute.values.map((v) => v.id)
            const chosen = ids.filter((id) => selected.has(id))
            return (
              <div key={attribute.id} className="rounded-md border border-border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Checkbox
                    checked={chosen.length > 0 && chosen.length === ids.length}
                    indeterminate={chosen.length > 0 && chosen.length < ids.length}
                    onChange={(e) => toggleWholeAttribute(attribute, e.target.checked)}
                  >
                    <span className="text-sm font-medium text-foreground">{attribute.name}</span>
                  </Checkbox>
                  {chosen.length > 0 && (
                    <Badge variant="secondary">
                      {chosen.length} of {ids.length}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {/* Authored order, so S / M / XL reads correctly. */}
                  {attribute.values.map((value) => (
                    <Checkbox
                      key={value.id}
                      checked={selected.has(value.id)}
                      onChange={(e) => toggleValue(value.id, e.target.checked)}
                    >
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        {attribute.presentation === 'SWATCH' && value.swatch && (
                          <span
                            aria-hidden
                            className="size-3 rounded-full border border-border"
                            style={{ backgroundColor: value.swatch }}
                          />
                        )}
                        {value.label}
                      </span>
                    </Checkbox>
                  ))}
                </div>
              </div>
            )
          })
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
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <InputNumber
                      className="w-full"
                      min={0}
                      step={0.01}
                      value={row.offerPrice}
                      onChange={(value) => updateRow(index, { offerPrice: value ?? 0 })}
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <InputNumber
                      className="w-full"
                      min={0}
                      step={0.01}
                      value={row.sellingPrice}
                      onChange={(value) => updateRow(index, { sellingPrice: value ?? undefined })}
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

      <Modal
        open={Boolean(pendingChange)}
        title="Some combinations cannot be carried over"
        okText="Apply anyway"
        okButtonProps={{ danger: true }}
        cancelText="Leave things as they are"
        onCancel={() => setPendingChange(null)}
        onOk={() => {
          if (!pendingChange) return
          pendingChange.removed.forEach((variant) => onRowRemoved?.(variant.variantKey))
          onSelectedValueIdsChange(pendingChange.valueIds)
          onRowsChange(pendingChange.rows)
          setPendingChange(null)
        }}
      >
        <p className="text-sm text-muted-foreground">{pendingChange?.message}</p>
      </Modal>
    </div>
  )
}

/** Re-exported so the form can release a removed row's shared-image assignments. */
export { SHARED_VARIANT_KEY }

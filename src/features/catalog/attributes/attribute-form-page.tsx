import * as React from 'react'
import { useParams } from 'react-router'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { ResourceFormPage } from '@/components/crud/resource-form-page'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ColorInput } from '@/components/ui/color-input'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FormArrayMessage,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { ATTRIBUTES_PATH } from '@/features/catalog/attributes/attributes-page'
import {
  useAttribute,
  useCreateAttribute,
  useUpdateAttribute,
  type Attribute,
} from '@/lib/api/attributes'
import { ApiError } from '@/lib/api/client'

const schema = z.object({
  name: z.string().min(1, 'Give this attribute a name'),
  presentation: z.enum(['LABEL', 'SWATCH']),
  values: z
    .array(
      z.object({
        /** Present for a value that already exists; absent for one being added. */
        id: z.string().optional(),
        /*
         * No rule of its own. A row left blank is discarded at save rather than
         * refused — `specs/catalog-management`, "A blank row is not a value" —
         * so the only floor is the group rule below, which is what an attribute
         * genuinely cannot be without.
         */
        label: z.string(),
        swatch: z.string().optional(),
      }),
    )
    .superRefine((rows, ctx) => {
      const labels = rows.map((row) => row.label.trim().toLowerCase()).filter(Boolean)

      if (labels.length === 0) {
        ctx.addIssue({ code: 'custom', message: 'An attribute needs at least one value' })
      }
      if (new Set(labels).size !== labels.length) {
        // Two identical chips would make a variant's selection ambiguous, so
        // this is caught before the request.
        ctx.addIssue({ code: 'custom', message: 'Two values read as the same choice' })
      }
    }),
})
type FormValues = z.infer<typeof schema>

const EMPTY: FormValues = { name: '', presentation: 'LABEL', values: [{ label: '' }] }

export default function AttributeFormPage() {
  const { attributeId } = useParams()
  const isEdit = Boolean(attributeId)

  const { data, isLoading, error } = useAttribute(attributeId)
  const createMutation = useCreateAttribute()
  const updateMutation = useUpdateAttribute()

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY })

  /**
   * Set when the backend refuses an edit that would remove values products
   * still sell. Confirming re-sends the same payload with `force`, so nothing
   * the merchant arranged has to be re-entered.
   */
  const [removalWarning, setRemovalWarning] = React.useState<string | null>(null)
  const pendingValues = React.useRef<FormValues | null>(null)

  const save = async (values: FormValues, force?: boolean) => {
    // Position comes from array order, so the list as arranged on screen *is*
    // the authored order. Nothing carries an explicit position.
    const input = {
      name: values.name,
      presentation: values.presentation,
      values: values.values
        .filter((value) => value.label.trim())
        .map((value) => ({
          id: value.id,
          label: value.label.trim(),
          swatch: values.presentation === 'SWATCH' ? value.swatch : undefined,
        })),
    }

    if (!isEdit) {
      const created = await createMutation.mutateAsync(input)
      return { id: created.id }
    }

    await updateMutation.mutateAsync({ id: attributeId as string, input, force })
  }

  return (
    <ResourceFormPage<FormValues, Attribute>
      noun="Attribute"
      listPath={ATTRIBUTES_PATH}
      recordId={attributeId}
      form={form}
      record={data}
      isLoading={isLoading}
      loadError={error}
      description="An axis of choice a product sells values from. Define it once; every product reuses it."
      toValues={(attribute) => ({
        name: attribute.name,
        presentation: attribute.presentation,
        values: attribute.values.map((value) => ({
          id: value.id,
          label: value.label,
          swatch: value.swatch ?? undefined,
        })),
      })}
      onSave={async (values) => {
        try {
          return await save(values)
        } catch (err) {
          // A 409 here is the "products still sell values you are removing"
          // guard, which is a decision for the merchant rather than a failure.
          if (err instanceof ApiError && err.status === 409) {
            pendingValues.current = values
            setRemovalWarning(err.message)
            // Swallowed deliberately: the shared page would otherwise render
            // this as a plain error, when what is needed is the confirmation
            // below.
            return
          }
          throw err
        }
      }}
      footer={
        removalWarning && (
          <Alert variant="warning" title="Some products still sell the values you removed">
            <div className="flex flex-col items-start gap-3">
              <span>{removalWarning}</span>
              <Button
                variant="destructive"
                size="lg"
                onClick={async () => {
                  if (!pendingValues.current) return
                  await save(pendingValues.current, true)
                  setRemovalWarning(null)
                  pendingValues.current = null
                }}
              >
                Remove them anyway
              </Button>
            </div>
          </Alert>
        )
      }
    >
      <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Colour" {...field} />
              </FormControl>
              <FormDescription>
                Whatever the shop calls it. The storefront renders it as written.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="presentation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Shown as</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="LABEL">Labelled chips</SelectItem>
                  <SelectItem value="SWATCH">Colour swatches</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Declared here rather than guessed from the name, so “Color” behaves like “Colour”.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <ValuesField form={form} />
    </ResourceFormPage>
  )
}

/**
 * The values list.
 *
 * Its own component so the `useFieldArray` subscription and the presentation
 * watch re-render the list rather than the whole page — and so the two group
 * rules have one obvious place to be rendered from.
 */
function ValuesField({ form }: { form: ReturnType<typeof useForm<FormValues>> }) {
  const { fields, append, remove, move } = useFieldArray({ control: form.control, name: 'values' })

  // Which controls a row carries follows the attribute's presentation, and has
  // to follow it as it is picked rather than after a save.
  const presentation = useWatch({ control: form.control, name: 'presentation' })
  const isSwatch = presentation === 'SWATCH'

  return (
    // Not a `FormItem`: "Values" names the whole list, and `FormLabel` would
    // point its `htmlFor` at a field that does not exist.
    <div className="flex flex-col gap-1.5">
      <Label>Values</Label>

      <div className="flex flex-col gap-2">
        {fields.map((row, index) => (
          <div key={row.id} className="flex items-start gap-2">
            <FormField
              control={form.control}
              name={`values.${index}.label`}
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input placeholder="e.g. Red" aria-label={`Value ${index + 1}`} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Only meaningful for a swatch attribute; hidden rather than
                disabled so the row does not carry a control that does nothing. */}
            {isSwatch && (
              <FormField
                control={form.control}
                name={`values.${index}.swatch`}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <ColorInput
                        aria-label={`Colour for value ${index + 1}`}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Move up"
              disabled={index === 0}
              onClick={() => move(index, index - 1)}
            >
              <ArrowUp className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Move down"
              disabled={index === fields.length - 1}
              onClick={() => move(index, index + 1)}
            >
              <ArrowDown className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove value"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => remove(index)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}

        <div>
          <Button type="button" variant="outline" onClick={() => append({ label: '' })}>
            <Plus className="size-4" /> Add value
          </Button>
        </div>

        {/* Where "needs at least one value" and "two values read as the same
            choice" land: they belong to the list, not to any row in it. */}
        <FormArrayMessage name="values" />
      </div>

      <p className="text-xs text-muted-foreground">
        In the order a shopper should see them — S, M, XL reads wrong alphabetically.
      </p>
    </div>
  )
}

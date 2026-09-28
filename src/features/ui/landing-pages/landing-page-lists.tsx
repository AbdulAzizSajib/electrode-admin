import { useFieldArray, useWatch } from 'react-hook-form'
import { Plus, Trash2, ArrowDown, ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/ui/number-input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { ImageUrlField } from './image-url-field'
import type { LandingPageForm } from './landing-page-schema'

/**
 * The repeatable rows a landing page is made of.
 *
 * All built on react-hook-form's `useFieldArray`, which is what the rest of the
 * admin's repeating editors use. Each keeps its own add/remove/reorder controls
 * rather than sharing one generic component: the rows differ in what they
 * contain and in which of them may be removed, and a shared abstraction that
 * took eight props to express those differences would be harder to read than
 * four small lists.
 *
 * Each list takes the page's `form` rather than reading a context, so the
 * `useFieldArray` subscription belongs to the list and editing one row does not
 * re-render the other five editors.
 */

const ROW = 'rounded-lg border border-border bg-muted/30 p-3'

function RowActions({
  index,
  total,
  onMove,
  onRemove,
  canRemove = true,
}: {
  index: number
  total: number
  onMove: (from: number, to: number) => void
  onRemove: () => void
  canRemove?: boolean
}) {
  return (
    <div className="flex shrink-0 gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
        aria-label="Move up"
      >
        <ArrowUp className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={index === total - 1}
        onClick={() => onMove(index, index + 1)}
        aria-label="Move down"
      >
        <ArrowDown className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-destructive hover:bg-destructive/10"
        disabled={!canRemove}
        onClick={onRemove}
        aria-label="Remove"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  )
}

/** The dashed "add another" control every list ends with. */
function AddRowButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="border-dashed"
      disabled={disabled}
      onClick={onClick}
    >
      <Plus className="size-4" /> {children}
    </Button>
  )
}

/**
 * One gallery row.
 *
 * Its own component so the image/video branch watches `media.<i>.type` from
 * inside the row: switching one row's kind then re-renders that row alone,
 * where the antd `shouldUpdate` it replaces re-rendered the whole list.
 */
function MediaRow({
  form,
  index,
  total,
  onMove,
  onRemove,
}: {
  form: LandingPageForm
  index: number
  total: number
  onMove: (from: number, to: number) => void
  onRemove: () => void
}) {
  const type = useWatch({ control: form.control, name: `media.${index}.type` })

  return (
    <div className={`${ROW} flex gap-3`}>
      <div className="grid flex-1 gap-x-3 sm:grid-cols-2">
        <FormField
          control={form.control}
          name={`media.${index}.type`}
          render={({ field }) => (
            <FormItem className="mb-2">
              <FormLabel>Type</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="IMAGE">Image</SelectItem>
                  <SelectItem value="VIDEO">Video</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {type === 'VIDEO' ? (
          <>
            <FormField
              control={form.control}
              name={`media.${index}.url`}
              render={({ field }) => (
                <FormItem className="mb-2">
                  <FormLabel>Video URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://…/clip.mp4" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`media.${index}.thumbnailUrl`}
              render={({ field }) => (
                <FormItem className="mb-2">
                  <FormLabel>Poster image</FormLabel>
                  <ImageUrlField value={field.value ?? ''} onChange={field.onChange} />
                  <FormDescription>Shown before the video is played.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        ) : (
          <>
            <FormField
              control={form.control}
              name={`media.${index}.url`}
              render={({ field }) => (
                <FormItem className="mb-2">
                  <FormLabel>Image</FormLabel>
                  <ImageUrlField value={field.value ?? ''} onChange={field.onChange} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`media.${index}.alt`}
              render={({ field }) => (
                <FormItem className="mb-2">
                  <FormLabel>Alt text</FormLabel>
                  <FormControl>
                    <Input placeholder="What the picture shows" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}
      </div>

      <RowActions index={index} total={total} onMove={onMove} onRemove={onRemove} />
    </div>
  )
}

/**
 * The campaign gallery.
 *
 * Order is authored, not derived: the first item is what a visitor arriving
 * from an ad sees in the first second, which is the merchant's call.
 */
export function MediaListField({ form }: { form: LandingPageForm }) {
  const { fields, append, remove, move } = useFieldArray({ control: form.control, name: 'media' })

  return (
    <div className="flex flex-col gap-3">
      {fields.map((row, index) => (
        <MediaRow
          key={row.id}
          form={form}
          index={index}
          total={fields.length}
          onMove={move}
          onRemove={() => remove(index)}
        />
      ))}

      <AddRowButton onClick={() => append({ type: 'IMAGE', url: '' })}>
        Add image or video
      </AddRowButton>

      <p className="text-xs text-muted-foreground">
        Leave this empty to use the product&apos;s own photos.
      </p>
    </div>
  )
}

export function HighlightsListField({ form }: { form: LandingPageForm }) {
  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: 'highlights',
  })

  return (
    <div className="flex flex-col gap-3">
      {fields.map((row, index) => (
        <div key={row.id} className={`${ROW} flex gap-3`}>
          <div className="grid flex-1 gap-x-3 sm:grid-cols-3">
            <FormField
              control={form.control}
              name={`highlights.${index}.title`}
              render={({ field }) => (
                <FormItem className="mb-2">
                  <FormLabel>Heading</FormLabel>
                  <FormControl>
                    <Input placeholder="সারা দেশে ডেলিভারি" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`highlights.${index}.text`}
              render={({ field }) => (
                <FormItem className="mb-2">
                  <FormLabel>Detail</FormLabel>
                  <FormControl>
                    <Input placeholder="২-৪ দিনের মধ্যে" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`highlights.${index}.icon`}
              render={({ field }) => (
                <FormItem className="mb-2">
                  <FormLabel>Icon</FormLabel>
                  <FormControl>
                    <Input placeholder="mdi:truck-fast" {...field} />
                  </FormControl>
                  <FormDescription>An Iconify name, e.g. mdi:truck-fast</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <RowActions
            index={index}
            total={fields.length}
            onMove={move}
            onRemove={() => remove(index)}
          />
        </div>
      ))}

      <AddRowButton onClick={() => append({ title: '' })}>Add a selling point</AddRowButton>
    </div>
  )
}

export function FaqsListField({ form }: { form: LandingPageForm }) {
  const { fields, append, remove, move } = useFieldArray({ control: form.control, name: 'faqs' })

  return (
    <div className="flex flex-col gap-3">
      {fields.map((row, index) => (
        <div key={row.id} className={`${ROW} flex gap-3`}>
          <div className="flex-1">
            <FormField
              control={form.control}
              name={`faqs.${index}.question`}
              render={({ field }) => (
                <FormItem className="mb-2">
                  <FormLabel>Question</FormLabel>
                  <FormControl>
                    <Input placeholder="সাইজ কি এক্সচেঞ্জ করা যাবে?" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`faqs.${index}.answer`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Answer</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="হ্যাঁ, ৭ দিনের মধ্যে।" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <RowActions
            index={index}
            total={fields.length}
            onMove={move}
            onRemove={() => remove(index)}
          />
        </div>
      ))}

      <AddRowButton onClick={() => append({ question: '', answer: '' })}>
        Add a question
      </AddRowButton>
    </div>
  )
}

export function QuotesListField({ form }: { form: LandingPageForm }) {
  const { fields, append, remove, move } = useFieldArray({ control: form.control, name: 'quotes' })

  return (
    <div className="flex flex-col gap-3">
      {fields.map((row, index) => (
        <div key={row.id} className={`${ROW} flex gap-3`}>
          <div className="grid flex-1 gap-x-3 sm:grid-cols-2">
            <FormField
              control={form.control}
              name={`quotes.${index}.name`}
              render={({ field }) => (
                <FormItem className="mb-2">
                  <FormLabel>Customer name</FormLabel>
                  <FormControl>
                    <Input placeholder="করিম" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`quotes.${index}.rating`}
              render={({ field }) => (
                <FormItem className="mb-2">
                  <FormLabel>Rating</FormLabel>
                  <FormControl>
                    <NumberInput min={1} max={5} className="w-full" {...field} />
                  </FormControl>
                  <FormDescription>
                    Left blank, no stars are shown — better than showing five nobody gave.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`quotes.${index}.text`}
              render={({ field }) => (
                <FormItem className="mb-2 sm:col-span-2">
                  <FormLabel>Quote</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="কাপড়ের মান খুব ভালো।" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`quotes.${index}.photoUrl`}
              render={({ field }) => (
                <FormItem className="mb-2">
                  <FormLabel>Photo</FormLabel>
                  <ImageUrlField value={field.value ?? ''} onChange={field.onChange} />
                  <FormDescription>Optional — their initial is shown instead.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`quotes.${index}.imageUrl`}
              render={({ field }) => (
                <FormItem className="mb-2">
                  <FormLabel>Review screenshot</FormLabel>
                  <ImageUrlField value={field.value ?? ''} onChange={field.onChange} />
                  <FormDescription>
                    A picture of the message they sent. With one, the quote text is
                    optional — post the screenshot instead of retyping it.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <RowActions
            index={index}
            total={fields.length}
            onMove={move}
            onRemove={() => remove(index)}
          />
        </div>
      ))}

      <AddRowButton onClick={() => append({ name: '', text: '' })}>
        Add a customer quote
      </AddRowButton>
    </div>
  )
}

export function TrustBadgesListField({ form }: { form: LandingPageForm }) {
  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: 'trustBadges',
  })

  return (
    <div className="flex flex-col gap-3">
      {fields.map((row, index) => (
        <div key={row.id} className={`${ROW} flex gap-3`}>
          <div className="grid flex-1 gap-x-3 sm:grid-cols-2">
            <FormField
              control={form.control}
              name={`trustBadges.${index}.label`}
              render={({ field }) => (
                <FormItem className="mb-2">
                  <FormLabel>Label</FormLabel>
                  <FormControl>
                    <Input placeholder="১০০% অরিজিনাল" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`trustBadges.${index}.icon`}
              render={({ field }) => (
                <FormItem className="mb-2">
                  <FormLabel>Icon</FormLabel>
                  <FormControl>
                    <Input placeholder="mdi:shield-check" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <RowActions
            index={index}
            total={fields.length}
            onMove={move}
            onRemove={() => remove(index)}
          />
        </div>
      ))}

      <AddRowButton onClick={() => append({ label: '' })}>Add a badge</AddRowButton>
    </div>
  )
}


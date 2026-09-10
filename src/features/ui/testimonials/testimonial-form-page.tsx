import * as React from 'react'
import { useParams } from 'react-router'
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Star, Trash2, Upload } from 'lucide-react'
import { ResourceFormPage } from '@/components/crud/resource-form-page'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { toast } from '@/components/ui/use-toast'
import { TESTIMONIALS_PATH } from '@/features/ui/testimonials/testimonials-list-page'
import { numberWithDefault } from '@/lib/validation/numeric'
import { useUploadImage } from '@/lib/api/uploads'
import {
  useTestimonial,
  useCreateTestimonial,
  useUpdateTestimonial,
  TESTIMONIAL_RATINGS,
  TESTIMONIAL_STATUSES,
  type Testimonial,
} from '@/lib/api/testimonials'
import { initials } from '@/lib/utils/format'

const schema = z.object({
  quote: z.string().min(1, 'Write the quote').max(1000, 'Quote cannot be longer than 1000 characters'),
  authorName: z
    .string()
    .min(1, 'Who said it?')
    .max(120, 'Name cannot be longer than 120 characters'),
  authorRole: z
    .string()
    .min(1, 'Add a short caption')
    .max(120, 'Role cannot be longer than 120 characters'),
  /** Set by the upload rather than typed, so it carries no rule of its own. */
  photoUrl: z.string(),
  rating: z.number(),
  status: z.enum(TESTIMONIAL_STATUSES),
  sortOrder: numberWithDefault(0),
})

/** `sortOrder` runs through a `z.preprocess`, so input and output diverge. */
type FormValues = z.input<typeof schema>
type OutputValues = z.output<typeof schema>

const EMPTY: FormValues = {
  quote: '',
  authorName: '',
  authorRole: '',
  photoUrl: '',
  rating: 5,
  status: 'DRAFT',
  sortOrder: 0,
}

export default function TestimonialFormPage() {
  const { testimonialId } = useParams()
  const isEdit = Boolean(testimonialId)

  const { data, isLoading, error } = useTestimonial(testimonialId)
  const createMutation = useCreateTestimonial()
  const updateMutation = useUpdateTestimonial()

  const form = useForm<FormValues, unknown, OutputValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  })

  return (
    <ResourceFormPage<FormValues, Testimonial, OutputValues>
      noun="Testimonial"
      listPath={TESTIMONIALS_PATH}
      recordId={testimonialId}
      form={form}
      record={data}
      isLoading={isLoading}
      loadError={error}
      toValues={(t) => ({
        quote: t.quote,
        authorName: t.authorName,
        authorRole: t.authorRole,
        photoUrl: t.photoUrl ?? '',
        rating: t.rating,
        status: t.status,
        sortOrder: t.sortOrder,
      })}
      onSave={async (values) => {
        const input = {
          quote: values.quote,
          authorName: values.authorName,
          authorRole: values.authorRole,
          // Blank means no photo — the storefront renders initials instead.
          // Sending "" would fail the backend's URL check.
          photoUrl: values.photoUrl?.trim() || undefined,
          rating: values.rating,
          status: values.status,
          sortOrder: values.sortOrder,
        }

        if (isEdit) {
          await updateMutation.mutateAsync({ id: testimonialId as string, input })
          return
        }
        const created = await createMutation.mutateAsync(input)
        return { id: created.id }
      }}
    >
      <TestimonialFields form={form} />
    </ResourceFormPage>
  )
}

function TestimonialFields({
  form,
}: {
  form: UseFormReturn<FormValues, unknown, OutputValues>
}) {
  const uploadMutation = useUploadImage()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)

  // Watched so the preview reflects what is being typed, not what was loaded.
  const photoUrl = useWatch({ control: form.control, name: 'photoUrl' })
  const authorName = useWatch({ control: form.control, name: 'authorName' })

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const { url } = await uploadMutation.mutateAsync(file)
      form.setValue('photoUrl', url)
    } catch (err) {
      toast({
        title: 'Could not upload that photo',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
      <FormField
        control={form.control}
        name="quote"
        render={({ field }) => (
          <FormItem className="md:col-span-2">
            <FormLabel>Quote</FormLabel>
            <FormControl>
              <Textarea
                rows={3}
                maxLength={1000}
                placeholder="What the customer said."
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="authorName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input maxLength={120} placeholder="e.g. Rahim Ahmed" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="authorRole"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Role</FormLabel>
            <FormControl>
              <Input maxLength={120} placeholder="e.g. Verified Buyer" {...field} />
            </FormControl>
            <FormDescription>The line under the name.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Not a `FormField`: the photo is set by the upload rather than typed, so
          there is no input to bind — the URL lives in the form's values and is
          written with `setValue`. A plain labelled block, as the brand form's
          upload is. */}
      <div className="flex flex-col gap-1.5 md:col-span-2">
        <Label>Photo</Label>
        <div className="flex items-center gap-3">
          {/* Exactly what the storefront card will render, photo or not, so the
              merchant approves the real thing rather than imagining it. */}
          {photoUrl ? (
            <img
              src={photoUrl}
              alt=""
              className="size-14 shrink-0 rounded-full border border-border object-cover"
            />
          ) : (
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
              {initials(authorName ?? '') || '—'}
            </span>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleUpload(file)
            }}
          />

          <Button
            type="button"
            size="lg"
            variant="outline"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {photoUrl ? 'Replace photo' : 'Upload photo'}
          </Button>

          {photoUrl && (
            <Button
              type="button"
              size="lg"
              variant="ghost"
              onClick={() => form.setValue('photoUrl', '')}
            >
              <Trash2 className="size-4" /> Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Optional. Without one, the card shows the author&apos;s initials — never a gap or a stock
          silhouette.
        </p>
      </div>

      <FormField
        control={form.control}
        name="rating"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Rating</FormLabel>
            {/* Radix carries a string; the payload carries a whole number. */}
            <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {TESTIMONIAL_RATINGS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    <span className="flex items-center gap-1">
                      {n}
                      <Star className="size-3.5 fill-current text-amber-500" aria-hidden />
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormDescription>
              Whole stars. This is what the card shows — it was previously pinned at 5 for every
              quote.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="status"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Status</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="PUBLISHED">Published</SelectItem>
              </SelectContent>
            </Select>
            <FormDescription>A draft does not appear on the storefront.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="sortOrder"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Order</FormLabel>
            <FormControl>
              <NumberInput className="w-full" min={0} step={1} {...field} />
            </FormControl>
            <FormDescription>
              Lower numbers come first. The homepage section shows only the first few, so this is
              how you choose which quote leads.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}

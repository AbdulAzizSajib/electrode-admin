import * as React from 'react'
import { useParams } from 'react-router'
import { Form, Input, InputNumber, Select, type FormInstance } from 'antd'
import { Loader2, Star, Trash2, Upload } from 'lucide-react'
import { ResourceFormPage } from '@/components/crud/resource-form-page'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { TESTIMONIALS_PATH } from '@/features/ui/testimonials/testimonials-list-page'
import { useUploadImage } from '@/lib/api/uploads'
import {
  useTestimonial,
  useCreateTestimonial,
  useUpdateTestimonial,
  TESTIMONIAL_RATINGS,
  type Testimonial,
  type TestimonialStatus,
} from '@/lib/api/testimonials'
import { initials } from '@/lib/utils/format'

interface FormValues {
  quote: string
  authorName: string
  authorRole: string
  photoUrl: string
  rating: number
  status: TestimonialStatus
  sortOrder: number
}

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

  return (
    <ResourceFormPage<FormValues, Testimonial>
      noun="Testimonial"
      listPath={TESTIMONIALS_PATH}
      recordId={testimonialId}
      record={data}
      isLoading={isLoading}
      loadError={error}
      emptyValues={EMPTY}
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
      {(form) => <TestimonialFields form={form} />}
    </ResourceFormPage>
  )
}

function TestimonialFields({ form }: { form: FormInstance<FormValues> }) {
  const uploadMutation = useUploadImage()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)

  // Watched so the preview reflects what is being typed, not what was loaded.
  const photoUrl = Form.useWatch('photoUrl', form)
  const authorName = Form.useWatch('authorName', form)

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const { url } = await uploadMutation.mutateAsync(file)
      form.setFieldValue('photoUrl', url)
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
    <div className="grid gap-x-6 md:grid-cols-2">
      <Form.Item
        name="quote"
        label="Quote"
        className="md:col-span-2"
        rules={[{ required: true, message: 'Write the quote' }, { max: 1000 }]}
      >
        <Input.TextArea rows={3} placeholder="What the customer said." />
      </Form.Item>

      <Form.Item
        name="authorName"
        label="Name"
        rules={[{ required: true, message: 'Who said it?' }, { max: 120 }]}
      >
        <Input placeholder="e.g. Rahim Ahmed" />
      </Form.Item>

      <Form.Item
        name="authorRole"
        label="Role"
        extra="The line under the name."
        rules={[{ required: true, message: 'Add a short caption' }, { max: 120 }]}
      >
        <Input placeholder="e.g. Verified Buyer" />
      </Form.Item>

      <Form.Item
        label="Photo"
        className="md:col-span-2"
        extra="Optional. Without one, the card shows the author's initials — never a gap or a stock silhouette."
      >
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
            size="sm"
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
              size="sm"
              variant="ghost"
              onClick={() => form.setFieldValue('photoUrl', '')}
            >
              <Trash2 className="size-4" /> Remove
            </Button>
          )}
        </div>
      </Form.Item>

      {/* Hidden, because the URL is set by the upload rather than typed — but it
          is still the field that carries the value into the payload. */}
      <Form.Item name="photoUrl" hidden>
        <Input />
      </Form.Item>

      <Form.Item
        name="rating"
        label="Rating"
        extra="Whole stars. This is what the card shows — it was previously pinned at 5 for every quote."
      >
        <Select
          options={TESTIMONIAL_RATINGS.map((n) => ({
            value: n,
            label: (
              <span className="flex items-center gap-1">
                {n}
                <Star className="size-3.5 fill-current text-amber-500" aria-hidden />
              </span>
            ),
          }))}
        />
      </Form.Item>

      <Form.Item
        name="status"
        label="Status"
        extra="A draft does not appear on the storefront."
      >
        <Select
          options={[
            { value: 'DRAFT', label: 'Draft' },
            { value: 'PUBLISHED', label: 'Published' },
          ]}
        />
      </Form.Item>

      <Form.Item
        name="sortOrder"
        label="Order"
        extra="Lower numbers come first. The homepage section shows only the first few, so this is how you choose which quote leads."
      >
        <InputNumber className="w-full" min={0} step={1} />
      </Form.Item>
    </div>
  )
}

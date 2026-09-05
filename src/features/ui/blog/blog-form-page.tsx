import * as React from 'react'
import { useParams } from 'react-router'
import { Form, Input, Select, type FormInstance } from 'antd'
import { ResourceFormPage } from '@/components/crud/resource-form-page'
import { RichTextEditor } from '@/components/forms/rich-text-editor'
import { BLOG_PATH } from '@/features/ui/blog/blog-list-page'
import { BlogMediaField } from '@/features/ui/blog/blog-media-field'
import { EMPTY_MEDIA, type BlogMedia } from '@/features/ui/blog/blog-media'
import {
  useBlogPost,
  useCreateBlogPost,
  useUpdateBlogPost,
  type BlogPost,
  type BlogPostStatus,
} from '@/lib/api/blog-posts'

interface FormValues {
  title: string
  slug?: string
  excerpt: string
  body: string
  media: BlogMedia
  /** `YYYY-MM-DD`, as `<input type="date">` produces — the campaign forms' convention. */
  publishedAt: string
  metaTitle?: string
  metaDescription?: string
  status: BlogPostStatus
}

/** Today, in the `YYYY-MM-DD` form the date input wants. */
const today = () => new Date().toISOString().slice(0, 10)

const EMPTY: FormValues = {
  title: '',
  slug: '',
  excerpt: '',
  body: '',
  media: EMPTY_MEDIA,
  publishedAt: today(),
  metaTitle: '',
  metaDescription: '',
  status: 'DRAFT',
}

/** Mirrors the backend's `slugifyTitle`, so the preview matches what gets stored. */
const slugify = (title: string) =>
  title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/** Mirrors the backend's `slugPattern`. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export default function BlogFormPage() {
  const { postId } = useParams()
  const isEdit = Boolean(postId)

  const { data, isLoading, error } = useBlogPost(postId)
  const createMutation = useCreateBlogPost()
  const updateMutation = useUpdateBlogPost()

  /**
   * The server's message for a slug clash, shown on the slug field rather than only as a toast.
   *
   * A conflict is about one field and has one fix; surfacing it as a page-level toast leaves the
   * merchant to work out which input it refers to.
   */
  const [slugError, setSlugError] = React.useState<string | null>(null)

  return (
    <ResourceFormPage<FormValues, BlogPost>
      noun="Post"
      listPath={BLOG_PATH}
      recordId={postId}
      record={data}
      isLoading={isLoading}
      loadError={error}
      emptyValues={EMPTY}
      toValues={(post) => ({
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        body: post.body,
        media: {
          mediaType: post.mediaType,
          imageUrl: post.imageUrl ?? '',
          videoUrl: post.videoUrl ?? '',
          videoThumbnailUrl: post.videoThumbnailUrl ?? '',
        },
        publishedAt: post.publishedAt.slice(0, 10),
        metaTitle: post.metaTitle ?? '',
        metaDescription: post.metaDescription ?? '',
        status: post.status,
      })}
      onSave={async (values) => {
        setSlugError(null)

        const input = {
          title: values.title,
          // Blank means "derive it from the title" — the backend's own default.
          // Sending "" would try to claim the empty slug.
          slug: values.slug?.trim() || undefined,
          excerpt: values.excerpt,
          body: values.body,
          /*
           * The four media fields always travel together. The backend refuses a payload that names
           * a media URL without its type, and re-checks the whole invariant whenever any of them is
           * mentioned — so sending them as a set is what keeps a media edit valid.
           */
          mediaType: values.media.mediaType,
          imageUrl: values.media.imageUrl || undefined,
          videoUrl: values.media.videoUrl || undefined,
          videoThumbnailUrl: values.media.videoThumbnailUrl || undefined,
          // Midnight UTC, matching how the campaign forms turn a date input into
          // an instant — the card shows a date, so the time of day is noise.
          publishedAt: values.publishedAt
            ? new Date(`${values.publishedAt}T00:00:00.000Z`).toISOString()
            : undefined,
          metaTitle: values.metaTitle?.trim() || undefined,
          metaDescription: values.metaDescription?.trim() || undefined,
          status: values.status,
        }

        try {
          if (isEdit) {
            await updateMutation.mutateAsync({ id: postId as string, input })
            return
          }
          const created = await createMutation.mutateAsync(input)
          return { id: created.id }
        } catch (err) {
          const message = err instanceof Error ? err.message : ''
          // Recognised by what the server actually says — see `assertSlugAvailable`.
          if (message.includes('slug')) setSlugError(message)
          throw err
        }
      }}
    >
      {(form) => <BlogFields form={form} isEdit={isEdit} slugError={slugError} />}
    </ResourceFormPage>
  )
}

function BlogFields({
  form,
  isEdit,
  slugError,
}: {
  form: FormInstance<FormValues>
  isEdit: boolean
  slugError: string | null
}) {
  /*
   * The slug follows the title only until the merchant takes it over. Once they have typed their
   * own, retyping the title must not silently overwrite it — and on an existing post it must never
   * auto-change at all, because the slug is a live URL that may already have been shared.
   */
  const [slugIsManual, setSlugIsManual] = React.useState(isEdit)

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (slugIsManual) return
    form.setFieldValue('slug', slugify(event.target.value))
  }

  return (
    <div className="grid gap-x-6 md:grid-cols-2">
      <Form.Item
        name="title"
        label="Title"
        rules={[{ required: true, message: 'Give this post a title' }]}
      >
        <Input placeholder="e.g. How to Set Up a Smart Home on a Budget" onChange={handleTitleChange} />
      </Form.Item>

      <Form.Item
        name="slug"
        label="Address"
        validateStatus={slugError ? 'error' : undefined}
        help={slugError ?? undefined}
        extra={
          isEdit
            ? 'Changing this breaks any existing link to the post.'
            : 'Left blank, this is built from the title.'
        }
        rules={[
          {
            validator: async (_rule, value: string | undefined) => {
              const slug = value?.trim()
              if (!slug) return
              if (!SLUG_PATTERN.test(slug)) {
                throw new Error('Use lowercase words separated by single hyphens')
              }
            },
          },
        ]}
      >
        <Input
          placeholder="smart-home-on-a-budget"
          addonBefore="/blogs/"
          onChange={() => setSlugIsManual(true)}
        />
      </Form.Item>

      <Form.Item
        name="excerpt"
        label="Excerpt"
        className="md:col-span-2"
        extra="The summary shown on every card. Required — a card without one looks half-finished."
        rules={[{ required: true, message: 'Write a short excerpt' }, { max: 500 }]}
      >
        <Input.TextArea rows={2} placeholder="One or two sentences summarising the post." />
      </Form.Item>

      {/* `value`/`onChange` are injected by Form.Item, which is why the child
          takes them as optional — the default antd control contract. */}
      <Form.Item name="media" label="Image or video" className="md:col-span-2">
        <BlogMediaField />
      </Form.Item>

      <Form.Item
        name="publishedAt"
        label="Date"
        extra="Shown on the card, and what orders the blog. Not what makes a post live — status does that."
      >
        <Input type="date" />
      </Form.Item>

      <Form.Item
        name="status"
        label="Status"
        extra="A draft is not reachable on the storefront — its address returns Not Found."
      >
        <Select
          options={[
            { value: 'DRAFT', label: 'Draft' },
            { value: 'PUBLISHED', label: 'Published' },
          ]}
        />
      </Form.Item>

      <Form.Item
        name="body"
        label="Content"
        className="md:col-span-2"
        rules={[{ required: true, message: 'A post needs some content' }]}
      >
        <RichTextEditor
          minHeight="min-h-96"
          allowImages
          placeholder="Write the post — headings, lists and links all work."
        />
      </Form.Item>

      <Form.Item name="metaTitle" label="Search engine title" extra="Left blank, the post title is used.">
        <Input placeholder="Smart Home on a Budget | Gadgets Mart" />
      </Form.Item>

      <Form.Item
        name="metaDescription"
        label="Search engine description"
        extra="Left blank, the excerpt is used."
      >
        <Input placeholder="Cheap ways to automate a first room." />
      </Form.Item>
    </div>
  )
}

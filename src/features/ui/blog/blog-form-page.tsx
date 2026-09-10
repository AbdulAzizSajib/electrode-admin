import * as React from 'react'
import { useParams } from 'react-router'
import { useForm, type UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ResourceFormPage } from '@/components/crud/resource-form-page'
import { Input } from '@/components/ui/input'
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
import { RichTextEditor } from '@/components/forms/rich-text-editor'
import { BLOG_PATH } from '@/features/ui/blog/blog-list-page'
import { BlogMediaField } from '@/features/ui/blog/blog-media-field'
import { EMPTY_MEDIA } from '@/features/ui/blog/blog-media'
import {
  useBlogPost,
  useCreateBlogPost,
  useUpdateBlogPost,
  BLOG_MEDIA_TYPES,
  BLOG_POST_STATUSES,
  type BlogPost,
} from '@/lib/api/blog-posts'

/** Mirrors the backend's `slugifyTitle`, so the preview matches what gets stored. */
const slugify = (title: string) =>
  title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/** Mirrors the backend's `slugPattern`. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const schema = z.object({
  title: z.string().min(1, 'Give this post a title'),
  slug: z
    .string()
    .optional()
    .superRefine((value, ctx) => {
      const slug = value?.trim()
      if (!slug) return
      if (!SLUG_PATTERN.test(slug)) {
        ctx.addIssue({ code: 'custom', message: 'Use lowercase words separated by single hyphens' })
      }
    }),
  excerpt: z
    .string()
    .min(1, 'Write a short excerpt')
    .max(500, 'Excerpt cannot be longer than 500 characters'),
  body: z.string().min(1, 'A post needs some content'),
  /** Validated as a set, because that is how the backend re-checks it. */
  media: z.object({
    mediaType: z.enum(BLOG_MEDIA_TYPES),
    imageUrl: z.string(),
    videoUrl: z.string(),
    videoThumbnailUrl: z.string(),
  }),
  /** `YYYY-MM-DD`, as `<input type="date">` produces — the campaign forms' convention. */
  publishedAt: z.string(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  status: z.enum(BLOG_POST_STATUSES),
})
type FormValues = z.infer<typeof schema>

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

export default function BlogFormPage() {
  const { postId } = useParams()
  const isEdit = Boolean(postId)

  const { data, isLoading, error } = useBlogPost(postId)
  const createMutation = useCreateBlogPost()
  const updateMutation = useUpdateBlogPost()

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY })

  return (
    <ResourceFormPage<FormValues, BlogPost>
      noun="Post"
      listPath={BLOG_PATH}
      recordId={postId}
      form={form}
      record={data}
      isLoading={isLoading}
      loadError={error}
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
          /*
           * The server's message for a slug clash, put on the slug field rather than left only to
           * the banner above the form. A conflict is about one field and has one fix; reporting it
           * page-wide leaves the merchant to work out which input it refers to.
           *
           * Recognised by what the server actually says — see `assertSlugAvailable`.
           */
          if (message.includes('slug')) form.setError('slug', { message })
          throw err
        }
      }}
    >
      <BlogFields form={form} isEdit={isEdit} />
    </ResourceFormPage>
  )
}

function BlogFields({ form, isEdit }: { form: UseFormReturn<FormValues>; isEdit: boolean }) {
  /*
   * The slug follows the title only until the merchant takes it over. Once they have typed their
   * own, retyping the title must not silently overwrite it — and on an existing post it must never
   * auto-change at all, because the slug is a live URL that may already have been shared.
   */
  const [slugIsManual, setSlugIsManual] = React.useState(isEdit)

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (slugIsManual) return
    form.setValue('slug', slugify(event.target.value))
  }

  return (
    <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Title</FormLabel>
            <FormControl>
              {/* `field.onChange` first: the slug is derived from the title the
                  form now holds, so the write has to land before it is read. */}
              <Input
                placeholder="e.g. How to Set Up a Smart Home on a Budget"
                {...field}
                onChange={(event) => {
                  field.onChange(event)
                  handleTitleChange(event)
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="slug"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Address</FormLabel>
            {/* The leading "/blogs/" is antd's `addonBefore`: a joined,
                non-editable prefix that says the value is a path segment, not a
                full URL. It sits outside `FormControl` so the label still points
                at the input rather than at the wrapper. */}
            <div className="flex w-full">
              <span className="inline-flex shrink-0 items-center rounded-l-md border border-r-0 border-input bg-muted px-2.5 text-sm text-muted-foreground">
                /blogs/
              </span>
              <FormControl>
                <Input
                  placeholder="smart-home-on-a-budget"
                  className="rounded-l-none"
                  {...field}
                  onChange={(event) => {
                    field.onChange(event)
                    setSlugIsManual(true)
                  }}
                />
              </FormControl>
            </div>
            <FormDescription>
              {isEdit
                ? 'Changing this breaks any existing link to the post.'
                : 'Left blank, this is built from the title.'}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="excerpt"
        render={({ field }) => (
          <FormItem className="md:col-span-2">
            <FormLabel>Excerpt</FormLabel>
            <FormControl>
              <Textarea
                rows={2}
                maxLength={500}
                placeholder="One or two sentences summarising the post."
                {...field}
              />
            </FormControl>
            <FormDescription>
              The summary shown on every card. Required — a card without one looks half-finished.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="media"
        render={({ field }) => (
          <FormItem className="md:col-span-2">
            <FormLabel>Image or video</FormLabel>
            <FormControl>
              <BlogMediaField value={field.value} onChange={field.onChange} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="publishedAt"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Date</FormLabel>
            <FormControl>
              <Input type="date" {...field} />
            </FormControl>
            <FormDescription>
              Shown on the card, and what orders the blog. Not what makes a post live — status does
              that.
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
            <FormDescription>
              A draft is not reachable on the storefront — its address returns Not Found.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="body"
        render={({ field }) => (
          <FormItem className="md:col-span-2">
            <FormLabel>Content</FormLabel>
            <FormControl>
              <RichTextEditor
                minHeight="min-h-96"
                allowImages
                placeholder="Write the post — headings, lists and links all work."
                value={field.value}
                onChange={field.onChange}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="metaTitle"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Search engine title</FormLabel>
            <FormControl>
              <Input placeholder="Smart Home on a Budget | Gadgets Mart" {...field} />
            </FormControl>
            <FormDescription>Left blank, the post title is used.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="metaDescription"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Search engine description</FormLabel>
            <FormControl>
              <Input placeholder="Cheap ways to automate a first room." {...field} />
            </FormControl>
            <FormDescription>Left blank, the excerpt is used.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}

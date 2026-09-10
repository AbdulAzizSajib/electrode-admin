import * as React from 'react'
import { useParams } from 'react-router'
import { useForm, type UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ResourceFormPage } from '@/components/crud/resource-form-page'
import { Input } from '@/components/ui/input'
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
import { PAGES_PATH } from '@/features/ui/pages/pages-list-page'
import {
  usePage,
  useCreatePage,
  useReservedSlugs,
  useUpdatePage,
  PAGE_STATUSES,
  type Page,
} from '@/lib/api/pages'

/** Mirrors the backend's `slugifyTitle`, so the preview matches what gets stored. */
const slugify = (title: string) =>
  title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/** Mirrors the backend's `slugPattern`. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Built per render of the reserved list rather than at module scope: which slugs
 * the storefront has claimed is server data, and the rule has to close over the
 * current answer. react-hook-form re-reads `resolver` off its options on every
 * render, so a new schema takes effect on the next validation.
 */
const makeSchema = (reservedSlugs: string[]) =>
  z.object({
    title: z.string().min(1, 'Give this page a title'),
    slug: z
      .string()
      .optional()
      .superRefine((value, ctx) => {
        const slug = value?.trim()
        if (!slug) return
        if (!SLUG_PATTERN.test(slug)) {
          ctx.addIssue({ code: 'custom', message: 'Use lowercase words separated by single hyphens' })
          return
        }
        // Checked as the merchant types rather than left to the save, because a
        // 409 after writing a whole page is a bad time to find out the address
        // was never available. The server checks it too — this is the early
        // warning, not the guarantee.
        if (reservedSlugs.includes(slug)) {
          ctx.addIssue({
            code: 'custom',
            message: `"/${slug}" is reserved by the storefront — pick another address`,
          })
        }
      }),
    body: z.string().min(1, 'A page needs some content'),
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    status: z.enum(PAGE_STATUSES),
  })

type FormValues = z.infer<ReturnType<typeof makeSchema>>

const EMPTY: FormValues = {
  title: '',
  slug: '',
  body: '',
  metaTitle: '',
  metaDescription: '',
  status: 'DRAFT',
}

/** Stable while the list is still loading, so the schema is not rebuilt every render. */
const NO_RESERVED_SLUGS: string[] = []

export default function PageFormPage() {
  const { pageId } = useParams()
  const isEdit = Boolean(pageId)

  const { data, isLoading, error } = usePage(pageId)
  const createMutation = useCreatePage()
  const updateMutation = useUpdatePage()
  const { data: reservedSlugs = NO_RESERVED_SLUGS } = useReservedSlugs()

  const schema = React.useMemo(() => makeSchema(reservedSlugs), [reservedSlugs])

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY })

  return (
    <ResourceFormPage<FormValues, Page>
      noun="Page"
      listPath={PAGES_PATH}
      recordId={pageId}
      form={form}
      record={data}
      isLoading={isLoading}
      loadError={error}
      toValues={(page) => ({
        title: page.title,
        slug: page.slug,
        body: page.body,
        metaTitle: page.metaTitle ?? '',
        metaDescription: page.metaDescription ?? '',
        status: page.status,
      })}
      onSave={async (values) => {
        const input = {
          title: values.title,
          // Blank means "derive it from the title" — the backend's own default.
          // Sending "" would try to claim the empty slug.
          slug: values.slug?.trim() || undefined,
          body: values.body,
          metaTitle: values.metaTitle?.trim() || undefined,
          metaDescription: values.metaDescription?.trim() || undefined,
          status: values.status,
        }

        if (isEdit) {
          await updateMutation.mutateAsync({ id: pageId as string, input })
          return
        }
        const created = await createMutation.mutateAsync(input)
        return { id: created.id }
      }}
    >
      <PageFields form={form} isEdit={isEdit} />
    </ResourceFormPage>
  )
}

function PageFields({
  form,
  isEdit,
}: {
  form: UseFormReturn<FormValues>
  isEdit: boolean
}) {
  /*
   * The slug follows the title only until the merchant takes it over. Once
   * they have typed their own, retyping the title must not silently overwrite
   * it — and on an existing page it must never auto-change at all, because the
   * slug is a live URL other sites may already link to.
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
                placeholder="e.g. Refund Policy"
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
            {/* The leading "/" is antd's `addonBefore`: a joined, non-editable
                prefix that says the value is a path segment, not a full URL. It
                sits outside `FormControl` so the label still points at the input
                rather than at the wrapper. */}
            <div className="flex w-full">
              <span className="inline-flex shrink-0 items-center rounded-l-md border border-r-0 border-input bg-muted px-2.5 text-sm text-muted-foreground">
                /
              </span>
              <FormControl>
                <Input
                  placeholder="refund-policy"
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
                ? 'Changing this breaks any existing link to the page.'
                : 'Left blank, this is built from the title.'}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="status"
        render={({ field }) => (
          <FormItem className="md:col-span-2">
            <FormLabel>Status</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger className="max-w-xs">
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
                placeholder="Write the page — headings, lists and links all work."
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
              <Input placeholder="Refund Policy | Gadgets Mart" {...field} />
            </FormControl>
            <FormDescription>Left blank, the page title is used.</FormDescription>
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
              <Input placeholder="How refunds and returns work." {...field} />
            </FormControl>
            <FormDescription>
              Left blank, this is taken from the start of the content.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}

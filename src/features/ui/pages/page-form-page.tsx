import * as React from 'react'
import { useParams } from 'react-router'
import { Form, Input, Select, type FormInstance } from 'antd'
import { ResourceFormPage } from '@/components/crud/resource-form-page'
import { RichTextEditor } from '@/components/forms/rich-text-editor'
import { PAGES_PATH } from '@/features/ui/pages/pages-list-page'
import {
  usePage,
  useCreatePage,
  useReservedSlugs,
  useUpdatePage,
  type Page,
  type PageStatus,
} from '@/lib/api/pages'

interface FormValues {
  title: string
  slug?: string
  body: string
  metaTitle?: string
  metaDescription?: string
  status: PageStatus
}

const EMPTY: FormValues = {
  title: '',
  slug: '',
  body: '',
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

export default function PageFormPage() {
  const { pageId } = useParams()
  const isEdit = Boolean(pageId)

  const { data, isLoading, error } = usePage(pageId)
  const createMutation = useCreatePage()
  const updateMutation = useUpdatePage()
  const { data: reservedSlugs = [] } = useReservedSlugs()

  return (
    <ResourceFormPage<FormValues, Page>
      noun="Page"
      listPath={PAGES_PATH}
      recordId={pageId}
      record={data}
      isLoading={isLoading}
      loadError={error}
      emptyValues={EMPTY}
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
      {(form) => <PageFields form={form} isEdit={isEdit} reservedSlugs={reservedSlugs} />}
    </ResourceFormPage>
  )
}

function PageFields({
  form,
  isEdit,
  reservedSlugs,
}: {
  form: FormInstance<FormValues>
  isEdit: boolean
  reservedSlugs: string[]
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
    form.setFieldValue('slug', slugify(event.target.value))
  }

  return (
    <div className="grid gap-x-6 md:grid-cols-2">
      <Form.Item
        name="title"
        label="Title"
        rules={[{ required: true, message: 'Give this page a title' }]}
      >
        <Input placeholder="e.g. Refund Policy" onChange={handleTitleChange} />
      </Form.Item>

      <Form.Item
        name="slug"
        label="Address"
        extra={
          isEdit
            ? 'Changing this breaks any existing link to the page.'
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
              // Checked as the merchant types rather than left to the save,
              // because a 409 after writing a whole page is a bad time to find
              // out the address was never available. The server checks it too —
              // this is the early warning, not the guarantee.
              if (reservedSlugs.includes(slug)) {
                throw new Error(`"/${slug}" is reserved by the storefront — pick another address`)
              }
            },
          },
        ]}
      >
        <Input
          placeholder="refund-policy"
          addonBefore="/"
          onChange={() => setSlugIsManual(true)}
        />
      </Form.Item>

      <Form.Item
        name="status"
        label="Status"
        className="md:col-span-2"
        extra="A draft is not reachable on the storefront — its address returns Not Found."
      >
        <Select
          className="max-w-xs"
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
        rules={[{ required: true, message: 'A page needs some content' }]}
      >
        <RichTextEditor
          minHeight="min-h-96"
          allowImages
          placeholder="Write the page — headings, lists and links all work."
        />
      </Form.Item>

      <Form.Item
        name="metaTitle"
        label="Search engine title"
        extra="Left blank, the page title is used."
      >
        <Input placeholder="Refund Policy | Gadgets Mart" />
      </Form.Item>

      <Form.Item
        name="metaDescription"
        label="Search engine description"
        extra="Left blank, this is taken from the start of the content."
      >
        <Input placeholder="How refunds and returns work." />
      </Form.Item>
    </div>
  )
}

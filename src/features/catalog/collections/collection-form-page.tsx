import { useParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ResourceFormPage } from '@/components/crud/resource-form-page'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { COLLECTIONS_PATH } from '@/features/catalog/collections/collections-page'
import {
  useCollection,
  useCreateCollection,
  useUpdateCollection,
  type Collection,
} from '@/lib/api/collections'

const schema = z.object({
  name: z.string().min(1, 'Give this collection a name'),
  slug: z.string().optional(),
  isVisible: z.boolean(),
})
type FormValues = z.infer<typeof schema>

const EMPTY: FormValues = { name: '', slug: '', isVisible: true }

export default function CollectionFormPage() {
  const { collectionId } = useParams()
  const isEdit = Boolean(collectionId)

  const { data, isLoading, error } = useCollection(collectionId)
  const createMutation = useCreateCollection()
  const updateMutation = useUpdateCollection()

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY })

  return (
    <ResourceFormPage<FormValues, Collection>
      noun="Collection"
      listPath={COLLECTIONS_PATH}
      recordId={collectionId}
      form={form}
      record={data}
      isLoading={isLoading}
      loadError={error}
      toValues={(collection) => ({
        name: collection.name,
        slug: collection.slug,
        isVisible: collection.isVisible,
      })}
      onSave={async (values) => {
        // A blank slug means "derive it from the name", which is the backend's
        // default — sending "" would try to claim the empty slug.
        const input = { ...values, slug: values.slug?.trim() || undefined }
        if (isEdit) {
          await updateMutation.mutateAsync({ id: collectionId as string, input })
          return
        }
        const created = await createMutation.mutateAsync(input)
        return { id: created.id }
      }}
    >
      <div className="grid gap-x-6 md:grid-cols-2">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Top selling" {...field} />
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
                  prefix that says the value is a path segment, not a full URL.
                  It sits outside `FormControl` so the label still points at the
                  input rather than at the wrapper. */}
              <div className="flex w-full">
                <span className="inline-flex shrink-0 items-center rounded-l-md border border-r-0 border-input bg-muted px-2.5 text-sm text-muted-foreground">
                  /
                </span>
                <FormControl>
                  <Input placeholder="top-selling" className="rounded-l-none" {...field} />
                </FormControl>
              </div>
              <FormDescription>Left blank, this is built from the name.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isVisible"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Visible on the storefront</FormLabel>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormDescription>
                Hiding a collection keeps its products in it — nothing is lost.
              </FormDescription>
            </FormItem>
          )}
        />
      </div>
    </ResourceFormPage>
  )
}

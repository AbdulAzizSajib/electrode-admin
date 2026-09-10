import * as React from 'react'
import { useParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ResourceFormPage } from '@/components/crud/resource-form-page'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { SingleImageField } from '@/components/forms/single-image-field'
import { BRANDS_PATH } from '@/features/catalog/brands/brands-page'
import {
  useBrand,
  useCreateBrand,
  useUpdateBrand,
  type Brand,
  type BrandInput,
} from '@/lib/api/brands'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  logo: z.string().optional(),
  description: z.string().optional(),
  status: z.boolean(),
})
type FormValues = z.infer<typeof schema>

const EMPTY_VALUES: FormValues = { name: '', logo: '', description: '', status: true }

const toValues = (brand: Brand): FormValues => ({
  name: brand.name,
  logo: brand.logo ?? '',
  description: brand.description ?? '',
  status: brand.status,
})

function toInput(values: FormValues): BrandInput {
  return {
    name: values.name,
    logo: values.logo || undefined,
    description: values.description || undefined,
    status: values.status,
  }
}

export default function BrandFormPage() {
  const { brandId } = useParams()

  const { data, isLoading, error } = useBrand(brandId)
  const createMutation = useCreateBrand()
  const updateMutation = useUpdateBrand()

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY_VALUES })

  // The picked file is component state, not a form field — the schema has no
  // say over an upload, and the logo URL field is the other route to the same
  // artwork.
  const [logoFile, setLogoFile] = React.useState<File | null>(null)

  const save = async (values: FormValues) => {
    if (brandId) {
      await updateMutation.mutateAsync({ id: brandId, input: toInput(values), logoFile })
      // The file has been sent; keeping it selected would re-upload the same
      // bytes on the next save from this page.
      setLogoFile(null)
      return
    }
    const created = await createMutation.mutateAsync({ input: toInput(values), logoFile })
    setLogoFile(null)
    return { id: created.id }
  }

  return (
    <ResourceFormPage<FormValues, Brand>
      noun="Brand"
      listPath={BRANDS_PATH}
      recordId={brandId}
      form={form}
      record={data}
      isLoading={isLoading}
      loadError={error}
      toValues={toValues}
      onSave={save}
    >
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Upload and URL are alternatives, not a pair — the backend accepts
          either. Not a form field: the file never enters the schema, so this
          is a plain labelled block rather than a `FormField`. */}
      <div className="flex flex-col gap-1.5">
        <Label>Logo</Label>
        <SingleImageField
          value={logoFile}
          onChange={setLogoFile}
          currentUrl={data?.logo}
          label="Upload logo"
        />
      </div>

      <FormField
        control={form.control}
        name="logo"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Logo URL</FormLabel>
            <FormControl>
              <Input placeholder="https://…" disabled={!!logoFile} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Textarea rows={3} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="status"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between gap-2">
            <FormLabel className="text-sm font-normal text-foreground">Active</FormLabel>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )}
      />
    </ResourceFormPage>
  )
}

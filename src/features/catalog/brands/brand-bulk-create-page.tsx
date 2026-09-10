import * as React from 'react'
import { useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ResourceFormLayout } from '@/components/crud/resource-form-layout'
import { Alert } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { toast } from '@/components/ui/use-toast'
import { BRANDS_PATH } from '@/features/catalog/brands/brands-page'
import { useBulkCreateBrands } from '@/lib/api/brands'

/**
 * Fast-entry path for adding many brands at once: one name per line, no other fields (matches
 * `BrandService.bulkCreateBrands` — each row becomes `status: true`, no description/logo). Rows
 * that are blank, duplicated within the list, or already exist are skipped, not failed — the page
 * reports which after submit rather than blocking the whole batch over one bad line.
 *
 * On `ResourceFormLayout` rather than the shared form page: this creates many records, so there is
 * no single record to continue editing and no id to navigate to. It borrows the page chrome and
 * supplies its own single action.
 */

const schema = z.object({
  namesText: z.string(),
})
type BulkFormValues = z.infer<typeof schema>

export default function BrandBulkCreatePage() {
  const navigate = useNavigate()
  const bulkMutation = useBulkCreateBrands()

  const form = useForm<BulkFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { namesText: '' },
  })

  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<{ created: number; skipped: { name: string; reason: string }[] } | null>(null)

  // Which button was pressed. `handleSubmit` runs the valid handler
  // asynchronously and cannot be told which submitter fired it.
  const returnAfterSave = React.useRef(false)

  const handleValid = async (values: BulkFormValues) => {
    const names = values.namesText
      .split('\n')
      .map((n) => n.trim())
      .filter(Boolean)

    if (names.length === 0) {
      setError('Enter at least one brand name.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const res = await bulkMutation.mutateAsync(names)
      setResult({ created: res.created.length, skipped: res.skipped })
      if (res.created.length > 0) {
        toast({ title: `${res.created.length} brand(s) created` })
      }

      // Anything skipped keeps the admin here regardless of which button they
      // pressed: the reasons are the point of the batch, and leaving would take
      // them off screen before they were read.
      if (res.skipped.length > 0) return

      if (returnAfterSave.current) {
        navigate(BRANDS_PATH)
        return
      }

      // Staying means the next batch starts from an empty box, with the last
      // batch's outcome still shown beneath it.
      form.setValue('namesText', '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create these brands')
    } finally {
      setSaving(false)
    }
  }

  const submit = (andReturn: boolean) => {
    returnAfterSave.current = andReturn
    void form.handleSubmit(handleValid)()
  }

  return (
    <ResourceFormLayout
      noun="Brand"
      listPath={BRANDS_PATH}
      isEdit={false}
      saving={saving}
      error={error}
      onDismissError={() => setError(null)}
      onSubmit={submit}
      title="Bulk add brands"
      description="One brand name per line. Names that already exist are skipped, not rejected."
      footer={
        result && (
          <div className="flex flex-col gap-2">
            {result.created > 0 && (
              <Alert variant="success" title={`${result.created} brand(s) created`} />
            )}
            {result.skipped.length > 0 && (
              <Alert variant="warning" title={`${result.skipped.length} skipped`}>
                <ul className="list-disc pl-4">
                  {result.skipped.map((s, i) => (
                    <li key={i}>
                      {s.name} — {s.reason}
                    </li>
                  ))}
                </ul>
              </Alert>
            )}
          </div>
        )
      }
    >
      <Form {...form}>
        {/* A real form element so Enter still submits from inside the box. The
            save buttons live in the page header, outside it, and call `submit`
            directly. */}
        <form
          onSubmit={(event) => {
            event.preventDefault()
            submit(false)
          }}
          className="flex flex-col gap-4"
        >
          <FormField
            control={form.control}
            name="namesText"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Brand names</FormLabel>
                <FormControl>
                  <Textarea rows={8} placeholder={'Samsung\nApple\nSony'} {...field} />
                </FormControl>
                <FormDescription>One brand name per line.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </ResourceFormLayout>
  )
}

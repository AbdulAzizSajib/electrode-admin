import * as React from 'react'
import { useNavigate } from 'react-router'
import { Alert, Form, Input } from 'antd'
import { ResourceFormLayout } from '@/components/crud/resource-form-layout'
import { toast } from '@/components/ui/use-toast'
import { BRANDS_PATH } from '@/features/catalog/brands/brands-page'
import { useBulkCreateBrands } from '@/lib/api/brands'

/**
 * Fast-entry path for adding many brands at once: one name per line, no other fields (matches
 * `BrandService.bulkCreateBrands` — each row becomes `status: true`, no description/logo). Rows
 * that are blank, duplicated within the list, or already exist are skipped, not failed — the page
 * reports which after submit rather than blocking the whole batch over one bad line.
 *
 * On `ResourceFormLayout` rather than `ResourceFormPage`: this creates many records, so there is no
 * single record to continue editing and no id to navigate to. It borrows the page chrome and
 * supplies its own single action.
 */

interface BulkFormValues {
  namesText: string
}

export default function BrandBulkCreatePage() {
  const navigate = useNavigate()
  const [form] = Form.useForm<BulkFormValues>()
  const bulkMutation = useBulkCreateBrands()

  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<{ created: number; skipped: { name: string; reason: string }[] } | null>(null)

  // Which button was pressed, read inside `onFinish` — same reason as `ResourceFormPage`.
  const returnAfterSave = React.useRef(false)

  const handleFinish = async (values: BulkFormValues) => {
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
      form.setFieldsValue({ namesText: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create these brands')
    } finally {
      setSaving(false)
    }
  }

  const submit = (andReturn: boolean) => {
    returnAfterSave.current = andReturn
    form.submit()
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
            {result.created > 0 && <Alert type="success" showIcon message={`${result.created} brand(s) created`} />}
            {result.skipped.length > 0 && (
              <Alert
                type="warning"
                showIcon
                message={`${result.skipped.length} skipped`}
                description={
                  <ul className="list-disc pl-4">
                    {result.skipped.map((s, i) => (
                      <li key={i}>
                        {s.name} — {s.reason}
                      </li>
                    ))}
                  </ul>
                }
              />
            )}
          </div>
        )
      }
    >
      <Form form={form} layout="vertical" onFinish={handleFinish} initialValues={{ namesText: '' }}>
        <Form.Item name="namesText" label="Brand names" extra="One brand name per line.">
          <Input.TextArea rows={8} placeholder={'Samsung\nApple\nSony'} />
        </Form.Item>
      </Form>
    </ResourceFormLayout>
  )
}

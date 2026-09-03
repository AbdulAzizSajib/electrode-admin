import * as React from 'react'
import { useNavigate } from 'react-router'
import { Alert, Form, type FormInstance } from 'antd'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from '@/components/ui/use-toast'

/**
 * The form half of the shared CRUD scaffolding.
 *
 * Owns everything the nine catalogue forms would otherwise each reinvent:
 * loading the record, blocking until it arrives, submitting, deciding where the
 * merchant lands afterwards, and putting the failure somewhere they will
 * actually read it. A page supplies its fields and its two callbacks.
 *
 * Error placement is the part most worth centralising. A rejected save must
 * leave everything the merchant typed on the page — antd's `Form` holds the
 * values, so nothing here resets them — and must say why, at the top of the
 * form where the eye returns after pressing Save. Field-level messages still
 * come from the form's own rules; this handles the ones the server raises,
 * which no client rule could have predicted.
 *
 * See `admin/product-authoring` — "Saving reports what happened and where the
 * merchant lands", and "Failed creation preserves the form".
 */

export interface ResourceFormPageProps<TValues extends object, TRecord> {
  /** "Tax rule" — used to build the title and the toasts. */
  noun: string
  /** Where Cancel and save-and-return go. */
  listPath: string
  /** Absent means this is a create form. */
  recordId?: string

  /** Only called when editing. */
  record?: TRecord
  isLoading?: boolean
  loadError?: unknown

  /** Turns the loaded record into form values. Not called on create. */
  toValues: (record: TRecord) => TValues
  /** Values used before anything is loaded, and for a create. */
  emptyValues: TValues

  /** Persists the values. Returns the saved record's id, if it has a new one. */
  onSave: (values: TValues) => Promise<{ id?: string } | void>

  /** The fields. Given the form instance so a field can read or set another. */
  children: (form: FormInstance<TValues>) => React.ReactNode

  /** Rendered beneath the form card — for sections gated on the record existing. */
  footer?: React.ReactNode

  /** Overrides the default "New tax rule" / "Edit tax rule". */
  title?: string
  description?: string
}

export function ResourceFormPage<TValues extends object, TRecord>({
  noun,
  listPath,
  recordId,
  record,
  isLoading = false,
  loadError,
  toValues,
  emptyValues,
  onSave,
  children,
  footer,
  title,
  description,
}: ResourceFormPageProps<TValues, TRecord>) {
  const navigate = useNavigate()
  const [form] = Form.useForm<TValues>()
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const isEdit = Boolean(recordId)

  // Which button was pressed. Read inside `onFinish`, which antd calls only
  // after validation passes and which cannot be told which submitter fired it.
  const returnAfterSave = React.useRef(false)

  // Fill the form once the record arrives. Keyed on the record itself so
  // switching between two records re-syncs, and so a save that returns fresh
  // server values (a generated slug, say) is reflected back.
  React.useEffect(() => {
    if (record) {
      form.resetFields()
      form.setFieldsValue(toValues(record))
    }
    // `toValues` is defined inline by every caller and would re-run this on
    // every render if depended on; the record is what actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record, form])

  const handleFinish = async (values: TValues) => {
    setSaving(true)
    setError(null)
    try {
      const saved = await onSave(values)
      toast({ title: isEdit ? `${noun} updated` : `${noun} created` })

      if (returnAfterSave.current) {
        navigate(listPath)
        return
      }

      // Staying put on a *create* means the form must become the edit form for
      // what was just created — otherwise pressing Save again would create a
      // second copy.
      if (!isEdit && saved && 'id' in saved && saved.id) {
        navigate(`${listPath}/${saved.id}`, { replace: true })
      }
    } catch (err) {
      // Deliberately not resetting the form: everything the merchant entered
      // stays exactly where it is, and the reason appears above it.
      setError(err instanceof Error ? err.message : `Could not save this ${noun.toLowerCase()}`)
    } finally {
      setSaving(false)
    }
  }

  const submit = (andReturn: boolean) => {
    returnAfterSave.current = andReturn
    form.submit()
  }

  if (isEdit && isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    )
  }

  if (isEdit && loadError) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={`Edit ${noun.toLowerCase()}`} />
        <Alert
          type="error"
          showIcon
          message={`Could not load this ${noun.toLowerCase()}`}
          description={loadError instanceof Error ? loadError.message : undefined}
        />
        <div>
          <Button variant="outline" onClick={() => navigate(listPath)}>
            <ArrowLeft /> Back to list
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={title ?? `${isEdit ? 'Edit' : 'New'} ${noun.toLowerCase()}`}
        description={description}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => navigate(listPath)} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" variant="outline" onClick={() => submit(false)} loading={saving}>
              Save and continue editing
            </Button>
            <Button size="sm" onClick={() => submit(true)} loading={saving}>
              Save and return
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="pt-6">
          {/* Above the fields, so the reason a save was rejected is the first
              thing in view when the page stops scrolling. */}
          {error && (
            <Alert type="error" showIcon message={error} className="mb-4" closable onClose={() => setError(null)} />
          )}

          <Form
            form={form}
            layout="vertical"
            initialValues={emptyValues}
            onFinish={handleFinish}
            onFinishFailed={() =>
              setError('Some fields need attention. The problems are marked below.')
            }
          >
            {children(form)}
          </Form>
        </CardContent>
      </Card>

      {footer}
    </div>
  )
}

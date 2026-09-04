import * as React from 'react'
import { useNavigate } from 'react-router'
import { Form, type FormInstance } from 'antd'
import { ResourceFormLayout } from '@/components/crud/resource-form-layout'
import { toast } from '@/components/ui/use-toast'

/**
 * The form half of the shared CRUD scaffolding, for the antd-based pages.
 *
 * Owns everything the catalogue forms would otherwise each reinvent: loading
 * the record, blocking until it arrives, submitting, deciding where the
 * merchant lands afterwards, and putting the failure somewhere they will
 * actually read it. A page supplies its fields and its two callbacks.
 *
 * The page around the form — header, buttons, error slot, load states — lives
 * in `ResourceFormLayout`, shared with `ResourceFormPageRHF` so the panel's two
 * form stacks present one authoring page. What remains here is the antd `Form`
 * binding and the save semantics.
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
  //
  // The `recordId` branch is the same hazard in the other direction: `/:id` and
  // `/new` are one component by design, so going straight from an edit URL to
  // the create URL leaves this mounted with the edited record still in the
  // fields. `resetFields` restores `initialValues`, which is `emptyValues`.
  React.useEffect(() => {
    if (record) {
      form.resetFields()
      form.setFieldsValue(toValues(record))
    } else if (!recordId) {
      form.resetFields()
    }
    // `toValues` is defined inline by every caller and would re-run this on
    // every render if depended on; the record is what actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record, recordId, form])

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

  return (
    <ResourceFormLayout
      noun={noun}
      listPath={listPath}
      isEdit={isEdit}
      saving={saving}
      error={error}
      onDismissError={() => setError(null)}
      onSubmit={submit}
      isLoading={isLoading}
      loadError={loadError}
      title={title}
      description={description}
      footer={footer}
    >
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
    </ResourceFormLayout>
  )
}

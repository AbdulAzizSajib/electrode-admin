import * as React from 'react'
import { useNavigate } from 'react-router'
import type { FieldValues, UseFormReturn } from 'react-hook-form'
import { ResourceFormLayout } from '@/components/crud/resource-form-layout'
import { Form } from '@/components/ui/form'
import { toast } from '@/components/ui/use-toast'

/**
 * The panel's one authoring page: every form in the admin is this, plus fields.
 *
 * There were two for a while. `replace-admin-modals-with-pages` moved twenty
 * pages out of overlays and deliberately postponed the choice of form library,
 * so the same save semantics were implemented twice — once over antd's `Form`,
 * once over react-hook-form — with a `Rhf` suffix telling them apart.
 * `remove-antd-from-admin` settled it: the antd half is gone, the suffix with
 * it, and there is one place where a refused save is handled rather than two
 * that can drift.
 *
 * Callers own their own `useForm` and zod schema and pass the result in, which
 * is what lets a page state a rule the scaffold has never heard of — a bound
 * that depends on another field, a value that must be distinct across a list —
 * without the scaffold growing a prop for it.
 *
 * Everything `specs/admin-shell/spec.md` requires of an authoring page is
 * decided here or in the layout: the three buttons and where each lands, the
 * create-then-stay handoff to the edit form, and — the guarantee most easily
 * lost — that a refused save leaves every entered value untouched with the
 * reason above the fields.
 */

export interface ResourceFormPageProps<
  TValues extends FieldValues,
  TRecord,
  TOutput extends FieldValues = TValues,
> {
  /** "Supplier" — used to build the title and the toasts. */
  noun: string
  /** Where Cancel and save-and-return go. */
  listPath: string
  /** Absent means this is a create form. */
  recordId?: string

  /**
   * The caller's own `useForm` result, so each page keeps its zod schema and,
   * where it has one, its input/output type divergence.
   */
  form: UseFormReturn<TValues, unknown, TOutput>

  /** Only present when editing. */
  record?: TRecord
  isLoading?: boolean
  loadError?: unknown

  /** Turns the loaded record into form values. Not called on create. */
  toValues: (record: TRecord) => TValues

  /** Persists the values. Returns the saved record's id, if it has a new one. */
  onSave: (values: TOutput) => Promise<{ id?: string } | void>

  /** The fields, rendered inside the form provider. */
  children: React.ReactNode

  /** Rendered beneath the form card — for sections gated on the record existing. */
  footer?: React.ReactNode

  /** Overrides the default "New supplier" / "Edit supplier". */
  title?: string
  description?: string
}

export function ResourceFormPage<
  TValues extends FieldValues,
  TRecord,
  TOutput extends FieldValues = TValues,
>({
  noun,
  listPath,
  recordId,
  form,
  record,
  isLoading = false,
  loadError,
  toValues,
  onSave,
  children,
  footer,
  title,
  description,
}: ResourceFormPageProps<TValues, TRecord, TOutput>) {
  const navigate = useNavigate()
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const isEdit = Boolean(recordId)

  // Which button was pressed. `handleSubmit` runs the valid handler
  // asynchronously and cannot be told which submitter fired it.
  const returnAfterSave = React.useRef(false)

  // Fill the form once the record arrives, keyed on the record itself. An
  // overlay got this for free by unmounting on close; a page does not, so
  // editing record A, going back and editing record B must re-sync here or B's
  // form would open holding A's values.
  //
  // The `recordId` branch is the same hazard in the other direction: `/:id` and
  // `/new` are one component by design, so going straight from an edit URL to
  // the create URL leaves this mounted with the edited record still in the
  // fields. Argument-less `reset()` restores the caller's `defaultValues`.
  React.useEffect(() => {
    if (record) {
      // `keepDefaultValues` matters: without it react-hook-form adopts the
      // record as the form's new defaults, and the bare `reset()` below would
      // then restore that record instead of emptying the form.
      form.reset(toValues(record), { keepDefaultValues: true })
    } else if (!recordId) {
      form.reset()
    }
    // `toValues` is defined inline by every caller and would re-run this on
    // every render if depended on; the record is what actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record, recordId, form])

  const handleValid = async (values: TOutput) => {
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
    void form.handleSubmit(handleValid, () =>
      setError('Some fields need attention. The problems are marked below.'),
    )()
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
      <Form {...form}>
        {/* A real form element so Enter still submits from inside a text field.
            The save buttons live in the page header, outside it, and call
            `submit` directly — pressing Enter takes the "stay on the form"
            branch, as it did in the sheets these pages replaced. */}
        <form
          onSubmit={(event) => {
            event.preventDefault()
            submit(false)
          }}
          className="flex flex-col gap-4"
        >
          {children}
        </form>
      </Form>
    </ResourceFormLayout>
  )
}

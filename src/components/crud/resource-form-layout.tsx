import * as React from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

/**
 * Everything an authoring page is apart from its fields.
 *
 * Extracted from `ResourceFormPage` when the panel ran two form stacks at once,
 * so neither had to be rewritten to present the same page to the merchant. Only
 * one stack is left, and the split has earned its keep anyway: the header, the
 * three buttons, where a failure appears and what a load error looks like are
 * the page's contract with the merchant, and they are worth reading without the
 * form plumbing around them.
 *
 * See `replace-admin-modals-with-pages` — design.md Decision 1, and
 * `specs/admin-shell/spec.md` "Authoring Pages Behave Consistently".
 */

export interface ResourceFormLayoutProps {
  /** "Tax rule" — used to build the default title and the load-error copy. */
  noun: string
  /** Where Cancel and the back-from-error button go. */
  listPath: string
  /** Chooses "Edit x" over "New x", and is what a caller's save semantics hang off. */
  isEdit: boolean

  saving: boolean
  /** The reason the last save was refused, shown above the fields. */
  error: string | null
  onDismissError: () => void

  onCancel?: () => void
  /** `true` = save and return to the list; `false` = save and stay. */
  onSubmit: (andReturn: boolean) => void

  /** Only consulted when editing — a create has nothing to load. */
  isLoading?: boolean
  loadError?: unknown

  /** Overrides the default "New tax rule" / "Edit tax rule". */
  title?: string
  description?: string
  /** Rendered beneath the form card — for sections gated on the record existing. */
  footer?: React.ReactNode

  /** The form itself, rendered inside the card. */
  children: React.ReactNode
}

export function ResourceFormLayout({
  noun,
  listPath,
  isEdit,
  saving,
  error,
  onDismissError,
  onCancel,
  onSubmit,
  isLoading = false,
  loadError,
  title,
  description,
  footer,
  children,
}: ResourceFormLayoutProps) {
  const navigate = useNavigate()
  const cancel = onCancel ?? (() => navigate(listPath))

  if (isEdit && isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    )
  }

  // A record that will not load must not fall through to an empty form: saving
  // one would create a second record rather than update the one asked for.
  if (isEdit && loadError) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={`Edit ${noun.toLowerCase()}`} />
        {/* No dismiss control: the record still will not load, so there is
            nothing to dismiss to. */}
        <Alert variant="destructive" title={`Could not load this ${noun.toLowerCase()}`}>
          {loadError instanceof Error ? loadError.message : undefined}
        </Alert>
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
            <Button size="sm" variant="ghost" onClick={cancel} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" variant="outline" onClick={() => onSubmit(false)} loading={saving}>
              Save and continue editing
            </Button>
            <Button size="sm" onClick={() => onSubmit(true)} loading={saving}>
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
            <Alert variant="destructive" title={error} className="mb-4" onDismiss={onDismissError} />
          )}

          {children}
        </CardContent>
      </Card>

      {footer}
    </div>
  )
}

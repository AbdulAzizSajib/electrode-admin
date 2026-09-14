/**
 * The credential form, GENERATED from what the server declares.
 *
 * There is no per-integration form component and there must not be one. The
 * fields, their labels, their placeholders and — critically — which of them are
 * secret all come from `integration.credentials`, so a courier that needs four
 * credentials instead of two renders correctly here without this file learning
 * its name.
 *
 * The alternative puts "which of these is a secret" in two places, and two
 * places drift: someone adds a field to the server and a matching input here,
 * forgets `type="password"`, and a merchant's API key is now sitting in plain
 * text in a screenshot. Driving the masked input from the same `secret` flag
 * that drives the server's write-only treatment makes that particular mistake
 * unavailable. See design.md Decision 4.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE FORM NEVER SHOWS A STORED VALUE, because it cannot: no endpoint returns
 * one. Inputs start empty over a placeholder, and a stored credential is
 * indicated by its hint (`••••1234`) beside the label. Submitting sends only the
 * fields actually typed into — an untouched field is omitted, and the server
 * leaves that credential alone.
 */
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'
import {
  useUpdateIntegrationCredentials,
  type IntegrationState,
} from '@/lib/api/integrations'

export function CredentialForm({
  integration,
  title = 'Courier Credentials',
  description,
  saveLabel = 'Save Credentials',
  onDirtyChange,
}: {
  integration: IntegrationState
  title?: string
  description?: string
  saveLabel?: string
  onDirtyChange?: (dirty: boolean) => void
}) {
  /** Only what the merchant has typed. An absent key means "leave unchanged". */
  const [values, setValues] = useState<Record<string, string>>({})
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})

  const save = useUpdateIntegrationCredentials()

  const setValue = (kind: string, value: string) => {
    const next = { ...values, [kind]: value }
    setValues(next)
    onDirtyChange?.(Object.values(next).some((entry) => entry.trim().length > 0))
  }

  const dirty = Object.values(values).some((value) => value.trim().length > 0)

  const submit = async () => {
    // Blank entries are dropped rather than sent: the server ignores them, and
    // sending them would make an untouched field indistinguishable from a
    // deliberate one in the request.
    const filled = Object.fromEntries(
      Object.entries(values).filter(([, value]) => value.trim().length > 0),
    )

    if (Object.keys(filled).length === 0) return

    try {
      await save.mutateAsync({ provider: integration.id, values: filled })
      /*
       * Cleared only on SUCCESS. A failed save keeps every entered value — the
       * merchant cannot read these back from anywhere, so wiping the form on
       * failure would mean re-fetching the credentials from the courier's own
       * panel to try again.
       */
      setValues({})
      setRevealed({})
      onDirtyChange?.(false)
      toast({ title: 'Credentials saved' })
    } catch (error) {
      toast({
        title: 'Could not save the credentials',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      })
    }
  }

  if (integration.credentials.length === 0) return null

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{title}</span>
        {description && (
          <span className="text-xs text-muted-foreground">{description}</span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {integration.credentials.map((credential) => {
          const inputId = `credential-${integration.id}-${credential.kind}`
          const isRevealed = revealed[credential.kind] === true

          return (
            <div key={credential.kind} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor={inputId}>{credential.label}</Label>
                {/*
                  * The hint is the only trace of the stored value that exists.
                  * Four characters is enough to tell "the key I pasted last
                  * week" from "the one before it", which is the entire question
                  * a merchant has here.
                  */}
                {credential.present && credential.hint && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {credential.hint}
                  </span>
                )}
              </div>

              <div className="relative">
                <Input
                  id={inputId}
                  // A stored secret is never populated back into the field.
                  // Typing replaces it; leaving it empty keeps it.
                  value={values[credential.kind] ?? ''}
                  onChange={(event) => setValue(credential.kind, event.target.value)}
                  type={credential.secret && !isRevealed ? 'password' : 'text'}
                  placeholder={
                    credential.present
                      ? 'Stored — type to replace'
                      : (credential.placeholder ?? `Paste ${credential.label}`)
                  }
                  autoComplete="off"
                  className={credential.secret ? 'pr-9' : undefined}
                />

                {/*
                  * Reveals only what the merchant is CURRENTLY TYPING — there is
                  * nothing stored to reveal. It exists so a long pasted key can
                  * be checked for a stray space before saving, which is the
                  * commonest cause of a credential that looks right and 401s.
                  */}
                {credential.secret && (
                  <button
                    type="button"
                    onClick={() =>
                      setRevealed((prev) => ({
                        ...prev,
                        [credential.kind]: !prev[credential.kind],
                      }))
                    }
                    className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
                    aria-label={isRevealed ? 'Hide what you typed' : 'Show what you typed'}
                  >
                    {isRevealed ? (
                      <EyeOff className="size-4" aria-hidden />
                    ) : (
                      <Eye className="size-4" aria-hidden />
                    )}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex justify-end">
        <Button onClick={() => void submit()} disabled={!dirty || save.isPending}>
          {save.isPending ? 'Saving…' : saveLabel}
        </Button>
      </div>
    </div>
  )
}

/**
 * The webhook block: the callback URL to paste into the courier's own panel, and
 * the button that generates the secret guarding it.
 *
 * THE MERCHANT DOES NOT CHOOSE THE SECRET. The server generates 32 random bytes,
 * because a merchant-chosen webhook secret is a merchant-chosen password with
 * the failure mode that implies. It is shown exactly ONCE, on the response to
 * the generate action, and is unreadable afterwards — so this component holds it
 * in state until the merchant navigates away, and says so plainly rather than
 * letting them discover it by coming back for it.
 *
 * REGENERATING IS DESTRUCTIVE AND IS LABELLED AS SUCH. The previous secret stops
 * working immediately, so every notification is dropped until the new one is
 * pasted into the courier's panel. The scheduled reconciliation sync catches the
 * statuses up, which is exactly the safety net it exists for — but a merchant
 * who regenerates casually and closes the tab has a shop that looks fine and is
 * silently not receiving delivery updates.
 */
import { useState } from 'react'
import { AlertTriangle, Check, Copy, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'
import { useGenerateWebhookSecret, type IntegrationState } from '@/lib/api/integrations'

/** Copy-to-clipboard with the confirmation that makes it feel like it worked. */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be refused (insecure origin, permissions). The
      // value is selectable in the field either way, so this is not worth an
      // error dialog — but silence would read as a dead button.
      toast({
        title: 'Could not copy automatically',
        description: 'Select the value and copy it by hand.',
      })
    }
  }

  return (
    <Button type="button" variant="outline" onClick={() => void copy()} aria-label={label}>
      {copied ? (
        <>
          <Check className="size-4" aria-hidden /> Copied
        </>
      ) : (
        <>
          <Copy className="size-4" aria-hidden /> Copy
        </>
      )}
    </Button>
  )
}

export function WebhookForm({ integration }: { integration: IntegrationState }) {
  /** The generated secret, held only until this component unmounts. */
  const [secret, setSecret] = useState<string | null>(null)
  const generate = useGenerateWebhookSecret()

  if (!integration.webhook) return null

  const { webhook } = integration

  const run = async () => {
    try {
      const result = await generate.mutateAsync(integration.id)
      setSecret(result.secret)
      toast({
        title: 'Webhook secret generated',
        description: 'Copy it now — it cannot be shown again.',
      })
    } catch (error) {
      toast({
        title: 'Could not generate the webhook secret',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">Webhook Settings</span>
        <span className="text-xs text-muted-foreground">
          Delivery statuses arrive here the moment they change. Without a webhook,
          dispatch still works and statuses refresh on the scheduled sync instead.
        </span>
      </div>

      <div className="flex flex-col gap-1.5 rounded-md bg-muted/50 p-3">
        <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <Info className="size-3.5" aria-hidden /> Quick Setup
        </span>
        <ul className="ml-5 list-disc text-xs text-muted-foreground">
          {webhook.instructions.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`webhook-url-${integration.id}`}>Callback URL</Label>
        {webhook.callbackUrl ? (
          <div className="flex gap-2">
            <Input
              id={`webhook-url-${integration.id}`}
              value={webhook.callbackUrl}
              readOnly
              className="font-mono text-xs"
              onFocus={(event) => event.currentTarget.select()}
            />
            <CopyButton value={webhook.callbackUrl} label="Copy the callback URL" />
          </div>
        ) : (
          /*
            * No URL until a secret exists, because generating one is what mints
            * the unguessable id the URL carries. Showing a placeholder URL that
            * does not work yet would be worse than showing none.
            */
          <p className="text-xs text-muted-foreground">
            Generate a secret below to create this shop&rsquo;s callback URL.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`webhook-secret-${integration.id}`}>
          {webhook.label} (auto generated)
        </Label>
        <div className="flex gap-2">
          <Input
            id={`webhook-secret-${integration.id}`}
            value={secret ?? ''}
            readOnly
            className="font-mono text-xs"
            placeholder={
              webhook.configured
                ? 'A secret is stored — generate a new one to replace it'
                : 'Click Generate to create the secret'
            }
            onFocus={(event) => event.currentTarget.select()}
          />
          {secret && <CopyButton value={secret} label={`Copy the ${webhook.label}`} />}
          <Button
            type="button"
            variant={webhook.configured ? 'outline' : 'default'}
            onClick={() => void run()}
            disabled={generate.isPending}
          >
            {generate.isPending ? 'Generating…' : webhook.configured ? 'Regenerate' : 'Generate'}
          </Button>
        </div>
      </div>

      {secret && (
        <p className="flex items-start gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            Copy this into {integration.displayName} now. It is shown once and cannot
            be retrieved — losing it means generating another and updating their
            panel again.
          </span>
        </p>
      )}

      {/*
        * Stated BEFORE the button is pressed, not after. A merchant who reads
        * this understands why their statuses stopped; one who meets it only as a
        * consequence has to work that out from parcels appearing stuck.
        */}
      {webhook.configured && !secret && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            Regenerating invalidates the current secret immediately. Delivery
            notifications stop arriving until the new one is saved in{' '}
            {integration.displayName}&rsquo;s panel — the scheduled sync will catch
            up whatever is missed in the meantime.
          </span>
        </p>
      )}
    </div>
  )
}

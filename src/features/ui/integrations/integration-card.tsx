/**
 * The shell every integration card shares: an avatar, a name, a description and
 * an enable toggle, with the integration's own controls inside.
 *
 * WHAT IS SHARED IS THE FRAME, NOT THE FORM. The controls differ completely
 * between a courier and a tracking pixel, so this component takes children
 * rather than growing props for each. What it does own is the one thing that
 * must behave identically everywhere: the enable toggle, which writes
 * immediately rather than waiting for a Save — a merchant switching an
 * integration off is usually switching it off because something is wrong, and
 * making them find a Save button first is the wrong moment to add a step.
 *
 * Each card owns its own Save for its own fields. That is deliberate and is why
 * this is not `useSettingsDraft` + one `EditorActions` bar: saving the pixel must
 * not touch courier credentials, and per-card save falls out naturally when each
 * card owns its own mutation. See design.md Decision 11.
 */
import type { ReactNode } from 'react'
import { AlertTriangle, KeyRound } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'
import { useSetIntegrationEnabled, type IntegrationState } from '@/lib/api/integrations'

/** A coloured initial, standing in for a logo we do not ship. */
function IntegrationAvatar({ name, tone }: { name: string; tone: string }) {
  return (
    <span
      className={`flex size-10 shrink-0 items-center justify-center rounded-full text-base font-semibold text-white ${tone}`}
      aria-hidden
    >
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

/** Per-integration accent, so the cards are distinguishable at a glance. */
const TONES: Record<string, string> = {
  STEADFAST: 'bg-blue-600',
  MANUAL: 'bg-slate-500',
  FACEBOOK_PIXEL: 'bg-blue-600',
  FACEBOOK_CAPI: 'bg-indigo-600',
}

export function IntegrationCard({
  integration,
  children,
  /** Hidden for integrations that are a statement of fact rather than a connection. */
  toggleable = true,
}: {
  integration: IntegrationState
  children?: ReactNode
  toggleable?: boolean
}) {
  const setEnabled = useSetIntegrationEnabled()

  const toggle = async (enabled: boolean) => {
    try {
      await setEnabled.mutateAsync({ provider: integration.id, enabled })
      toast({
        title: enabled
          ? `${integration.displayName} enabled`
          : `${integration.displayName} disabled`,
      })
    } catch (error) {
      /*
       * The server's message, not a generic one. A refusal here can carry a
       * reason the merchant must act on, and replacing it with "could not save"
       * throws that away.
       */
      toast({
        title: `Could not change ${integration.displayName}`,
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      })
    }
  }

  const toggleId = `integration-${integration.id}-enabled`

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <IntegrationAvatar
            name={integration.displayName}
            tone={TONES[integration.id] ?? 'bg-slate-500'}
          />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-semibold text-foreground">
              {integration.displayName}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {integration.description}
            </span>
          </div>
        </div>

        {toggleable && (
          <div className="flex shrink-0 items-center gap-2">
            {/* Labelled for screen readers: a bare switch beside a name reads as
                an unlabelled control, and this one turns off a shop's dispatch. */}
            <Label htmlFor={toggleId} className="sr-only">
              Enable {integration.displayName}
            </Label>
            <Switch
              id={toggleId}
              checked={integration.enabled}
              disabled={setEnabled.isPending}
              onCheckedChange={(checked) => void toggle(checked)}
            />
          </div>
        )}
      </div>

      {/*
        * An unreadable credential is called out ABOVE the form, because the form
        * is not where it gets fixed. Re-entering a credential under a broken
        * encryption key just produces another unreadable row, so the message has
        * to point at the server instead — the one case where "type it in again"
        * is exactly the wrong advice.
        */}
      {!integration.readable && (
        <p className="flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            <span className="sr-only">Warning: </span>
            Stored credentials for this integration cannot be read. The server&rsquo;s
            encryption key does not match the stored data — restoring the correct
            key recovers them. Re-entering them now would not help.
          </span>
        </p>
      )}

      {!integration.enabled && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <KeyRound className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            Switched off. Stored credentials are kept, so switching it back on
            needs no re-entry.
          </span>
        </p>
      )}

      {children}
    </Card>
  )
}

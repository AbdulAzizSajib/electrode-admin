/**
 * The Meta Pixel and Conversions API cards.
 *
 * ONE FEATURE, TWO STORES, AND THE SPLIT IS VISIBLE HERE. The pixel id and the
 * CAPI flags are public configuration and go to `PATCH /settings`; the CAPI
 * access token is a secret and goes to `PUT /integrations/FACEBOOK_CAPI/
 * credentials`. That looks inconsistent in one component and is deliberate: a
 * pixel id is published to every visitor by the act of using it, while an access
 * token can post events as the merchant's business. See the backend's
 * `StoreSetting.integrationConfig` comment.
 *
 * BOTH HALVES OF `integrationConfig` ARE SENT TOGETHER on every save, because a
 * present value replaces the whole column. Sending only the pixel would blank
 * the CAPI settings and vice versa — the same partial-PATCH discipline the other
 * settings editors follow, except that here one page owns both halves, so it can
 * simply always send both.
 */
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/use-toast'
import { CredentialForm } from './credential-form'
import { IntegrationCard } from './integration-card'
import type { IntegrationState } from '@/lib/api/integrations'
import {
  DEFAULT_INTEGRATION_CONFIG,
  useStoreSettings,
  useUpdateStoreSettings,
  type IntegrationConfig,
} from '@/lib/api/store-settings'

/**
 * The stored config, repaired against the defaults per key.
 *
 * Seeded from `DEFAULT_INTEGRATION_CONFIG` rather than `{}` so that a shop which
 * has never opened this page renders both features as explicitly OFF — and so a
 * blob written before a key existed does not surface that key as `undefined`,
 * which is falsy and would read as "disabled" for a feature the merchant turned
 * on.
 */
const resolveConfig = (stored: IntegrationConfig | null | undefined) => ({
  facebookPixel: {
    ...DEFAULT_INTEGRATION_CONFIG.facebookPixel,
    ...(stored?.facebookPixel ?? {}),
  },
  facebookCapi: {
    ...DEFAULT_INTEGRATION_CONFIG.facebookCapi,
    ...(stored?.facebookCapi ?? {}),
  },
})

export function FacebookPixelCard({
  integration,
  onDirtyChange,
}: {
  integration: IntegrationState
  onDirtyChange?: (dirty: boolean) => void
}) {
  const { data: settings } = useStoreSettings()
  const update = useUpdateStoreSettings()

  const saved = resolveConfig(settings?.integrationConfig)
  const [pixelId, setPixelId] = useState<string | null>(null)

  const value = pixelId ?? saved.facebookPixel.pixelId
  const dirty = pixelId !== null && pixelId !== saved.facebookPixel.pixelId

  const save = async () => {
    try {
      await update.mutateAsync({
        // BOTH halves — a present integrationConfig replaces the column.
        integrationConfig: {
          ...saved,
          facebookPixel: { ...saved.facebookPixel, pixelId: value },
        },
      })
      setPixelId(null)
      onDirtyChange?.(false)
      toast({ title: 'Pixel settings saved' })
    } catch (error) {
      /*
       * The server's message names the expected format ("digits only"), which is
       * the one thing that lets a merchant fix a pasted pixel URL. A generic
       * failure would send them back to Meta to look for a problem that is in
       * what they pasted.
       */
      toast({
        title: 'Could not save the Pixel settings',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      })
    }
  }

  return (
    <IntegrationCard integration={integration}>
      <div className="flex flex-col gap-3 rounded-md border border-border p-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="facebook-pixel-id">Pixel ID</Label>
          <Input
            id="facebook-pixel-id"
            value={value}
            onChange={(event) => {
              setPixelId(event.target.value)
              onDirtyChange?.(event.target.value !== saved.facebookPixel.pixelId)
            }}
            placeholder="1247199439643328"
            inputMode="numeric"
            autoComplete="off"
          />
          <span className="text-xs text-muted-foreground">
            Digits only — the number from Meta Events Manager, not the full script.
            A campaign landing page with its own pixel keeps using that one instead.
          </span>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => void save()} disabled={!dirty || update.isPending}>
            {update.isPending ? 'Saving…' : 'Save Pixel Settings'}
          </Button>
        </div>
      </div>
    </IntegrationCard>
  )
}

export function FacebookCapiCard({
  integration,
  onDirtyChange,
}: {
  integration: IntegrationState
  onDirtyChange?: (dirty: boolean) => void
}) {
  const { data: settings } = useStoreSettings()
  const update = useUpdateStoreSettings()

  const saved = resolveConfig(settings?.integrationConfig)
  const [draft, setDraft] = useState<{ testMode: boolean; testEventCode: string } | null>(null)

  const value = draft ?? {
    testMode: saved.facebookCapi.testMode,
    testEventCode: saved.facebookCapi.testEventCode,
  }

  const dirty =
    draft !== null &&
    (draft.testMode !== saved.facebookCapi.testMode ||
      draft.testEventCode !== saved.facebookCapi.testEventCode)

  const edit = (next: Partial<typeof value>) => {
    const merged = { ...value, ...next }
    setDraft(merged)
    onDirtyChange?.(
      merged.testMode !== saved.facebookCapi.testMode ||
        merged.testEventCode !== saved.facebookCapi.testEventCode,
    )
  }

  const save = async () => {
    try {
      await update.mutateAsync({
        integrationConfig: {
          ...saved,
          facebookCapi: { ...saved.facebookCapi, ...value },
        },
      })
      setDraft(null)
      onDirtyChange?.(false)
      toast({ title: 'Conversions API settings saved' })
    } catch (error) {
      /*
       * Carries the server's refusal when test mode is on without a code — the
       * silent failure this whole rule exists for, since Meta accepts those
       * events and routes them where nobody is looking.
       */
      toast({
        title: 'Could not save the Conversions API settings',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      })
    }
  }

  return (
    <IntegrationCard integration={integration}>
      <div className="flex flex-col gap-3 rounded-md border border-border p-3">
        <div className="flex items-center gap-2">
          <Switch
            id="capi-test-mode"
            checked={value.testMode}
            onCheckedChange={(checked) => edit({ testMode: checked })}
          />
          <Label htmlFor="capi-test-mode">Enable Test Mode</Label>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="capi-test-event-code">
            Test Event Code {value.testMode && <span aria-hidden>*</span>}
            <span className="sr-only">{value.testMode ? '(required)' : '(optional)'}</span>
          </Label>
          <Input
            id="capi-test-event-code"
            value={value.testEventCode}
            onChange={(event) => edit({ testEventCode: event.target.value })}
            placeholder="TEST12345"
            autoComplete="off"
          />
          <span className="text-xs text-muted-foreground">
            {value.testMode
              ? 'Required while test mode is on. Events go to Meta’s test stream and are counted nowhere until you switch it off.'
              : 'Only used while test mode is on. Real conversions are reported normally.'}
          </span>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => void save()} disabled={!dirty || update.isPending}>
            {update.isPending ? 'Saving…' : 'Save CAPI Settings'}
          </Button>
        </div>
      </div>

      {/*
        * The access token is a SECRET and takes the credential path, not the
        * settings path above. Same card, two endpoints — see this file's header.
        */}
      <CredentialForm
        integration={integration}
        title="Access Token"
        description="Generated in Meta Events Manager. Stored encrypted and never shown again."
        saveLabel="Save Access Token"
        onDirtyChange={onDirtyChange}
      />
    </IntegrationCard>
  )
}

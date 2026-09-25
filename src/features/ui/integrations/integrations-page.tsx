/**
 * UI → Integrations. Everything this shop connects to, on one page.
 *
 * Replaces the former "Courier Setting", which was named after one integration
 * and was the only place in the panel where an integration could be configured
 * at all. The rename is the visible half; the half that matters is that
 * "Integrations" is now TRUE — a merchant can connect a courier account and a
 * tracking pixel here, without a developer, a `.env` edit or a redeploy.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EACH CARD SAVES ITSELF. There is no page-wide Save bar, and deliberately not
 * the `useSettingsDraft` + `EditorActions` pattern the other UI screens use:
 * that pattern is for ONE settings block with one Save, and these are unrelated
 * integrations whose fields must not travel together. Saving the pixel must not
 * touch courier credentials, and per-card save makes that structural rather than
 * something to remember.
 *
 * The credential forms are generated from what the server declares, so adding an
 * integration is a server change and a card assignment here — not a new form.
 * See server/openspec/changes/rename-courier-setting-to-integrations, design.md
 * Decisions 4 and 11.
 */
import { useState } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { useIntegrations, INTEGRATION_IDS } from '@/lib/api/integrations'
import { useUnsavedChangesGuard } from '@/features/ui/components/settings-editor-utils'
import { UnsavedChangesDialog } from '@/features/ui/components/settings-editor'
import { CourierSelectionCard } from './courier-selection-card'
import { CredentialForm } from './credential-form'
import { FacebookCapiCard, FacebookPixelCard } from './facebook-cards'
import { IntegrationCard } from './integration-card'
import { TelegramCard } from './telegram-card'
import { WebhookForm } from './webhook-form'

const TITLE = 'Integrations'
const DESCRIPTION = 'Manage courier and third-party integrations.'

export default function IntegrationsPage() {
  const { data: integrations, isLoading, error } = useIntegrations()

  /*
   * One dirty flag for the whole page, keyed by card.
   *
   * A page-wide boolean would be wrong in both directions: cleared by whichever
   * card saved first while another still holds edits, or stuck dirty after a
   * card that set it unmounted. Keyed, the guard asks "is ANY card dirty", which
   * is the actual question.
   */
  const [dirtyCards, setDirtyCards] = useState<Record<string, boolean>>({})

  const markDirty = (card: string) => (dirty: boolean) =>
    setDirtyCards((prev) => (prev[card] === dirty ? prev : { ...prev, [card]: dirty }))

  const blocker = useUnsavedChangesGuard(Object.values(dirtyCards).some(Boolean))

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  /*
   * A failed load is said, not rendered around. Rendering an empty page would
   * claim this shop has no integrations available, which is never true and would
   * send a merchant looking for a feature that is simply not loading.
   */
  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : 'Could not load the integrations.'}
        </p>
      </div>
    )
  }

  const byId = new Map((integrations ?? []).map((entry) => [entry.id, entry]))

  const steadfast = byId.get(INTEGRATION_IDS.STEADFAST)
  const pixel = byId.get(INTEGRATION_IDS.FACEBOOK_PIXEL)
  const capi = byId.get(INTEGRATION_IDS.FACEBOOK_CAPI)
  const telegram = byId.get(INTEGRATION_IDS.TELEGRAM)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={TITLE} description={DESCRIPTION} />

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-muted-foreground">Delivery</h2>

        {/*
          * The courier SELECTION sits above the courier's credentials, because
          * choosing who delivers is the decision; the keys are what makes the
          * choice work. MANUAL has no card of its own — it is an option in this
          * list, not a service to connect.
          */}
        <CourierSelectionCard onDirtyChange={markDirty('courier-selection')} />

        {steadfast && (
          <IntegrationCard integration={steadfast}>
            <CredentialForm
              integration={steadfast}
              description="Found in Steadfast's merchant portal under API settings."
              saveLabel="Save Courier Credentials"
              onDirtyChange={markDirty('steadfast-credentials')}
            />
            <WebhookForm integration={steadfast} />
          </IntegrationCard>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-muted-foreground">Marketing</h2>

        {pixel && (
          <FacebookPixelCard integration={pixel} onDirtyChange={markDirty('facebook-pixel')} />
        )}
        {capi && <FacebookCapiCard integration={capi} onDirtyChange={markDirty('facebook-capi')} />}
      </section>

      {/*
        * Its own section rather than a third card under Marketing. These
        * categories are how a merchant finds a thing again, and someone looking
        * for "where do I turn off the order alerts" would not look beside the
        * Facebook pixel. The heading matches the server's `NOTIFICATION`
        * category so the two cannot drift.
        */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-muted-foreground">Notifications</h2>

        {telegram && (
          <TelegramCard integration={telegram} onDirtyChange={markDirty('telegram')} />
        )}
      </section>

      <UnsavedChangesDialog blocker={blocker} />
    </div>
  )
}

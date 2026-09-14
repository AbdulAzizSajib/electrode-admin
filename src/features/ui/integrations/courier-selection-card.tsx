/**
 * Which courier this shop dispatches through.
 *
 * MOVED FROM `courier-settings-page.tsx`, NOT REWRITTEN. The radio list, the
 * `Current` badge, the capability badges, the configuration notes and the
 * in-flight refusal message all behave exactly as they did — every one of them
 * exists for a reason recorded in `add-courier-provider-selection`, and a rename
 * is no occasion to relitigate them. What changed is where it lives and that it
 * saves on its own button rather than a page-wide bar.
 *
 * Two things this card still deliberately does NOT do:
 *
 *  - **It does not decide what a provider can do.** Capabilities come from
 *    `/courier/config`, because the answer depends on which adapter is
 *    registered on the server — a fact the browser bundle cannot know and would
 *    only get wrong after the next deploy.
 *  - **It does not decide whether a provider is ready.** Same endpoint, same
 *    reasoning; credentials now live in the database rather than the server's
 *    environment, but they are still never sent to the browser.
 */
import { AlertTriangle, Check, Truck, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { useCourierConfig, type CourierProviderInfo } from '@/lib/api/courier'
import {
  useStoreSettings,
  useUpdateStoreSettings,
  type CourierProvider,
} from '@/lib/api/store-settings'
import { useState } from 'react'

/** One capability, and what it means for the merchant rather than the code. */
const CAPABILITY_LABELS: { key: keyof CourierProviderInfo['capabilities']; label: string }[] = [
  { key: 'dispatch', label: 'Send orders' },
  { key: 'status', label: 'Track delivery' },
  { key: 'webhook', label: 'Live updates' },
  { key: 'balance', label: 'Account balance' },
  { key: 'returns', label: 'Return requests' },
]

/**
 * What this courier can and cannot do.
 *
 * Three separate carriers for one distinction, because each fails a different
 * reader: the icon and the tint go to whoever is scanning, and the
 * visually-hidden word goes to whoever is listening. Strikethrough alone said
 * it in CSS, which is exactly the channel a screen reader does not receive —
 * "Send orders" and "Send orders" read identically whether or not the courier
 * can do it, and this is the list a merchant picks a courier from.
 */
function CapabilityList({ provider }: { provider: CourierProviderInfo }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CAPABILITY_LABELS.map(({ key, label }) => {
        const supported = provider.capabilities[key]
        return (
          <Badge
            key={key}
            variant={supported ? 'secondary' : 'outline'}
            className={supported ? '' : 'text-muted-foreground'}
          >
            {supported ? (
              <Check className="size-3 text-success" aria-hidden />
            ) : (
              <X className="size-3" aria-hidden />
            )}
            {label}
            <span className="sr-only">{supported ? ' supported' : ' not supported'}</span>
          </Badge>
        )
      })}
    </div>
  )
}

/**
 * Whether this provider is usable, said before the merchant selects it.
 *
 * Discovering a missing credential at dispatch time — on a selection of packed
 * parcels — is the most expensive moment to discover it.
 *
 * A provider that needs no credentials is not "unconfigured": MANUAL reports
 * itself configured because there is nothing to configure, and saying otherwise
 * would show a working setup as broken.
 */
function ConfigurationNote({ id, provider }: { id: string; provider: CourierProviderInfo }) {
  /*
   * Checked before everything else. A switched-off courier cannot be selected at
   * all, so its credential state is beside the point — leading with "not
   * configured" would send a merchant to add keys that are already there.
   */
  if (!provider.enabled) {
    return (
      <p id={id} className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          Switched off below. Turn it back on to dispatch through it — its stored
          credentials are unaffected.
        </span>
      </p>
    )
  }

  if (!provider.capabilities.dispatch) {
    return (
      <p id={id} className="text-xs text-muted-foreground">
        Orders are handed over by hand. Record each shipment on its order.
      </p>
    )
  }

  if (!provider.credentialsConfigured) {
    return (
      <p id={id} className="flex items-start gap-1.5 text-xs text-destructive">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          <span className="sr-only">Warning: </span>
          Its API credentials are not set, so dispatch will be refused. Add them on
          this page before selecting this courier.
        </span>
      </p>
    )
  }

  if (provider.capabilities.webhook && !provider.webhookConfigured) {
    return (
      <p id={id} className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          Credentials are set, but no webhook secret is configured. Dispatch works;
          delivery statuses will only refresh on the scheduled sync rather than the
          moment they change.
        </span>
      </p>
    )
  }

  return (
    <p id={id} className="text-xs text-muted-foreground">
      Configured and ready to dispatch.
    </p>
  )
}

export function CourierSelectionCard({
  onDirtyChange,
}: {
  onDirtyChange?: (dirty: boolean) => void
}) {
  const { data: settings, isLoading, error } = useStoreSettings()
  const { data: config, isLoading: configLoading, error: configError } = useCourierConfig()
  const updateSettings = useUpdateStoreSettings()

  /** The merchant's pending choice. Null means "showing what the server has". */
  const [selected, setSelected] = useState<CourierProvider | null>(null)

  const stored = settings?.courierProvider ?? 'STEADFAST'
  const value = selected ?? stored
  const dirty = selected !== null && selected !== stored

  const choose = (next: CourierProvider) => {
    setSelected(next)
    onDirtyChange?.(next !== stored)
  }

  const save = async () => {
    try {
      await updateSettings.mutateAsync({ courierProvider: value })
      setSelected(null)
      onDirtyChange?.(false)
      toast({ title: 'Courier updated' })
    } catch (err) {
      /*
       * The message matters here more than usual. A refused switch says how many
       * consignments are still in transit, which is what tells the merchant when
       * to try again — a generic "could not save" would throw that away.
       */
      toast({
        title: 'Could not change the courier',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  if (isLoading || configLoading) {
    return <Skeleton className="h-64 w-full" />
  }

  /*
   * A failed load is said, not rendered around.
   *
   * Both queries resolve to undefined on failure, which without this branch left
   * the page drawing an empty courier card over a live Save button — a card that
   * claims this shop has no couriers to choose from, which is a different and
   * wrong statement.
   */
  if (error || configError) {
    const failure = error ?? configError
    return (
      <Card className="p-4">
        <p className="text-sm text-destructive">
          {failure instanceof Error ? failure.message : 'Could not load the courier settings.'}
        </p>
      </Card>
    )
  }

  const providers = config?.providers ?? []
  /*
   * The courier the SERVER is on, which is not the same as the one the radio
   * shows. Once someone changes the selection, the ring has moved to their
   * intent and nothing marks what orders are still dispatching through — the
   * one fact they need when the save is about to be refused for parcels in
   * transit.
   */
  const activeProvider = config?.configured

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-0.5">
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          <Truck className="size-4" aria-hidden /> Courier service
        </span>
        <span className="text-xs text-muted-foreground">
          Orders you dispatch go to the courier selected here. Parcels already on their
          way stay with the courier carrying them, whatever you choose now.
        </span>
      </div>

      {/*
        * A server that reports no providers at all is a deployment fault, not an
        * empty list to render a bare card around. Saying so beats an
        * apparently-working page with nothing in it, which reads as "this shop
        * has no couriers" — something that is never true.
        */}
      {providers.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          The server reported no courier integrations. Check that the courier providers
          are registered on the server before dispatching orders.
        </p>
      ) : (
        <RadioGroup
          value={value}
          onValueChange={(next) => choose(next as CourierProvider)}
          className="flex flex-col gap-2"
        >
          {providers.map((provider) => {
            const noteId = `courier-${provider.id}-note`
            const isActive = provider.id === activeProvider
            /*
             * A disabled courier cannot be chosen — the server refuses a
             * dispatch through one, so offering it here would only produce a
             * save that works followed by dispatches that do not.
             *
             * The exception is the one currently selected: it stays selectable
             * so the radio can still show what the shop is actually set to.
             * (The server separately refuses switching THAT one off, so this
             * state is reachable only by editing the database by hand.)
             */
            const selectable = provider.enabled || provider.id === stored
            return (
              <Label
                key={provider.id}
                htmlFor={`courier-${provider.id}`}
                className={`flex items-start gap-3 rounded-md border p-3 transition-colors ${
                  selectable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                } ${
                  value === provider.id
                    ? 'border-primary bg-accent/40'
                    : 'border-border hover:border-input hover:bg-accent/20'
                }`}
              >
                <RadioGroupItem
                  id={`courier-${provider.id}`}
                  value={provider.id}
                  disabled={!selectable}
                  className="mt-1"
                  aria-describedby={noteId}
                />
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{provider.displayName}</span>
                    {/* Marks the server's answer, so it survives changing the selection. */}
                    {isActive && <Badge variant="secondary">Current</Badge>}
                  </span>
                  <CapabilityList provider={provider} />
                  <ConfigurationNote id={noteId} provider={provider} />
                </div>
              </Label>
            )
          })}
        </RadioGroup>
      )}

      {/*
        * Stated up front rather than only on the refusal. A merchant who reads
        * this before selecting understands why the save was refused; one who only
        * meets it as an error has to work that out from the message.
        */}
      <p className="text-xs text-muted-foreground">
        You cannot change courier while parcels are still in transit with the current
        one. Wait for them to be delivered or cancelled — the save will tell you how
        many are left.
      </p>

      <div className="flex justify-end">
        <Button onClick={() => void save()} disabled={!dirty || updateSettings.isPending}>
          {updateSettings.isPending ? 'Saving…' : 'Save Courier'}
        </Button>
      </div>
    </Card>
  )
}

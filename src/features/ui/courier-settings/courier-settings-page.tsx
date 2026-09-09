import { AlertTriangle, Check, Truck, X } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { EditorActions, UnsavedChangesDialog } from '@/features/ui/components/settings-editor'
import {
  useSettingsDraft,
  useUnsavedChangesGuard,
} from '@/features/ui/components/settings-editor-utils'
import { useCourierConfig, type CourierProviderInfo } from '@/lib/api/courier'
import {
  useStoreSettings,
  useUpdateStoreSettings,
  DEFAULT_COURIER_SETTINGS,
  type CourierProvider,
} from '@/lib/api/store-settings'

/**
 * Which courier the shop dispatches through.
 *
 * Writes ONLY `courierProvider`. `PATCH /settings` is a partial upsert, so this
 * page coexists with the other settings editors exactly as they coexist with
 * each other — by sending a disjoint set of keys. Sending a superset from here
 * would clobber whichever editor owns the extra fields.
 *
 * Two things this page deliberately does NOT do:
 *
 *  - **It does not collect credentials.** Those live in the server's
 *    environment, because `GET /settings` is public and a secret on that row is
 *    one careless field selection away from being served to the internet. What
 *    the page shows instead is whether each provider's credentials are PRESENT,
 *    which the server reports as a boolean and never as a value.
 *  - **It does not decide what a provider can do.** Capabilities come from
 *    `/courier/config`, because the answer depends on which adapter is
 *    registered on the server — a fact the browser bundle cannot know and would
 *    only get wrong after the next deploy.
 *
 * See openspec/changes/add-courier-provider-selection.
 */

const TITLE = 'Courier'
const DESCRIPTION =
  'Which courier service this shop dispatches orders through. Orders are dispatched from the Orders list; this page decides who receives them.'

/** One capability, and what it means for the merchant rather than the code. */
const CAPABILITY_LABELS: { key: keyof CourierProviderInfo['capabilities']; label: string }[] = [
  { key: 'dispatch', label: 'Send orders' },
  { key: 'status', label: 'Track delivery' },
  { key: 'webhook', label: 'Live updates' },
  { key: 'balance', label: 'Account balance' },
  { key: 'returns', label: 'Return requests' },
]

function CapabilityList({ provider }: { provider: CourierProviderInfo }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CAPABILITY_LABELS.map(({ key, label }) => {
        const supported = provider.capabilities[key]
        return (
          <Badge
            key={key}
            variant={supported ? 'secondary' : 'outline'}
            className={supported ? '' : 'text-muted-foreground line-through'}
          >
            {supported ? <Check className="size-3" /> : <X className="size-3" />}
            {label}
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
function ConfigurationNote({ provider }: { provider: CourierProviderInfo }) {
  if (!provider.capabilities.dispatch) {
    return (
      <p className="text-xs text-muted-foreground">
        Orders are handed over by hand. Record each shipment on its order.
      </p>
    )
  }

  if (!provider.credentialsConfigured) {
    return (
      <p className="flex items-start gap-1.5 text-xs text-destructive">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        <span>
          API credentials are not set on the server, so dispatch will be refused. Add them to the
          server environment before selecting this courier.
        </span>
      </p>
    )
  }

  if (provider.capabilities.webhook && !provider.webhookConfigured) {
    return (
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Credentials are set, but no webhook token is configured. Dispatch works; delivery
          statuses will only refresh on the scheduled sync rather than the moment they change.
        </span>
      </p>
    )
  }

  return (
    <p className="text-xs text-muted-foreground">Configured and ready to dispatch.</p>
  )
}

export default function CourierSettingsPage() {
  const { data: settings, isLoading } = useStoreSettings()
  const { data: config, isLoading: configLoading } = useCourierConfig()
  const updateSettings = useUpdateStoreSettings()

  const draft = useSettingsDraft<{ courierProvider: CourierProvider }>(
    settings ? { courierProvider: settings.courierProvider } : undefined,
    DEFAULT_COURIER_SETTINGS,
  )

  const blocker = useUnsavedChangesGuard(draft.isDirty)

  const save = async () => {
    try {
      await updateSettings.mutateAsync({ courierProvider: draft.value.courierProvider })
      draft.markSaved(draft.value)
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
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const providers = config?.providers ?? []

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={TITLE} description={DESCRIPTION} />

      <Card className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <Truck className="size-4" /> Courier service
          </span>
          <span className="text-xs text-muted-foreground">
            Orders you dispatch go to the courier selected here. Parcels already on their way stay
            with the courier carrying them, whatever you choose now.
          </span>
        </div>

        <RadioGroup
          value={draft.value.courierProvider}
          onValueChange={(value) =>
            draft.set({ courierProvider: value as CourierProvider })
          }
          className="flex flex-col gap-2"
        >
          {providers.map((provider) => (
            <Label
              key={provider.id}
              htmlFor={`courier-${provider.id}`}
              className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${
                draft.value.courierProvider === provider.id
                  ? 'border-primary bg-accent/40'
                  : 'border-border'
              }`}
            >
              <RadioGroupItem
                id={`courier-${provider.id}`}
                value={provider.id}
                className="mt-1"
              />
              <div className="flex flex-col gap-1.5">
                <span className="font-medium text-foreground">{provider.displayName}</span>
                <CapabilityList provider={provider} />
                <ConfigurationNote provider={provider} />
              </div>
            </Label>
          ))}
        </RadioGroup>

        {/*
          * Stated up front rather than only on the refusal. A merchant who reads
          * this before selecting understands why the save was refused; one who
          * only meets it as an error has to work that out from the message.
          */}
        <p className="text-xs text-muted-foreground">
          You cannot change courier while parcels are still in transit with the current one. Wait
          for them to be delivered or cancelled — the save will tell you how many are left.
        </p>
      </Card>

      <EditorActions
        isDirty={draft.isDirty}
        isSaving={updateSettings.isPending}
        onReset={draft.reset}
        onSave={() => void save()}
      />

      <UnsavedChangesDialog blocker={blocker} />
    </div>
  )
}

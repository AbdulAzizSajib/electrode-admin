import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/use-toast'
import {
  EditorActions,
  UnsavedChangesDialog,
} from '@/features/ui/components/settings-editor'
import {
  useSettingsDraft,
  useUnsavedChangesGuard,
} from '@/features/ui/components/settings-editor-utils'
import {
  useStoreSettings,
  useUpdateStoreSettings,
  DEFAULT_CATALOG_CONFIG,
  type CatalogConfig,
} from '@/lib/api/store-settings'

/**
 * Which of the optional catalog features the website offers.
 *
 * Writes ONLY `catalogConfig`. `PATCH /settings` is a partial upsert, so this page and the other
 * settings editors are saved independently without any of them clobbering another — the same
 * disjoint-field-set arrangement Checkout Setting, Header Links and Footer Links already rely on.
 *
 * Every switch here is reversible at no cost, which is why none of them asks for confirmation: the
 * backend does not gate the wishlist or comparison APIs on these flags and never deletes what a
 * shopper has saved, so turning a feature off withdraws it from the website and nothing else.
 */

const TITLE = 'Catalog settings'
const DESCRIPTION =
  'Which extras the website offers alongside the buy button. Turn off anything your business does not use — nothing a customer has already saved is deleted, so you can turn it back on later.'

/**
 * One switch, plus what the website does when it is off.
 *
 * The consequence is body copy rather than a tooltip because it is the part a merchant cannot
 * guess — "Quick view" says nothing about where a shopper ends up once it is off — and because a
 * tooltip is unreachable on the touch devices half of them administer from.
 */
function FeatureSwitch({
  id,
  label,
  checked,
  onChange,
  children,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      <div className="flex flex-col gap-0.5">
        <Label htmlFor={id}>{label}</Label>
        <span className="text-xs text-muted-foreground">{children}</span>
      </div>
    </div>
  )
}

export default function CatalogSettingsPage() {
  const { data, isLoading, error } = useStoreSettings()
  const updateMutation = useUpdateStoreSettings()

  /*
   * An unconfigured store seeds from the same defaults the backend falls back to, so the switches
   * show what the website is actually doing rather than reading as off. `data &&` matters: until the
   * record arrives the draft has no loaded value, and `useSettingsDraft` treats it as not-yet-dirty
   * rather than as a merchant's choice.
   */
  const draft = useSettingsDraft<CatalogConfig>(
    data && (data.catalogConfig ?? DEFAULT_CATALOG_CONFIG),
    DEFAULT_CATALOG_CONFIG,
  )
  const blocker = useUnsavedChangesGuard(draft.isDirty)

  const config = draft.value
  const setConfig = (patch: Partial<CatalogConfig>) => draft.set({ ...config, ...patch })

  const handleSave = async () => {
    try {
      // One key and only one — see the note at the top of this file.
      await updateMutation.mutateAsync({ catalogConfig: config })
      draft.markSaved(config)
      toast({ title: 'Catalog settings saved' })
    } catch (err) {
      // The draft is deliberately left as it was: a merchant whose save failed
      // should not also lose the edits they were trying to make.
      toast({
        title: 'Could not save the catalog settings',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : 'Could not load the catalog settings.'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={TITLE} description={DESCRIPTION} />

      <Card className="flex flex-col gap-4 p-4">
        <FeatureSwitch
          id="show-wishlist"
          label="Wishlist"
          checked={config.showWishlist}
          onChange={(checked) => setConfig({ showWishlist: checked })}
        >
          {config.showWishlist
            ? 'Customers can save products to come back to, from the product card and the product page.'
            : 'The save-for-later heart is removed everywhere and the wishlist page is switched off. Lists customers already saved are kept.'}
        </FeatureSwitch>

        <FeatureSwitch
          id="show-compare"
          label="Compare products"
          checked={config.showCompare}
          onChange={(checked) => setConfig({ showCompare: checked })}
        >
          {config.showCompare
            ? 'Customers can put products side by side on a comparison page.'
            : 'The compare button is removed everywhere and the comparison page is switched off.'}
        </FeatureSwitch>

        <FeatureSwitch
          id="show-quick-view"
          label="Quick view"
          checked={config.showQuickView}
          onChange={(checked) => setConfig({ showQuickView: checked })}
        >
          {config.showQuickView
            ? 'A product with options opens a preview over the list, where the customer picks their option and adds to the cart without leaving the page.'
            : 'A product with options goes straight to its full product page instead of opening a preview. Products without options still add to the cart from the list.'}
        </FeatureSwitch>
      </Card>

      <EditorActions
        isDirty={draft.isDirty}
        isSaving={updateMutation.isPending}
        onReset={draft.reset}
        onSave={handleSave}
      />

      <UnsavedChangesDialog blocker={blocker} />
    </div>
  )
}

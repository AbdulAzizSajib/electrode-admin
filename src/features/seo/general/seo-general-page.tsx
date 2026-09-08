import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import {
  EditorActions,
  UnsavedChangesDialog,
} from '@/features/ui/components/settings-editor'
import { useSeoConfigDraft } from '../use-seo-config-draft'
import {
  SEO_LENGTH_LIMITS,
  useStoreSettings,
  useUpdateStoreSettings,
} from '@/lib/api/store-settings'
import * as React from 'react'

/**
 * The defaults every page falls back to, and the canonical address they are
 * resolved against.
 *
 * Writes to TWO places, which is the one wrinkle on this screen: `siteUrl`,
 * `metaTitle` and `metaDescription` are columns of their own on the settings row
 * (they predate the SEO menu and back the storefront's `metadataBase`), while
 * everything else lives in the `seoConfig` blob. Both go up in a single PATCH,
 * so a merchant still sees one Save.
 */

const TITLE = 'General'
const DESCRIPTION =
  'The title and description search engines fall back to, and the address your pages are published under. Individual products and pages can override these; anything they leave blank uses what you set here.'

/** Shows how a title or description compares to what search engines display. */
function LengthHint({ value, max }: { value: string; max: number }) {
  const length = value.trim().length
  if (length === 0) return null

  return (
    <span className={length > max ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
      {length} / {max} characters
      {length > max ? ' — search results will cut this short' : ''}
    </span>
  )
}

export default function SeoGeneralPage() {
  const { config, setConfig, isDirty, reset, isSaving, isLoading, error, blocker } =
    useSeoConfigDraft()
  const { data: settings } = useStoreSettings()
  const updateSettings = useUpdateStoreSettings()

  /*
   * The three scalar columns are drafted separately from the blob because they
   * are separate columns. Seeded once the settings row arrives; `?? ''` because
   * the admin read returns null for a column nobody has written, and a null in
   * an input is an uncontrolled-component warning.
   */
  const [scalars, setScalars] = React.useState<{
    siteUrl: string
    metaTitle: string
    metaDescription: string
  } | null>(null)

  const loadedScalars = React.useMemo(
    () => ({
      siteUrl: settings?.siteUrl ?? '',
      metaTitle: settings?.metaTitle ?? '',
      metaDescription: settings?.metaDescription ?? '',
    }),
    [settings?.siteUrl, settings?.metaTitle, settings?.metaDescription],
  )

  const values = scalars ?? loadedScalars
  const scalarsDirty =
    settings !== undefined && JSON.stringify(values) !== JSON.stringify(loadedScalars)

  const handleSave = async () => {
    try {
      /*
       * One PATCH carrying both halves. `siteUrl` is only sent when it has a
       * value: the backend validates it as a URL, so an empty string would be a
       * 400 rather than a clear. Clearing it means omitting the key, which is
       * the same partial-upsert rule every other settings screen follows.
       */
      await updateSettings.mutateAsync({
        ...(values.siteUrl.trim() ? { siteUrl: values.siteUrl.trim() } : {}),
        metaTitle: values.metaTitle,
        metaDescription: values.metaDescription,
        seoConfig: config,
      })
      setScalars(null)
      toast({ title: 'SEO settings saved' })
    } catch (err) {
      // Draft left intact — a merchant whose save failed should not also lose
      // what they were trying to save.
      toast({
        title: 'Could not save the SEO settings',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : 'Could not load the SEO settings.'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={TITLE} description={DESCRIPTION} />

      <Card className="flex flex-col gap-4 p-4">
        <h2 className="text-sm font-semibold">Site address</h2>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="site-url">Website address</Label>
          <Input
            id="site-url"
            placeholder="https://yourshop.com"
            value={values.siteUrl}
            onChange={(e) => setScalars({ ...values, siteUrl: e.target.value })}
          />
          <span className="text-xs text-muted-foreground">
            Your shop&apos;s public address, including https://. Used to build the links search
            engines and social networks follow. Until this is set, your sitemap stays empty and no
            canonical links are published.
          </span>
        </div>
      </Card>

      <Card className="flex flex-col gap-4 p-4">
        <h2 className="text-sm font-semibold">Default title and description</h2>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="meta-title">Default page title</Label>
          <Input
            id="meta-title"
            placeholder={settings?.storeName ?? 'Your shop name'}
            value={values.metaTitle}
            onChange={(e) => setScalars({ ...values, metaTitle: e.target.value })}
          />
          <LengthHint value={values.metaTitle} max={SEO_LENGTH_LIMITS.titleMax} />
          <span className="text-xs text-muted-foreground">
            Used when a page has no title of its own. Leave blank to use your shop name.
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="meta-description">Default description</Label>
          <Textarea
            id="meta-description"
            rows={3}
            value={values.metaDescription}
            onChange={(e) => setScalars({ ...values, metaDescription: e.target.value })}
          />
          <LengthHint value={values.metaDescription} max={SEO_LENGTH_LIMITS.descriptionMax} />
          <span className="text-xs text-muted-foreground">
            The sentence shown under your link in search results, for pages that do not set their
            own.
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title-template">Title format</Label>
          <Input
            id="title-template"
            placeholder="%s | My Shop"
            value={config.titleTemplate}
            onChange={(e) => setConfig({ titleTemplate: e.target.value })}
          />
          <span className="text-xs text-muted-foreground">
            How every page title is written. <code>%s</code> is replaced by the page&apos;s own
            title — so <code>%s | My Shop</code> turns &ldquo;Laptops&rdquo; into &ldquo;Laptops |
            My Shop&rdquo;. Leave blank to use page titles as they are.
          </span>
        </div>
      </Card>

      <Card className="flex flex-col gap-4 p-4">
        <h2 className="text-sm font-semibold">Link previews</h2>
        <p className="-mt-2 text-xs text-muted-foreground">
          What people see when your links are shared on social media and messaging apps.
        </p>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="og-image">Default preview image</Label>
          <Input
            id="og-image"
            placeholder="https://yourshop.com/preview.jpg"
            value={config.defaultOgImageUrl}
            onChange={(e) => setConfig({ defaultOgImageUrl: e.target.value })}
          />
          <span className="text-xs text-muted-foreground">
            Shown for pages with no image of their own. 1200×630 pixels works everywhere.
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="twitter-site">X / Twitter account</Label>
          <Input
            id="twitter-site"
            placeholder="@yourshop"
            value={config.twitterSite}
            onChange={(e) => setConfig({ twitterSite: e.target.value })}
          />
          <span className="text-xs text-muted-foreground">
            Credited on shared links. Leave blank if you do not have one.
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="twitter-card">Preview size</Label>
          <select
            id="twitter-card"
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            value={config.twitterCardType}
            onChange={(e) =>
              setConfig({
                twitterCardType: e.target.value as 'summary' | 'summary_large_image',
              })
            }
          >
            <option value="summary_large_image">Large image</option>
            <option value="summary">Small thumbnail</option>
          </select>
        </div>
      </Card>

      <EditorActions
        isDirty={isDirty || scalarsDirty}
        isSaving={isSaving || updateSettings.isPending}
        onReset={() => {
          reset()
          setScalars(null)
        }}
        onSave={handleSave}
      />

      <UnsavedChangesDialog blocker={blocker} />
    </div>
  )
}

import { AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import {
  EditorActions,
  UnsavedChangesDialog,
} from '@/features/ui/components/settings-editor'
import { useSeoConfigDraft } from '../use-seo-config-draft'
import {
  SEO_CONTENT_TYPES,
  SEO_ROUTE_GROUPS,
  type SeoContentType,
  type SeoRouteGroup,
} from '@/lib/api/store-settings'

/**
 * What search engines are allowed to index, and what goes in the sitemap.
 *
 * The route groups are a CLOSED list rather than free-form path rules. A
 * merchant can read a checklist and know what it does; a mistyped path pattern
 * silently removes a catalogue from search and gives no sign it has. Anything
 * the list cannot express goes in the custom rules box at the bottom.
 */

const TITLE = 'Indexing'
const DESCRIPTION =
  'Which parts of your shop search engines are allowed to list, and what appears in your sitemap.'

/** Merchant-facing names. The stored keys are camelCase; nobody should have to read those. */
const GROUP_LABELS: Record<SeoRouteGroup, { label: string; hint: string }> = {
  home: { label: 'Home page', hint: 'Your shop front.' },
  product: { label: 'Product pages', hint: 'Every individual product.' },
  category: { label: 'Category pages', hint: 'Product listings and category links.' },
  blog: { label: 'Blog', hint: 'Blog index and posts.' },
  page: { label: 'Content pages', hint: 'About, Terms, Refund Policy and the like.' },
  landingPage: { label: 'Landing pages', hint: 'Campaign pages you send ads to.' },
  account: { label: 'Customer accounts', hint: 'Sign in, orders, saved addresses.' },
  cart: { label: 'Cart', hint: "A shopper's own basket." },
  checkout: { label: 'Checkout', hint: 'The order form and confirmation.' },
  wishlist: { label: 'Wishlist', hint: 'Saved-for-later lists.' },
  compare: { label: 'Compare', hint: 'Side-by-side product comparison.' },
  search: { label: 'Search results', hint: 'Filtered and searched product lists.' },
}

const CONTENT_TYPE_LABELS: Record<SeoContentType, string> = {
  product: 'Products',
  category: 'Categories',
  page: 'Content pages',
  blogPost: 'Blog posts',
  landingPage: 'Landing pages',
}

/** The groups a shop normally keeps out of search, rendered as a second block. */
const PRIVATE_GROUPS: SeoRouteGroup[] = [
  'account',
  'cart',
  'checkout',
  'wishlist',
  'compare',
  'search',
]

export default function SeoIndexingPage() {
  const { config, setConfig, save, isDirty, reset, isSaving, isLoading, error, blocker } =
    useSeoConfigDraft()

  const setGroup = (group: SeoRouteGroup, index: boolean) =>
    setConfig({
      robots: {
        ...config.robots,
        groups: {
          ...config.robots.groups,
          // `follow` tracks `index` here rather than being a second switch. The
          // two come apart only in cases a shop does not have, and a second
          // column of checkboxes buys confusion rather than control.
          [group]: { index, follow: index },
        },
      },
    })

  const handleSave = async () => {
    try {
      await save()
      toast({ title: 'Indexing settings saved' })
    } catch (err) {
      toast({
        title: 'Could not save the indexing settings',
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
          {error instanceof Error ? error.message : 'Could not load the indexing settings.'}
        </p>
      </div>
    )
  }

  const noindex = config.robots.globalNoindex

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={TITLE} description={DESCRIPTION} />

      {/*
        Persistent, not a toast: this switch costs a shop all of its search
        traffic and gives no other sign it is on. A merchant who turned it on
        during a rebuild and forgot has no way to discover it from anywhere else
        in the panel.
      */}
      {noindex && (
        <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-destructive">
              Your whole shop is hidden from search engines
            </span>
            <span className="text-xs text-muted-foreground">
              No page can be found on Google or Bing, and your sitemap is empty. Turn this off when
              you are ready to be found.
            </span>
          </div>
        </div>
      )}

      <Card className="flex flex-col gap-4 p-4">
        <div className="flex items-start gap-3">
          <Switch
            id="global-noindex"
            checked={noindex}
            onCheckedChange={(checked) =>
              setConfig({ robots: { ...config.robots, globalNoindex: checked } })
            }
          />
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="global-noindex">Hide the entire shop from search engines</Label>
            <span className="text-xs text-muted-foreground">
              For a shop that is not open yet. Overrides everything below.
            </span>
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-4 p-4">
        <div>
          <h2 className="text-sm font-semibold">What can appear in search results</h2>
          <p className="text-xs text-muted-foreground">
            Turn a section off and search engines are asked to leave it out.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {SEO_ROUTE_GROUPS.filter((g) => !PRIVATE_GROUPS.includes(g)).map((group) => (
            <div key={group} className="flex items-start gap-3">
              <Switch
                id={`group-${group}`}
                disabled={noindex}
                checked={config.robots.groups[group].index}
                onCheckedChange={(checked) => setGroup(group, checked)}
              />
              <div className="flex flex-col gap-0.5">
                <Label htmlFor={`group-${group}`}>{GROUP_LABELS[group].label}</Label>
                <span className="text-xs text-muted-foreground">{GROUP_LABELS[group].hint}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-2 border-t pt-4">
          <h3 className="text-sm font-medium">Private pages</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Normally kept out of search — these hold one shopper&apos;s own information and have
            nothing useful to show a stranger.
          </p>

          <div className="flex flex-col gap-3">
            {PRIVATE_GROUPS.map((group) => (
              <div key={group} className="flex items-start gap-3">
                <Switch
                  id={`group-${group}`}
                  disabled={noindex}
                  checked={config.robots.groups[group].index}
                  onCheckedChange={(checked) => setGroup(group, checked)}
                />
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor={`group-${group}`}>{GROUP_LABELS[group].label}</Label>
                  <span className="text-xs text-muted-foreground">{GROUP_LABELS[group].hint}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-4 p-4">
        <div>
          <h2 className="text-sm font-semibold">Sitemap</h2>
          <p className="text-xs text-muted-foreground">
            The list of pages handed to search engines so they can find everything without guessing.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {SEO_CONTENT_TYPES.map((type) => (
            <div key={type} className="flex items-center gap-3">
              <Switch
                id={`sitemap-${type}`}
                disabled={noindex}
                checked={config.sitemap[type]}
                onCheckedChange={(checked) =>
                  setConfig({ sitemap: { ...config.sitemap, [type]: checked } })
                }
              />
              <Label htmlFor={`sitemap-${type}`}>{CONTENT_TYPE_LABELS[type]}</Label>
            </div>
          ))}
        </div>
      </Card>

      <Card className="flex flex-col gap-2 p-4">
        <Label htmlFor="custom-rules">Extra crawler rules</Label>
        <Textarea
          id="custom-rules"
          rows={4}
          placeholder={'/private-preview\n/tmp'}
          value={config.robots.customRules}
          onChange={(e) =>
            setConfig({ robots: { ...config.robots, customRules: e.target.value } })
          }
        />
        <span className="text-xs text-muted-foreground">
          One path per line, each added to robots.txt as a section crawlers should skip. Leave blank
          unless you have a specific address to hide.
        </span>
      </Card>

      <EditorActions
        isDirty={isDirty}
        isSaving={isSaving}
        onReset={reset}
        onSave={handleSave}
      />

      <UnsavedChangesDialog blocker={blocker} />
    </div>
  )
}

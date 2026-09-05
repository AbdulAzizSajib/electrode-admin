import * as React from 'react'
import { Globe, Rocket, TriangleAlert } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'
import {
  useStoreSettings,
  useUpdateStoreSettings,
  type SiteMode,
} from '@/lib/api/store-settings'
import { usePublishedLandingPages } from '@/lib/api/landing-pages'

/**
 * The website ↔ single-landing-page toggle, and which page is live.
 *
 * Lives HERE, at the top of the Landing Pages list, rather than on Site
 * Settings. "Website or landing page?" and "which landing page?" are one
 * decision, and splitting them across two screens is how a merchant ends up
 * with the toggle on and the wrong page live. Site Settings carries a read-only
 * line pointing here, so the setting is still discoverable where someone would
 * look for it.
 *
 * The invariants are the SERVER's, not this component's — it refuses to enter
 * landing page mode without a published selection, and refuses to unpublish or
 * delete the live page. This UI does not re-implement any of that; it disables
 * what would obviously fail and surfaces the server's own message when
 * something less obvious does. A rule enforced in two places is a rule that
 * gets enforced differently in two places.
 */
export function SiteModeBanner() {
  const settings = useStoreSettings()
  const published = usePublishedLandingPages()
  const update = useUpdateStoreSettings()

  const siteMode: SiteMode = settings.data?.siteMode ?? 'WEBSITE'
  const activeId = settings.data?.activeLandingPageId ?? null
  const options = published.data ?? []
  const activePage = options.find((page) => page.id === activeId)

  const isLive = siteMode === 'LANDING_PAGE'
  const busy = update.isPending || settings.isLoading

  const save = React.useCallback(
    async (input: { siteMode?: SiteMode; activeLandingPageId?: string | null }, success: string) => {
      try {
        await update.mutateAsync(input)
        toast({ title: success })
      } catch (error) {
        // The server's own message, verbatim: it names what to do first
        // ("Publish it before making it your site's home page"), which a
        // generic failure would throw away.
        toast({
          variant: 'destructive',
          title: 'Could not save',
          description: error instanceof Error ? error.message : 'Please try again.',
        })
      }
    },
    // `toast` is a module-level function, not a hook result — it is stable and
    // is not a dependency.
    [update],
  )

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {isLive ? (
            <Rocket className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          ) : (
            <Globe className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <div>
            <p className="font-medium text-foreground">
              {isLive ? 'Your site is a single landing page' : 'Your site is a full website'}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {isLive ? (
                <>
                  Visitors to your home page see{' '}
                  <strong className="text-foreground">{activePage?.title ?? 'the active page'}</strong>.
                  Everything else — products, cart, checkout, order tracking — still works exactly as
                  before.
                </>
              ) : (
                'Your home page shows the normal storefront. Every published landing page is still reachable at its own /lp/ address.'
              )}
            </p>
          </div>
        </div>

        <label className="flex shrink-0 items-center gap-2.5">
          <span className="text-sm text-muted-foreground">Landing page mode</span>
          <Switch
            checked={isLive}
            disabled={busy || (!isLive && !activeId)}
            onCheckedChange={(checked) =>
              save(
                { siteMode: checked ? 'LANDING_PAGE' : 'WEBSITE' },
                checked ? 'Your landing page is now live' : 'Your website is back',
              )
            }
            aria-label="Serve a landing page at the home page"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <span className="text-sm font-medium text-foreground">Active landing page</span>
        <Select
          value={activeId ?? 'none'}
          disabled={busy}
          onValueChange={(value) =>
            save(
              { activeLandingPageId: value === 'none' ? null : value },
              value === 'none' ? 'Selection cleared' : 'Active landing page updated',
            )
          }
        >
          <SelectTrigger className="h-9 w-72">
            <SelectValue placeholder="Choose a published landing page" />
          </SelectTrigger>
          <SelectContent>
            {/*
              Offered only while the toggle is off. Clearing the selection while
              a page is live is refused by the server anyway, and an option that
              always fails is worse than no option.
            */}
            {!isLive && <SelectItem value="none">No page selected</SelectItem>}
            {options.map((page) => (
              <SelectItem key={page.id} value={page.id}>
                {page.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {options.length === 0 && (
          <span className="flex items-center gap-1.5 text-sm text-amber-600">
            <TriangleAlert className="size-4" aria-hidden />
            Publish a landing page before you can make one live.
          </span>
        )}

        {activePage && (
          <a
            href={`/lp/${activePage.slug}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            /lp/{activePage.slug}
          </a>
        )}
      </div>
    </div>
  )
}

import { Plus, X } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/use-toast'
import {
  EditorActions,
  UnsavedChangesDialog,
} from '@/features/ui/components/settings-editor'
import { useSeoConfigDraft } from '../use-seo-config-draft'

/**
 * The machine-readable description of the shop that produces rich results —
 * star ratings under a product, a knowledge panel for the business.
 *
 * Every toggle is on by default: this data is derived from what the shop already
 * publishes, costs nothing to emit, and a merchant who does not know what
 * structured data is still benefits from having it.
 */

const TITLE = 'Structured data'
const DESCRIPTION =
  'Extra detail sent to search engines so they can show prices, ratings and your business details directly in the results.'

export default function SeoStructuredDataPage() {
  const { config, setConfig, save, isDirty, reset, isSaving, isLoading, error, blocker } =
    useSeoConfigDraft()

  const sd = config.structuredData
  const org = sd.organization

  const setOrg = (patch: Partial<typeof org>) =>
    setConfig({ structuredData: { ...sd, organization: { ...org, ...patch } } })

  const setSameAs = (index: number, value: string) => {
    const next = [...org.sameAs]
    next[index] = value
    setOrg({ sameAs: next })
  }

  const handleSave = async () => {
    try {
      // Blank rows dropped on save rather than while typing — removing a row the
      // moment its box is cleared would yank the field out from under someone
      // who is midway through replacing a URL.
      await save({
        ...config,
        structuredData: {
          ...sd,
          organization: { ...org, sameAs: org.sameAs.filter((url) => url.trim()) },
        },
      })
      toast({ title: 'Structured data saved' })
    } catch (err) {
      toast({
        title: 'Could not save the structured data settings',
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
          {error instanceof Error ? error.message : 'Could not load the structured data settings.'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={TITLE} description={DESCRIPTION} />

      <Card className="flex flex-col gap-4 p-4">
        <h2 className="text-sm font-semibold">Your business</h2>
        <p className="-mt-2 text-xs text-muted-foreground">
          Used to build the business panel that can appear beside search results for your name.
        </p>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="legal-name">Registered business name</Label>
          <Input
            id="legal-name"
            value={org.legalName}
            onChange={(e) => setOrg({ legalName: e.target.value })}
          />
          <span className="text-xs text-muted-foreground">
            Leave blank to use your shop name.
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="org-logo">Logo address</Label>
          <Input
            id="org-logo"
            placeholder="https://yourshop.com/logo.png"
            value={org.logoUrl}
            onChange={(e) => setOrg({ logoUrl: e.target.value })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="org-email">Contact email</Label>
            <Input
              id="org-email"
              value={org.email}
              onChange={(e) => setOrg({ email: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="org-phone">Contact phone</Label>
            <Input
              id="org-phone"
              value={org.phone}
              onChange={(e) => setOrg({ phone: e.target.value })}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Social profiles</Label>
          <span className="-mt-1 text-xs text-muted-foreground">
            Links to your official accounts, so search engines can connect them to your business.
          </span>

          {org.sameAs.map((url, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                placeholder="https://facebook.com/yourshop"
                value={url}
                onChange={(e) => setSameAs(index, e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove profile"
                onClick={() => setOrg({ sameAs: org.sameAs.filter((_, i) => i !== index) })}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => setOrg({ sameAs: [...org.sameAs, ''] })}
          >
            <Plus className="mr-1.5 size-4" aria-hidden />
            Add a profile
          </Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-4 p-4">
        <div>
          <h2 className="text-sm font-semibold">What to describe</h2>
          <p className="text-xs text-muted-foreground">
            Turn one off only if it is causing a problem — each is built from information your shop
            already publishes.
          </p>
        </div>

        <div className="flex items-start gap-3">
          <Switch
            id="sd-org"
            checked={sd.enableOrganization}
            onCheckedChange={(checked) =>
              setConfig({ structuredData: { ...sd, enableOrganization: checked } })
            }
          />
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="sd-org">Business details</Label>
            <span className="text-xs text-muted-foreground">
              Your name, logo and contact details, on every page.
            </span>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Switch
            id="sd-product"
            checked={sd.enableProduct}
            onCheckedChange={(checked) =>
              setConfig({ structuredData: { ...sd, enableProduct: checked } })
            }
          />
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="sd-product">Products</Label>
            <span className="text-xs text-muted-foreground">
              Price and whether an item is in stock, shown directly in search results.
            </span>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Switch
            id="sd-article"
            checked={sd.enableArticle}
            onCheckedChange={(checked) =>
              setConfig({ structuredData: { ...sd, enableArticle: checked } })
            }
          />
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="sd-article">Blog posts</Label>
            <span className="text-xs text-muted-foreground">
              Headline and publication date, so posts can appear as news-style results.
            </span>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Switch
            id="sd-breadcrumb"
            checked={sd.enableBreadcrumb}
            onCheckedChange={(checked) =>
              setConfig({ structuredData: { ...sd, enableBreadcrumb: checked } })
            }
          />
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="sd-breadcrumb">Navigation trail</Label>
            <span className="text-xs text-muted-foreground">
              Replaces the bare address under a search result with a readable path.
            </span>
          </div>
        </div>
      </Card>

      <EditorActions isDirty={isDirty} isSaving={isSaving} onReset={reset} onSave={handleSave} />

      <UnsavedChangesDialog blocker={blocker} />
    </div>
  )
}

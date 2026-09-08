import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import {
  EditorActions,
  UnsavedChangesDialog,
} from '@/features/ui/components/settings-editor'
import { useSeoConfigDraft } from '../use-seo-config-draft'

/**
 * Ownership codes for search engine webmaster tools.
 *
 * Each is pasted from the provider's own setup screen and published as a meta
 * tag proving the site belongs to whoever holds the account. Blank means no tag
 * at all — an empty verification tag is a failed verification, not a neutral
 * one, which is why nothing here has a default.
 */

const TITLE = 'Verification'
const DESCRIPTION =
  'Codes that prove you own this shop, so you can see your traffic in Google Search Console and Bing Webmaster Tools.'

export default function SeoVerificationPage() {
  const { config, setConfig, save, isDirty, reset, isSaving, isLoading, error, blocker } =
    useSeoConfigDraft()

  const setVerification = (patch: Partial<typeof config.verification>) =>
    setConfig({ verification: { ...config.verification, ...patch } })

  const handleSave = async () => {
    try {
      await save()
      toast({ title: 'Verification codes saved' })
    } catch (err) {
      toast({
        title: 'Could not save the verification codes',
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
          {error instanceof Error ? error.message : 'Could not load the verification codes.'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={TITLE} description={DESCRIPTION} />

      <Card className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="verify-google">Google Search Console</Label>
          <Input
            id="verify-google"
            value={config.verification.google}
            onChange={(e) => setVerification({ google: e.target.value })}
          />
          <span className="text-xs text-muted-foreground">
            In Search Console, choose the HTML tag method and paste only the code from inside
            content=&quot;…&quot; — not the whole tag.
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="verify-bing">Bing Webmaster Tools</Label>
          <Input
            id="verify-bing"
            value={config.verification.bing}
            onChange={(e) => setVerification({ bing: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="verify-other">Other</Label>
          <Input
            id="verify-other"
            value={config.verification.other}
            onChange={(e) => setVerification({ other: e.target.value })}
          />
          <span className="text-xs text-muted-foreground">
            For any other service that verifies ownership the same way.
          </span>
        </div>
      </Card>

      <EditorActions isDirty={isDirty} isSaving={isSaving} onReset={reset} onSave={handleSave} />

      <UnsavedChangesDialog blocker={blocker} />
    </div>
  )
}

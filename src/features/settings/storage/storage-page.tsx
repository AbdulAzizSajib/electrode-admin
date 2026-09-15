import { AlertTriangle, Database, Image as ImageIcon, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useStorageUsage, type MediaUsage } from '@/lib/api/storage'
import { cn } from '@/lib/utils/cn'

/**
 * How much of the two systems holding the shop's data are actually in use.
 *
 * Deliberately two cards and no total: the database and Cloudinary are metered
 * by different providers in different units, so a combined "37 MB used" would
 * be a number with no meaning against any limit either one enforces.
 *
 * No per-table breakdown either. It was considered and left out — it answers
 * "what is big" rather than "how much do I have left", and the one time it
 * mattered (the audit trail) the answer is already on the Audit Logs page.
 */

/** A figure that could not be read. Never rendered as zero — see the note in `storage.ts`. */
function Unavailable({ reason }: { reason: string | null }) {
  return (
    <div className="flex items-start gap-2 text-sm text-muted-foreground">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
      <div className="flex flex-col gap-0.5">
        <span className="font-medium text-foreground">Could not read this</span>
        <span>{reason ?? 'The provider did not respond.'}</span>
      </div>
    </div>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}

/**
 * Cloudinary's credit usage, which is what its free tier is actually metered
 * on — storage and bandwidth both draw from the same pool.
 *
 * This is the only bar on the page, because it is the only figure with a real
 * limit behind it. The database has no readable quota, so showing a bar there
 * would mean inventing a denominator.
 */
function CreditBar({ credits }: { credits: NonNullable<MediaUsage['credits']> }) {
  const pct = Math.min(100, Math.max(0, credits.percentUsed))

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">Credits used</span>
        <span className="text-xs font-medium text-foreground">
          {credits.used.toFixed(2)} of {credits.limit} ({pct.toFixed(1)}%)
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            // Colour is the signal, so the thresholds have to mean something:
            // amber once a merchant should be paying attention, red once it is
            // close enough to interrupt uploads.
            pct >= 90 ? 'bg-destructive' : pct >= 75 ? 'bg-warning' : 'bg-primary',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function StoragePage() {
  const { data, isLoading, isFetching, refetch } = useStorageUsage()

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Storage"
        description="How much of your database and image hosting is currently in use."
        actions={
          <Button variant="outline" size="lg" onClick={() => refetch()} loading={isFetching}>
            <RefreshCw /> Refresh
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <Database className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">Database</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : data?.database ? (
              <>
                <span className="text-3xl font-semibold text-foreground">
                  {data.database.size.label}
                </span>
                {/*
                  Stated rather than left to be inferred. A merchant reading a
                  bare number will look for the percentage that is not there,
                  and the honest answer is that the host does not expose one.
                */}
                <p className="text-xs text-muted-foreground">
                  Total size including indexes. Your hosting plan's limit is not readable from the
                  database itself, so this is the raw figure — check it against your provider's
                  dashboard.
                </p>
              </>
            ) : (
              <Unavailable reason={data?.databaseError ?? null} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <ImageIcon className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">Images &amp; media</CardTitle>
            {data?.media && (
              <Badge variant="outline" className="ml-auto">
                {data.media.plan}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : data?.media ? (
              <>
                <span className="text-3xl font-semibold text-foreground">
                  {data.media.storage.label}
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <Figure label="Files stored" value={String(data.media.assets)} />
                  <Figure label="Bandwidth this period" value={data.media.bandwidth.label} />
                </div>
                {data.media.credits && <CreditBar credits={data.media.credits} />}
              </>
            ) : (
              <Unavailable reason={data?.mediaError ?? null} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

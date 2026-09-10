import { AlertTriangle } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

/**
 * The panel's "this region failed to load" block.
 *
 * Extracted from `DataTable`, which had the only copy of it — every list page got a
 * retryable failure for free by rendering a table, and every page that showed data
 * WITHOUT a table (the dashboard) silently had no error path at all: a failed fetch
 * sat on the loading skeleton forever, because `isLoading || !data` cannot tell
 * "still arriving" from "never arriving".
 *
 * Kept visually identical to the in-table version on purpose — the same icon, title,
 * and `Try again` affordance — so a failed card and a failed table read as the same
 * event to the merchant rather than as two unrelated designs.
 */
export interface ErrorStateProps {
  /** Names the thing that failed, e.g. "The revenue chart could not be loaded." */
  description?: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({
  description = 'Something went wrong while loading this data.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title="Couldn't load data"
      description={description}
      className={className}
      action={
        onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-sm text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Try again
          </button>
        )
      }
    />
  )
}

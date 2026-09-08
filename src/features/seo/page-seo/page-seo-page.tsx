import * as React from 'react'
import { AlertCircle, Check, ExternalLink, Pencil, X } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import {
  useSeoOverview,
  useUpdateRowSeo,
  type SeoOverviewRow,
} from '@/lib/api/seo'
import {
  SEO_CONTENT_TYPES,
  SEO_LENGTH_LIMITS,
  type SeoContentType,
} from '@/lib/api/store-settings'

/**
 * Every page that can carry SEO, from all five content types, in one list.
 *
 * The screen this whole change exists for: before it, a merchant asking "which
 * of my pages is missing a description?" had to open five separate lists, and two
 * of the five had no SEO fields on their forms at all.
 *
 * Edits here write to the SAME columns the record's own form writes to, through
 * that resource's own endpoint — so the two entry points cannot disagree. There
 * is no copy of this data and nothing to keep in sync.
 */

const TITLE = 'Page SEO'
const DESCRIPTION =
  'The title and description each page shows in search results. Anything left blank falls back to the page’s own name and to your defaults under General.'

const CONTENT_TYPE_LABELS: Record<SeoContentType, string> = {
  product: 'Product',
  category: 'Category',
  page: 'Page',
  blogPost: 'Blog post',
  landingPage: 'Landing page',
}

/**
 * What is wrong with a row, if anything.
 *
 * A missing title is not flagged: every content type falls back to its own name,
 * which is usually the right title anyway. A missing DESCRIPTION is flagged,
 * because the fallback there is an excerpt of body text or nothing at all — and
 * a search result with no description is one a shopper skips.
 */
function healthOf(row: SeoOverviewRow): { tone: 'warn' | 'ok'; message: string } {
  const title = row.metaTitle?.trim() ?? ''
  const description = row.metaDescription?.trim() ?? ''

  if (!description) return { tone: 'warn', message: 'No description' }
  if (title.length > SEO_LENGTH_LIMITS.titleMax)
    return { tone: 'warn', message: `Title ${title.length}/${SEO_LENGTH_LIMITS.titleMax}` }
  if (description.length > SEO_LENGTH_LIMITS.descriptionMax)
    return {
      tone: 'warn',
      message: `Description ${description.length}/${SEO_LENGTH_LIMITS.descriptionMax}`,
    }

  return { tone: 'ok', message: 'Good' }
}

/** One row's inline editor. Open, edit, save — no navigation away from the list. */
function RowEditor({
  row,
  onDone,
}: {
  row: SeoOverviewRow
  onDone: () => void
}) {
  const [metaTitle, setMetaTitle] = React.useState(row.metaTitle ?? '')
  const [metaDescription, setMetaDescription] = React.useState(row.metaDescription ?? '')
  const mutation = useUpdateRowSeo()

  const handleSave = async () => {
    try {
      await mutation.mutateAsync({
        id: row.id,
        contentType: row.contentType,
        metaTitle,
        metaDescription,
      })
      toast({ title: `Saved SEO for “${row.title}”` })
      onDone()
    } catch (err) {
      // Editor stays open on failure so the text is not lost.
      toast({
        title: 'Could not save',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="flex flex-col gap-3 bg-muted/40 p-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" htmlFor={`title-${row.id}`}>
          Search result title
        </label>
        <Input
          id={`title-${row.id}`}
          value={metaTitle}
          placeholder={row.title}
          onChange={(e) => setMetaTitle(e.target.value)}
        />
        <span className="text-xs text-muted-foreground">
          {metaTitle.trim().length}/{SEO_LENGTH_LIMITS.titleMax} characters. Blank uses &ldquo;
          {row.title}&rdquo;.
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" htmlFor={`description-${row.id}`}>
          Search result description
        </label>
        <Textarea
          id={`description-${row.id}`}
          rows={3}
          value={metaDescription}
          onChange={(e) => setMetaDescription(e.target.value)}
        />
        <span className="text-xs text-muted-foreground">
          {metaDescription.trim().length}/{SEO_LENGTH_LIMITS.descriptionMax} characters.
        </span>
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={mutation.isPending}>
          <Check className="mr-1.5 size-4" aria-hidden />
          {mutation.isPending ? 'Saving…' : 'Save'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone} disabled={mutation.isPending}>
          <X className="mr-1.5 size-4" aria-hidden />
          Cancel
        </Button>
      </div>
    </div>
  )
}

export default function PageSeoPage() {
  const [contentType, setContentType] = React.useState<SeoContentType | ''>('')
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [editing, setEditing] = React.useState<string | null>(null)

  const { data, isLoading, error } = useSeoOverview({
    contentType: contentType || undefined,
    search,
    page,
    limit: 20,
  })

  const rows = data?.data ?? []
  const meta = data?.meta

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={TITLE} description={DESCRIPTION} />

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search by name…"
          className="max-w-xs"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            // Back to the first page: staying on page 4 of a narrower result set
            // shows an empty table and reads as "no matches".
            setPage(1)
          }}
        />
        <select
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          value={contentType}
          onChange={(e) => {
            setContentType(e.target.value as SeoContentType | '')
            setPage(1)
          }}
        >
          <option value="">All types</option>
          {SEO_CONTENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {CONTENT_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <Skeleton className="h-96 w-full" />}

      {error && (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : 'Could not load the SEO overview.'}
        </p>
      )}

      {!isLoading && !error && rows.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No pages match what you are looking for.
        </Card>
      )}

      {!isLoading && !error && rows.length > 0 && (
        <Card className="divide-y overflow-hidden p-0">
          {rows.map((row) => {
            const health = healthOf(row)
            const isEditing = editing === row.id

            return (
              <div key={`${row.contentType}-${row.id}`}>
                <div className="flex items-start gap-3 p-4">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {CONTENT_TYPE_LABELS[row.contentType]}
                      </span>
                      <span className="truncate text-sm font-medium">{row.title}</span>
                      {!row.isPublished && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          Draft
                        </span>
                      )}
                    </div>

                    <span className="truncate text-sm text-muted-foreground">
                      {row.metaTitle?.trim() || (
                        <em className="not-italic opacity-70">Uses &ldquo;{row.title}&rdquo;</em>
                      )}
                    </span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {row.metaDescription?.trim() || (
                        <em className="not-italic opacity-70">No description set</em>
                      )}
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={
                        health.tone === 'warn'
                          ? 'flex items-center gap-1 text-xs text-destructive'
                          : 'flex items-center gap-1 text-xs text-muted-foreground'
                      }
                    >
                      {health.tone === 'warn' && (
                        <AlertCircle className="size-3.5" aria-hidden />
                      )}
                      {health.message}
                    </span>

                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit SEO for ${row.title}`}
                      onClick={() => setEditing(isEditing ? null : row.id)}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </Button>

                    {/* Opens the live page. A merchant checking a title usually
                        wants to see the page it belongs to. */}
                    <Button variant="ghost" size="icon" asChild aria-label="View page">
                      <a href={row.path} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-4" aria-hidden />
                      </a>
                    </Button>
                  </div>
                </div>

                {isEditing && <RowEditor row={row} onDone={() => setEditing(null)} />}
              </div>
            )
          })}
        </Card>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Page {meta.page} of {meta.totalPages} — {meta.total} pages
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

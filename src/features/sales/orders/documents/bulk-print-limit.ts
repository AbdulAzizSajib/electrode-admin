/**
 * Ceiling on one bulk print run.
 *
 * Its own module rather than living on `bulk-document-page.tsx`, because the
 * orders list needs the number to disable the action *before* navigating — and
 * importing it from the page component would pull that lazily-loaded chunk into
 * the list's bundle, defeating the lazy route it is registered behind.
 *
 * Fifty, because the selected ids travel in the query string so a jammed run
 * can be reopened from history, and that buys a URL length limit: ~2000
 * characters is the conservative ceiling and a CUID costs 26 with its
 * separator. Fifty leaves real headroom, and matches the courier dispatch batch
 * size already used in `courier.service.ts` so an operator learns one number
 * rather than two. See openspec/changes/add-bulk-order-document-printing
 * design.md Decision 1.
 */
export const BULK_PRINT_LIMIT = 50

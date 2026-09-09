import * as React from 'react'
import type { Font } from '@/lib/api/fonts'
import { resolveFontHref } from '@/lib/font'

/**
 * Loads a stylesheet for each library font so previews render in the face they
 * name.
 *
 * A font picker whose options are all set in the admin's own typeface is a list
 * of words, not a preview — the merchant is choosing how something looks, so
 * they have to be able to see it. That means every listed font's stylesheet has
 * to be present, not just the selected one.
 *
 * Rendered as real `<link>` elements appended to `<head>` rather than via React
 * so they can be removed precisely on unmount. Each is keyed by its href, so
 * mounting this twice (the library list and a picker on another screen) loads
 * each stylesheet once and neither unmount pulls the rug from the other.
 *
 * Every href goes through `resolveFontHref` first. The values come from the
 * API and were rebuilt by the backend's parser, but they are stored in a JSON
 * column Postgres does not constrain, so they are re-validated immediately
 * before use exactly as the storefront does.
 *
 * Bounded by the size of a hand-curated library. If one ever grows past a few
 * dozen fonts this wants lazy loading per visible row; it does not now.
 */

/** Refcount per href, so overlapping mounts do not evict each other's links. */
const mounted = new Map<string, number>()

function acquire(href: string) {
  const count = mounted.get(href) ?? 0
  mounted.set(href, count + 1)

  if (count > 0) return

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  link.dataset.fontPreview = href
  document.head.appendChild(link)
}

function release(href: string) {
  const count = mounted.get(href) ?? 0

  if (count <= 1) {
    mounted.delete(href)
    document.head.querySelector(`link[data-font-preview="${CSS.escape(href)}"]`)?.remove()
    return
  }

  mounted.set(href, count - 1)
}

export function FontStylesheets({ fonts }: { fonts: Font[] }) {
  /*
   * Joined into a primitive so the effect re-runs when the SET of fonts
   * changes, not on every render that produced a new array with the same
   * contents — which is every render, since `fonts` comes from a query.
   */
  const hrefs = fonts
    .map((f) => resolveFontHref(f.url))
    .filter((href): href is string => href !== null)
  const key = hrefs.join('|')

  React.useEffect(() => {
    const current = key ? key.split('|') : []
    current.forEach(acquire)

    return () => {
      current.forEach(release)
    }
  }, [key])

  return null
}

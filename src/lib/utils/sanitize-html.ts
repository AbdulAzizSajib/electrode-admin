import DOMPurify from 'isomorphic-dompurify'

/**
 * The allowlist merchant-authored HTML is filtered through before the admin
 * renders it.
 *
 * Deliberately a mirror of `nextjs/src/lib/sanitize-html.ts`, not an import:
 * the two packages never import each other (see CLAUDE.md, "Both frontends
 * mirror backend validation limits"). It carries the same obligation — a tag
 * added to one list and not the other renders in one app and vanishes in the
 * other, which is exactly the confusion a merchant reports as "the admin shows
 * it but the site doesn't".
 *
 * Sanitising at render rather than on save is the same decision the storefront
 * made: cleaning only on the way in would leave everything already stored — and
 * anything written by any other path — trusted forever. The admin is not a
 * lesser target for this. Product copy can be written by a STAFF account and is
 * then read by an OWNER, so stored markup reaching an admin's browser unfiltered
 * is a privilege-escalation path, not merely a display bug.
 */

/**
 * What merchant-authored content legitimately needs: structure, emphasis,
 * lists, tables, links, and images for content pages.
 *
 * The editor and this list are two halves of one switch: a tag the editor can
 * emit but this strips disappears silently. See `buildToolbar` in
 * `components/forms/rich-text-editor.tsx`, which is pinned to this list.
 */
const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'del',
  'mark',
  'code',
  'pre',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'a',
  'img',
  'hr',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'span',
  'div',
]

/**
 * No `style`, no `class`, no `id`, and no `on*`.
 *
 * A class could pull in the admin's own utility styles to cover the page with
 * an overlay, and an inline style can do it without help — neither is something
 * a product description needs.
 */
const ALLOWED_ATTR = [
  'href',
  'title',
  'target',
  'rel',
  'colspan',
  'rowspan',
  // For `img`. `src` is constrained by ALLOWED_URI_REGEXP below exactly like
  // `href` is, which is what keeps a `data:` payload out of an image tag.
  'src',
  'alt',
  'width',
  'height',
]

/** The only URI shapes any attribute here may carry. */
const SAFE_URI = /^(?:https?:|mailto:|tel:|#|\/)/i

/**
 * Closes a hole `ALLOWED_URI_REGEXP` does not.
 *
 * DOMPurify treats `img` (with `audio`, `video`, `source`, `track`) as a
 * "data URI tag": for those, a `data:` source is accepted even when the
 * configured URI regexp rejects it. `data:image/svg+xml` is a documented
 * content-injection vector, so `src` is re-checked against the same rule
 * `href` gets.
 *
 * Registered at module scope, so it is installed exactly once no matter how
 * many callers import `sanitizeHtml`.
 */
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  // Duck-typed rather than `instanceof Element`: under the `jsdom` test
  // environment this can run against a different window's constructor.
  if (typeof (node as Element)?.getAttribute !== 'function') return

  const src = (node as Element).getAttribute('src')
  if (src !== null && !SAFE_URI.test(src)) (node as Element).removeAttribute('src')
})

/**
 * Strips everything outside the allowlist. `javascript:` and `data:` URIs go
 * with it, on `href` and `src` alike.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: SAFE_URI,
    // A rejected tag's text still reads; dropping it whole would silently lose
    // wording the merchant wrote.
    KEEP_CONTENT: true,
    ALLOW_DATA_ATTR: false,
  })
}

/** True when the markup carries nothing a reader would see. */
export function isBlankHtml(html: string | undefined | null): boolean {
  if (!html) return true
  return (
    sanitizeHtml(html)
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim() === ''
  )
}

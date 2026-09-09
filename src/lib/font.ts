/**
 * Validating the admin panel's own typeface before it is used.
 *
 * A near-mirror of `nextjs/src/lib/theme.ts` — `resolveFontStack` and
 * `resolveFontHref` there — and deliberately so: both surfaces read the same
 * `theme` blob, which lives in a JSON column Postgres does not constrain. The
 * API validates on the way in, but a row edited outside it is exactly the case
 * where "reads are trusted" would be trusting the wrong thing. So the family
 * and the stylesheet address are both re-checked immediately before use, and a
 * value that does not pass falls back rather than being rendered.
 *
 * The one deliberate difference from the storefront is FALLBACK_STACK: Roboto
 * leads it here. See the comment on that constant.
 *
 * Kept in step with the backend's `FAMILY_PATTERN` and with the storefront's
 * copy — this is the third hand-duplicated instance of the same invariant, and
 * all three must agree.
 *
 * See openspec/changes/add-font-library-and-admin-font, design.md Decision 7.
 */

/** Matches the backend's FAMILY_PATTERN — letters, digits, spaces, hyphens. */
const FAMILY = /^[A-Za-z0-9][A-Za-z0-9 -]{0,63}$/

/**
 * Roboto first, unlike the storefront's stack.
 *
 * Roboto is what the admin panel was hardcoded to before it became
 * configurable, so leading with it means the panel looks exactly as it always
 * has in the moment before the setting resolves, and permanently if the
 * merchant never picks anything. A different lead font would turn "the setting
 * has not loaded yet" into a visible flash of something wrong.
 */
const FALLBACK_STACK =
  "'Roboto', 'Segoe UI', system-ui, -apple-system, sans-serif"

/**
 * The `font-family` value to apply, always ending in the fallback stack.
 *
 * An unusable family yields the stack alone rather than a quoted invalid name:
 * there is nothing to gain by naming a font that cannot be trusted, and a
 * family carrying a quote or a semicolon is precisely what must never reach a
 * style declaration.
 */
export function resolveFontStack(family: string | undefined): string {
  if (typeof family !== 'string' || !FAMILY.test(family)) return FALLBACK_STACK
  return `'${family}', ${FALLBACK_STACK}`
}

/**
 * The stylesheet URL to load, or null if it cannot be vouched for.
 *
 * The same three checks the backend's parser applies, for the same reasons:
 * https only (an http stylesheet would be blocked as mixed content and
 * silently never load), the host compared by EQUALITY — `endsWith` would
 * accept `fonts.googleapis.com.evil.test` — and a stylesheet path rather than
 * any Google Fonts endpoint.
 */
export function resolveFontHref(url: string | undefined): string | null {
  if (typeof url !== 'string') return null

  try {
    const parsed = new URL(url)
    const ok =
      parsed.protocol === 'https:' &&
      parsed.hostname === 'fonts.googleapis.com' &&
      (parsed.pathname === '/css2' || parsed.pathname === '/css')

    return ok ? parsed.toString() : null
  } catch {
    return null
  }
}

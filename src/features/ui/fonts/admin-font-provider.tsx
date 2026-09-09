import * as React from 'react'
import { ConfigProvider } from 'antd'
import { buildAntdTheme } from '@/lib/antd-theme'
import { resolveFontHref, resolveFontStack } from '@/lib/font'
import { DEFAULT_THEME, useStoreSettings } from '@/lib/api/store-settings'

/**
 * Applies the merchant's chosen typeface to the whole admin panel.
 *
 * The panel has TWO independent styling systems and the font has to reach both,
 * which is why this does two distinct things rather than one:
 *
 *  1. **The CSS variable.** `--font-sans` is set on `<html>`, which is what
 *     `body { font-family: var(--font-sans) }` in index.css resolves. That
 *     covers every Tailwind and shadcn surface.
 *
 *  2. **The antd token.** antd reads `token.fontFamily` at RENDER time and
 *     writes its own class-based styles; it never consults the CSS variable. So
 *     the variable alone would restyle most of the panel and leave every antd
 *     form — the resource form pages, roughly eighteen files — in the old
 *     typeface. A panel where the forms disagree with everything around them is
 *     the failure this second step exists to prevent.
 *
 * The stylesheet `<link>` is injected rather than declared in index.html
 * because which font to fetch is not known until the setting is read. It is
 * keyed by a stable id so a font change REPLACES it instead of accumulating a
 * new link on every save.
 *
 * Nothing here blocks rendering. Until the setting resolves the panel uses the
 * fallback stack from index.css, which leads with Roboto — exactly what the
 * panel looked like before the font was configurable — so the pre-resolution
 * frame reads as normal rather than as a flash of something wrong.
 *
 * See openspec/changes/add-font-library-and-admin-font, design.md Decision 7.
 */

/** Identifies the injected link so it is replaced, never duplicated. */
const LINK_ID = 'admin-font-stylesheet'

export function AdminFontProvider({ children }: { children: React.ReactNode }) {
  /*
   * Fails soft: an unreachable settings endpoint leaves `data` undefined and
   * the panel on its fallback stack. The admin must remain usable when the
   * backend is down — that is when someone most needs to look at it.
   */
  const { data } = useStoreSettings()

  const adminFont = data?.theme?.adminFont ?? DEFAULT_THEME.adminFont
  const family = adminFont?.family
  const href = resolveFontHref(adminFont?.url)

  /*
   * Both values are re-validated before use even though the API validated them
   * on the way in: the theme lives in a JSON column Postgres does not
   * constrain, so a row edited outside the API is the one case where trusting
   * the read would be trusting the wrong thing. An unusable family yields the
   * fallback stack alone; an unusable URL yields no link at all.
   */
  const stack = resolveFontStack(family)

  React.useEffect(() => {
    document.documentElement.style.setProperty('--font-sans', stack)
  }, [stack])

  React.useEffect(() => {
    const existing = document.getElementById(LINK_ID)

    if (!href) {
      // No usable stylesheet: drop any previous one rather than leaving the
      // panel loading a font it is no longer set to use.
      existing?.remove()
      return
    }

    if (existing instanceof HTMLLinkElement) {
      if (existing.href !== href) existing.href = href
      return
    }

    const link = document.createElement('link')
    link.id = LINK_ID
    link.rel = 'stylesheet'
    link.href = href
    document.head.appendChild(link)
  }, [href])

  /*
   * Memoised on the family alone: rebuilding the theme object on every render
   * would give ConfigProvider a new identity each time and re-render every antd
   * component in the panel.
   */
  const theme = React.useMemo(() => buildAntdTheme(stack), [stack])

  return <ConfigProvider theme={theme}>{children}</ConfigProvider>
}

import type { ThemeConfig } from 'antd'

/**
 * Shared antd theme, applied via <ConfigProvider> in AdminFontProvider so every
 * antd component used anywhere in the app matches this project's existing color
 * tokens (see index.css's `@theme` block).
 *
 * A FUNCTION rather than the constant this used to be, because the font became
 * a setting. antd resolves `token.fontFamily` at render time and emits its own
 * class-based styles from it; it never reads the `--font-sans` custom property.
 * So setting that variable alone restyles every Tailwind and shadcn surface and
 * leaves the antd form pages in the old typeface — a panel visibly at odds with
 * itself. Passing the resolved stack in here is what keeps the two systems
 * agreeing.
 *
 * The caller is expected to memoise the result: a fresh object on every render
 * gives ConfigProvider a new identity and re-renders every antd component in
 * the panel.
 *
 * See openspec/changes/add-font-library-and-admin-font, design.md Decision 7.
 */
export function buildAntdTheme(fontFamily: string): ThemeConfig {
  return {
    token: {
      colorPrimary: '#155eef',
      colorError: '#d92d20',
      colorSuccess: '#067647',
      colorWarning: '#b54708',
      borderRadius: 6,
      /*
       * Already a full stack ending in the fallback chain — `resolveFontStack`
       * builds it, and it is the same string written into `--font-sans`, so
       * antd and everything else resolve to the identical typeface.
       */
      fontFamily,
      fontSize: 15,
    },
  }
}

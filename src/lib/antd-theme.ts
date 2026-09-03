import type { ThemeConfig } from 'antd'

/**
 * Shared antd theme, applied once via <ConfigProvider> in main.tsx so every
 * antd component used anywhere in the app (starting with Categories) matches
 * this project's existing color tokens (see index.css's `@theme` block).
 */
export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: '#155eef',
    colorError: '#d92d20',
    colorSuccess: '#067647',
    colorWarning: '#b54708',
    borderRadius: 6,
    fontFamily: "'Roboto', 'Segoe UI', system-ui, -apple-system, sans-serif",
    fontSize: 15,
  },
}

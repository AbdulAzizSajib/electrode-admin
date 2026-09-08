/// <reference types="vite/client" />

/**
 * The panel's build-time configuration.
 *
 * Declared explicitly rather than leaning on `vite/client`'s index signature,
 * which types every `VITE_*` key as `any` — a typo would then compile happily
 * and produce requests to `undefined/products` at runtime.
 */
interface ImportMetaEnv {
  /**
   * Origin of the Ecom API, including the `/api/v1` path.
   *
   * Optional: unset falls back to the local dev server, which is what every
   * developer wants and what this panel did unconditionally before deployment
   * existed.
   *
   * Vite inlines this AT BUILD TIME. Changing it in a hosting dashboard does
   * nothing until the panel is rebuilt — unlike the server, where an env change
   * takes effect on restart.
   */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

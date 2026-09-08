/**
 * The chrome around the signed-out screens (login, forgot password).
 *
 * Branded from the store's own settings rather than the hardcoded "E" / "Ecom
 * Admin" this used to show. The source is `GET /settings/public` — see
 * `lib/api/public-settings.ts` for why it is that endpoint and not the admin
 * `GET /settings`, which would 401 for the only visitor this layout ever has.
 *
 * The whole thing degrades rather than blocks. The settings request is never
 * awaited before rendering and never gates the form: while it is in flight, or
 * if it fails outright (backend down is exactly when an admin needs to get in),
 * every value below falls back to `FALLBACK_BRANDING` and the layout renders the
 * same generic mark it always did. Nothing here is allowed to keep someone from
 * typing a password.
 */
import { Outlet } from 'react-router'
import * as React from 'react'
import { usePublicBranding } from '@/lib/api/public-settings'

/**
 * What the layout shows before — or instead of — a settings response. Not the
 * backend's `DEFAULT_PUBLIC_SETTINGS`: those describe a storefront, and this is
 * the admin panel, so the neutral name is the right stand-in when we genuinely
 * do not know the store's.
 */
const FALLBACK_BRANDING = {
  storeName: 'Ecom Admin',
  siteNameAccent: null,
  logoUrl: null,
} as const

export function AuthLayout() {
  const { data } = usePublicBranding()

  const storeName = data?.storeName?.trim() || FALLBACK_BRANDING.storeName
  const accent = data?.siteNameAccent?.trim() || null
  const logoUrl = data?.logoUrl?.trim() || null
  const theme = data?.theme ?? null

  // The logo is remote (Cloudinary) and can 404 after an asset is replaced.
  // Falling back to the wordmark keeps a broken-image icon off the sign-in page.
  const [logoFailed, setLogoFailed] = React.useState(false)
  const showLogo = Boolean(logoUrl) && !logoFailed

  const supportEmail = data?.contact?.email?.trim() || null

  /*
   * The store's palette, applied as local CSS variables rather than by writing
   * Tailwind classes from the values. Tailwind 4 compiles its utilities at build
   * time, so a runtime colour cannot become a class name — but the tokens in
   * `src/index.css` are variables, and overriding them on this subtree is enough
   * to re-tint the primitives (Button, Input focus rings) that already consume
   * them. Scoped to this element so the rest of the admin keeps its own theme.
   *
   * Only the two brand tokens are taken. Background and foreground are
   * deliberately NOT: they are chosen for a storefront, and a dark storefront
   * background behind the admin's light Card would make the form unreadable —
   * this layout is not the place to relitigate the admin's own contrast.
   */
  const brandStyle = React.useMemo<React.CSSProperties | undefined>(() => {
    if (!theme?.brand) return undefined
    return {
      '--color-primary': theme.brand,
      // `brandDark` is the storefront's own hover/pressed shade, so the button's
      // hover stays a deliberate colour rather than a computed guess.
      '--color-primary-hover': theme.brandDark || theme.brand,
      '--color-ring': theme.brand,
    } as React.CSSProperties
  }, [theme])

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted px-4 py-10" style={brandStyle}>
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          {showLogo ? (
            <img
              src={logoUrl as string}
              alt={storeName}
              className="h-11 max-w-[200px] object-contain"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <div className="flex items-center justify-center gap-2">
              {/* The initial, from the store's own name — the "E" here was
                  hardcoded before and stayed "E" for a shop called anything. */}
              <div className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
                {storeName.charAt(0).toUpperCase()}
              </div>
              <span className="text-base font-semibold text-foreground">
                {storeName}
                {accent && <span className="text-primary ml-1">{accent}</span>}
              </span>
            </div>
          )}

          {/* Named only under the logo, which usually carries the store name as
              artwork and so would otherwise leave the panel unlabelled. */}
          {showLogo && (
            <span className="text-sm font-medium text-foreground">
              {storeName}
              {accent && <span className="text-primary ml-1">{accent}</span>}
            </span>
          )}

          <span className="text-xs text-muted-foreground">Admin panel</span>
        </div>

        <Outlet />

        {/* A locked-out admin needs a way to reach whoever can help, and the
            store already records one. Omitted entirely when unset — an empty
            "contact" line helps nobody. */}
        {supportEmail && (
          <p className="text-center text-xs text-muted-foreground">
            Trouble signing in?{' '}
            <a href={`mailto:${supportEmail}`} className="font-medium hover:text-foreground hover:underline">
              {supportEmail}
            </a>
          </p>
        )}
      </div>
    </div>
  )
}

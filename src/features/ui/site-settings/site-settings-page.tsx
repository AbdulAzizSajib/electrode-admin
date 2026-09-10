import * as React from 'react'
import { Link } from 'react-router'
import { Loader2, TriangleAlert } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import {
  EditorActions,
  EditorSection,
  UnsavedChangesDialog,
} from '@/features/ui/components/settings-editor'
import {
  useSettingsDraft,
  useUnsavedChangesGuard,
} from '@/features/ui/components/settings-editor-utils'
import { useAllFonts, type Font } from '@/lib/api/fonts'
import { FontStylesheets } from '@/features/ui/fonts/font-stylesheets'
import { FONTS_PATH } from '@/features/ui/fonts/fonts-list-page'
import { useUploadImage } from '@/lib/api/uploads'
import {
  useStoreSettings,
  useUpdateStoreSettings,
  nearestContentWidth,
  DEFAULT_BRAND_DISPLAY,
  DEFAULT_SITE_CONTENT_WIDTH,
  DEFAULT_THEME,
  FULL_WIDTH,
  LOGO_HEIGHT_LIMITS,
  SITE_CONTENT_WIDTHS,
  THEME_COLOR_FIELDS,
  type BrandDisplayMode,
  type StoreSettingsInput,
  type Theme,
  type ThemeColorKey,
} from '@/lib/api/store-settings'
import { contrastRatio } from '@/features/ui/site-settings/contrast'

/**
 * The storefront's identity and theme: logos, name, SEO, colours, typeface and
 * content width.
 *
 * This page is the single home for branding. Store Settings under the Settings
 * section keeps commerce configuration (currency, tax, shipping, COD limits,
 * contact) and no longer offers these fields, so a given value has exactly one
 * editing surface and two forms cannot overwrite each other with stale values.
 *
 * Writes only its own keys through the partial `PATCH /settings`, so saving here
 * leaves currency, tax and the nav blocks untouched.
 */

const TITLE = 'Site settings'
const DESCRIPTION = "Your storefront's name, branding, SEO and theme."

/** Everything this page owns, held as one draft so dirty-tracking is one flag. */
interface SiteDraft {
  storeName: string
  siteNameAccent: string
  logoUrl: string
  footerLogoUrl: string
  /**
   * Which of the two things each brand slot shows.
   *
   * Held in the draft alongside the artwork rather than derived from it: the
   * mode is what the storefront renders on, and a merchant may set a slot to
   * text while keeping its image on file.
   */
  headerBrandMode: BrandDisplayMode
  footerBrandMode: BrandDisplayMode
  /** Pixels. Bounded by `LOGO_HEIGHT_LIMITS` before the save is attempted. */
  headerLogoHeight: number
  footerLogoHeight: number
  siteUrl: string
  metaTitle: string
  metaDescription: string
  copyrightText: string
  /**
   * Both typefaces live in here as `theme.font` and `theme.adminFont`.
   *
   * There is no longer a raw-text companion field. Fonts used to be pasted on
   * this page, which meant carrying the merchant's untouched keystrokes
   * alongside the parsed pair; now a font is added once under UI → Fonts and
   * chosen here, so the draft holds a selection and nothing needs parsing.
   */
  theme: Theme
}

const EMPTY_DRAFT: SiteDraft = {
  storeName: '',
  siteNameAccent: '',
  logoUrl: '',
  footerLogoUrl: '',
  headerBrandMode: DEFAULT_BRAND_DISPLAY.headerBrandMode,
  footerBrandMode: DEFAULT_BRAND_DISPLAY.footerBrandMode,
  headerLogoHeight: LOGO_HEIGHT_LIMITS.headerDefault,
  footerLogoHeight: LOGO_HEIGHT_LIMITS.footerDefault,
  siteUrl: '',
  metaTitle: '',
  metaDescription: '',
  copyrightText: '',
  theme: DEFAULT_THEME,
}

/** WCAG AA for body text. Advisory here — a merchant owns their brand. */
const AA_CONTRAST = 4.5

/**
 * One surface's typeface, as radio cards previewed in their own font.
 *
 * Native radio inputs rather than a custom widget: this is exactly what a radio
 * group is for, and it gets keyboard navigation and screen-reader semantics
 * without any work. The input is visually hidden but focusable, so the card's
 * ring follows focus.
 *
 * The preview only renders in the right face if that font's stylesheet is
 * loaded — `FontStylesheets`, mounted by the page, is what does that.
 */
function FontPicker({
  name,
  label,
  hint,
  fonts,
  selected,
  onSelect,
}: {
  name: string
  label: string
  hint: string
  fonts: Font[]
  selected: string
  onSelect: (family: string) => void
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-foreground">{label}</legend>
      <p className="text-xs text-muted-foreground">{hint}</p>

      <div className="mt-1 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {fonts.map((font) => {
          const isSelected = font.family === selected

          return (
            <label
              key={font.id}
              /*
               * `relative` is load-bearing, not decoration. `sr-only` is
               * `position: absolute`, so the hidden radio is placed against its
               * nearest POSITIONED ancestor — and without this that is the
               * shell's `fixed inset-0` box, four levels above `<main>`. An
               * absolute box anchored outside the scroller does not move when
               * the scroller scrolls, so on a page scrolled down to the font
               * section the radio's real position sits that far below the
               * viewport. Clicking the card focuses it, the browser scrolls the
               * nearest scrollable ancestor to reveal it — the shell, which is
               * `overflow-hidden` and so has no scrollbar to scroll back — and
               * the entire panel slides off the top of the screen for good.
               * Anchoring the radio to its own card keeps it inside `<main>`'s
               * scrolled content, where it is already in view and nothing needs
               * to scroll at all.
               */
              className={`relative flex cursor-pointer flex-col gap-1 rounded-md border p-3 transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1 ${
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/40'
              }`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name={name}
                  className="sr-only"
                  checked={isSelected}
                  onChange={() => onSelect(font.family)}
                />
                <span
                  aria-hidden
                  className={`size-3.5 shrink-0 rounded-full border ${
                    isSelected ? 'border-[5px] border-primary' : 'border-muted-foreground/50'
                  }`}
                />
                <span className="text-xs font-medium text-foreground">{font.family}</span>
              </span>

              {/* Quoted family plus a fallback, so an unloaded stylesheet
                  degrades to readable text rather than to nothing. */}
              <span
                className="text-xl leading-snug text-muted-foreground"
                style={{ fontFamily: `"${font.family}", system-ui, sans-serif` }}
              >
                Aa Bb Cc
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

export default function SiteSettingsPage() {
  const { data, isLoading, error } = useStoreSettings()
  const updateMutation = useUpdateStoreSettings()
  const uploadMutation = useUploadImage()

  /*
   * The whole library, unpaginated — the pickers must offer every font, not
   * page one of them.
   */
  const { data: fontsData, isLoading: fontsLoading, error: fontsError } = useAllFonts()
  const fonts = fontsData ?? []

  const draft = useSettingsDraft<SiteDraft>(
    data && {
      storeName: data.storeName ?? '',
      siteNameAccent: data.siteNameAccent ?? '',
      logoUrl: data.logoUrl ?? '',
      footerLogoUrl: data.footerLogoUrl ?? '',
      /*
       * Seeded from the mirrored defaults, because the admin read returns the
       * row as-is: a store that has never chosen a mode sends null here, and
       * null is not a state either control can display.
       */
      headerBrandMode: data.headerBrandMode ?? DEFAULT_BRAND_DISPLAY.headerBrandMode,
      footerBrandMode: data.footerBrandMode ?? DEFAULT_BRAND_DISPLAY.footerBrandMode,
      headerLogoHeight: data.headerLogoHeight ?? LOGO_HEIGHT_LIMITS.headerDefault,
      footerLogoHeight: data.footerLogoHeight ?? LOGO_HEIGHT_LIMITS.footerDefault,
      siteUrl: data.siteUrl ?? '',
      metaTitle: data.metaTitle ?? '',
      metaDescription: data.metaDescription ?? '',
      copyrightText: data.copyrightText ?? '',
      theme: data.theme ?? DEFAULT_THEME,
    },
    EMPTY_DRAFT,
  )
  const blocker = useUnsavedChangesGuard(draft.isDirty)

  const value = draft.value
  const set = (patch: Partial<SiteDraft>) => draft.set({ ...value, ...patch })
  const setTheme = (patch: Partial<Theme>) => set({ theme: { ...value.theme, ...patch } })

  /** Which logo slot an upload is in flight for, so only that one shows a spinner. */
  const [uploading, setUploading] = React.useState<'logoUrl' | 'footerLogoUrl' | null>(null)

  const handleUpload = async (slot: 'logoUrl' | 'footerLogoUrl', file: File) => {
    setUploading(slot)
    try {
      const { url } = await uploadMutation.mutateAsync(file)
      set({ [slot]: url } as Partial<SiteDraft>)
    } catch (err) {
      toast({
        title: 'Could not upload that image',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setUploading(null)
    }
  }

  const isFullWidth = value.theme.maxWidth === FULL_WIDTH
  const storedWidth =
    typeof value.theme.maxWidth === 'number' ? value.theme.maxWidth : DEFAULT_SITE_CONTENT_WIDTH
  /* A width saved before the set closed has no option of its own, so the picker
     shows the one the storefront actually renders it at. */
  const selectedWidth = nearestContentWidth(storedWidth)
  const isLegacyWidth = !isFullWidth && selectedWidth !== storedWidth

  const bodyContrast = contrastRatio(value.theme.background, value.theme.foreground)
  const brandContrast = contrastRatio(value.theme.background, value.theme.brand)

  const save = async () => {
    /*
     * Only non-empty values are sent. The backend's schema is `.optional()`, not
     * `.nullable()`, so "leave this unset" is expressed by omitting the key —
     * sending an empty string would store one.
     */
    /*
     * Both fonts go up as selections — `{ family }` — not as pasted text. The
     * backend looks each family up in the font library and stores its
     * `{ family, url }`. Sending the family alone is what keeps the stylesheet
     * URL something only the server's parser can produce.
     */
    /*
     * The brand modes and heights go up UNCONDITIONALLY, unlike the string
     * fields below which are omitted when blank.
     *
     * A mode always has one of two values, so there is no "blank" to omit. And
     * omitting a height would make "put this back to the default" inexpressible
     * — an omitted key means "leave unchanged" under the partial upsert, so the
     * old value would simply stay. Both are always valid: the mode comes from a
     * two-option control and the height is clamped to the permitted range
     * before it reaches the draft.
     */
    const input: StoreSettingsInput = {
      theme: {
        ...value.theme,
        font: { family: value.theme.font.family },
        adminFont: {
          family: value.theme.adminFont?.family ?? DEFAULT_THEME.adminFont!.family,
        },
      },
      headerBrandMode: value.headerBrandMode,
      footerBrandMode: value.footerBrandMode,
      headerLogoHeight: value.headerLogoHeight,
      footerLogoHeight: value.footerLogoHeight,
    }
    if (value.storeName.trim()) input.storeName = value.storeName.trim()
    if (value.siteNameAccent.trim()) input.siteNameAccent = value.siteNameAccent.trim()
    if (value.logoUrl.trim()) input.logoUrl = value.logoUrl.trim()
    if (value.footerLogoUrl.trim()) input.footerLogoUrl = value.footerLogoUrl.trim()
    /*
     * `siteUrl`, `metaTitle` and `metaDescription` are deliberately NOT sent
     * any more — SEO → General owns them now. Still loaded into this page's
     * draft above (harmlessly, and so the diff stays small), but writing them
     * from here would make this screen and the SEO one fight over the same three
     * columns: whichever was saved second would win with whatever it had loaded,
     * which is exactly the clobbering the disjoint-key-set rule exists to
     * prevent.
     */
    if (value.copyrightText.trim()) input.copyrightText = value.copyrightText.trim()

    try {
      const saved = await updateMutation.mutateAsync(input)
      /*
       * Re-seed from what the backend actually stored rather than from the
       * draft: the selections went up as bare family names and come back as
       * resolved `{ family, url }` pairs, and the pickers read the family off
       * the theme.
       */
      draft.markSaved({ ...value, theme: saved.theme ?? value.theme })
      toast({ title: 'Site settings saved' })
    } catch (err) {
      toast({
        title: 'Could not save the site settings',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : 'Could not load the site settings.'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Loads every library font so the pickers below can preview each one in
          the face it names. Removed when this page unmounts. */}
      <FontStylesheets fonts={fonts} />

      <PageHeader title={TITLE} description={DESCRIPTION} />

      <p className="text-xs text-muted-foreground">
        Storefront pages are cached briefly, so changes here appear on the site within a few
        minutes.
      </p>

      {/*
        Read-only, and deliberately so. The toggle and the "which page" selector
        are ONE decision, and both live on the Landing Pages screen — splitting
        them across two screens is how a merchant ends up with the toggle on and
        the wrong page live. This line exists so the setting is still findable
        by someone who came looking for it here.
      */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
        <span className="text-muted-foreground">Your home page currently shows</span>
        <strong className="text-foreground">
          {data?.siteMode === 'LANDING_PAGE' ? 'a single landing page' : 'the full website'}
        </strong>
        <Link
          to="/ui/landing-pages"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Change this on Landing Pages
        </Link>
      </div>

      {/*
        The description states what the code actually does. It previously
        promised a fallback chain the storefront never ran — both logos were
        stored and served, and Header.tsx and Footer.tsx rendered the wordmark
        regardless. Now that the fallback is real, the copy also has to say the
        thing that surprises people: the CHOICE decides, not the upload.
      */}
      <EditorSection
        title="Branding"
        description="Choose what your header and footer each show — your site name as text, or a logo. They are set separately, so you can run a logo up top and the name below. Headers and footers usually sit on different backgrounds, so each takes its own artwork; a footer with no logo of its own uses the header's, and a slot set to Logo with no image falls back to showing your site name."
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            <BrandModeField
              label="Header shows"
              slot="header"
              mode={value.headerBrandMode}
              onChange={(headerBrandMode) => set({ headerBrandMode })}
            />
            <LogoField
              label="Header logo"
              url={value.logoUrl}
              busy={uploading === 'logoUrl'}
              onPick={(file) => handleUpload('logoUrl', file)}
              onClear={() => set({ logoUrl: '' })}
            />
            {/* Only meaningful while the slot is actually showing a logo. */}
            {value.headerBrandMode === 'LOGO' && (
              <LogoHeightField
                id="header-logo-height"
                value={value.headerLogoHeight}
                onChange={(headerLogoHeight) => set({ headerLogoHeight })}
              />
            )}
            {value.headerBrandMode === 'LOGO' && !value.logoUrl && (
              <NoArtworkNote />
            )}
          </div>

          <div className="flex flex-col gap-3">
            <BrandModeField
              label="Footer shows"
              slot="footer"
              mode={value.footerBrandMode}
              onChange={(footerBrandMode) => set({ footerBrandMode })}
            />
            <LogoField
              label="Footer logo"
              url={value.footerLogoUrl}
              busy={uploading === 'footerLogoUrl'}
              onPick={(file) => handleUpload('footerLogoUrl', file)}
              onClear={() => set({ footerLogoUrl: '' })}
              /* Shown on the dark footer, so the preview matches where it lands. */
              dark
            />
            {value.footerBrandMode === 'LOGO' && (
              <LogoHeightField
                id="footer-logo-height"
                value={value.footerLogoHeight}
                onChange={(footerLogoHeight) => set({ footerLogoHeight })}
              />
            )}
            {/*
              The footer borrows the header's artwork rather than going blank,
              so "no footer logo" is only a problem when there is no header logo
              either. Saying which of the two will happen beats leaving the
              merchant to reload the storefront and find out.
            */}
            {value.footerBrandMode === 'LOGO' &&
              !value.footerLogoUrl &&
              (value.logoUrl ? (
                <p className="text-xs text-muted-foreground">
                  No footer logo set, so the footer will use the header logo.
                </p>
              ) : (
                <NoArtworkNote />
              ))}
          </div>
        </div>
      </EditorSection>

      <EditorSection title="Identity" description="How the store names itself.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Labelled id="store-name" label="Site name">
            <Input
              id="store-name"
              value={value.storeName}
              onChange={(e) => set({ storeName: e.target.value })}
              placeholder="Gadgets"
            />
          </Labelled>
          <Labelled
            id="site-name-accent"
            label="Accent half"
            hint="Rendered in the accent colour after the site name, e.g. Gadgets|Mart."
          >
            <Input
              id="site-name-accent"
              value={value.siteNameAccent}
              onChange={(e) => set({ siteNameAccent: e.target.value })}
              placeholder="Mart"
            />
          </Labelled>
        </div>
        <Labelled
          id="copyright-text"
          label="Copyright text"
          hint="Shown in the footer. Leave empty to omit the line entirely."
        >
          <Input
            id="copyright-text"
            value={value.copyrightText}
            onChange={(e) => set({ copyrightText: e.target.value })}
            placeholder="Gadgets Mart - Electronics Store."
          />
        </Labelled>
      </EditorSection>

      {/*
        The SEO fields that used to sit here now live under SEO → General,
        alongside the robots, sitemap, structured-data and verification settings
        they belong with. The columns are unchanged and so are their values —
        only the screen that edits them moved.

        A signpost rather than a silent removal: a merchant who knew these were
        on this page needs to be told where they went, once. Worth deleting after
        a release or two, when nobody is still looking for them here.
      */}
      <EditorSection
        title="SEO"
        description="Search engine settings have moved to the SEO section in the sidebar, where they sit with indexing, sitemap and structured data. Your existing title, description and site address are unchanged."
      >
        <Link
          to="/seo/general"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Go to SEO → General
        </Link>
      </EditorSection>

      {/*
        Two independent selections from one library. Pasting an embed happens
        under UI → Fonts, once per font; this page only chooses between what is
        already there. Each option is rendered in the face it names, because a
        list of font names set in the admin's own typeface tells a merchant
        nothing about the decision they are making.
      */}
      <EditorSection
        title="Fonts"
        description="Choose a typeface for the storefront and one for this admin panel. They are independent. Add more under UI → Fonts."
      >
        {fontsError ? (
          <p className="text-sm text-destructive">
            Could not load the font library.{' '}
            <Link to={FONTS_PATH} className="underline underline-offset-4">
              Open UI → Fonts
            </Link>
          </p>
        ) : fontsLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : fonts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            The font library is empty.{' '}
            <Link
              to={`${FONTS_PATH}/new`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Add a font
            </Link>{' '}
            to choose one here.
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            <FontPicker
              name="storefront-font"
              label="Storefront"
              hint="What customers see on every page of the shop."
              fonts={fonts}
              selected={value.theme.font.family}
              onSelect={(family) =>
                setTheme({ font: { ...value.theme.font, family } })
              }
            />
            <FontPicker
              name="admin-font"
              label="Admin panel"
              hint="What you see here. Takes effect as soon as you save."
              fonts={fonts}
              selected={value.theme.adminFont?.family ?? DEFAULT_THEME.adminFont!.family}
              onSelect={(family) =>
                setTheme({
                  adminFont: {
                    ...(value.theme.adminFont ?? DEFAULT_THEME.adminFont!),
                    family,
                  },
                })
              }
            />
          </div>
        )}
      </EditorSection>

      <EditorSection
        title="Colours"
        description="Applied across the whole storefront — every button, link, price and badge follows these."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {THEME_COLOR_FIELDS.map((field) => (
            <ColorField
              key={field.key}
              label={field.label}
              hint={field.hint}
              value={value.theme[field.key as ThemeColorKey]}
              onChange={(next) => setTheme({ [field.key]: next } as Partial<Theme>)}
            />
          ))}
        </div>

        {/* Advisory, never blocking: a merchant owns their brand, and a hard
            gate on contrast would be the wrong call. */}
        <div className="flex flex-col gap-1 text-xs">
          <ContrastNote label="Body text on background" ratio={bodyContrast} />
          <ContrastNote label="Brand on background" ratio={brandContrast} />
        </div>
      </EditorSection>

      <EditorSection
        title="Content width"
        description="How wide the site's content runs. Applies to the header, footer and every page."
      >
        {/*
          Fixed options, not a pixel field. The homepage hero is laid out from
          this value, and at an arbitrary width its slider took a shape no
          artwork had been cut for — the banner ended up sitting inside empty
          bands. Each option below keeps every hero slot's ratio and only scales
          it, so switching width never means re-uploading a banner.
        */}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SITE_CONTENT_WIDTHS.map((option) => (
            <WidthOption
              key={option.value}
              label={option.label}
              detail={`${option.value} px`}
              hint={option.hint}
              selected={!isFullWidth && selectedWidth === option.value}
              onSelect={() => setTheme({ maxWidth: option.value })}
            />
          ))}
          <WidthOption
            label="Full width"
            detail="100%"
            hint="Spans the screen, keeping the normal side padding"
            selected={isFullWidth}
            onSelect={() => setTheme({ maxWidth: FULL_WIDTH })}
          />
        </div>
        {isLegacyWidth && (
          <p className="text-xs text-warning">
            This store was saved at {value.theme.maxWidth}px, which is no longer offered. The
            storefront renders it at the nearest option, {selectedWidth}px — saving here makes that
            official.
          </p>
        )}
      </EditorSection>

      <EditorActions
        isDirty={draft.isDirty}
        isSaving={updateMutation.isPending}
        onReset={draft.reset}
        onSave={save}
      />

      <UnsavedChangesDialog blocker={blocker} />
    </div>
  )
}

/**
 * Which of the two things one brand slot shows.
 *
 * Two buttons with `aria-pressed` rather than a select, matching how this page
 * already expresses a chosen-one-of (see `WidthOption`). With only two options
 * both are visible at once, so the merchant reads the choice instead of opening
 * a list to discover it.
 */
function BrandModeField({
  label,
  slot,
  mode,
  onChange,
}: {
  label: string
  slot: 'header' | 'footer'
  mode: BrandDisplayMode
  onChange: (next: BrandDisplayMode) => void
}) {
  const options: { value: BrandDisplayMode; label: string }[] = [
    { value: 'TEXT', label: 'Site name' },
    { value: 'LOGO', label: 'Logo' },
  ]

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-sm font-medium text-foreground">{label}</legend>
      <div className="mt-1 flex gap-2">
        {options.map((option) => {
          const selected = mode === option.value
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              aria-label={`${slot} shows ${option.label}`}
              onClick={() => onChange(option.value)}
              className={
                'flex-1 rounded-md border px-3 py-2 text-sm transition-colors ' +
                (selected
                  ? 'border-primary bg-primary/5 font-medium text-foreground ring-1 ring-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50 hover:bg-muted/40')
              }
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

/**
 * A logo's displayed height.
 *
 * Clamped to the permitted range on commit rather than validated on submit: the
 * backend refuses anything outside it, and a toast after saving is a worse way
 * to learn the limit than simply not being able to leave it.
 *
 * Clamping happens on blur, not on every keystroke — clamping as the merchant
 * types rewrites "3" into "24" before they can reach "36".
 */
function LogoHeightField({
  id,
  value,
  onChange,
}: {
  id: string
  value: number
  onChange: (next: number) => void
}) {
  /*
   * The keystrokes in flight, or null when the field is showing the draft's
   * value. Derived rather than synced with an effect: an effect that mirrors a
   * prop into state runs a second render every time the draft changes, and
   * `Reset` would briefly show the old text before correcting itself.
   */
  const [typed, setTyped] = React.useState<string | null>(null)
  const text = typed ?? String(value)

  const commit = () => {
    setTyped(null)
    const parsed = Number.parseInt(text, 10)
    if (Number.isNaN(parsed)) return
    onChange(Math.min(LOGO_HEIGHT_LIMITS.max, Math.max(LOGO_HEIGHT_LIMITS.min, parsed)))
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Logo height</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={LOGO_HEIGHT_LIMITS.min}
          max={LOGO_HEIGHT_LIMITS.max}
          value={text}
          onChange={(e) => setTyped(e.target.value)}
          onBlur={commit}
          className="w-24"
        />
        <span className="text-xs text-muted-foreground">
          px ({LOGO_HEIGHT_LIMITS.min}–{LOGO_HEIGHT_LIMITS.max})
        </span>
      </div>
      <span className="text-xs text-muted-foreground">
        The width adjusts to your artwork, so any shape works.
      </span>
    </div>
  )
}

/** Shown when a slot is set to Logo but has no image to fall back on. */
function NoArtworkNote() {
  return (
    <p className="flex items-start gap-1.5 text-xs text-amber-600">
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
      No logo uploaded, so your site name is shown instead.
    </p>
  )
}

/** A labelled control with optional help text — this page has a lot of them. */
function Labelled({
  id,
  label,
  hint,
  children,
}: {
  id: string
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}

/** Native colour picker beside a hex box — the picker for choosing, the text for pasting a brand value. */
function ColorField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: string
  onChange: (next: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-9 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
          aria-label={`${label} colour picker`}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="font-mono text-xs"
          aria-label={`${label} hex value`}
        />
      </div>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </div>
  )
}

/**
 * One content-width choice.
 *
 * A row of radio-like cards rather than a `<select>`: there are five of them,
 * the difference between two is a number a merchant has no feel for, and the
 * hint is what makes the choice legible. Rendered as buttons with
 * `aria-pressed`, which is how the rest of the panel expresses a chosen-one-of.
 */
function WidthOption({
  label,
  detail,
  hint,
  selected,
  onSelect,
}: {
  label: string
  detail: string
  hint: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={
        'flex flex-col items-start gap-0.5 rounded-md border p-3 text-left transition-colors ' +
        (selected
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'border-border hover:border-primary/50 hover:bg-muted/40')
      }
    >
      <span className="flex w-full items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="font-mono text-xs text-muted-foreground">{detail}</span>
      </span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </button>
  )
}

function ContrastNote({ label, ratio }: { label: string; ratio: number | null }) {
  if (ratio === null) return null
  const passes = ratio >= AA_CONTRAST
  return (
    <span className={passes ? 'text-muted-foreground' : 'flex items-center gap-1.5 text-amber-600'}>
      {!passes && <TriangleAlert className="size-3.5 shrink-0" />}
      {label}: {ratio.toFixed(1)}:1
      {passes ? ' — meets AA for body text' : ` — below the ${AA_CONTRAST}:1 AA guideline`}
    </span>
  )
}

/** One logo slot: preview, pick, and clear. */
function LogoField({
  label,
  url,
  busy,
  onPick,
  onClear,
  dark,
}: {
  label: string
  url: string
  busy: boolean
  onPick: (file: File) => void
  onClear: () => void
  dark?: boolean
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div
        className={`flex h-24 items-center justify-center rounded-md border border-border p-2 ${
          dark ? 'bg-neutral-900' : 'bg-muted'
        }`}
      >
        {busy ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : url ? (
          <img src={url} alt={label} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className={`text-xs ${dark ? 'text-neutral-400' : 'text-muted-foreground'}`}>
            Not set
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
          {url ? 'Replace' : 'Upload'}
        </Button>
        {url && (
          <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={onClear}>
            Remove
          </Button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onPick(file)
          // Cleared so picking the same file twice still fires a change.
          e.target.value = ''
        }}
      />
    </div>
  )
}

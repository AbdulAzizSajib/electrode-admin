import * as React from 'react'
import { Link } from 'react-router'
import { Loader2, TriangleAlert } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
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
import { useUploadImage } from '@/lib/api/uploads'
import {
  useStoreSettings,
  useUpdateStoreSettings,
  nearestContentWidth,
  DEFAULT_SITE_CONTENT_WIDTH,
  DEFAULT_THEME,
  FULL_WIDTH,
  SITE_CONTENT_WIDTHS,
  THEME_COLOR_FIELDS,
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
  siteUrl: string
  metaTitle: string
  metaDescription: string
  copyrightText: string
  theme: Theme
  /**
   * The font as the merchant last typed it, separate from `theme.font` which is
   * what the backend parsed. Seeded with the stored URL because a bare URL is a
   * valid paste form — so an untouched field round-trips through exactly the
   * same validation as a fresh paste, with no unchecked "keep what's there"
   * path into the column.
   */
  fontInput: string
}

const EMPTY_DRAFT: SiteDraft = {
  storeName: '',
  siteNameAccent: '',
  logoUrl: '',
  footerLogoUrl: '',
  siteUrl: '',
  metaTitle: '',
  metaDescription: '',
  copyrightText: '',
  theme: DEFAULT_THEME,
  fontInput: DEFAULT_THEME.font.url,
}

/** WCAG AA for body text. Advisory here — a merchant owns their brand. */
const AA_CONTRAST = 4.5

export default function SiteSettingsPage() {
  const { data, isLoading, error } = useStoreSettings()
  const updateMutation = useUpdateStoreSettings()
  const uploadMutation = useUploadImage()

  const draft = useSettingsDraft<SiteDraft>(
    data && {
      storeName: data.storeName ?? '',
      siteNameAccent: data.siteNameAccent ?? '',
      logoUrl: data.logoUrl ?? '',
      footerLogoUrl: data.footerLogoUrl ?? '',
      siteUrl: data.siteUrl ?? '',
      metaTitle: data.metaTitle ?? '',
      metaDescription: data.metaDescription ?? '',
      copyrightText: data.copyrightText ?? '',
      theme: data.theme ?? DEFAULT_THEME,
      fontInput: (data.theme ?? DEFAULT_THEME).font.url,
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
    const input: StoreSettingsInput = {
      theme: { ...value.theme, font: value.fontInput.trim() },
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
      // Re-seed the font box from what the backend actually stored, so the
      // field shows the canonical URL rather than the raw paste.
      const savedTheme = saved.theme ?? value.theme
      draft.markSaved({
        ...value,
        theme: savedTheme,
        fontInput: savedTheme.font.url,
      })
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

      <EditorSection
        title="Logos"
        description="Headers and footers usually sit on different backgrounds, so each takes its own artwork. With no footer logo set, the header's is used; with neither, the site name is shown as text."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <LogoField
            label="Header logo"
            url={value.logoUrl}
            busy={uploading === 'logoUrl'}
            onPick={(file) => handleUpload('logoUrl', file)}
            onClear={() => set({ logoUrl: '' })}
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

      <EditorSection
        title="Font"
        description="Pick a font on fonts.google.com, then paste what it gives you — the @import rule, the <link> tag, or just the URL."
      >
        <Textarea
          value={value.fontInput}
          onChange={(e) => set({ fontInput: e.target.value })}
          rows={3}
          spellCheck={false}
          className="font-mono text-xs"
          placeholder={'@import url("https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap");'}
        />
        <p className="text-xs text-muted-foreground">
          Currently using <span className="font-medium text-foreground">{value.theme.font.family}</span>. The
          font is checked when you save; only Google Fonts addresses are accepted.
        </p>
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

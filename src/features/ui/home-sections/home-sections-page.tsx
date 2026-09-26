import * as React from 'react'
import { Link } from 'react-router'
import {
  PROMO_LAYOUT_LABEL,
  usePromoBannerGroups,
  type PromoBannerGroup,
} from '@/lib/api/promo-banner-groups'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  EyeOff,
  GripVertical,
  Plus,
  TriangleAlert,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import {
  EditorActions,
  EditorRow,
  UnsavedChangesDialog,
} from '@/features/ui/components/settings-editor'
import {
  moveItem,
  useSettingsDraft,
  useUnsavedChangesGuard,
} from '@/features/ui/components/settings-editor-utils'
import {
  ReorderableList,
  type DragHandleProps,
} from '@/features/ui/components/reorderable-list'
import {
  useStoreSettings,
  useUpdateStoreSettings,
  DEFAULT_HOME_CONFIG,
  HOME_SECTION_REGISTRY,
  PROMO_SECTION_KEY,
  SECTION_LINKED_ROUTES,
  type HomeConfig,
  type HomeSection,
  type HomeSectionKey,
  HERO_VARIANT_OPTIONS,
  type NavItem,
  type Newsletter,
  DEFAULT_PERKS,
  SETTINGS_LIMITS,
  type Perk,
} from '@/lib/api/store-settings'
import { CategoryLayoutPicker } from '@/features/ui/home-sections/category-layout-picker'
import { ProductRowLayoutPicker } from '@/features/ui/home-sections/product-row-layout-picker'

/**
 * Which sections the website's home page is built from, and in what order.
 *
 * Writes `homeConfig`, `newsletter` AND `perks`, and nothing else. `PATCH /settings` is a partial
 * upsert, so this page and the other settings editors are saved independently without any of them
 * clobbering another — the same disjoint-field-set arrangement Catalog Setting, Checkout Setting,
 * Header Links and Footer Links already rely on.
 *
 * Three keys rather than one because they are one decision for a merchant even though they are
 * three columns: whether a block exists, where it sits, and what it says. The newsletter's wording
 * used to live on Footer Links, back when the block was welded into the storefront footer and the
 * only way to remove it was to empty its heading; the perks band's wording was not editable at all
 * and lived in the storefront's source. Both are home page sections now, so their copy is here,
 * beside the switches that govern them.
 *
 * DISJOINTNESS STILL HOLDS — neither was an addition to a second writer. Footer Links no longer
 * sends `newsletter`, and nothing else has ever written `perks`, so exactly one editor writes each.
 * If you are adding a fourth key here, check nobody else writes it first.
 *
 * Every switch here is reversible at no cost, which is why none of them asks for confirmation:
 * turning a section off removes it from the home page and nothing else. The products, banners,
 * testimonials and posts it was showing are all untouched and still reachable at their own URLs,
 * so turning it back on restores exactly what was there.
 *
 * THE HOME PAGE ONLY. The header, footer, announcement bar and mobile menu are on every page of
 * the website, not just this one, and are deliberately not listed here.
 */

const TITLE = 'Home sections'
const DESCRIPTION =
  'The blocks your home page is built from, top to bottom. Drag to reorder, or switch a section off to hide it — nothing it shows is deleted, so you can switch it back on at any time.'

/** Look-up from key to the merchant-facing name and description. */
const SECTION_INFO = new Map(HOME_SECTION_REGISTRY.map((section) => [section.key, section]))

/**
 * The rows that render products and offer a grid-or-slider choice.
 *
 * Mirrors the three `PRODUCT_ROW_VARIANTS` entries in the backend's
 * `HOME_SECTION_VARIANTS`. `DEAL_OF_WEEK` renders products too and is
 * deliberately absent: its cards share a grid with a countdown panel, so it
 * offers no choice and the backend rejects a layout on it.
 */
const PRODUCT_ROW_KEYS: HomeSectionKey[] = ['BEST_SELLING', 'FEATURED_PRODUCTS', 'NEW_ARRIVALS']

/**
 * Which header links each section would hide if it were switched off, by their stored labels.
 *
 * Built from the WHOLE nav regardless of what is currently enabled, because the caller asks per
 * section and only shows the answer for the sections that are off. Dropdown children count: the
 * storefront hides a child on its own target, so a section can be suppressing a link the
 * merchant only sees one level down.
 *
 * A label the merchant left blank falls back to the target, since an empty string in a sentence
 * naming what is hidden tells them nothing about which row to go and look at.
 */
function navLabelsBySection(mainNav: NavItem[]): Map<HomeSectionKey, string[]> {
  const bySection = new Map<HomeSectionKey, string[]>()

  const record = (item: { label: string; href: string }) => {
    const key = SECTION_LINKED_ROUTES[item.href]
    if (!key) return

    const existing = bySection.get(key) ?? []
    existing.push(item.label.trim() || item.href)
    bySection.set(key, existing)
  }

  mainNav.forEach((item) => {
    record(item)
    item.children?.forEach(record)
  })

  return bySection
}

/** Everything this page owns, held as one draft so dirty-tracking stays one flag. */
interface HomeSectionsDraft {
  sections: HomeConfig
  newsletter: Newsletter
  perks: Perk[]
}

const EMPTY_NEWSLETTER: Newsletter = { heading: '', subtext: '', placeholder: '', buttonLabel: '' }

/**
 * A fresh, blank column for the perks band.
 *
 * Blank rather than pre-filled with an example: the backend requires all three
 * fields, so a seeded row would either be saved verbatim onto the merchant's
 * live home page or have to be cleared before it could be filled in.
 */
const BLANK_PERK: Perk = { icon: '', title: '', description: '' }

/**
 * One section: what it is, where it sits, and whether it is shown.
 *
 * Carries BOTH a drag handle and a pair of move buttons. The drag handle is the fast path, but
 * native drag cannot be operated by keyboard and is unreliable on touch — and a good share of
 * merchants run this panel from a tablet. The buttons are what make the order reachable for them,
 * so they are not redundant with the handle; they are the accessible version of it.
 */
function SectionRow({
  section,
  index,
  count,
  dragHandleProps,
  onMove,
  onToggle,
  settings,
  settingsError,
  open: controlledOpen,
  onOpenChange,
  hiddenNavLabels,
  promoGroup,
}: {
  section: HomeSection
  index: number
  count: number
  dragHandleProps: DragHandleProps
  onMove: (from: number, to: number) => void
  onToggle: (enabled: boolean) => void
  /** This section's own fields, revealed by a disclosure control. Omit for a section with none. */
  settings?: React.ReactNode
  /**
   * Why the last save was refused because of THIS section's fields, if it was.
   * Rendered outside the panel, since the panel may be shut.
   */
  settingsError?: string
  /**
   * The disclosure's state, for a section whose panel the PAGE needs to be able
   * to open — a save refused over a field in there has to be able to show the
   * merchant the field. Omit to let the row own it, which is what every other
   * section does.
   *
   * Controlled rather than a "force open" flag or an effect watching one: the
   * page opens the panel from the same event handler that refuses the save, so
   * nothing has to synchronise two copies of one piece of state afterwards.
   */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /**
   * Header links this section is currently hiding, by label. Empty unless the section is off and
   * the merchant has a link pointing at a destination this section fills.
   */
  hiddenNavLabels: string[]
  /** This row's promo strip, when the row is a promo entry. Names the row. */
  promoGroup?: PromoBannerGroup
}) {
  const info = SECTION_INFO.get(section.key)

  /*
   * IDs CARRY THE GROUP, because `MID_BANNERS` appears once per promo strip and
   * a duplicated `id` makes every `htmlFor` on the page point at the first row's
   * switch — clicking the third strip's label would toggle the first. The
   * `?? ''` keeps the id stable for the eleven sections that carry no group.
   */
  const rowId = `${section.key}${section.groupId ? `-${section.groupId}` : ''}`
  const switchId = `home-section-${rowId}`
  const panelId = `home-section-${rowId}-settings`
  /*
   * Uncontrolled by default. `controlledOpen` wins when the page passed one,
   * which it does for the section whose panel a refused save must be able to
   * open; the local state is then simply never read.
   */
  const [selfOpen, setSelfOpen] = React.useState(false)
  const open = controlledOpen ?? selfOpen
  const setOpen = onOpenChange ?? setSelfOpen

  /*
   * A promo row is named after its GROUP, not after the section.
   *
   * With several strips on a page, three rows all reading "Promo banners" tell
   * a merchant nothing about which one they are reordering or switching off —
   * the name they gave the strip is the only thing that distinguishes them.
   * Falls back to the registry label for a row whose group has not loaded yet.
   */
  const rowLabel =
    section.key === PROMO_SECTION_KEY
      ? (promoGroup?.name ?? info?.label ?? section.key)
      : (info?.label ?? section.key)

  const rowDescription =
    section.key === PROMO_SECTION_KEY
      ? promoGroup
        ? `Promo banners · ${PROMO_LAYOUT_LABEL[promoGroup.layout].label.toLowerCase()} · ${promoGroup.bannerCount} image${promoGroup.bannerCount === 1 ? '' : 's'}`
        : 'A promotional banner strip.'
      : info?.description

  return (
    /*
     * A fragment, so the settings panel below is a SIBLING of the draggable row rather than a
     * child of it. That is not a layout preference — a text input inside a `draggable` ancestor
     * cannot be selected with the mouse in Chrome or Firefox, because the drag intercepts the
     * gesture. Keeping the panel out of that subtree fixes it structurally; `draggable={false}`
     * or a `stopPropagation` on the panel would also work today and would quietly stop working.
     */
    <>
    <div
      {...dragHandleProps}
      className={`flex items-center gap-3 rounded-md border border-border bg-card p-3 ${
        section.enabled ? '' : 'opacity-60'
      } ${settings && open ? 'rounded-b-none' : ''}`}
    >
      {/* Presentational: the drag affordance lives on the whole row, and the
          buttons beside it are what a keyboard reaches. */}
      <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Label htmlFor={switchId} className="cursor-pointer">
          {rowLabel}
        </Label>
        <span className="text-xs text-muted-foreground">{rowDescription}</span>

        {/*
          READ-ONLY, and a link rather than a control. The hero's arrangement is
          part of `homeConfig` and could be edited from this row — but it is
          chosen on Home Slider, where a merchant can see each arrangement drawn
          and where the artwork guidance moves with the choice. Offering it in
          two places would mean two screens writing the same field with only one
          of them able to show what the answer means.

          The row still names the current arrangement, because a merchant
          looking for the setting where the rest of the homepage's layout lives
          must find a pointer rather than nothing.
        */}
        {section.key === 'HERO' && (
          <span className="text-xs text-muted-foreground">
            Layout:{' '}
            <span className="text-foreground">
              {HERO_VARIANT_OPTIONS.find((o) => o.value === (section.variant ?? 'SPLIT_THREE'))
                ?.label ?? 'Slider with three tiles'}
            </span>
            {' · '}
            <Link
              to="/ui/home-slider"
              className="relative underline underline-offset-2 hover:text-foreground"
            >
              Change on Home slider
            </Link>
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {/*
          Only the sections that have something to configure get this. Deliberately NOT gated on
          `section.enabled`: a merchant may well write the copy before switching the block on, and
          hiding the fields behind the switch would make that impossible. The dimmed row is signal
          enough that it is off.
        */}
        {settings ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={`${open ? 'Hide' : 'Show'} ${rowLabel} settings`}
          >
            <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </Button>
        ) : null}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={index === 0}
          onClick={() => onMove(index, index - 1)}
          aria-label={`Move ${rowLabel} up`}
        >
          <ArrowUp className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={index === count - 1}
          onClick={() => onMove(index, index + 1)}
          aria-label={`Move ${rowLabel} down`}
        >
          <ArrowDown className="size-4" />
        </Button>
        <Switch
          id={switchId}
          checked={section.enabled}
          onCheckedChange={onToggle}
          aria-label={`Show ${rowLabel}`}
        />
      </div>
    </div>

    {settings && open ? (
      <div
        id={panelId}
        className="flex flex-col gap-3 rounded-b-md border border-t-0 border-border bg-muted/40 p-3"
      >
        {settings}
      </div>
    ) : null}

    {/*
      Why the last save was refused, outside the panel so it survives the panel being shut —
      the same reason the nav notice below is outside the draggable row.
    */}
    {settingsError ? (
      <p className="px-3 pb-1 text-xs text-destructive">{settingsError}</p>
    ) : null}

    {/*
      What switching this section off did BEYOND the home page.
      The storefront hides a header link whose destination this section fills, so the merchant's
      menu changed too — and this row is where they made that decision, so this is where it has
      to be said. Outside the draggable row for the same reason the settings panel is.
      See server/openspec/changes/align-nav-links-with-home-sections.
    */}
    {hiddenNavLabels.length > 0 ? (
      <p className="flex items-start gap-1.5 px-3 pb-1 text-xs text-muted-foreground">
        <EyeOff className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          Also hiding {hiddenNavLabels.length === 1 ? 'the header link' : 'the header links'}{' '}
          <span className="font-medium text-foreground">{hiddenNavLabels.join(', ')}</span>.
        </span>
      </p>
    ) : null}
    </>
  )
}

/**
 * The newsletter block's wording.
 *
 * Here rather than on Footer Links because the block is no longer in the footer — it is a home
 * page section, and its copy belongs beside the switch that decides whether it appears at all.
 *
 * Every field may be left empty. The storefront renders the form regardless and simply omits a
 * line it has no text for, so emptying the heading is NOT how a merchant removes this block —
 * the switch on the row above is. That used to be the only way, and it was an accident rather
 * than a design.
 */
function NewsletterFields({
  value,
  onChange,
}: {
  value: Newsletter
  onChange: (patch: Partial<Newsletter>) => void
}) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="newsletter-heading">Heading</Label>
        <Input
          id="newsletter-heading"
          value={value.heading}
          onChange={(e) => onChange({ heading: e.target.value })}
          placeholder="Join our newsletter"
          maxLength={200}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="newsletter-subtext">Supporting text</Label>
        <Textarea
          id="newsletter-subtext"
          value={value.subtext}
          onChange={(e) => onChange({ subtext: e.target.value })}
          placeholder="Tell customers what they get for signing up."
          maxLength={500}
          rows={2}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="newsletter-placeholder">Input placeholder</Label>
          <Input
            id="newsletter-placeholder"
            value={value.placeholder ?? ''}
            onChange={(e) => onChange({ placeholder: e.target.value })}
            placeholder="Email"
            maxLength={100}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="newsletter-button">Button label</Label>
          <Input
            id="newsletter-button"
            value={value.buttonLabel ?? ''}
            onChange={(e) => onChange({ buttonLabel: e.target.value })}
            placeholder="Subscribe"
            maxLength={50}
          />
        </div>
      </div>

      {/*
        Said plainly, because the form looks like it works and does not. A merchant who believes
        they are collecting addresses and is not has a worse problem than one who knows.
      */}
      <p className="text-xs text-muted-foreground">
        Sign-ups are not collected anywhere yet — the form is shown, but nothing is stored when a
        customer submits it.
      </p>
    </>
  )
}

/**
 * The perks band's columns — the coloured strip reading "Free Shipping / Money
 * Return / …" that used to be four objects in the storefront's own source.
 *
 * Here rather than on a screen of its own for the same reason the newsletter's
 * wording is: the band is a home page section, and what it says belongs beside
 * the switch that decides whether it appears and the handle that decides where
 * it sits. A separate screen would also have meant a second writer of the row
 * this page already saves.
 *
 * ALL THREE FIELDS ARE REQUIRED, which is why this panel validates rather than
 * letting the save fail: the band is a row of aligned columns, so a perk with
 * no icon is a hole in it and one with no title is a mark floating over a
 * sentence. The backend refuses both; this says so before the round trip.
 *
 * NO ICON PREVIEW, and deliberately. The storefront resolves Iconify names and
 * this panel has no Iconify dependency, so anything drawn here would be a
 * second guess at what the site renders — the same call the header links editor
 * already made. The field takes the name; the site draws the mark.
 */
function PerksFields({
  value,
  errors,
  onChange,
}: {
  value: Perk[]
  /** Keyed `<index>-<field>`, as the page's `perkErrors` builds them. */
  errors: Record<string, string>
  onChange: (next: Perk[]) => void
}) {
  const atCapacity = value.length >= SETTINGS_LIMITS.perks

  /** This row's first complaint, so the row border and its message agree. */
  const rowError = (index: number) =>
    errors[`${index}-icon`] ?? errors[`${index}-title`] ?? errors[`${index}-description`]

  const setPerk = (index: number, key: keyof Perk, next: string) =>
    onChange(value.map((perk, i) => (i === index ? { ...perk, [key]: next } : perk)))

  return (
    <>
      {value.length === 0 ? (
        <p className="py-2 text-center text-sm text-muted-foreground">
          No perks yet. The band stays off the page until you add one, even with the section
          switched on.
        </p>
      ) : null}

      {value.map((perk, index) => (
        <EditorRow
          /*
           * BY INDEX, like every other repeatable list in these editors. A perk
           * carries no id — it is three strings the merchant types — so there is
           * nothing else stable to key on, and the rows are only ever added,
           * removed or moved as a whole.
           */
          key={index}
          index={index}
          count={value.length}
          error={rowError(index)}
          removeLabel="Remove perk"
          onMove={(from, to) => onChange(moveItem(value, from, to))}
          onRemove={() => onChange(value.filter((_, i) => i !== index))}
        >
          {(errorId) => (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.4fr]">
              <Input
                value={perk.icon}
                onChange={(e) => setPerk(index, 'icon', e.target.value)}
                placeholder="Icon (e.g. lucide:truck)"
                aria-label={`Perk ${index + 1} icon name`}
                maxLength={SETTINGS_LIMITS.iconLength}
                aria-invalid={Boolean(errors[`${index}-icon`])}
                aria-describedby={errors[`${index}-icon`] ? errorId : undefined}
              />
              <Input
                value={perk.title}
                onChange={(e) => setPerk(index, 'title', e.target.value)}
                placeholder="Free Shipping"
                aria-label={`Perk ${index + 1} title`}
                maxLength={SETTINGS_LIMITS.perkTitleLength}
                aria-invalid={Boolean(errors[`${index}-title`])}
                aria-describedby={errors[`${index}-title`] ? errorId : undefined}
              />
              <Input
                value={perk.description}
                onChange={(e) => setPerk(index, 'description', e.target.value)}
                placeholder="For orders over ৳130."
                aria-label={`Perk ${index + 1} supporting line`}
                maxLength={SETTINGS_LIMITS.perkDescriptionLength}
                aria-invalid={Boolean(errors[`${index}-description`])}
                aria-describedby={errors[`${index}-description`] ? errorId : undefined}
              />
            </div>
          )}
        </EditorRow>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {atCapacity
            ? `${SETTINGS_LIMITS.perks} is the most the band holds — it is one row of equal columns.`
            : `Up to ${SETTINGS_LIMITS.perks} columns. Icon names come from iconify.design.`}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={atCapacity}
          onClick={() => onChange([...value, BLANK_PERK])}
        >
          <Plus className="size-4" />
          Add perk
        </Button>
      </div>
    </>
  )
}

export default function HomeSectionsPage() {
  const { data, isLoading, error } = useStoreSettings()
  // Names the promo rows below. Its own query rather than part of the settings
  // read: a strip's name changes far more often than the rest of this payload.
  const { data: promoGroups } = usePromoBannerGroups()
  const updateMutation = useUpdateStoreSettings()

  /*
   * An unconfigured store seeds from the same defaults the backend falls back to, so the list shows
   * what the home page is actually doing rather than reading as though every section were off.
   * `data &&` matters: until the record arrives the draft has no loaded value, and
   * `useSettingsDraft` treats that as not-yet-dirty rather than as a merchant's choice.
   *
   * A stored list may be SHORTER than the registry — that is a config saved before a section
   * shipped, not a corrupt one. Missing sections are appended below rather than dropped, mirroring
   * what the backend's own reconciliation does on the read path. Without this the merchant would
   * simply never see the new section, and could not switch it on.
   */
  const draft = useSettingsDraft<HomeSectionsDraft>(
    data && {
      sections: data.homeConfig ?? DEFAULT_HOME_CONFIG,
      newsletter: data.newsletter ?? EMPTY_NEWSLETTER,
      /*
       * DEFAULT_PERKS, not an empty list — the same reason the sections seed
       * from `DEFAULT_HOME_CONFIG` one line up. The admin read returns the row
       * AS STORED, so a store that has never touched this panel has null here
       * while its home page is visibly rendering four columns; seeding blank
       * would show the merchant an empty editor for a band they can see on
       * their own site, and their first save would then delete it.
       */
      perks: data.perks ?? DEFAULT_PERKS,
    },
    { sections: DEFAULT_HOME_CONFIG, newsletter: EMPTY_NEWSLETTER, perks: DEFAULT_PERKS },
  )
  const blocker = useUnsavedChangesGuard(draft.isDirty)

  /*
   * One draft holding both, so dirty-tracking and the unsaved-changes guard cover a wording edit
   * exactly as they cover a reorder. `useSettingsDraft` is unchanged — it holds one value, and one
   * value is what it gets.
   */
  const stored = draft.value.sections
  const { newsletter, perks } = draft.value
  const setSections = (next: HomeConfig) => draft.set({ ...draft.value, sections: next })
  const setNewsletter = (patch: Partial<Newsletter>) =>
    draft.set({ ...draft.value, newsletter: { ...newsletter, ...patch } })
  const setPerks = (next: Perk[]) => {
    draft.set({ ...draft.value, perks: next })
    // A row the merchant has just edited must stop complaining at once rather
    // than staying red until the next save proves it fixed.
    setPerkErrors((current) => (Object.keys(current).length > 0 ? {} : current))
  }

  /*
   * Which perk fields are blank, keyed `<index>-<field>`.
   *
   * Computed on SAVE rather than as you type, like Header Links: a row is
   * incomplete the whole time it is being filled in, and marking it red from
   * the first keystroke would tell the merchant they had made a mistake while
   * they were still typing. Cleared whenever the list changes so a fixed row
   * stops complaining immediately.
   */
  const [perkErrors, setPerkErrors] = React.useState<Record<string, string>>({})

  /*
   * The perks panel's disclosure, held here rather than in its row.
   *
   * A save refused over a blank perk must be able to OPEN that panel: it is
   * shut by default, so the offending inputs are not even in the DOM, and the
   * toast would be pointing at fields nobody can see or focus. Owning the flag
   * here lets the refusal open it from the same handler, with no effect
   * watching a signal and no second copy of the state to keep in step.
   */
  const [perksPanelOpen, setPerksPanelOpen] = React.useState(false)

  const known = new Set<HomeSectionKey>(HOME_SECTION_REGISTRY.map((s) => s.key))

  /*
   * The promo strips, so each promo row can name itself.
   *
   * Read-only here. This page owns `homeConfig` — where a strip sits and whether
   * it is on — while the strip's NAME, LAYOUT and ARTWORK belong to the Promo
   * Banners manager. Two screens writing one row is the hazard the hero's layout
   * picker was moved to Home Slider to avoid, and the same answer applies.
   */
  const promoGroupsById = new Map(
    (promoGroups ?? []).map((group) => [group.id, group] as const),
  )

  /*
   * What the merchant edits: their stored order with anything unrecognised dropped and anything
   * missing appended, enabled. The appended-at-the-end placement is a deliberate simplification of
   * the backend's rule (which splices at the registry position) — the merchant can see the new row
   * and drag it where they want, and the save then makes their choice explicit.
   *
   * THE FILTER KEEPS THE WHOLE ENTRY, and that is load-bearing rather than incidental. A stored
   * section may carry fields this page does not edit — the hero's `variant`, chosen on Home
   * Slider — and this page sends `homeConfig` back WHOLESALE on save. Rebuilding entries as
   * `{ key, enabled }` here would therefore wipe the hero's layout on the next unrelated save from
   * this screen: the merchant reorders their sections, and their hero silently reverts. The same
   * hazard `reconcileHomeConfig` carries on the server. `hero-variant-preserved.test.tsx` guards it.
   *
   * The appended entries below carry no `variant` on purpose — a section the store has never saved
   * has no layout to preserve, and the server resolves an absent one to that section's default.
   */
  const sections: HomeConfig = [
    ...stored.filter((section) => known.has(section.key)),
    /*
     * PROMO_SECTION_KEY IS EXCLUDED FROM THE APPEND, and that exclusion is
     * load-bearing.
     *
     * This append exists to surface a section the store has never saved. It
     * cannot do that for promo banners: a promo entry must NAME a group, and
     * "which group" has no answer here — the key alone does not identify the
     * row. Appending a groupless `{ key: 'MID_BANNERS', enabled: true }` would
     * be rejected by the server's write schema, so the merchant's next save
     * from this page would fail outright with an error about a section they
     * never touched.
     *
     * Promo strips reach this list a different way: the server splices an entry
     * in per group on read, so a newly created strip is already in `stored` by
     * the time this page loads it.
     */
    ...HOME_SECTION_REGISTRY.filter(
      (entry) =>
        entry.key !== PROMO_SECTION_KEY &&
        !stored.some((section) => section.key === entry.key),
    ).map((entry) => ({ key: entry.key, enabled: true })),
  ]

  const allHidden = sections.every((section) => !section.enabled)

  /*
   * The header links each section would suppress, from the SAVED `mainNav` — this page does not
   * own that field and must not send it.
   *
   * Looked up per row against the LIVE DRAFT's enabled flag, so flipping a switch updates the
   * notice immediately rather than after a save. That is the opposite choice from the one Header
   * Links makes, and deliberately: there the merchant is being told what their site is doing
   * right now, here they are being shown the consequence of the switch under their finger.
   */
  const navLabels = navLabelsBySection(data?.mainNav ?? [])

  /**
   * The perks band's rows, checked before the round trip.
   *
   * The backend requires all three fields on every perk and would refuse the
   * whole save — including the reorder the merchant may have come here to make
   * — over one blank input inside a collapsed panel. Naming the failing FIELD
   * rather than the row is what lets each input mark itself `aria-invalid` and
   * point at the message, instead of the row turning red and leaving the
   * merchant to guess which of its three inputs is meant. Every blank field in
   * a row is reported at once, so nobody learns about the second one on the
   * next attempt.
   *
   * Only emptiness is checked here. Length is capped by `maxLength` on the
   * inputs, and whether an icon name actually resolves is a question only the
   * storefront can answer.
   */
  const validatePerks = (): boolean => {
    const errors: Record<string, string> = {}

    perks.forEach((perk, index) => {
      if (!perk.icon.trim()) errors[`${index}-icon`] = 'Every perk needs an icon name'
      if (!perk.title.trim()) errors[`${index}-title`] = 'Every perk needs a title'
      if (!perk.description.trim())
        errors[`${index}-description`] = 'Every perk needs a short supporting line'
    })

    setPerkErrors(errors)
    // Open the panel the merchant now has to act in — see `perksPanelOpen`.
    if (Object.keys(errors).length > 0) setPerksPanelOpen(true)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!validatePerks()) {
      toast({ title: 'Fill in the highlighted perks first', variant: 'destructive' })
      /*
       * The toast says "highlighted", which only a sighted merchant can act on
       * — and here the fields may be inside a COLLAPSED panel, where nobody can
       * act on it. Focusing the first invalid input is the same instruction for
       * everyone; the panel it sits in is open whenever a field of it exists in
       * the DOM, because the panel is what renders them.
       */
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      })
      return
    }

    try {
      // Three keys and only three — see the note at the top of this file.
      await updateMutation.mutateAsync({ homeConfig: sections, newsletter, perks })
      draft.markSaved({ sections, newsletter, perks })
      setPerkErrors({})
      toast({ title: 'Home sections saved' })
    } catch (err) {
      // The draft is deliberately left as it was: a merchant whose save failed
      // should not also lose the ordering they just built.
      toast({
        title: 'Could not save the home sections',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <Skeleton className="h-136 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : 'Could not load the home sections.'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={TITLE} description={DESCRIPTION} />

      {/*
        Stated, not prevented. Every section off is a real choice — a merchant running everything
        through a campaign page may want exactly that — so the save is not blocked. But it is also
        indistinguishable from a mistake once saved, and the home page is the one page nobody
        checks after editing a list, so it is worth saying out loud beforehand.
      */}
      {allHidden ? (
        <Card className="flex items-center gap-2 border-warning/40 p-3">
          <TriangleAlert className="size-4 shrink-0 text-warning" />
          <span className="text-sm text-foreground">
            <span className="font-medium">Your home page will be empty.</span> Every section is
            switched off, so visitors will see only your header and footer. Your menus, products and
            other pages are unaffected.
          </span>
        </Card>
      ) : null}

      <Card className="p-3">
        <ReorderableList
          items={sections}
          getKey={(section) => section.key}
          onReorder={setSections}
          className="flex flex-col gap-2"
          renderItem={(section, dragHandleProps, index) => (
            <SectionRow
              section={section}
              index={index}
              count={sections.length}
              promoGroup={section.groupId ? promoGroupsById.get(section.groupId) : undefined}
              dragHandleProps={dragHandleProps}
              onMove={(from, to) => setSections(moveItem(sections, from, to))}
              onToggle={(enabled) =>
                setSections(
                  sections.map((entry, entryIndex) =>
                    /*
                     * MATCHED BY POSITION, NOT BY KEY.
                     *
                     * `MID_BANNERS` appears once per promo strip, so
                     * `entry.key === section.key` would switch EVERY promo strip
                     * on or off together — the merchant toggles one row and
                     * three change. The index is the only identity that is
                     * unambiguous for every row in this list, and it is exactly
                     * what the drag-reorder above already works in.
                     */
                    entryIndex === index ? { ...entry, enabled } : entry,
                  ),
                )
              }
              settingsError={
                section.key === 'PERKS_BAR' && Object.keys(perkErrors).length > 0
                  ? 'This save was refused: every perk needs an icon, a title and a short line.'
                  : undefined
              }
              open={section.key === 'PERKS_BAR' ? perksPanelOpen : undefined}
              onOpenChange={section.key === 'PERKS_BAR' ? setPerksPanelOpen : undefined}
              settings={
                section.key === 'NEWSLETTER' ? (
                  <NewsletterFields value={newsletter} onChange={setNewsletter} />
                ) : section.key === 'PERKS_BAR' ? (
                  /*
                   * The band's WORDING, edited from the row that already owns
                   * whether it appears and where it sits — the same call the
                   * newsletter's copy above makes, and for the same reason: a
                   * screen of its own would be a second writer of the settings
                   * row this page already saves wholesale.
                   *
                   * Not keyed by position like the layout pickers below, because
                   * `PERKS_BAR` appears exactly once. The positional identity
                   * those need exists for `MID_BANNERS`, which repeats.
                   */
                  <PerksFields value={perks} errors={perkErrors} onChange={setPerks} />
                ) : section.key === 'FEATURED_CATEGORIES' ? (
                  /*
                   * THIS SECTION'S LAYOUT IS CHOSEN HERE; THE HERO'S IS NOT.
                   *
                   * The hero's picker lives on Home Slider because choosing a
                   * hero layout changes the upload sizes and slot shapes, which
                   * only that page can show — a merchant who picks it where those
                   * consequences are invisible never notices they changed. None
                   * of that applies to grid-versus-slider for category tiles:
                   * the tiles are the same size in both, there is no artwork
                   * guidance to move, and nothing a dedicated screen could draw
                   * that the two small diagrams cannot. So the tidy answer the
                   * hero had to reject is right here — the page that owns and
                   * writes `homeConfig` also edits this field of it, and no
                   * second writer of that column is introduced.
                   *
                   * Written through the same per-section path as the enabled
                   * switch, so it rides the draft, the unsaved-changes guard,
                   * and the one Save bar. An unrecognised stored value shows as
                   * the default for DISPLAY only — the resolve rule the server
                   * and storefront apply — and is never written back until the
                   * merchant chooses. Offered whether or not the section is on,
                   * for the reason on `settings` above.
                   *
                   * See server/openspec/changes/add-featured-categories-layout,
                   * design.md Decisions 2 and 6.
                   */
                  <CategoryLayoutPicker
                    value={section.variant === 'SLIDER' ? 'SLIDER' : 'GRID'}
                    onChange={(variant) =>
                      setSections(
                        sections.map((entry, entryIndex) =>
                          // By position, matching the enabled switch above — see
                          // the note there. These two sections are unique keys,
                          // but one identity rule for the whole list is what
                          // keeps a future repeatable section from reintroducing
                          // the bug.
                          entryIndex === index ? { ...entry, variant } : entry,
                        ),
                      )
                    }
                  />
                ) : PRODUCT_ROW_KEYS.includes(section.key) ? (
                  /*
                   * The three product rows, chosen here for the same reasons the
                   * categories' layout is: no artwork guidance moves, the cards
                   * are the same size in both layouts, and this page already
                   * owns and writes `homeConfig`.
                   *
                   * One picker component for all three, given this row's own
                   * value and writing back to this row — so a merchant can set
                   * the rows differently, which is the point of storing the
                   * layout per section rather than once.
                   *
                   * Same display-only default resolution as above: an absent or
                   * unrecognised stored value shows as GRID and is never written
                   * back until the merchant chooses.
                   *
                   * See server/openspec/changes/add-product-slider-and-card-quantity.
                   */
                  <ProductRowLayoutPicker
                    label={`${SECTION_INFO.get(section.key)?.label ?? 'Section'} layout`}
                    value={section.variant === 'SLIDER' ? 'SLIDER' : 'GRID'}
                    onChange={(variant) =>
                      setSections(
                        sections.map((entry, entryIndex) =>
                          // By position, matching the enabled switch above — see
                          // the note there. These two sections are unique keys,
                          // but one identity rule for the whole list is what
                          // keeps a future repeatable section from reintroducing
                          // the bug.
                          entryIndex === index ? { ...entry, variant } : entry,
                        ),
                      )
                    }
                  />
                ) : undefined
              }
              hiddenNavLabels={
                section.enabled ? [] : (navLabels.get(section.key) ?? [])
              }
            />
          )}
        />
      </Card>

      <EditorActions
        isDirty={draft.isDirty}
        isSaving={updateMutation.isPending}
        onReset={draft.reset}
        onSave={handleSave}
      />

      <UnsavedChangesDialog blocker={blocker} />
    </div>
  )
}

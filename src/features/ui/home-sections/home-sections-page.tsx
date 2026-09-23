import * as React from 'react'
import { Link } from 'react-router'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  EyeOff,
  GripVertical,
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
  SECTION_LINKED_ROUTES,
  type HomeConfig,
  type HomeSection,
  type HomeSectionKey,
  HERO_VARIANT_OPTIONS,
  type NavItem,
  type Newsletter,
} from '@/lib/api/store-settings'
import { CategoryLayoutPicker } from '@/features/ui/home-sections/category-layout-picker'

/**
 * Which sections the website's home page is built from, and in what order.
 *
 * Writes `homeConfig` AND `newsletter`, and nothing else. `PATCH /settings` is a partial upsert, so
 * this page and the other settings editors are saved independently without any of them clobbering
 * another — the same disjoint-field-set arrangement Catalog Setting, Checkout Setting, Header Links
 * and Footer Links already rely on.
 *
 * Two keys rather than one because they are one decision for a merchant even though they are two
 * columns: whether the newsletter block exists, and what it says. The wording used to live on
 * Footer Links, back when the block was welded into the storefront footer and the only way to
 * remove it was to empty its heading. It is a home page section now, so its copy is here, beside
 * the switch that governs it.
 *
 * DISJOINTNESS STILL HOLDS — this was a move, not an addition. Footer Links no longer sends
 * `newsletter`, so exactly one editor writes it, which is the property the arrangement needs. If
 * you are adding a third key here, check nobody else writes it first.
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
}

const EMPTY_NEWSLETTER: Newsletter = { heading: '', subtext: '', placeholder: '', buttonLabel: '' }

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
  hiddenNavLabels,
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
   * Header links this section is currently hiding, by label. Empty unless the section is off and
   * the merchant has a link pointing at a destination this section fills.
   */
  hiddenNavLabels: string[]
}) {
  const info = SECTION_INFO.get(section.key)
  const switchId = `home-section-${section.key}`
  const panelId = `home-section-${section.key}-settings`
  const [open, setOpen] = React.useState(false)

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
          {info?.label ?? section.key}
        </Label>
        <span className="text-xs text-muted-foreground">{info?.description}</span>

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
          Only the sections that have something to configure get this, and only the newsletter
          does today. Deliberately NOT gated on `section.enabled`: a merchant may well write the
          copy before switching the block on, and hiding the fields behind the switch would make
          that impossible. The dimmed row is signal enough that it is off.
        */}
        {settings ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => setOpen((wasOpen) => !wasOpen)}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={`${open ? 'Hide' : 'Show'} ${info?.label ?? section.key} settings`}
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
          aria-label={`Move ${info?.label ?? section.key} up`}
        >
          <ArrowUp className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={index === count - 1}
          onClick={() => onMove(index, index + 1)}
          aria-label={`Move ${info?.label ?? section.key} down`}
        >
          <ArrowDown className="size-4" />
        </Button>
        <Switch
          id={switchId}
          checked={section.enabled}
          onCheckedChange={onToggle}
          aria-label={`Show ${info?.label ?? section.key}`}
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

export default function HomeSectionsPage() {
  const { data, isLoading, error } = useStoreSettings()
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
    },
    { sections: DEFAULT_HOME_CONFIG, newsletter: EMPTY_NEWSLETTER },
  )
  const blocker = useUnsavedChangesGuard(draft.isDirty)

  /*
   * One draft holding both, so dirty-tracking and the unsaved-changes guard cover a wording edit
   * exactly as they cover a reorder. `useSettingsDraft` is unchanged — it holds one value, and one
   * value is what it gets.
   */
  const stored = draft.value.sections
  const { newsletter } = draft.value
  const setSections = (next: HomeConfig) => draft.set({ ...draft.value, sections: next })
  const setNewsletter = (patch: Partial<Newsletter>) =>
    draft.set({ ...draft.value, newsletter: { ...newsletter, ...patch } })

  const known = new Set<HomeSectionKey>(HOME_SECTION_REGISTRY.map((s) => s.key))

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
    ...HOME_SECTION_REGISTRY.filter(
      (entry) => !stored.some((section) => section.key === entry.key),
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

  const handleSave = async () => {
    try {
      // Two keys and only two — see the note at the top of this file.
      await updateMutation.mutateAsync({ homeConfig: sections, newsletter })
      draft.markSaved({ sections, newsletter })
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
              dragHandleProps={dragHandleProps}
              onMove={(from, to) => setSections(moveItem(sections, from, to))}
              onToggle={(enabled) =>
                setSections(
                  sections.map((entry) =>
                    entry.key === section.key ? { ...entry, enabled } : entry,
                  ),
                )
              }
              settings={
                section.key === 'NEWSLETTER' ? (
                  <NewsletterFields value={newsletter} onChange={setNewsletter} />
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
                        sections.map((entry) =>
                          entry.key === section.key ? { ...entry, variant } : entry,
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

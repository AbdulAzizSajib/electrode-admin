import * as React from 'react'
import { Link, useParams } from 'react-router'
import { ArrowDown, ArrowUp, ChevronDown, GripVertical, Plus, Trash2 } from 'lucide-react'
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
  DEFAULT_LANDING_SECTION_ORDER,
  LANDING_CUSTOM_SECTION_LAYOUTS,
  LANDING_REPEATABLE_SECTION_KEYS,
  LANDING_REQUIRED_SECTION_KEYS,
  LANDING_SECTION_REGISTRY,
  MAX_CUSTOM_SECTION_BODY,
  MAX_CUSTOM_SECTION_HEADING,
  MAX_CUSTOM_SECTIONS,
  useLandingPage,
  useUpdateLandingPage,
  type LandingCustomSectionLayout,
  type LandingSectionConfigEntry,
} from '@/lib/api/landing-pages'

/**
 * Which sections ONE campaign page is built from, and in what order.
 *
 * The same control Home sections gives the website's front page, for a landing
 * page — but PER PAGE rather than per store, because that is the whole point: a
 * campaign selling on price wants the countdown early, one selling on trust
 * wants the reviews before the form, and both run at the same time.
 *
 * WRITES ONLY `sectionConfig`, and that is load-bearing rather than tidiness.
 * The landing page form writes the SAME ROW — its headline, gallery, FAQs and
 * everything else — so a save from here carrying a whole-page payload would
 * overwrite whatever the merchant last did over there. The backend treats an
 * omitted key as "leave unchanged", so sending one key changes one column.
 *
 * NULL MEANS "NEVER CONFIGURED", not "nothing to show". A page that has never
 * been through this editor stores null and renders the default order, so this
 * page seeds from `DEFAULT_LANDING_SECTION_ORDER` rather than from an empty
 * list — a blank editor for a page the merchant can see rendering sections
 * would invite a first save that deleted them all.
 *
 * Every switch here is reversible at no cost, which is why none of them asks
 * for confirmation: turning a section off hides it and keeps its content, so
 * turning it back on restores exactly what was there.
 *
 * See server/openspec/changes/add-landing-page-section-builder, design.md D7.
 */

const TITLE = 'Page sections'
const DESCRIPTION =
  'The blocks this campaign page is built from, top to bottom. Drag to reorder, or switch a section off to hide it — nothing it shows is deleted, so you can switch it back on at any time.'

const SECTION_INFO = new Map(LANDING_SECTION_REGISTRY.map((section) => [section.key, section]))

const LAYOUT_LABEL: Record<LandingCustomSectionLayout, string> = {
  PROSE: 'Heading and text',
  CENTERED: 'Centred',
  HIGHLIGHT: 'Highlighted',
}

/**
 * A new custom section's identity.
 *
 * Generated ONCE here and never rewritten. Position is not an identity: if these
 * were derived from the index, dragging one custom section would reattach every
 * other one's heading and body to the wrong row. `crypto.randomUUID` where it
 * exists, with a fallback for the older browsers a merchant may still be on.
 */
const newCustomId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * A stored order, plus any section it has never heard of.
 *
 * MIRRORS the storefront's own restore pass in `lib/landing-sections.ts`, and
 * has to: a stored order and the build reading it are versioned separately, so
 * a page saved before a section existed names every section BUT that one. The
 * storefront already puts it back at render time; without the same pass here
 * the editor shows a list that does not match the live page, and — since the
 * backend refuses an order missing a required section — the merchant's next
 * save is rejected by a rule about a row the screen never showed them.
 *
 * That is not hypothetical: splitting the old `HERO` block into a product
 * section and an order form made ORDER_FORM required, and every order stored
 * before that split names neither it nor anything else new.
 *
 * INSERTED AT ITS DEFAULT POSITION rather than appended, so a section arrives
 * where it was designed to sit instead of below the last call to action.
 *
 * CTA and CUSTOM are skipped: they repeat, so `"was it mentioned"` has no single
 * answer, and a page that deliberately kept one strip must not regain the
 * other two. A section MENTIONED AND SWITCHED OFF is a decision, not an
 * omission, so it counts as present.
 */
const withMissingSections = (
  stored: LandingSectionConfigEntry[],
): LandingSectionConfigEntry[] => {
  const restored = [...stored]
  const mentioned = new Set(stored.map((entry) => entry.key))

  DEFAULT_LANDING_SECTION_ORDER.forEach((key, defaultIndex) => {
    if (LANDING_REPEATABLE_SECTION_KEYS.includes(key)) return
    if (mentioned.has(key)) return

    const at = restored.findIndex(
      (entry) => DEFAULT_LANDING_SECTION_ORDER.indexOf(entry.key) > defaultIndex,
    )

    const entry: LandingSectionConfigEntry = { key, enabled: true }

    if (at === -1) restored.push(entry)
    else restored.splice(at, 0, entry)

    mentioned.add(key)
  })

  return restored
}

/** The entry a freshly added custom section starts as. */
const blankCustom = (): LandingSectionConfigEntry => ({
  key: 'CUSTOM',
  enabled: true,
  id: newCustomId(),
  heading: '',
  body: '',
  layout: 'PROSE',
})

/**
 * One row: what the section is, where it sits, and whether it is shown.
 *
 * Carries BOTH a drag handle and a pair of move buttons. The handle is the fast
 * path, but native drag cannot be operated by keyboard and is unreliable on
 * touch — and a good share of merchants run this panel from a tablet. The
 * buttons are the accessible version of the handle, not a redundant second way.
 */
function SectionRow({
  entry,
  index,
  count,
  dragHandleProps,
  onMove,
  onToggle,
  onEdit,
  onRemove,
}: {
  entry: LandingSectionConfigEntry
  index: number
  count: number
  dragHandleProps: DragHandleProps
  onMove: (from: number, to: number) => void
  onToggle: (enabled: boolean) => void
  /** Custom rows only — patches this entry's own content. */
  onEdit?: (patch: Partial<LandingSectionConfigEntry>) => void
  /** Custom and call-to-action rows only; the built-in sections cannot be removed. */
  onRemove?: () => void
}) {
  const info = SECTION_INFO.get(entry.key)
  const isCustom = entry.key === 'CUSTOM'
  const required = LANDING_REQUIRED_SECTION_KEYS.includes(entry.key)

  /*
   * THE ID CARRIES THE INDEX, because CTA and CUSTOM both appear more than once.
   * A duplicated `id` makes every `htmlFor` on the page point at the first
   * matching row's switch — clicking the third strip's label would toggle the
   * first.
   */
  const rowId = `${entry.key}-${index}`
  const switchId = `landing-section-${rowId}`
  const panelId = `landing-section-${rowId}-settings`

  const [open, setOpen] = React.useState(false)

  /*
   * A custom row is named after ITS OWN HEADING, not after the section type.
   * Three rows all reading "Your own section" tell a merchant nothing about
   * which one they are dragging.
   */
  const rowLabel = isCustom ? entry.heading?.trim() || 'Your own section' : (info?.label ?? entry.key)

  return (
    /*
     * A fragment, so the editor panel below is a SIBLING of the draggable row
     * rather than a child. Not a layout preference: a text input inside a
     * `draggable` ancestor cannot be selected with the mouse in Chrome or
     * Firefox, because the drag intercepts the gesture. Keeping the panel out of
     * that subtree fixes it structurally.
     */
    <>
      <div
        {...dragHandleProps}
        className="flex items-center gap-3 rounded-md border border-border bg-card p-3"
      >
        <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden />

        <div className="min-w-0 flex-1">
          <Label htmlFor={switchId} className="cursor-pointer font-medium">
            {rowLabel}
          </Label>
          {info?.description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{info.description}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Move ${rowLabel} up`}
            disabled={index === 0}
            onClick={() => onMove(index, index - 1)}
          >
            <ArrowUp className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Move ${rowLabel} down`}
            disabled={index === count - 1}
            onClick={() => onMove(index, index + 1)}
          >
            <ArrowDown className="size-4" />
          </Button>

          {isCustom ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-expanded={open}
              aria-controls={panelId}
              aria-label={`Edit ${rowLabel}`}
              onClick={() => setOpen((value) => !value)}
            >
              <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
            </Button>
          ) : null}

          {onRemove ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove ${rowLabel}`}
              onClick={onRemove}
            >
              <Trash2 className="size-4" />
            </Button>
          ) : null}

          {/*
            THE REQUIRED SECTIONS HAVE NO SWITCH AT ALL, rather than a disabled
            one with a tooltip. The backend refuses to store an order without
            them, so offering a control that cannot work is worse than offering
            none — a campaign with nothing to buy is a paid click that buys
            nothing, and the ads keep running either way.
          */}
          {required ? (
            <span className="px-2 text-xs text-muted-foreground">Always shown</span>
          ) : (
            <Switch
              id={switchId}
              checked={entry.enabled}
              onCheckedChange={onToggle}
              aria-label={`Show ${rowLabel}`}
            />
          )}
        </div>
      </div>

      {isCustom && open && onEdit ? (
        <div id={panelId} className="ml-7 flex flex-col gap-3 rounded-md border border-border p-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${panelId}-heading`}>Heading</Label>
            <Input
              id={`${panelId}-heading`}
              value={entry.heading ?? ''}
              maxLength={MAX_CUSTOM_SECTION_HEADING}
              placeholder="e.g. Our guarantee"
              onChange={(event) => onEdit({ heading: event.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${panelId}-body`}>Text</Label>
            <Textarea
              id={`${panelId}-body`}
              value={entry.body ?? ''}
              maxLength={MAX_CUSTOM_SECTION_BODY}
              rows={5}
              placeholder="What you want this section to say."
              onChange={(event) => onEdit({ body: event.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Basic formatting is allowed. Anything unsafe is removed before the page is shown.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${panelId}-layout`}>Layout</Label>
            <select
              id={`${panelId}-layout`}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              value={entry.layout ?? 'PROSE'}
              onChange={(event) =>
                onEdit({ layout: event.target.value as LandingCustomSectionLayout })
              }
            >
              {LANDING_CUSTOM_SECTION_LAYOUTS.map((layout) => (
                <option key={layout} value={layout}>
                  {LAYOUT_LABEL[layout]}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default function LandingSectionsPage() {
  const { landingPageId } = useParams<{ landingPageId: string }>()
  const { data, isLoading } = useLandingPage(landingPageId)
  const updateMutation = useUpdateLandingPage()

  /*
   * SEEDED FROM THE DEFAULT ORDER when the page has none, because null means
   * "never configured" and that page is visibly rendering those sections right
   * now. Seeding blank would show an empty editor for a page the merchant can
   * see working, and their first save would delete every section on it.
   *
   * `data &&` matters: until the record arrives the draft has no loaded value,
   * and `useSettingsDraft` treats that as not-yet-dirty rather than as a choice.
   */
  const draft = useSettingsDraft<LandingSectionConfigEntry[]>(
    data &&
      (data.sectionConfig
        ? withMissingSections(data.sectionConfig)
        : DEFAULT_LANDING_SECTION_ORDER.map((key) => ({ key, enabled: true }))),
    DEFAULT_LANDING_SECTION_ORDER.map((key) => ({ key, enabled: true })),
  )
  const blocker = useUnsavedChangesGuard(draft.isDirty)

  const sections = draft.value
  const setSections = (next: LandingSectionConfigEntry[]) => draft.set(next)

  const customCount = sections.filter((entry) => entry.key === 'CUSTOM').length

  /*
   * MATCHED BY POSITION, NOT BY KEY, everywhere below.
   *
   * CTA and CUSTOM both appear more than once, so `entry.key === target.key`
   * would switch every call-to-action strip on or off together — the merchant
   * toggles one row and three change. The index is the only identity that is
   * unambiguous for every row in this list.
   */
  const patchAt = (index: number, patch: Partial<LandingSectionConfigEntry>) =>
    setSections(
      sections.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...patch } : entry,
      ),
    )

  const removeAt = (index: number) =>
    setSections(sections.filter((_, entryIndex) => entryIndex !== index))

  const addCustom = () => {
    if (customCount >= MAX_CUSTOM_SECTIONS) return
    setSections([...sections, blankCustom()])
  }

  const addCta = () => setSections([...sections, { key: 'CTA', enabled: true }])

  const handleSave = async () => {
    if (!landingPageId) return

    /*
     * A custom section with neither a heading nor any text renders nothing, and
     * the backend refuses it. Caught here so the merchant is told which row
     * rather than shown a validation error naming an index.
     */
    const emptyCustom = sections.findIndex(
      (entry) => entry.key === 'CUSTOM' && !entry.heading?.trim() && !entry.body?.trim(),
    )

    if (emptyCustom !== -1) {
      toast({
        title: 'One of your own sections is empty',
        description: 'Give it a heading or some text, or remove it.',
        variant: 'destructive',
      })
      return
    }

    try {
      /*
       * ONE KEY AND ONE KEY ONLY — see the note at the top of this file. The
       * landing page form writes this same row, and a whole-page payload from
       * here would overwrite whatever it last saved.
       */
      await updateMutation.mutateAsync({
        id: landingPageId,
        input: { sectionConfig: sections },
      })
      draft.markSaved(sections)
      toast({ title: 'Page sections saved' })
    } catch (err) {
      /*
       * The draft is deliberately left as it was. A merchant whose save was
       * refused must not also lose the ordering they just built — the reason is
       * shown, the work stays on screen.
       */
      toast({
        title: 'Could not save the page sections',
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

  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <Card className="p-6 text-sm text-muted-foreground">
          That landing page could not be found.{' '}
          <Link to="/ui/landing-pages" className="underline">
            Back to landing pages
          </Link>
          .
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`${TITLE} — ${data.title}`}
        description={DESCRIPTION}
        actions={
          <Button asChild variant="outline">
            <Link to={`/ui/landing-pages/${landingPageId}`}>Edit page content</Link>
          </Button>
        }
      />

      <Card className="p-3">
        <ReorderableList
          items={sections}
          /*
           * THE KEY MUST BE UNIQUE PER ROW, and `entry.key` is not: CTA and
           * CUSTOM both repeat, so three call-to-action strips would share one
           * React key and a reorder would animate the wrong rows.
           *
           * A custom section uses its own stable id. A repeated built-in key —
           * only CTA — falls back to its position, counted here because
           * `getKey` is handed the item alone.
           */
          getKey={(entry) => {
            if (entry.id) return `CUSTOM-${entry.id}`
            const position = sections.indexOf(entry)
            return `${entry.key}-${position}`
          }}
          onReorder={setSections}
          className="flex flex-col gap-2"
          renderItem={(entry, dragHandleProps, index) => (
            <SectionRow
              entry={entry}
              index={index}
              count={sections.length}
              dragHandleProps={dragHandleProps}
              onMove={(from, to) => setSections(moveItem(sections, from, to))}
              onToggle={(enabled) => patchAt(index, { enabled })}
              onEdit={
                entry.key === 'CUSTOM' ? (patch) => patchAt(index, patch) : undefined
              }
              onRemove={
                entry.key === 'CUSTOM' || entry.key === 'CTA'
                  ? () => removeAt(index)
                  : undefined
              }
            />
          )}
        />
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={addCustom} disabled={customCount >= MAX_CUSTOM_SECTIONS}>
          <Plus className="size-4" />
          Add your own section
        </Button>
        <Button type="button" variant="outline" onClick={addCta}>
          <Plus className="size-4" />
          Add an order button strip
        </Button>
        {customCount >= MAX_CUSTOM_SECTIONS ? (
          <span className="self-center text-xs text-muted-foreground">
            You can add up to {MAX_CUSTOM_SECTIONS} of your own sections.
          </span>
        ) : null}
      </div>

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

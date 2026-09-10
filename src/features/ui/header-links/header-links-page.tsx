import * as React from 'react'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { toast } from '@/components/ui/use-toast'
import { LinkTargetInput } from '@/features/ui/components/link-target-input'
import {
  EditorActions,
  EditorRow,
  EditorSection,
  EditorSubsection,
  UnsavedChangesDialog,
} from '@/features/ui/components/settings-editor'
import {
  moveItem,
  useSettingsDraft,
  useUnsavedChangesGuard,
} from '@/features/ui/components/settings-editor-utils'
import {
  useStoreSettings,
  useUpdateStoreSettings,
  SETTINGS_LIMITS,
  type AnnouncementBar,
  type AnnouncementLink,
  type AnnouncementLinkSource,
  type NavItem,
} from '@/lib/api/store-settings'

/**
 * The storefront header: its main navigation row and the announcement strip
 * above it.
 *
 * Writes ONLY `mainNav` and `announcementBar`. `PATCH /settings` is a partial
 * upsert, so this disjoint field set is what lets this page and Footer Links be
 * saved independently without either clobbering the other — no locking needed.
 * See design.md, "Header and footer editors write disjoint field sets".
 */

interface HeaderDraft {
  mainNav: NavItem[]
  announcementBar: AnnouncementBar
}

/**
 * One copy, because there were three and two had drifted: the loading and error
 * headers said "every page" while the loaded one said "every storefront page".
 * A merchant who hit a slow load read a slightly different promise than one who
 * did not.
 */
const PAGE_DESCRIPTION =
  'The navigation and announcement bar at the top of every storefront page.'

const EMPTY_BAR: AnnouncementBar = { enabled: false, text: '', links: [] }

/**
 * What a `source`-bound announcement link stores as its label.
 *
 * The storefront renders these links from `contactPhone`/`contactEmail`, so this
 * text is never what a merchant with contact details set will see. It exists
 * because the backend keeps `label` required — as the fallback for a store whose
 * contact column is still empty — while this editor disables the input for it.
 * Something has to fill it, and a word describing the action beats an empty
 * string rendering as a bare link.
 */
const SOURCE_FALLBACK_LABEL: Record<AnnouncementLinkSource, string> = {
  contactPhone: 'Call us',
  contactEmail: 'Email us',
}

export default function HeaderLinksPage() {
  const { data, isLoading, error, refetch } = useStoreSettings()
  const updateMutation = useUpdateStoreSettings()

  const draft = useSettingsDraft<HeaderDraft>(
    data && {
      mainNav: data.mainNav ?? [],
      announcementBar: data.announcementBar ?? EMPTY_BAR,
    },
    { mainNav: [], announcementBar: EMPTY_BAR },
  )
  const blocker = useUnsavedChangesGuard(draft.isDirty)
  const [rowErrors, setRowErrors] = React.useState<Record<string, string>>({})

  const { mainNav, announcementBar } = draft.value
  const barLinks = announcementBar.links ?? []

  /**
   * The row's message, joined from whichever of its fields failed.
   *
   * `validate` records errors per field so each input can mark itself, but
   * `EditorRow` shows one message per row — two short sentences read better
   * under a row than two stacked paragraphs.
   */
  const rowError = (key: string) =>
    [rowErrors[`${key}-label`], rowErrors[`${key}-href`], rowErrors[`${key}-icon`]]
      .filter(Boolean)
      .join('. ') || undefined

  const setNav = (next: NavItem[]) => draft.set({ ...draft.value, mainNav: next })
  const setBar = (next: Partial<AnnouncementBar>) =>
    draft.set({ ...draft.value, announcementBar: { ...announcementBar, ...next } })

  const updateNavItem = (index: number, patch: Partial<NavItem>) =>
    setNav(mainNav.map((item, i) => (i === index ? { ...item, ...patch } : item)))

  /**
   * Mirrors the backend's rules so a preventable 400 never leaves the browser.
   *
   * Both failures per row, not the first: these were an `if/else if` chain, so a
   * row missing BOTH its label and its target reported only the label. The
   * merchant fixed it, saved, and was told about the target on the next
   * round-trip — one avoidable failure per missing field.
   *
   * Naming the failing field (`-label` / `-href`) rather than just the row is
   * what lets the inputs below mark themselves `aria-invalid` and point at the
   * message, instead of the row turning red and leaving the merchant to guess
   * which of its three inputs is meant.
   */
  const validate = (): boolean => {
    const errors: Record<string, string> = {}
    const tooLong = (value: string, max: number) => value.trim().length > max

    const checkTarget = (key: string, href: string, noun: string) => {
      if (!href.trim()) errors[`${key}-href`] = `This ${noun} needs a target`
      else if (tooLong(href, SETTINGS_LIMITS.hrefLength))
        errors[`${key}-href`] = `Targets are limited to ${SETTINGS_LIMITS.hrefLength} characters`
    }

    const checkLabel = (key: string, label: string, noun: string) => {
      if (!label.trim()) errors[`${key}-label`] = `This ${noun} needs a label`
      else if (tooLong(label, SETTINGS_LIMITS.labelLength))
        errors[`${key}-label`] = `Labels are limited to ${SETTINGS_LIMITS.labelLength} characters`
    }

    mainNav.forEach((item, i) => {
      checkLabel(`nav-${i}`, item.label, 'menu item')
      checkTarget(`nav-${i}`, item.href, 'menu item')
      ;(item.children ?? []).forEach((child, c) => {
        checkLabel(`nav-${i}-${c}`, child.label, 'dropdown item')
        checkTarget(`nav-${i}-${c}`, child.href, 'dropdown item')
      })
    })

    barLinks.forEach((link, i) => {
      // A `source`-bound row draws its displayed label from the store's contact
      // details, so a blank label there is not an error the merchant can act on
      // — the input is disabled. `save` supplies the stored fallback the
      // backend still requires; see SOURCE_FALLBACK_LABEL.
      if (!link.source) checkLabel(`bar-${i}`, link.label, 'link')
      checkTarget(`bar-${i}`, link.href, 'link')
      if (link.icon && tooLong(link.icon, SETTINGS_LIMITS.iconLength))
        errors[`bar-${i}-icon`] = `Icon names are limited to ${SETTINGS_LIMITS.iconLength} characters`
    })

    if (tooLong(announcementBar.text, SETTINGS_LIMITS.announcementTextLength))
      errors['bar-text'] =
        `The message is limited to ${SETTINGS_LIMITS.announcementTextLength} characters`

    setRowErrors(errors)
    return Object.keys(errors).length === 0
  }

  const save = async () => {
    if (!validate()) {
      toast({ title: 'Fix the highlighted rows first', variant: 'destructive' })
      // The toast says "highlighted", which only a sighted merchant can act on.
      // Moving focus to the first failing field is the same instruction for
      // everyone else, and saves twenty rows of tabbing for everyone.
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      })
      return
    }
    try {
      await updateMutation.mutateAsync({
        mainNav,
        announcementBar: {
          ...announcementBar,
          // `announcementBarSchema` requires a non-empty label even on a
          // `source`-bound row, where it is the fallback for a store whose
          // contact column is still empty. The input for it is disabled here,
          // so an empty one would be a 400 the merchant could not fix.
          links: barLinks.map((link) =>
            link.source && !link.label.trim()
              ? { ...link, label: SOURCE_FALLBACK_LABEL[link.source] }
              : link,
          ),
        },
      })
      draft.markSaved(draft.value)
      toast({ title: 'Header saved' })
    } catch (err) {
      toast({
        title: 'Could not save the header',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Header links" description={PAGE_DESCRIPTION} />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Header links" description={PAGE_DESCRIPTION} />
        {/* The shared block, not a bare red paragraph: a failed load here read as
            a different kind of event from a failed load on every list page, and
            offered no way out except a browser reload. */}
        <ErrorState
          description={
            error instanceof Error ? error.message : 'Could not load the header settings.'
          }
          onRetry={() => void refetch()}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Header links" description={PAGE_DESCRIPTION} />

      {/* Contact details come from the stored settings, not the draft: they are
          edited under Footer Links, so within this page they are read-only fact. */}
      <HeaderPreview
        mainNav={mainNav}
        announcementBar={announcementBar}
        contactPhone={data?.contactPhone ?? ''}
        contactEmail={data?.contactEmail ?? ''}
        isDirty={draft.isDirty}
      />

      <EditorSection
        title="Announcement bar"
        description="The thin strip above the header. Switching it off keeps the text for later."
      >
        <div className="flex items-center gap-2">
          <Switch
            checked={announcementBar.enabled}
            onCheckedChange={(enabled) => setBar({ enabled })}
            id="bar-enabled"
          />
          <Label htmlFor="bar-enabled">Show the announcement bar</Label>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bar-text">Message</Label>
          <Input
            id="bar-text"
            value={announcementBar.text}
            onChange={(e) => setBar({ text: e.target.value })}
            placeholder="Free delivery on your first order"
            maxLength={SETTINGS_LIMITS.announcementTextLength}
            aria-invalid={Boolean(rowErrors['bar-text'])}
            aria-describedby={rowErrors['bar-text'] ? 'bar-text-error' : undefined}
          />
          {rowErrors['bar-text'] && (
            <p id="bar-text-error" role="alert" className="text-xs text-destructive">
              {rowErrors['bar-text']}
            </p>
          )}
        </div>

        <EditorSubsection
          title="Links on the right"
          onAdd={() => setBar({ links: [...barLinks, { label: '', href: '' }] })}
          addLabel="Add link"
          atCapacity={barLinks.length >= SETTINGS_LIMITS.announcementLinks}
          capacityNote={`Up to ${SETTINGS_LIMITS.announcementLinks} links.`}
        >
          {barLinks.length === 0 && (
            <p className="py-3 text-center text-sm text-muted-foreground">
              No links. The bar will show its message on its own.
            </p>
          )}

          {barLinks.map((link, index) => (
            <EditorRow
              key={index}
              index={index}
              count={barLinks.length}
              error={rowError(`bar-${index}`)}
              removeLabel="Remove link"
              onMove={(from, to) => setBar({ links: moveItem(barLinks, from, to) })}
              onRemove={() => setBar({ links: barLinks.filter((_, i) => i !== index) })}
            >
              {(errorId) => (
                <>
                  {/* Three fields plus the target's picker button do not fit one
                      row until well past `sm`; below `lg` the href field ended up
                      narrower than the values merchants routinely paste. */}
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.2fr]">
                    <Input
                      value={link.icon ?? ''}
                      onChange={(e) =>
                        setBar({
                          links: barLinks.map((l, i) =>
                            i === index ? { ...l, icon: e.target.value } : l,
                          ),
                        })
                      }
                      placeholder="Icon (e.g. fa-solid:truck)"
                      aria-label="Icon name"
                      maxLength={SETTINGS_LIMITS.iconLength}
                      aria-invalid={Boolean(rowErrors[`bar-${index}-icon`])}
                      aria-describedby={rowErrors[`bar-${index}-icon`] ? errorId : undefined}
                    />
                    <Input
                      value={link.label}
                      onChange={(e) =>
                        setBar({
                          links: barLinks.map((l, i) =>
                            i === index ? { ...l, label: e.target.value } : l,
                          ),
                        })
                      }
                      placeholder={link.source ? SOURCE_FALLBACK_LABEL[link.source] : 'Label'}
                      aria-label="Link label"
                      disabled={Boolean(link.source)}
                      maxLength={SETTINGS_LIMITS.labelLength}
                      aria-invalid={Boolean(rowErrors[`bar-${index}-label`])}
                      aria-describedby={rowErrors[`bar-${index}-label`] ? errorId : undefined}
                    />
                    <LinkTargetInput
                      value={link.href}
                      onChange={(href) =>
                        setBar({ links: barLinks.map((l, i) => (i === index ? { ...l, href } : l)) })
                      }
                      aria-label="Link target"
                      maxLength={SETTINGS_LIMITS.hrefLength}
                      aria-invalid={Boolean(rowErrors[`bar-${index}-href`])}
                      aria-describedby={rowErrors[`bar-${index}-href`] ? errorId : undefined}
                    />
                  </div>
                  {link.source && (
                    <p className="text-xs text-muted-foreground">
                      This link follows the store&apos;s{' '}
                      {link.source === 'contactPhone' ? 'phone number' : 'email address'}, which is
                      set under Footer Links. Its label updates automatically.
                    </p>
                  )}
                </>
              )}
            </EditorRow>
          ))}
        </EditorSubsection>
      </EditorSection>

      <EditorSection
        title="Main navigation"
        description="The row of links under the search bar. Each can have one level of dropdown items."
        onAdd={() => setNav([...mainNav, { label: '', href: '' }])}
        addLabel="Add menu item"
        atCapacity={mainNav.length >= SETTINGS_LIMITS.mainNavItems}
        capacityNote={`Up to ${SETTINGS_LIMITS.mainNavItems} menu items.`}
      >
        {mainNav.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No menu items. The header will render without a navigation row.
          </p>
        )}

        {mainNav.map((item, index) => {
          const children = item.children ?? []
          return (
            <EditorRow
              key={index}
              index={index}
              count={mainNav.length}
              error={rowError(`nav-${index}`)}
              removeLabel="Remove menu item"
              onMove={(from, to) => setNav(moveItem(mainNav, from, to))}
              onRemove={() => setNav(mainNav.filter((_, i) => i !== index))}
            >
              {(errorId) => (
                <>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      value={item.label}
                      onChange={(e) => updateNavItem(index, { label: e.target.value })}
                      placeholder="Label (e.g. Shop)"
                      aria-label="Menu item label"
                      maxLength={SETTINGS_LIMITS.labelLength}
                      aria-invalid={Boolean(rowErrors[`nav-${index}-label`])}
                      aria-describedby={rowErrors[`nav-${index}-label`] ? errorId : undefined}
                    />
                    <LinkTargetInput
                      value={item.href}
                      onChange={(href) => updateNavItem(index, { href })}
                      aria-label="Menu item target"
                      maxLength={SETTINGS_LIMITS.hrefLength}
                      aria-invalid={Boolean(rowErrors[`nav-${index}-href`])}
                      aria-describedby={rowErrors[`nav-${index}-href`] ? errorId : undefined}
                    />
                  </div>

                  {children.length > 0 && (
                    <div className="ml-4 flex flex-col gap-2 border-l border-border pl-3">
                      {children.map((child, childIndex) => {
                        // The child's message is its own, not the row's, so it
                        // carries its own id rather than borrowing `errorId`.
                        const childKey = `nav-${index}-${childIndex}`
                        const childError = rowError(childKey)
                        const childErrorId = `${childKey}-error`
                        return (
                          <div key={childIndex} className="flex flex-col gap-1">
                            <div className="grid gap-2 sm:grid-cols-[1fr_1.2fr_auto]">
                              <Input
                                value={child.label}
                                onChange={(e) =>
                                  updateNavItem(index, {
                                    children: children.map((c, i) =>
                                      i === childIndex ? { ...c, label: e.target.value } : c,
                                    ),
                                  })
                                }
                                placeholder="Dropdown label"
                                aria-label="Dropdown item label"
                                maxLength={SETTINGS_LIMITS.labelLength}
                                aria-invalid={Boolean(rowErrors[`${childKey}-label`])}
                                aria-describedby={
                                  rowErrors[`${childKey}-label`] ? childErrorId : undefined
                                }
                              />
                              <LinkTargetInput
                                value={child.href}
                                onChange={(href) =>
                                  updateNavItem(index, {
                                    children: children.map((c, i) =>
                                      i === childIndex ? { ...c, href } : c,
                                    ),
                                  })
                                }
                                aria-label="Dropdown item target"
                                maxLength={SETTINGS_LIMITS.hrefLength}
                                aria-invalid={Boolean(rowErrors[`${childKey}-href`])}
                                aria-describedby={
                                  rowErrors[`${childKey}-href`] ? childErrorId : undefined
                                }
                              />
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="text-destructive hover:bg-destructive/10"
                                onClick={() =>
                                  updateNavItem(index, {
                                    children: children.filter((_, i) => i !== childIndex),
                                  })
                                }
                                aria-label="Remove dropdown item"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                            {childError && (
                              <p
                                id={childErrorId}
                                role="alert"
                                className="text-xs text-destructive"
                              >
                                {childError}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {children.length < SETTINGS_LIMITS.navChildren && (
                    <Button
                      type="button"
                      size="lg"
                      variant="ghost"
                      className="self-start text-xs"
                      onClick={() =>
                        updateNavItem(index, { children: [...children, { label: '', href: '' }] })
                      }
                    >
                      <Plus className="size-3" /> Add dropdown item
                    </Button>
                  )}
                </>
              )}
            </EditorRow>
          )
        })}
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
 * What the storefront will render, in the storefront's own colours.
 *
 * Shown above the fields rather than beside them: the merchant's question is
 * "does the header read right", and a row of inputs does not answer it.
 *
 * `contactPhone`/`contactEmail` are passed in for the same reason. A
 * `source`-bound link previously previewed as the literal `(from store
 * contact)`, which is a placeholder sitting where real text will be — the one
 * thing a preview must not do, since the merchant is here to judge how the row
 * reads at its real width.
 *
 * Link icons are still not drawn: the storefront resolves Iconify names and
 * this panel has no Iconify dependency, so anything rendered here would be a
 * guess at a glyph rather than the glyph. An omission is honest; an invented
 * icon is not.
 */
function HeaderPreview({
  mainNav,
  announcementBar,
  contactPhone,
  contactEmail,
  isDirty,
}: {
  mainNav: NavItem[]
  announcementBar: AnnouncementBar
  contactPhone: string
  contactEmail: string
  isDirty: boolean
}) {
  /** The same precedence the storefront applies: contact detail, then the stored fallback. */
  const resolveLabel = (link: AnnouncementLink) => {
    if (link.source === 'contactPhone') return contactPhone || link.label
    if (link.source === 'contactEmail') return contactEmail || link.label
    return link.label
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">Preview</span>
        {isDirty && <span className="text-xs text-warning">Unsaved — not live yet</span>}
      </div>
      <div className="bg-[#1560bd] text-white">
        {announcementBar.enabled && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/30 px-4 py-2 text-xs">
            <span className="min-w-0 wrap-break-word">
              {announcementBar.text || <em className="opacity-60">No message set</em>}
            </span>
            <span className="flex flex-wrap gap-3">
              {(announcementBar.links ?? []).map((link, i) => {
                const label = resolveLabel(link)
                return (
                  <span key={i} className="opacity-90">
                    {label || (
                      <em className="opacity-60">
                        {link.source ? '(no contact detail set)' : '(no label)'}
                      </em>
                    )}
                  </span>
                )
              })}
            </span>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-5 px-4 py-3 text-sm">
          <span className="border-r border-white/30 pr-5 opacity-70">Shop By Categories</span>
          {mainNav.length === 0 ? (
            <em className="text-xs opacity-60">No menu items</em>
          ) : (
            mainNav.map((item, i) => (
              <span key={i} className="flex items-center gap-1">
                {item.label || <em className="opacity-60">(no label)</em>}
                {(item.children?.length ?? 0) > 0 && <ChevronDown className="size-3" />}
              </span>
            ))
          )}
          <span className="ml-auto opacity-70">Today&apos;s Offers</span>
        </div>
      </div>
    </Card>
  )
}

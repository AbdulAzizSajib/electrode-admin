import * as React from 'react'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { LinkTargetInput } from '@/features/ui/components/link-target-input'
import {
  EditorActions,
  EditorRow,
  EditorSection,
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

const EMPTY_BAR: AnnouncementBar = { enabled: false, text: '', links: [] }

export default function HeaderLinksPage() {
  const { data, isLoading, error } = useStoreSettings()
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

  const setNav = (next: NavItem[]) => draft.set({ ...draft.value, mainNav: next })
  const setBar = (next: Partial<AnnouncementBar>) =>
    draft.set({ ...draft.value, announcementBar: { ...announcementBar, ...next } })

  const updateNavItem = (index: number, patch: Partial<NavItem>) =>
    setNav(mainNav.map((item, i) => (i === index ? { ...item, ...patch } : item)))

  /** Mirrors the backend's rules so a preventable 400 never leaves the browser. */
  const validate = (): boolean => {
    const errors: Record<string, string> = {}

    mainNav.forEach((item, i) => {
      if (!item.label.trim()) errors[`nav-${i}`] = 'This menu item needs a label'
      else if (!item.href.trim()) errors[`nav-${i}`] = 'This menu item needs a target'
      ;(item.children ?? []).forEach((child, c) => {
        if (!child.label.trim()) errors[`nav-${i}-${c}`] = 'This dropdown item needs a label'
        else if (!child.href.trim()) errors[`nav-${i}-${c}`] = 'This dropdown item needs a target'
      })
    })

    barLinks.forEach((link, i) => {
      // A `source`-bound row draws its label from the store's contact details,
      // so a blank label there is not an error the merchant can act on.
      if (!link.source && !link.label.trim()) errors[`bar-${i}`] = 'This link needs a label'
      else if (!link.href.trim()) errors[`bar-${i}`] = 'This link needs a target'
    })

    setRowErrors(errors)
    return Object.keys(errors).length === 0
  }

  const save = async () => {
    if (!validate()) {
      toast({ title: 'Fix the highlighted rows first', variant: 'destructive' })
      return
    }
    try {
      await updateMutation.mutateAsync({
        mainNav,
        announcementBar: { ...announcementBar, links: barLinks },
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
        <PageHeader title="Header links" description="The navigation and announcement bar at the top of every page." />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Header links" description="The navigation and announcement bar at the top of every page." />
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : 'Could not load the header settings.'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Header links"
        description="The navigation and announcement bar at the top of every storefront page."
      />

      <HeaderPreview mainNav={mainNav} announcementBar={announcementBar} isDirty={draft.isDirty} />

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
            maxLength={300}
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <Label>Links on the right</Label>
          {barLinks.length < SETTINGS_LIMITS.announcementLinks ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setBar({ links: [...barLinks, { label: '', href: '' }] })}
            >
              <Plus /> Add link
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">
              Up to {SETTINGS_LIMITS.announcementLinks} links.
            </span>
          )}
        </div>

        {barLinks.map((link, index) => (
          <EditorRow
            key={index}
            index={index}
            count={barLinks.length}
            error={rowErrors[`bar-${index}`]}
            onMove={(from, to) => setBar({ links: moveItem(barLinks, from, to) })}
            onRemove={() => setBar({ links: barLinks.filter((_, i) => i !== index) })}
          >
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1.2fr]">
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
                placeholder="Label"
                aria-label="Link label"
                disabled={Boolean(link.source)}
              />
              <LinkTargetInput
                value={link.href}
                onChange={(href) =>
                  setBar({ links: barLinks.map((l, i) => (i === index ? { ...l, href } : l)) })
                }
                aria-label="Link target"
              />
            </div>
            {link.source && (
              <p className="text-xs text-muted-foreground">
                This link follows the store&apos;s{' '}
                {link.source === 'contactPhone' ? 'phone number' : 'email address'}, which is set
                under Footer Links. Its label updates automatically.
              </p>
            )}
          </EditorRow>
        ))}
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
              error={rowErrors[`nav-${index}`]}
              onMove={(from, to) => setNav(moveItem(mainNav, from, to))}
              onRemove={() => setNav(mainNav.filter((_, i) => i !== index))}
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  value={item.label}
                  onChange={(e) => updateNavItem(index, { label: e.target.value })}
                  placeholder="Label (e.g. Shop)"
                  aria-label="Menu item label"
                />
                <LinkTargetInput
                  value={item.href}
                  onChange={(href) => updateNavItem(index, { href })}
                  aria-label="Menu item target"
                />
              </div>

              {children.length > 0 && (
                <div className="ml-4 flex flex-col gap-2 border-l border-border pl-3">
                  {children.map((child, childIndex) => (
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
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-9 text-destructive"
                          onClick={() =>
                            updateNavItem(index, {
                              children: children.filter((_, i) => i !== childIndex),
                            })
                          }
                          aria-label="Remove dropdown item"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                      {rowErrors[`nav-${index}-${childIndex}`] && (
                        <p className="text-xs text-destructive">
                          {rowErrors[`nav-${index}-${childIndex}`]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {children.length < SETTINGS_LIMITS.navChildren && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="self-start text-xs"
                  onClick={() =>
                    updateNavItem(index, { children: [...children, { label: '', href: '' }] })
                  }
                >
                  <Plus className="size-3" /> Add dropdown item
                </Button>
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
 */
function HeaderPreview({
  mainNav,
  announcementBar,
  isDirty,
}: {
  mainNav: NavItem[]
  announcementBar: AnnouncementBar
  isDirty: boolean
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">Preview</span>
        {isDirty && <span className="text-xs text-warning">Unsaved — not live yet</span>}
      </div>
      <div className="bg-[#1560bd] text-white">
        {announcementBar.enabled && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/30 px-4 py-2 text-xs">
            <span>{announcementBar.text || <em className="opacity-60">No message set</em>}</span>
            <span className="flex flex-wrap gap-3">
              {(announcementBar.links ?? []).map((link, i) => (
                <span key={i} className="opacity-90">
                  {link.label || <em className="opacity-60">(from store contact)</em>}
                </span>
              ))}
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

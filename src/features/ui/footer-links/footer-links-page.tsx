import * as React from 'react'
import { Link } from 'react-router'
import { Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  SOCIAL_PLATFORMS,
  type FooterColumn,
  type Newsletter,
  type SocialLink,
  type SocialPlatform,
} from '@/lib/api/store-settings'

/**
 * The storefront footer: its link columns, social icons, newsletter copy, and
 * the brand/contact block on either end.
 *
 * Writes everything EXCEPT `mainNav` and `announcementBar`, which belong to
 * Header Links. The two field sets are disjoint and `PATCH /settings` is a
 * partial upsert, so both pages can be saved in any order without either losing
 * the other's work.
 *
 * The contact fields here are the same three columns the Store Settings page
 * writes. Both go through the same partial patch, so last-write-wins is the
 * only interaction — and they are here because "the phone number in my footer"
 * is where a merchant looks for them.
 */

interface FooterDraft {
  footerColumns: FooterColumn[]
  socialLinks: SocialLink[]
  newsletter: Newsletter
  aboutText: string
  contactEmail: string
  contactPhone: string
  address: string
}

const EMPTY_NEWSLETTER: Newsletter = { heading: '', subtext: '', placeholder: '', buttonLabel: '' }

export default function FooterLinksPage() {
  const { data, isLoading, error } = useStoreSettings()
  const updateMutation = useUpdateStoreSettings()

  const draft = useSettingsDraft<FooterDraft>(
    data && {
      footerColumns: data.footerColumns ?? [],
      socialLinks: data.socialLinks ?? [],
      newsletter: data.newsletter ?? EMPTY_NEWSLETTER,
      aboutText: data.aboutText ?? '',
      contactEmail: data.contactEmail ?? '',
      contactPhone: data.contactPhone ?? '',
      address: data.address ?? '',
    },
    {
      footerColumns: [],
      socialLinks: [],
      newsletter: EMPTY_NEWSLETTER,
      aboutText: '',
      contactEmail: '',
      contactPhone: '',
      address: '',
    },
  )
  const blocker = useUnsavedChangesGuard(draft.isDirty)
  const [rowErrors, setRowErrors] = React.useState<Record<string, string>>({})

  const { footerColumns, socialLinks, newsletter } = draft.value
  const patch = (next: Partial<FooterDraft>) => draft.set({ ...draft.value, ...next })

  const updateColumn = (index: number, next: Partial<FooterColumn>) =>
    patch({
      footerColumns: footerColumns.map((col, i) => (i === index ? { ...col, ...next } : col)),
    })

  const validate = (): boolean => {
    const errors: Record<string, string> = {}

    footerColumns.forEach((column, c) => {
      if (!column.title.trim()) errors[`col-${c}`] = 'This column needs a heading'
      column.links.forEach((link, l) => {
        if (!link.label.trim()) errors[`col-${c}-${l}`] = 'This link needs a label'
        else if (!link.href.trim()) errors[`col-${c}-${l}`] = 'This link needs a target'
      })
    })

    socialLinks.forEach((social, i) => {
      // The backend requires a full, valid URL here (`z.url()`), unlike nav
      // hrefs which may be site-relative — so the check differs deliberately.
      if (!/^https?:\/\/.+/.test(social.url.trim())) {
        errors[`social-${i}`] = 'Enter the full address, starting with https://'
      }
    })

    if (draft.value.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.value.contactEmail.trim())) {
      errors.contactEmail = 'Enter a valid email address'
    }

    setRowErrors(errors)
    return Object.keys(errors).length === 0
  }

  const save = async () => {
    if (!validate()) {
      toast({ title: 'Fix the highlighted rows first', variant: 'destructive' })
      return
    }
    try {
      // Blank optional strings are omitted rather than sent as "": the backend
      // treats these as `.optional()`, not `.nullable()`, so "leave it unset"
      // is expressed by absence. Same rule the store settings page follows.
      await updateMutation.mutateAsync({
        footerColumns,
        socialLinks,
        newsletter,
        ...(draft.value.aboutText.trim() ? { aboutText: draft.value.aboutText.trim() } : {}),
        ...(draft.value.contactEmail.trim() ? { contactEmail: draft.value.contactEmail.trim() } : {}),
        ...(draft.value.contactPhone.trim() ? { contactPhone: draft.value.contactPhone.trim() } : {}),
        ...(draft.value.address.trim() ? { address: draft.value.address.trim() } : {}),
      })
      draft.markSaved(draft.value)
      toast({ title: 'Footer saved' })
    } catch (err) {
      toast({
        title: 'Could not save the footer',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Footer links" description="The columns, contact details and newsletter at the bottom of every page." />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Footer links" description="The columns, contact details and newsletter at the bottom of every page." />
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : 'Could not load the footer settings.'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Footer links"
        description="The columns, contact details, social icons and newsletter at the bottom of every storefront page."
      />

      {/* Copyright is shown but not edited here, so it comes from the stored
          settings rather than the draft. */}
      <FooterPreview
        draft={draft.value}
        copyrightText={data?.copyrightText ?? ''}
        isDirty={draft.isDirty}
      />

      <EditorSection
        title="Link columns"
        description="Each column is a heading and a list of links. Point one at a page you wrote under Pages."
        onAdd={() => patch({ footerColumns: [...footerColumns, { title: '', links: [] }] })}
        addLabel="Add column"
        atCapacity={footerColumns.length >= SETTINGS_LIMITS.footerColumns}
        capacityNote={`Up to ${SETTINGS_LIMITS.footerColumns} columns.`}
      >
        {footerColumns.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No columns yet. The footer will show only the brand and contact blocks.
          </p>
        )}

        {footerColumns.map((column, columnIndex) => (
          <EditorRow
            key={columnIndex}
            index={columnIndex}
            count={footerColumns.length}
            error={rowErrors[`col-${columnIndex}`]}
            removeLabel="Remove column"
            onMove={(from, to) => patch({ footerColumns: moveItem(footerColumns, from, to) })}
            onRemove={() =>
              patch({ footerColumns: footerColumns.filter((_, i) => i !== columnIndex) })
            }
          >
            <Input
              value={column.title}
              onChange={(e) => updateColumn(columnIndex, { title: e.target.value })}
              placeholder="Column heading (e.g. Information)"
              aria-label="Column heading"
              className="font-medium"
            />

            <div className="ml-4 flex flex-col gap-2 border-l border-border pl-3">
              {column.links.map((link, linkIndex) => (
                <div key={linkIndex} className="flex flex-col gap-1">
                  <div className="grid gap-2 sm:grid-cols-[1fr_1.2fr_auto]">
                    <Input
                      value={link.label}
                      onChange={(e) =>
                        updateColumn(columnIndex, {
                          links: column.links.map((l, i) =>
                            i === linkIndex ? { ...l, label: e.target.value } : l,
                          ),
                        })
                      }
                      placeholder="Link label"
                      aria-label="Link label"
                    />
                    <LinkTargetInput
                      value={link.href}
                      onChange={(href) =>
                        updateColumn(columnIndex, {
                          links: column.links.map((l, i) => (i === linkIndex ? { ...l, href } : l)),
                        })
                      }
                      aria-label="Link target"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-9 text-destructive"
                      onClick={() =>
                        updateColumn(columnIndex, {
                          links: column.links.filter((_, i) => i !== linkIndex),
                        })
                      }
                      aria-label="Remove link"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  {rowErrors[`col-${columnIndex}-${linkIndex}`] && (
                    <p className="text-xs text-destructive">
                      {rowErrors[`col-${columnIndex}-${linkIndex}`]}
                    </p>
                  )}
                </div>
              ))}

              {column.links.length < SETTINGS_LIMITS.footerLinksPerColumn && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="self-start text-xs"
                  onClick={() =>
                    updateColumn(columnIndex, { links: [...column.links, { label: '', href: '' }] })
                  }
                >
                  <Plus className="size-3" /> Add link
                </Button>
              )}
            </div>
          </EditorRow>
        ))}
      </EditorSection>

      <EditorSection
        title="Brand and contact"
        description="The first and last columns of the footer."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="aboutText">About text</Label>
            <Textarea
              id="aboutText"
              value={draft.value.aboutText}
              onChange={(e) => patch({ aboutText: e.target.value })}
              placeholder="A sentence or two about the store."
              rows={3}
              maxLength={1000}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contactEmail">Contact email</Label>
            <Input
              id="contactEmail"
              value={draft.value.contactEmail}
              onChange={(e) => patch({ contactEmail: e.target.value })}
              placeholder="hello@example.com"
            />
            {rowErrors.contactEmail && (
              <p className="text-xs text-destructive">{rowErrors.contactEmail}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Also used by any announcement-bar link set to follow the store email.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contactPhone">Contact phone</Label>
            <Input
              id="contactPhone"
              value={draft.value.contactPhone}
              onChange={(e) => patch({ contactPhone: e.target.value })}
              placeholder="+8801700000000"
            />
            <p className="text-xs text-muted-foreground">
              Also used by any announcement-bar link set to follow the store phone.
            </p>
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={draft.value.address}
              onChange={(e) => patch({ address: e.target.value })}
              placeholder="Street, city, country"
            />
          </div>
          {/* Copyright text belongs to the store's identity, and identity has
              one home — UI → Site Setting. Editing it from two forms meant
              either could overwrite the other with a stale value. */}
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label>Copyright line</Label>
            <p className="text-xs text-muted-foreground">
              Edited under{' '}
              <Link to="/ui/site-settings" className="font-medium text-foreground underline">
                Site Setting
              </Link>
              . The year is added automatically.
            </p>
          </div>
        </div>
      </EditorSection>

      <EditorSection
        title="Social links"
        description="Only the platforms the storefront has an icon for."
        onAdd={() => patch({ socialLinks: [...socialLinks, { platform: 'facebook', url: '' }] })}
        addLabel="Add social link"
        atCapacity={socialLinks.length >= SETTINGS_LIMITS.socialLinks}
        capacityNote={`Up to ${SETTINGS_LIMITS.socialLinks} links.`}
      >
        {socialLinks.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            None set. The footer renders without the social icon row.
          </p>
        )}

        {socialLinks.map((social, index) => (
          <EditorRow
            key={index}
            index={index}
            count={socialLinks.length}
            error={rowErrors[`social-${index}`]}
            onMove={(from, to) => patch({ socialLinks: moveItem(socialLinks, from, to) })}
            onRemove={() => patch({ socialLinks: socialLinks.filter((_, i) => i !== index) })}
          >
            <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
              <Select
                value={social.platform}
                onValueChange={(v) =>
                  patch({
                    socialLinks: socialLinks.map((s, i) =>
                      i === index ? { ...s, platform: v as SocialPlatform } : s,
                    ),
                  })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOCIAL_PLATFORMS.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={social.url}
                onChange={(e) =>
                  patch({
                    socialLinks: socialLinks.map((s, i) =>
                      i === index ? { ...s, url: e.target.value } : s,
                    ),
                  })
                }
                placeholder="https://facebook.com/yourstore"
                aria-label="Profile address"
              />
            </div>
          </EditorRow>
        ))}
      </EditorSection>

      <EditorSection title="Newsletter" description="The signup strip at the top of the footer.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="nl-heading">Heading</Label>
            <Input
              id="nl-heading"
              value={newsletter.heading}
              onChange={(e) => patch({ newsletter: { ...newsletter, heading: e.target.value } })}
              placeholder="Join Our Newsletter For ৳10 Off"
              maxLength={200}
            />
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="nl-subtext">Supporting text</Label>
            <Textarea
              id="nl-subtext"
              value={newsletter.subtext}
              onChange={(e) => patch({ newsletter: { ...newsletter, subtext: e.target.value } })}
              rows={2}
              maxLength={500}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nl-placeholder">Input placeholder</Label>
            <Input
              id="nl-placeholder"
              value={newsletter.placeholder ?? ''}
              onChange={(e) => patch({ newsletter: { ...newsletter, placeholder: e.target.value } })}
              placeholder="Email"
              maxLength={100}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nl-button">Button label</Label>
            <Input
              id="nl-button"
              value={newsletter.buttonLabel ?? ''}
              onChange={(e) => patch({ newsletter: { ...newsletter, buttonLabel: e.target.value } })}
              placeholder="Subscribe"
              maxLength={50}
            />
          </div>
        </div>
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

function FooterPreview({
  draft,
  copyrightText,
  isDirty,
}: {
  draft: FooterDraft
  /** From the stored settings — this page no longer edits it. */
  copyrightText: string
  isDirty: boolean
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">Preview</span>
        {isDirty && <span className="text-xs text-warning">Unsaved — not live yet</span>}
      </div>
      <div className="bg-[#1560bd] p-4 text-white">
        <div className="border-b border-white/20 pb-3">
          <p className="text-sm font-semibold">
            {draft.newsletter.heading || <em className="opacity-60">No newsletter heading</em>}
          </p>
          <p className="text-xs opacity-80">{draft.newsletter.subtext}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-3 text-xs sm:grid-cols-3 lg:grid-cols-5">
          <div>
            <p className="mb-1.5 font-semibold">Brand</p>
            <p className="line-clamp-4 opacity-80">{draft.aboutText}</p>
          </div>
          {draft.footerColumns.map((column, i) => (
            <div key={i}>
              <p className="mb-1.5 font-semibold">
                {column.title || <em className="opacity-60">(no heading)</em>}
              </p>
              <ul className="flex flex-col gap-1 opacity-80">
                {column.links.map((link, l) => (
                  <li key={l}>{link.label || <em className="opacity-60">(no label)</em>}</li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <p className="mb-1.5 font-semibold">About Information</p>
            <ul className="flex flex-col gap-1 opacity-80">
              <li>{draft.address}</li>
              <li>{draft.contactEmail}</li>
              <li>{draft.contactPhone}</li>
            </ul>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-white/20 pt-2 text-xs opacity-80">
          <span className="capitalize">{draft.socialLinks.map((s) => s.platform).join(' · ')}</span>
          <span>
            © {new Date().getFullYear()}, {copyrightText}
          </span>
        </div>
      </div>
    </Card>
  )
}

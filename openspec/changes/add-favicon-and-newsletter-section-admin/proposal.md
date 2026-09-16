## Why

The server change `add-favicon-and-newsletter-section` (in `server/`) makes two things configurable that the panel has no screen for yet. This change is the admin half — without it a merchant cannot reach either setting, and one of them will silently discard their work.

**There is no way to set a favicon.** Site Setting → Branding already uploads a header logo and a footer logo, previews both, and clears either. The browser-tab icon is the one piece of brand artwork with no field, even though it is the one a merchant sees most often — every tab, every bookmark, every search result.

**The newsletter is edited on Footer Links, a page that will no longer render it.** The storefront change moves the block out of the footer and onto the home page as a section a merchant switches on, off and reorders. Its four copy fields — heading, supporting text, input placeholder, button label — would be left on a screen named for a part of the site that no longer shows them.

**And there is a failure that is worse than a missing screen.** `HOME_SECTION_REGISTRY` in `src/lib/api/store-settings.ts` is a hand-maintained mirror of the server's section list, and Home Sections filters its stored configuration against it: `stored.filter((section) => known.has(section.key))`. Until `NEWSLETTER` is in that mirror the page treats it as unrecognised, drops it from the list on load, and writes the shortened list back on the next save — silently deleting the merchant's choice with no error anywhere. That makes this change a correctness fix, not only a feature.

## What Changes

- **Site Setting → Branding gains a Favicon field**, beside the two logos and built from the same `LogoField` — upload, preview, clear — through the `POST /upload/image` route already wired into that page. Its helper text says what the image is for and what shape it should be.
- `faviconUrl` joins the admin's `StoreSettings` and `UpdateStoreSettingsInput` types and the Site Setting draft, and is sent only when non-empty, following the page's existing rule that "unset" is expressed by omitting the key.
- **`NEWSLETTER` joins `HOME_SECTION_REGISTRY`**, last, matching the server's order, with a merchant-facing label and a description saying what the block is.
- **Home Sections gains the newsletter's copy fields.** The Newsletter row expands to reveal heading, supporting text, input placeholder and button label, so the switch, the position and the wording are edited in one place. Every other row is unchanged.
- **Home Sections now writes two keys, `homeConfig` and `newsletter`,** where it previously wrote one. The page's standing "one key and only one" note is rewritten to say which two and why they travel together.
- **Footer Links loses the newsletter fields** and stops sending `newsletter`. It keeps its link columns, social links, about text and contact details. This restores the disjointness the settings editors depend on — with both edits in this change, exactly one page writes `newsletter`.
- **BREAKING for merchant habits, not for data:** a merchant who edits their newsletter wording today on Footer Links will find it on Home Sections. Nothing stored changes, and no wording is lost.

Stated because its absence is deliberate: **no subscriber list, no signup counts, no export.** The storefront's form is still a no-op with nowhere to post to, so there is nothing for the panel to show. A screen listing subscribers that are not being collected would be a lie. Capturing subscribers is its own change, server first.

Also deliberate: **plain string literals, not `t()` calls.** The admin has i18n packages installed but `add-admin-i18n` has not been applied, and none of the settings editors use them. New strings here follow the code as it stands; the i18n change picks them up with everything else.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platform-settings`: adds a requirement that the browser-tab icon is uploadable, previewable and clearable from the branding editor; and a requirement that the newsletter's visibility, position and wording are all administered from the home sections editor, with the two values saved together and without disturbing any other setting.

## Impact

- `src/lib/api/store-settings.ts` — `faviconUrl` on the settings and update types; `NEWSLETTER` in `HOME_SECTION_REGISTRY` (which `DEFAULT_HOME_CONFIG` derives from, so that needs no edit).
- `src/features/ui/site-settings/site-settings-page.tsx` — the favicon slot in the Branding section, the draft field, the upload handler's slot union, and the save payload.
- `src/features/ui/home-sections/home-sections-page.tsx` — the draft becomes `{ sections, newsletter }`, the Newsletter row expands, the save sends both keys.
- `src/features/ui/footer-links/footer-links-page.tsx` — the newsletter fields, the draft key and the saved key removed.
- `src/features/ui/components/settings-editor.tsx` — only if the expanded row needs a shared primitive; prefer keeping it local to Home Sections.
- **Depends on** `server/openspec/changes/add-favicon-and-newsletter-section`, which must be deployed first. `updateStoreSettingZodSchema` is not `.strict()`, so an older server does not reject `faviconUrl` — it silently strips it, the save reports success, and the merchant's icon never sticks with nothing anywhere saying why. That is a worse failure than a rejection, and the only guard against it is ordering. Independent of the storefront change; neither blocks the other.

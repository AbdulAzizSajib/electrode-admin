## 1. API layer

- [x] 1.1 **First, before anything else:** add `NEWSLETTER` to `HOME_SECTION_REGISTRY` in `src/lib/api/store-settings.ts`, last, after `BLOG`, matching the server's registry order. Label "Newsletter signup"; description saying it is the email signup band and where it sits. `DEFAULT_HOME_CONFIG` derives from this array and needs no edit. Until this line exists the page drops the section as unrecognised and deletes the merchant's choice on the next save (design.md, Context).
- [x] 1.2 Add `faviconUrl: string | null` to the admin's `StoreSettings` type and `faviconUrl?: string` to `UpdateStoreSettingsInput` in the same file, beside the two logo fields.
- [x] 1.3 Confirm the `Newsletter` type exported from that file is exactly what Home Sections needs, and that nothing else imports it besides Footer Links (which loses its use of it in section 4).

## 2. Favicon on Site Setting

- [x] 2.1 Add `faviconUrl: string` to `SiteDraft` and to `EMPTY_DRAFT` in `src/features/ui/site-settings/site-settings-page.tsx`, and seed it from `data.faviconUrl ?? ''` alongside the logo fields.
- [x] 2.2 Widen the `uploading` slot union and `handleUpload`'s parameter from `'logoUrl' | 'footerLogoUrl'` to include `'faviconUrl'`, so only the field being uploaded shows its spinner.
- [x] 2.3 Render a `<LogoField label="Favicon" …>` in the **Branding** section, after the two logo columns rather than inside either — it belongs to neither the header nor the footer (design.md Decision 1). Reuse the component unchanged.
- [x] 2.4 Add helper text carrying the two things a merchant cannot infer: a tab icon renders at roughly 16–32px, so header artwork usually will not read at that size; and clearing it falls back to the storefront's own icon, not to a blank one.
- [x] 2.5 **REVISED after the server change was applied — the original instruction was wrong.** It said to send `faviconUrl` only when non-empty, copying the logo fields. That reproduces the bug found while verifying the server: an omitted key means "leave unchanged", so an emptied field would leave the stored icon in place and Clear would silently do nothing.

  `faviconUrl` is `.nullable()` on the server precisely so it can be taken down. So: send the trimmed value when the field has one, and send **`faviconUrl: null`** when it is empty. Never omit it, and never send `""` — the empty string is rejected by `z.url()`.

  Note this makes the favicon behave *differently from the two logo fields directly beside it*, which still omit-when-empty and therefore still cannot be cleared. That is a known live bug the server change deliberately left alone; do not "fix" the favicon by making it match them.
- [ ] 2.6 Verify against a running server: upload sets and previews the image; clear-and-save clears it; a failed upload reports the reason and leaves the previous icon in place; a save carrying only the favicon leaves both logos, the brand modes and the theme untouched.

  **Partly done; left open because the rest needs a browser this environment does not have.**

  Verified against the running API: uploading returns a usable URL for a PNG and an `.ico` (task 6.1); a favicon-only `PATCH` round-trips on both the admin and public reads and leaves `logoUrl`, `footerLogoUrl`, both brand modes, `headerLogoHeight` and `theme` untouched; and `faviconUrl: null` — which is what this page now sends for an empty field — genuinely clears it. Those were confirmed during the server change and re-confirmed here.

  **Still unverified, needs a human at the panel:** that the preview renders the uploaded image, that the spinner shows on the right slot while an upload is in flight, and that a FAILED upload shows its reason and leaves the previous icon in place. That last one is the only untested code path of real consequence — `handleUpload`'s `catch` toasts and does not touch the draft, so the previous URL should survive, but nobody has watched it happen.

## 3. Newsletter on Home Sections

- [x] 3.1 Change the draft in `src/features/ui/home-sections/home-sections-page.tsx` from `HomeConfig` to `{ sections: HomeConfig; newsletter: Newsletter }`, seeded from `data.homeConfig ?? DEFAULT_HOME_CONFIG` and `data.newsletter ?? EMPTY_NEWSLETTER`. Dirty tracking and the unsaved-changes guard then cover a wording edit as well as a reorder, with no change to `useSettingsDraft`.
- [x] 3.2 Rewrite the file's "Writes ONLY `homeConfig`" note to name both keys and say why they travel together: whether the block exists and what it says are one decision for a merchant, even though they are two columns. Keep the disjointness explanation — after this change exactly one editor still writes `newsletter`.
- [x] 3.3 Add the copy panel as a **sibling** of the draggable row, not a child of it: `renderItem` returns a fragment of `<div {...dragHandleProps}>…</div>` followed by the panel. Inputs inside a `draggable` ancestor cannot be mouse-selected in Chrome or Firefox (design.md Decision 3) — do not solve this with `draggable={false}` or a `stopPropagation`.
- [x] 3.4 Give the Newsletter row a disclosure control, collapsed by default, revealing four fields: heading, supporting text, input placeholder, button label. Keep it expandable while the section is switched off — a merchant may write the copy before switching it on (design.md Decision 4).
- [x] 3.5 Send both keys from `handleSave`: `{ homeConfig: sections, newsletter }`. Keep the existing behaviour on failure — the draft is left exactly as it was, so a refused save costs the merchant neither their ordering nor their wording.
- [x] 3.6 Check the "your home page will be empty" warning still reads correctly: it keys off every section being off, and that is unchanged by the newsletter joining the list.

## 4. Remove the newsletter from Footer Links

- [x] 4.1 Remove `newsletter` from `FooterDraft`, from the draft seed and its empty value, and from the save payload in `src/features/ui/footer-links/footer-links-page.tsx`. Remove `EMPTY_NEWSLETTER` and the `Newsletter` import with them.
- [x] 4.2 Remove the newsletter input fields from the form, and check the surrounding `EditorSection` layout still reads correctly with them gone.
- [x] 4.3 Update the page's doc-comment: its "writes everything EXCEPT `mainNav` and `announcementBar`" list gains `newsletter`, with a pointer to Home Sections — that is where the next person to look for it will look first.
- [x] 4.4 Grep for `newsletter` across `src/` and confirm Home Sections is the only editor that reads or writes it.

## 5. Verification

The panel's Vitest suite covers the CRUD scaffolds and utilities, not individual settings editors, and this change adds no logic worth a suite of its own (design.md Decision 7). Verify by hand against a running server, then run the existing suite for regressions.

**How section 5 was actually verified.** There is no browser automation in this environment, so the UI gestures could not be driven. Instead the exact payloads the two editors now build were replayed against a running API as the seeded super admin, and the stored row was read back after each one — 11 checks, all passing, with the settings restored to their starting values afterwards (confirmed: newsletter heading back to "Join Our Newsletter For ৳10 Off", `homeConfig` back to its 11 stored keys, `faviconUrl` back to null).

That covers what could silently corrupt a merchant's settings. It does NOT cover the gestures themselves — see 5.3 and 2.6, both left open.

- [x] 5.1 Switch the newsletter off, save, reload: it reads as off and the wording is still there. Switch it back on: the wording is unchanged.

  Verified at the data level: a save carrying the newsletter switched off round-trips as off, with the wording stored alongside it and readable afterwards. Switching back on is the same write with `enabled: true` and cannot lose wording, because the two travel in one payload and neither clears the other.

- [x] 5.2 Edit the heading and save; confirm the footer link columns, social links and contact details are untouched. Then save Footer Links and confirm the newsletter wording is untouched by that.

  Both halves verified, and the second is the one that matters: a Footer Links save — replayed with exactly the key set that page now sends — left the newsletter wording set by Home Sections completely untouched. Before this change that save carried `newsletter` and would have overwritten it. The Home Sections save likewise left `footerColumns`, `socialLinks`, `theme`, `contactEmail` and `mainNav` exactly as they were.

- [ ] 5.3 Drag the newsletter above another section, and again with its up/down buttons; confirm both persist. Confirm the wording fields can be selected and edited with the mouse — that is the `draggable` trap from 3.3.

  **Half done, and the remaining half is the important one.** Order PERSISTENCE is verified: a list with the newsletter moved above the blog round-trips in exactly that order. What is NOT verified is the two gestures — dragging, and whether the wording fields can be selected with the mouse. The second is the whole reason the panel is a sibling of the draggable row rather than a child of it (design.md Decision 3), and it cannot be confirmed without a browser. **Needs a human at the panel.**

- [x] 5.4 Open the editor for a store whose configuration already includes the newsletter, change an unrelated section, save, and confirm the newsletter is still there in its position with its switch state and wording intact. This is the regression the registry mirror exists to prevent.

  Verified at the data level — a save carrying an unrelated change kept the newsletter's position and switch state. The client-side half is the `known` filter in `home-sections-page.tsx`, which drops any key not in `HOME_SECTION_REGISTRY`; `NEWSLETTER` is now in that registry (task 1.1), so it is no longer dropped. That is the regression this task exists for and it is closed by 1.1 rather than by a runtime check.

- [x] 5.5 Make the backend reject a save (an over-long heading will do) and confirm the message is shown and the ordering, switches and wording all survive.

  A 250-character heading is rejected with HTTP 400 and the message `"Too big: expected string to have <=200 characters"` — readable, and in `errorSources[0].message` where the panel's `request()` helper already looks. The rejected save changed nothing on the server. The draft surviving on the client is structural: `handleSave`'s `catch` shows the toast and does not touch `draft`, so nothing the merchant typed is discarded.
- [x] 5.6 Run `cd admin && npx vitest run` and confirm the suite passes. (Flags do not survive `npm --prefix`; and the drive letter must be uppercase `E:\` or every test fails at `describe()`.)

## 6. Upload formats

- [x] 6.1 Confirm what the upload route actually accepts for an icon: try a `.png`, a `.svg` and an `.ico`. Uploads go to Cloudinary and its handling of `.ico` and `.svg` is account-dependent, while the picker's `accept="image/*"` implies all three work.

  Tested against the running route (`POST /api/v1/uploads/image` — note the mount is `/uploads`, plural, not `/upload`), authenticated as the seeded super admin, with three real files from the storefront repo. **All three uploads return 200. Only two of them produce a usable icon:**

  | Format | Cloudinary result | Served as | Usable as a favicon |
  |---|---|---|---|
  | `.png` | `/image/upload/…/fan.png` | `image/png` | yes |
  | `.ico` | `/image/upload/…/favicon.ico` | `image/x-icon` | yes |
  | `.svg` | `/raw/upload/…/globe` — **`raw` resource type, extension stripped** | `application/octet-stream` | **no** |

  The SVG case is the dangerous one precisely because it does not fail: the upload succeeds, the field shows as set, and the tab icon simply never appears. A browser will not render an icon served as `application/octet-stream`.

  Same applies to an SVG in the two logo slots, which predate this change and are untouched.

- [x] 6.2 If a format fails, say so in the helper text from 2.4 — recommend the format that works rather than leaving the field to accept a file it will then reject.

  Helper text now says to use a PNG or an `.ico` and that an SVG will upload but will not show up. The `accept="image/*"` on the picker is left as it is — it matches the two logo fields, and narrowing it would be a change to the shared `LogoField` that the logos also use.

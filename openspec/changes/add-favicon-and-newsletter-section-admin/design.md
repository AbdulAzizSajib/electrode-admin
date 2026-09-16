## Context

See proposal.md — Why. The server side is `server/openspec/changes/add-favicon-and-newsletter-section` (adds `faviconUrl` and the `NEWSLETTER` section key); the storefront side is `frontend/openspec/changes/add-favicon-and-newsletter-section-ui`.

Five facts about the panel as it stands shape everything below.

**The settings editors are disjoint by construction.** `PATCH /settings` is a partial upsert, and eight editors — Store Settings, Site Setting, Header Links, Footer Links, Home Sections, Catalog Setting, Checkout Setting, Integrations — stay independent by each writing a field set nobody else writes. That is the invariant this change has to preserve while moving `newsletter` from one editor to another.

**Home Sections writes exactly one key today,** and says so in a comment at the top of the file. After this change it writes two. The comment is not decoration: it is what a future editor reads before adding a field.

**`HOME_SECTION_REGISTRY` is a hand-maintained mirror, and the page filters against it.** `stored.filter((section) => known.has(section.key))` drops any key the mirror does not carry, and the save writes that filtered list back. An unmirrored `NEWSLETTER` therefore does not merely fail to render a row — it deletes the merchant's setting on the next unrelated save, with no error.

**`LogoField` already exists** in `site-settings-page.tsx`: label, preview box, upload button, clear button, spinner while busy. It is local to that file and takes `{ label, url, busy, onPick, onClear, dark? }`. A favicon slot is the same component with a different label.

**Rows in `ReorderableList` carry `draggable: true` on the row element itself.** `SectionRow` spreads `dragHandleProps` onto its outer `div`, and a text input inside a `draggable` ancestor is unreliable in Chrome and Firefox — mouse selection inside the field starts a drag instead of selecting text. This is the one real obstacle to putting copy fields in a section row, and Decision 3 is about getting around it.

## Goals / Non-Goals

**Goals:**

- A favicon slot that is indistinguishable in behaviour from the two logo slots beside it, because it is the same component.
- The newsletter's switch, its position and its wording in one place, without breaking the disjointness rule the other seven editors depend on.
- `NEWSLETTER` in the registry mirror, which is the correctness half of this change.
- No new shared abstraction unless two callers actually need it.

**Non-Goals:**

- A general "sections with settings" mechanism. One section has copy fields. Building a framework for the second one before it exists would be guessing at its shape.
- Any change to how the list is reordered, reconciled or saved. `NEWSLETTER` is an ordinary member of a list that already works.
- Validating the favicon's dimensions, aspect ratio or file type beyond the picker's `accept`. The panel does not inspect uploads anywhere else and should not start with this one.
- i18n. Not applied to any settings editor yet; new strings are literals like their neighbours.

## Decisions

### 1. The favicon reuses `LogoField` as-is, and stays local to Site Setting

`LogoField` already does upload, preview, clear and busy state, and `handleUpload` already takes a slot name so only the field being uploaded shows a spinner. The favicon widens that union from `'logoUrl' | 'footerLogoUrl'` to include `'faviconUrl'` and adds one more `<LogoField>`. No new component, no props added to the existing one.

It goes in the **Branding** section, after the two logo columns rather than inside either, because it belongs to neither the header nor the footer — it is the site's mark. Its helper text carries the two things a merchant cannot infer: that a tab icon renders at roughly 16–32px so header artwork usually will not read, and that clearing it falls back to the storefront's own icon rather than to nothing.

*Alternative considered — a separate "Favicon" editor section.* Rejected: one field does not justify a section, and separating it from the logos is exactly the split that makes people hunt for it.

*Alternative considered — SEO → General.* The favicon is emitted beside the meta tags, so this is defensible. Rejected for the same reason the server keeps `faviconUrl` as a branding column rather than a key in `seoConfig`: it is artwork a merchant uploads, and it belongs with the other artwork they upload.

### 2. Home Sections writes `homeConfig` and `newsletter`, and the disjointness rule holds

Moving `newsletter` from Footer Links to Home Sections is a **swap, not an addition**: after this change exactly one editor writes it, which is the same property the arrangement had before. Both edits are in this change and the same deploy, so there is no window where both write it or neither does.

The draft type changes from `HomeConfig` to `{ sections: HomeConfig; newsletter: Newsletter }`, so `useSettingsDraft` still holds one value, dirty-tracking still covers everything on the page, and the unsaved-changes guard still fires for a wording edit as well as a reorder. The file's "one key and only one" comment is rewritten to name both keys and say why they travel together — the block's wording and whether the block exists are one decision for a merchant, even though they are two columns.

*Alternative considered — leave `newsletter` on Footer Links and give Home Sections only the switch.* Rejected by the ask, and rightly: it leaves the wording on a page named for the part of the site that no longer renders it, and a merchant who switches the section on has nowhere obvious to go to change what it says.

### 3. The copy panel is a sibling of the draggable row, not a child of it

The panel renders **outside** the element carrying `dragHandleProps`, as the second child of a fragment returned from `renderItem`:

```
renderItem → <>
  <div {...dragHandleProps}>  …label, move buttons, switch…  </div>
  {section.key === 'NEWSLETTER' && expanded ? <NewsletterFields … /> : null}
</>
```

Inputs inside a `draggable` ancestor cannot be selected with the mouse in Chrome or Firefox — the drag intercepts it. Keeping the panel out of that subtree fixes it at the root, and costs nothing: the drop target is the row, which is what a merchant aims at anyway.

*Alternative considered — `draggable={false}` on the panel, or `onDragStart` stopping propagation.* Both work in most browsers and both are the kind of fix that silently stops working. The structural answer has no such failure mode.

*Alternative considered — a separate "Newsletter wording" card below the list.* Simpler, and it was the fallback if the row approach had proved awkward. Rejected because it separates the wording from the switch that governs it, and the point of this change is to put them together.

### 4. The panel is disclosed, not always open

The list is eleven rows of equal weight; one row permanently four fields taller would read as the important one. The Newsletter row gets a disclosure control that expands its fields, collapsed by default, with the row itself unchanged otherwise.

It stays expandable while the section is switched **off** — a merchant may well write the copy before turning the block on, and hiding the fields behind the switch would make that impossible. The off state already dims the row, which is enough signal.

### 5. Footer Links loses the fields in the same change

`newsletter` comes out of `FooterDraft`, out of the draft's seed and its empty value, out of the save payload, and its three or four inputs come out of the form. `EMPTY_NEWSLETTER` goes with them. The page's doc-comment currently says it writes "everything EXCEPT `mainNav` and `announcementBar`" — that list gains `newsletter`, with a pointer to where it went, because the next person to look for it will look here first.

### 6. `NEWSLETTER` goes last in the registry mirror, matching the server

Registry order is what a merchant sees before they reorder anything, and the two registries disagreeing would mean the admin showing one default order while the storefront renders another. Last, after `BLOG`, exactly as the server has it.

Label and description are the admin's own and can be reworded freely — the server's comment on `HOME_SECTION_KEYS` is explicit that only the key is permanent. "Newsletter signup", described as the email signup band, rather than "Newsletter", which reads like a mailing list feature the panel does not have.

### 7. No test for a switch; one for the registry if it is cheap

The panel's suite is Vitest + jsdom and covers the CRUD scaffolds and a few utilities, not every settings editor. This change adds no logic worth a test of its own — the interesting parts are a mirrored constant and a prop swap.

The one thing worth asserting, if it fits the existing `store-settings` test surface: that the admin's `HOME_SECTION_REGISTRY` and the storefront's default order agree in length and order. It cannot be checked across repositories, so it is a comment-level obligation and a manual step, not a test. Do not add a suite for it.

## Risks / Trade-offs

**Shipping this before the server change** → `faviconUrl` is silently stripped by a server that does not know it (`updateStoreSettingZodSchema` is not `.strict()`), so the save reports success and the icon never sticks, with nothing anywhere saying why. Ordering is the only guard — see Migration Plan.

**Shipping the registry mirror late** → the failure named in the proposal: Home Sections drops `NEWSLETTER` as unrecognised and writes the shortened list back on the next save, deleting the merchant's choice. This is why the registry line is the first task and not the last.

**A merchant goes to Footer Links for the newsletter and finds nothing** → the fields moved, and nothing in the panel says so. Mitigated by the Home Sections description mentioning the wording is edited there, and by the section label being the obvious place to look. A one-line note on Footer Links pointing at Home Sections is worth considering during apply, but a permanent signpost for a one-time move is clutter.

**An `.ico` upload may not survive the image pipeline.** The picker accepts `image/*`, which includes `image/x-icon`, but uploads go to Cloudinary and its handling of `.ico` — and of `.svg`, which some accounts do not deliver by default — is account-dependent. Verify both during apply; if either fails, the helper text should recommend PNG rather than the field pretending to accept everything.

**Two hand-maintained registry mirrors** → this repository owns one, the storefront owns the other, and nothing checks that they agree. Decision 7 declines to fake a test for it; the mitigation is that the server's `HOME_SECTION_KEYS` doc-comment names both, and that both changes are planned together.

## Migration Plan

1. **The server change ships first.** Until it does, `faviconUrl` is silently discarded on save and `NEWSLETTER` never arrives in a settings read — so the row would only ever appear because the mirror appends it locally, and saving it would send a key the server drops.
2. **Then this change**, all of it in one deploy: the registry line, the favicon field, the Home Sections panel and the Footer Links removal. Splitting the last two would leave a window where both editors write `newsletter` and a Footer Links save silently reverts a Home Sections one.
3. The storefront change can land before or after. Before it lands, a merchant editing the newsletter on Home Sections is editing something the storefront still renders in its footer — correct, just not yet moved.

**Rollback** is a plain revert; nothing here writes data the panel cannot write again, and the merchant's stored wording is untouched throughout — no path in this change clears `newsletter`, only relocates which screen sends it.

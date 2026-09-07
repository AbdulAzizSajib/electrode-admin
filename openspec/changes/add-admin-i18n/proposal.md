## Why

Every word of the admin panel's interface is written in English, hardcoded at the point it is displayed. The staff who use it — the operations team of a Bangladeshi electronics store — are not uniformly comfortable in English, and nothing in the panel lets them read it in Bangla.

The text is not merely untranslated; it is unaddressable. There are roughly 333 literal UI strings across 71 source files (`title:`, `label:`, `placeholder:` and their kin), with 51 in the navigation config alone. No string has a name, so no string can be looked up, and there is no seam at which a second language could be introduced. Adding Bangla today would mean editing 71 files whether or not a library is involved — the library is what makes the *second* such edit unnecessary.

Two further facts shape the change:

- **Ant Design supplies its own interface text.** It is used in 30+ files (DatePicker, Select, Table), and the words inside those components — "No data", "Select date", the month names in a calendar — never pass through this panel's source. They are translated only by handing antd a locale, which is a separate mechanism from translating our own strings.
- **`src/lib/utils/format.ts` hardcodes `en-US`** in seven places. Switching those to `bn-BD` would render every number in Bangla-Indic digits (`১,২০০`), which is *not* wanted: staff read financial figures in Western digits, and a report copied into a spreadsheet must remain parseable. The language of the interface and the numerals of its data are being decided separately here, and the numerals are not changing.

## What Changes

- **The panel gains a language setting with two values, English and Bangla**, chosen by the person using it and remembered across sessions and reloads. English remains what a staff member who has never touched the setting sees.
- **UI text is addressed by key rather than written in place.** Each displayed string is looked up by a stable name from a per-language catalogue, so a second language is a new catalogue rather than a second edit of every file.
- **Ant Design components follow the same setting** — the panel passes antd the matching locale through the `ConfigProvider` already mounted in `src/main.tsx`, so words the panel does not own are translated too.
- **Numbers, dates and currency stay in Western digits and the existing format, in both languages.** `formatCurrency`, `formatNumber`, `formatDate` and the rest are untouched by the language setting. This is a deliberate decision recorded in design.md, not an omission.
- **Rollout is phased, and this change covers the first phase**: the i18n foundation (catalogue structure, provider, language setting, persistence, antd locale wiring) plus the sidebar navigation's 51 strings converted end to end as the worked example. The remaining ~280 strings across feature pages are explicitly deferred — see below.
- **A missing Bangla translation falls back to the English string**, so a partly-translated panel is usable at every point during the phased rollout rather than showing blank labels or raw keys.

Deliberately **not** in scope:

- **The remaining feature-page strings** (catalog, inventory, sales, marketing, customers, settings). They are the bulk of the work and are mechanical once the foundation exists; folding them in here would produce a diff too large to review against a foundation not yet agreed.
- **Translating data, not chrome.** Product names, category names and customer names are merchant-entered content in one language; they are not interface text and are not translated.
- **Server-supplied text.** API error messages and enum values (`PENDING`, `CONFIRMED`) come from the backend in English. Where the panel already maps an enum to a display label it will translate that label; it will not translate raw server strings, and the backend is not modified by this change.
- **The storefront** (`nextjs/`), which is a separate application with its own OpenSpec root.
- **Right-to-left layout.** Both languages are left-to-right; no bidirectional support is added.

## Capabilities

### New Capabilities
- `admin-localization`: how the panel decides which language to display, how that choice is made and remembered, what falls back when a translation is missing, which surfaces the choice governs (including component libraries the panel does not own), and — equally binding — what the choice does *not* change, namely the numerals and formats used for money, quantities and dates.

### Modified Capabilities
(none — the admin panel has no spec files under `openspec/specs/` yet, so there is no existing requirement to amend. The `admin-shell` capability is referenced by earlier changes but exists only as delta specs within those changes.)

## Impact

- **New**: `src/lib/i18n/` — the i18next configuration, the language store, and the `en`/`bn` catalogues.
- **Modified**: `src/main.tsx` (initialise i18n; pass `locale` to the existing `ConfigProvider`); `src/routes/nav-config.ts` (labels become keys); `src/components/layout/sidebar-nav.tsx` (resolve those keys); `src/components/layout/topbar.tsx` (the language control).
- **Unchanged, deliberately**: `src/lib/utils/format.ts`. Its `en-US` formatters are correct for both languages under the decision above, and the currency symbol already comes from merchant settings rather than a locale.
- **Dependencies**: `i18next`, `react-i18next`, `i18next-browser-languagedetector`. Note: these three were already added to `package.json` before this proposal was written, in anticipation of the work; no other code change was made. If this proposal is rejected they should be removed.
- **Bundle**: the two catalogues ship with the app rather than being fetched, so the panel never renders untranslated text while a language file loads. The added weight is a few kilobytes of JSON, versus a loading state on every screen.
- **Testing**: the panel has an established Vitest setup; the language switch and the fallback behaviour are testable without a browser.
- **Translation quality is a content risk, not a technical one.** The Bangla catalogue needs a reviewer who works in Bangladeshi e-commerce operations — machine-translated inventory and accounting vocabulary is frequently wrong in ways a developer cannot detect. This change delivers the mechanism and the navigation strings; it does not certify the wording.

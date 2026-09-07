## Context

See proposal.md — Why, for the motivation. The constraints that shape the approach:

- **The panel is a Vite SPA** (React 19, react-router data router, Tailwind v4). There is no server render, so there is no hydration mismatch to design around and no need to resolve the language on a server.
- **Text is scattered, not centralised.** ~333 literal strings across 71 files. `src/routes/nav-config.ts` alone holds 51, and it is a plain exported array consumed by `sidebar-nav.tsx` — a module-scope constant evaluated once at import.
- **`src/main.tsx` already mounts `ConfigProvider`** from antd, wrapping the whole tree for theming. It takes a `locale` prop the panel does not currently pass.
- **`src/lib/utils/format.ts` is module-scope, not a hook.** `formatCurrency` is called from ~90 sites including cell renderers and chart tooltip callbacks that are not components. Its docstring records this deliberately: a mutable module-scope value set once by a provider, because threading a format through 90 call sites would prop-drill a deployment constant. Any design that needs formatting to react to language would have to overturn that decision.
- **Zustand with `persist` is the established pattern** for browser-persisted preferences (`session-store.ts`, key `ecom-admin-session`).
- **Vitest + Testing Library** are already configured.

## Goals / Non-Goals

**Goals:**

- One lookup mechanism for interface text, usable identically from components, from non-component render callbacks, and from module-scope constant tables like `nav-config.ts`.
- The language decision expressed once, with antd's locale and the panel's own catalogue both following from it — not two settings that can disagree.
- A structure that makes the deferred ~280 strings a mechanical, reviewable conversion rather than a second design problem.
- No flash of the wrong language on load.

**Non-Goals:**

- Lazy-loading or fetching catalogues over the network (see Decision 4).
- Any change to how money, numbers or dates are formatted (see Decision 5) — the spec makes this binding.
- A translation-management UI, or storing translations in the database. The catalogues are source files, reviewed like source.
- Machine translation of the Bangla catalogue as part of implementation (see Risks).

## Decisions

### Decision 1: `react-i18next` over `react-intl`, `lingui`, or a hand-rolled map

**Chosen:** `i18next` + `react-i18next` + `i18next-browser-languagedetector`.

`react-i18next` is the most widely used option in the React SPA ecosystem, which matters most for the part of this work that is deferred: the remaining ~280 strings will likely be converted by several people over time, and the conventions are ones they are most likely to already know.

Two capabilities decide it over a hand-rolled `Record<string, string>` lookup, which is genuinely tempting at this size:

- **`Trans`** handles text with embedded markup — "**3** of 10 selected", a label containing a link — without splitting the sentence into fragments that cannot be reordered. Bangla word order differs from English; a fragment-concatenating approach produces sentences that cannot be translated correctly, and this is not visible until a translator tries.
- **Plural and interpolation rules** are built in. Bangla's plural rules differ from English's, and hand-written pluralisation is wrong in ways that only a Bangla reader notices.

**Alternatives considered:**

- **Hand-rolled lookup.** Smallest dependency footprint, and adequate for the 51 navigation strings alone. Rejected because it would have to grow both features above by the time the deferred strings land, at which point it is an unreviewed reimplementation of a library.
- **`react-intl`** (FormatJS). ICU message syntax is more expressive and standard. Rejected as heavier and less familiar for a team that has not used it; the ICU expressiveness is not needed for interface chrome.
- **`lingui`.** Compile-time extraction is attractive — it would find strings automatically. Rejected because its macro/build integration is an additional Vite build concern, and the extraction advantage is largest for a codebase that is already fully keyed, which this one is not.

`i18next-browser-languagedetector` is included but deliberately **not** used to read the browser's language — see Decision 3.

### Decision 2: Namespaced keys mirroring the source tree

Keys are dotted and namespaced by area: `nav.catalog.products`, `common.actions.save`, `orders.list.emptyState`.

The namespace mirrors the feature directory a string lives in, so a developer converting `src/features/inventory/stock/stock-page.tsx` knows without asking that its keys begin `inventory.stock.`. With ~333 strings across 71 files eventually in one catalogue, a naming rule that can be derived from the file path is what keeps the catalogue navigable and collisions unlikely.

`common.*` is reserved for text genuinely shared across features (Save, Cancel, Delete, "No results"). A string used in exactly one place does **not** go in `common`, even if it is short — that is how `common` becomes a dumping ground whose entries cannot be changed safely.

**Alternative considered:** English source text as the key (`t('Save changes')`), which i18next supports and which makes untranslated text trivially readable. Rejected because every copy edit to the English wording then breaks every translation, silently — the Bangla entry keys off a string that no longer exists and falls back to the new English. Stable keys make copy edits and translation independent.

### Decision 3: The panel's own persisted setting decides the language; the browser does not

The spec requires that an unconfigured panel show English even to a Bangla-configured browser. This is unusual enough to record why.

This is a shared internal operations tool, often on a shared machine. A browser's language preference states what its owner can read, not what a shop's staff have agreed to run their operations in. Auto-switching would also make the panel's language vary by machine, so a staff member describing a screen over the phone may be describing different words than their colleague sees.

Language is therefore stored in a small Zustand store with `persist` (key `ecom-admin-language`), matching `session-store.ts`. i18next is initialised from that store's value, with `lng` set explicitly and no detection order that consults `navigator`. The detector package is present for its `localStorage` caching path only; if it proves to add nothing over the Zustand store during implementation, it should be dropped rather than kept for symmetry.

**Deliberately separate from the session store.** Language survives logout — it is a property of the browser, not of the authenticated user. Folding it into `ecom-admin-session` would clear it on logout, so the login screen would revert to English for someone who had chosen Bangla.

**Alternative considered:** storing language on the staff user server-side, so it follows the person across devices. Rejected for this change: it needs a backend field, a migration and an API, and the panel has no per-user preferences endpoint today. The Zustand store is a superset-compatible first step — a later change can seed it from the server without changing any call site.

### Decision 4: Both catalogues are bundled, not fetched

`en` and `bn` are imported as ordinary modules and passed to i18next at init.

The alternative — i18next's HTTP backend, fetching the active catalogue as JSON — halves the translation payload but introduces a load state before any text can render, i.e. exactly the flash of untranslated interface the spec forbids. Two catalogues of a few hundred short strings are a few kilobytes gzipped, against a bundle whose largest single chunk is already ~400 kB. The trade is not close at this size.

This should be revisited only if the catalogue grows by an order of magnitude or a third language with a large character set is added.

### Decision 5: `format.ts` is not touched, and language is not passed to it

The spec makes Western digits binding in both languages. The design consequence is that `src/lib/utils/format.ts` needs no change at all — its `en-US` formatters already produce exactly the required output, and the currency symbol and position already come from merchant settings rather than a locale.

This is worth stating because the obvious instinct when adding i18n is to make formatting locale-aware, and here that would be an active regression: `Intl.NumberFormat('bn-BD')` renders `১,২০০`, which the spec forbids.

It also avoids overturning the module-scope decision documented in `format.ts`: if formatting depended on the active language, every one of the ~90 `formatCurrency` call sites — including non-component chart and cell callbacks that cannot hold a hook — would need to re-render on language change. Keeping language out of formatting keeps that design intact.

**Consequence to watch:** a language switch does not need to re-render formatted values, so nothing about formatting has to react to it.

### Decision 6: `nav-config.ts` stores keys; `sidebar-nav.tsx` resolves them

`NAV_SECTIONS` is a module-scope array evaluated at import, before any React context exists. It therefore cannot call a translation hook.

The `label` fields become translation keys (`nav.catalog.products`), and the single consumer — `sidebar-nav.tsx` — resolves them at render with `t()`. Everything else in the config (paths, icons, roles) is untouched.

One consumer detail matters: `sidebar-nav.tsx` currently uses `section.label` as a React `key`, as the `expanded` state map's key, and in `aria-controls` id construction. Those must move to a stable non-translated identifier, or the component's expand/collapse state resets when the language changes and ids change with the language. Adding an explicit `id` field to each section is the intended fix.

**Alternative considered:** making `NAV_SECTIONS` a function of `t`. Rejected — it makes a static table a render-time computation for every consumer, and the same key-stability problem still has to be solved.

### Decision 7: The language control lives in the topbar

Next to the existing account and notification controls in `src/components/layout/topbar.tsx`, which is already present on every authenticated screen and is where a per-user setting is looked for.

Rendered as a compact two-value toggle showing the *target* language in its own script ("বাংলা" when English is active), which is legible to someone who cannot currently read the interface — a dropdown labelled "Language" is not.

**Not** placed in Settings → Store Settings: that page holds shop-wide configuration written to the server and shared by all staff, and language here is per-browser. Putting it there would imply the merchant sets one language for everyone.

## Risks / Trade-offs

- **Machine-translated Bangla is wrong in ways developers cannot detect** → Inventory, accounting and logistics vocabulary ("purchase order", "stock movement", "refund", "landed cost") has established Bangladeshi trade usage that general translation misses. The catalogue must be reviewed by someone who works in the domain. This change delivers the mechanism and the navigation strings; it does not certify wording. Budget review time before the deferred phases, not after.
- **Partial translation is visible as mixed language** → The English fallback keeps every screen usable, but a staff member in Bangla will see English on unconverted screens during the phased rollout. Accepted deliberately: the alternative is one unreviewable 71-file diff. Convert by whole screens rather than by scattered strings so the seam falls at screen boundaries.
- **Bangla text is typically longer than English and its script is taller** → Fixed-width buttons, narrow table headers and the collapsed sidebar rail can clip or wrap. Not knowable from the code; check the sidebar, data-table headers and dialog action rows visually in Bangla during phase one, while the change is small.
- **`t()` calls silently return the key if i18n is not initialised** → A component rendered outside the provider shows `nav.catalog.products` to a user rather than failing. Mount i18n at the root in `main.tsx` alongside `ConfigProvider`, above the router, so no authenticated screen can render outside it; add one test asserting a known key resolves.
- **Key drift as the deferred strings land** → Nothing mechanically enforces that `en` and `bn` hold the same keys, so a key added to `en` alone falls back silently and looks like a translation nobody wrote. Type the `bn` catalogue against the shape of `en` so a missing key is a typecheck error, and let the runtime fallback cover only intentionally-untranslated strings.
- **The three npm dependencies were installed before this proposal was written** → They sit in `package.json` ahead of approval. If this proposal is rejected, remove `i18next`, `react-i18next` and `i18next-browser-languagedetector`; nothing imports them yet.

## Migration Plan

No data migration, no backend change, no deployment step. The change is additive to the client bundle.

**Rollback:** revert the change. A staff member who had selected Bangla and whose persisted `ecom-admin-language` value outlives the revert sees English again, because nothing reads that key any more — the stale value is inert, not corrupting.

**Sequencing within this change:** i18n foundation and provider first, then the language store and topbar control, then `nav-config.ts` and `sidebar-nav.tsx` together (the id/key fix in Decision 6 must land with the label change, not after), then the antd locale wiring. Each step leaves the panel working in English.

## Open Questions

- **Should the Bangla catalogue ship complete for the navigation, or ship with the reviewed subset only?** Either satisfies the spec, since untranslated keys fall back to English. This affects only how much of the `bn` catalogue is populated at merge time, not its structure or any task, and is best answered when a reviewer is identified.

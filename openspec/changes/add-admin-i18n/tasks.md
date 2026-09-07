## 1. Foundation

- [ ] 1.1 Confirm `i18next`, `react-i18next` and `i18next-browser-languagedetector` are in `package.json` dependencies (added ahead of this change — verify versions resolve and nothing else was altered)
- [ ] 1.2 Create `src/lib/i18n/locales/en.ts` exporting the English catalogue as a nested object, with a `nav` namespace holding all 51 navigation strings keyed per Decision 2 (`nav.<section>.<item>`)
- [ ] 1.3 Create `src/lib/i18n/locales/bn.ts` with the Bangla catalogue, typed against the shape of `en` so a missing or misspelled key is a typecheck error (Risks — key drift)
- [ ] 1.4 Create `src/lib/i18n/config.ts` initialising i18next with both catalogues bundled (Decision 4), `lng` set explicitly from the persisted store, `fallbackLng: 'en'`, and no `navigator`-based detection order (Decision 3)
- [ ] 1.5 Create `src/lib/i18n/language-store.ts` — a Zustand store with `persist`, key `ecom-admin-language`, holding `'en' | 'bn'` and a setter that also calls `i18n.changeLanguage`; kept separate from `session-store.ts` so the choice survives logout (Decision 3)

## 2. Wire into the app root

- [ ] 2.1 Import the i18n config in `src/main.tsx` so initialisation runs before first paint, and confirm no flash of English for a persisted Bangla choice (spec: no flash of the previous language)
- [ ] 2.2 Pass the matching antd locale (`bn_BD` / `en_US`) to the existing `ConfigProvider` in `src/main.tsx`, driven by the same language store rather than a second setting (spec: components the panel does not author)
- [ ] 2.3 Verify the provider sits above the router so no authenticated screen can render outside it (Risks — `t()` returning raw keys)

## 3. Language control

- [ ] 3.1 Add a two-value language toggle to `src/components/layout/topbar.tsx`, labelled with the target language in its own script ("বাংলা" while English is active) per Decision 7
- [ ] 3.2 Confirm switching applies immediately without a page reload and without navigating away (spec: switching language)
- [ ] 3.3 Confirm switching while a form holds unsaved entries preserves every value and raises no validation (spec: switching while filling a form) — check against a `resource-form-page` screen

## 4. Navigation conversion

- [ ] 4.1 Add a stable non-translated `id` field to each entry in `NAV_SECTIONS` (`src/routes/nav-config.ts`), required before labels change (Decision 6)
- [ ] 4.2 Replace the `label` values in `nav-config.ts` with the `nav.*` translation keys from task 1.2, leaving paths, icons and roles untouched
- [ ] 4.3 In `src/components/layout/sidebar-nav.tsx`, resolve labels through `t()` at render — covering the expanded list, the collapsed rail's tooltips and its dropdown flyout, and `aria-label` on collapsed links
- [ ] 4.4 Move the React `key`, the `expanded` state map key, and the `aria-controls` id construction in `sidebar-nav.tsx` from `section.label` to the new `id`, so expand/collapse state and element ids survive a language change (Decision 6)

## 5. Verification

- [ ] 5.1 Add a test asserting a known key resolves to its English string, so a broken or unmounted provider fails the suite rather than shipping raw keys to users (Risks)
- [ ] 5.2 Add a test asserting a key present in `en` but absent from `bn` renders the English text while Bangla is active (spec: untranslated text falls back to English)
- [ ] 5.3 Add a test asserting the persisted language is restored on remount (spec: returning later)
- [ ] 5.4 Assert in a test that `formatCurrency` and `formatDate` return identical output under both languages (spec: numbers, money and dates are unaffected — guards Decision 5 against a later well-meaning change)
- [ ] 5.5 Run `pnpm lint`, `pnpm build` and `pnpm test`; all must pass

## 6. Visual check in Bangla

- [ ] 6.1 With the panel in Bangla, check the sidebar (expanded and collapsed) for clipping or wrapping from longer Bangla strings and taller glyphs (Risks — text length)
- [ ] 6.2 Check a date picker and an empty table render Bangla text end to end, confirming the antd locale wiring (spec: a date picker in Bangla, an empty table in Bangla)
- [ ] 6.3 Confirm on a list screen showing money that figures remain in Western digits with the merchant's configured symbol and position (spec: a figure in the Bangla interface)

## 7. Hand-off for the deferred phases

- [ ] 7.1 Record the key-naming rule from Decision 2 in the panel's `README.md` or `AGENTS.md`, so the remaining ~280 strings are converted consistently by whoever picks them up
- [ ] 7.2 Note in the change record which screens remain unconverted, so the mixed-language seam during rollout is a known state rather than a bug report
- [ ] 7.3 Resolve design.md's open question (whether `bn` ships complete for navigation or as a reviewed subset) with whoever reviews the Bangla wording, before merge

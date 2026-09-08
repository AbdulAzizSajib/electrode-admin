## Context

See proposal.md — Why.

The UI section already has a settled shape for a settings editor, established by Checkout Setting and reused by Header Links and Footer Links: a page that owns one top-level settings field, holds its edits in `useSettingsDraft`, guards navigation with `useUnsavedChangesGuard`, and renders through `EditorSection` / `EditorRow` / `EditorActions` with `UnsavedChangesDialog`. This change adds a page to that set rather than inventing anything.

The one property worth naming: `PATCH /settings` is a partial upsert, and each editor writes a **disjoint field set**. That is what lets these pages be saved independently without any of them clobbering another, and it is why the new page must write `catalogConfig` alone.

## Goals / Non-Goals

**Goals:**

- A merchant can predict what turning a switch off does before they do it.
- The page cannot erase settings it does not present.
- Zero new patterns — a reader who knows Checkout Setting knows this page.

**Non-Goals:**

- Previewing the storefront under the chosen settings. The storefront reads the flags on its next page load; a live preview here would be a much larger feature.
- Confirming before turning a feature off. These are reversible presentation flags and the backend keeps shoppers' saved wishlist and compare data regardless — a confirmation dialog would imply a destructiveness that is not there.

## Decisions

**A separate page, not a section on Site Setting.**
Site Setting is already long — branding, SEO, contact, social. Adding a fourth concern to it would bury three switches a merchant sets once. A separate page also keeps the disjoint-field-set rule mechanical: this page's save payload is `{ catalogConfig }` and nothing else, which is only obviously true if the page has nothing else on it. Placed directly above Checkout Setting in the UI group, since both answer "what does my storefront offer".

**`useSettingsDraft`, not react-hook-form.**
Three booleans need no resolver, no field registration, and no validation — and the neighbouring editors in this section all use `useSettingsDraft`. It also gives the dirty tracking that `useUnsavedChangesGuard` and `UnsavedChangesDialog` consume, which would otherwise have to be wired up by hand.

**Each switch carries its off-state consequence as body copy, not a tooltip.**
"Quick view" tells a merchant nothing about what happens when it is off, and the answer is not guessable — a product with variants goes to its full product page rather than opening a preview. That is a change in where shoppers land, so it is stated in the row rather than hidden behind a hover a touch user cannot reach. The other two are simpler but get the same treatment for consistency.

**`DEFAULT_CATALOG_CONFIG` is duplicated here, mirroring the backend's.**
`useSettingsDraft(loaded, fallback)` needs a fallback to render before the record arrives, exactly as `DEFAULT_CHECKOUT_CONFIG` already serves that role. It must mirror the backend's defaults (all three enabled), and the risk of the two drifting is noted below.

## Risks / Trade-offs

- **`DEFAULT_CATALOG_CONFIG` here can drift from the backend's** → the page renders it only as a pre-load fallback and the loaded record replaces it, so drift shows as a brief wrong switch position rather than a wrong save. Keeping the two in step is a review concern, the same one `DEFAULT_CHECKOUT_CONFIG` already carries.
- **Shipping this before the server change means saves fail with a validation error** → sequencing is stated in the proposal's Impact; deploy the server change first.
- **A merchant may turn a feature off expecting shoppers' saved data to be cleared** → the opposite is true and deliberate (see the server change's design). Not surfaced in the UI copy, which stays focused on what the storefront shows; the data-retention guarantee is a backend requirement, and stating it here would raise a question most merchants are not asking.

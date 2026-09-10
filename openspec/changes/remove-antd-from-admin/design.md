## Context

See proposal.md — Why. What matters for the approach is the shape of what is left.

The two scaffolds are already near-identical. `ResourceFormPage` (169 lines) and `ResourceFormPageRhf` (188 lines) have the same props apart from how the form is bound, the same save semantics, the same `returnAfterSave` ref trick, the same "deliberately not resetting the form" catch block, and both render through the same `ResourceFormLayout`. Migrating a caller is therefore not a rewrite of the page's behaviour — it is a rewrite of its *field bindings*, with the page's contract unchanged.

The twelve pages divide cleanly by what they ask of the form library:

| Group | Pages | What they use |
|---|---|---|
| Plain fields | `brand` (104), `collection` (84), `font` (101), `category` (200), `brand-bulk-create` (123) | `Input`, `Switch`, `InputNumber`, one `setFieldsValue` |
| Conditional fields | `tax-rule` (109), `bundle-deal` (108) | `shouldUpdate` + `getFieldValue` to make one field's label, bounds or help text follow another |
| Slug + watch | `blog` (269), `page` (207), `testimonial` (247) | `FormInstance` passed to a child, `setFieldValue('slug', …)`, `Form.useWatch` |
| Repeatable lists | `attribute` (254), `landing-page` (634) + `landing-page-lists` (447) | `Form.List` ×7, list-level `rules`, `Form.ErrorList`, nested `shouldUpdate`, `ColorPicker` |

The kit already has everything the first three groups need: `Input`, `Switch`, `Select`, `Combobox`, `MultiSelect`, `RadioGroup`, `Alert`, `ConfirmDialog`, and a `Form` exporting `FormField` / `FormItem` / `FormLabel` / `FormControl` / `FormDescription` / `FormMessage`. `FormDescription` is the direct replacement for antd's `extra`. Only the fourth group needs anything new.

Two constraints shape the rest. `ResourceFormLayout` returns a spinner while `isEdit && isLoading`, so a page's fields never mount before its record arrives — that guard is what makes Radix `Select` safe on an edit page, and it is load-bearing for all twelve. And `openspec/specs/` is empty, so the deltas are `ADDED` against capability paths that only exist inside other unarchived changes.

## Goals / Non-Goals

**Goals:**

- One form scaffold, one validation model, one set of field primitives.
- Each phase leaves `pnpm build` and `pnpm test` green, so the work can stop between phases without leaving the panel half-migrated.
- The two new primitives are general kit additions, not one-page helpers — `number-input` in particular replaces a pattern already copy-pasted four times in `product-form-page.tsx`.
- Removing the dependency is the proof, not the assumption: the build fails if an import survives.

**Non-Goals:**

- Any visual redesign. Where antd and the kit render a field differently, the kit's rendering wins by default; matching antd pixel-for-pixel is not a goal.
- A generic "repeatable list" component. `landing-page-lists.tsx` already argues against one in its own header comment, and this change does not overturn that.
- Behaviour parity with antd's *form engine* — only with each page's observable behaviour.

## Decisions

### Decision 1 — `ResourceFormPageRhf` survives and is renamed to `ResourceFormPage` last

The eleven `ResourceFormPage` callers move to `ResourceFormPageRhf`, the antd scaffold is deleted, and only then is the survivor renamed back to `ResourceFormPage` in one mechanical commit.

Renaming last rather than first keeps every intermediate state buildable and every diff readable: during the migration the two names mean two different things, and a page's diff shows only its own change. The `Rhf` suffix exists solely to disambiguate from the antd scaffold, so leaving it in place after antd is gone would name a distinction that no longer exists.

*Alternative considered:* rename first, and have both scaffolds temporarily share a name via a re-export. Rejected — it makes every intermediate commit ambiguous about which stack a page is on, which is exactly what the migration needs to stay legible.

### Decision 2 — Every page owns its own `useForm` and zod schema; no shared schema factory

`supplier-form-page` is the pattern: a module-level `const schema = z.object({…})`, `type Values = z.infer<typeof schema>`, a `const EMPTY: Values`, a `toValues` mapper, and `useForm({ resolver: zodResolver(schema), defaultValues: EMPTY })`.

*Alternative considered:* a helper that derives a schema from a field descriptor list, to shrink twelve near-identical schema blocks. Rejected — the pages' rules diverge more than they converge (a bound that depends on another field, a cross-row uniqueness rule, a pattern on one key). A factory expressive enough for `attribute` and `landing-page` would take more configuration than the zod schema it replaced.

### Decision 3 — `Form.List` becomes `useFieldArray`; group-level rules become `superRefine`, rendered through a new `FormArrayMessage`

This is the only place where antd gives something the target stack does not have for free. antd's `Form.List` accepts `rules` that validate the *array*, and `Form.ErrorList` renders their messages at the group's position. zod plus react-hook-form has both halves but neither is wired by default:

- The rule goes on the array in the schema — `z.array(row).superRefine((rows, ctx) => ctx.addIssue({ code: 'custom', message: '…', path: [] }))` — which lands the issue on the array path itself.
- react-hook-form surfaces an array-level issue at `errors.<name>.root` (supported since 7.44; the panel is on ^7.86). The existing `FormMessage` reads `useFormField()`'s field-level error and will not see it.

So a small `FormArrayMessage({ name })` is added to `components/ui/form.tsx`, reading `formState.errors` at `<name>.root` and rendering with `FormMessage`'s styling. Without it these rules fail silently — the save is refused and nothing on screen says why, which is the worst available outcome and the single most likely regression in this change.

The rules this covers: `attribute` — "at least one value" and "two values read as the same choice"; `deliveryZones` — "each area needs its own distinct key".

*Alternative considered:* keep group rules as page-level errors routed into the existing banner above the form. Rejected — `specs/admin-shell` requires the message to appear *with the group*, and on the 634-line landing page the banner can be several screens away from the list it refers to.

### Decision 4 — Empty-vs-zero stays a schema concern; `number-input.tsx` extracts only the display half

`specs/admin-shell` → "Numeric fields accept an empty value distinctly from zero" already exists as a requirement from the previous change, and `product-form-page.tsx` already satisfies it — but at the **schema** layer, not the component layer:

```
const optionalNumber = (message = 'Cannot be negative') =>
  z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().min(0, message).optional(),
  )
```

`onChange` is left as react-hook-form's default event handler, so the field value is the raw string the input produced, and `z.preprocess` maps `''` to `undefined` before `z.coerce.number()` can turn it into `0`. What is inlined four times on that page is only the other half — normalising `undefined | null` back to `''` for display:

```
type="number" min={0} step={0.01}
value={field.value === undefined || field.value === null ? '' : String(field.value)}
```

The split is deliberate and is kept. A component that owned `onChange` and emitted `number | undefined` would fight `z.coerce`, would stop working with a bare `register()`, and would put the same rule in two places for the fields whose schema must keep a `preprocess` anyway.

So the work divides:

- `components/ui/number-input.tsx` takes the display normalisation plus `min` / `max` / `step` / `suffix` (`suffix` replacing antd's `addonAfter`, used for the tax rule's `%`). It spreads `field` and overrides `value` only — exactly what the four product-form sites do today.
- `src/lib/validation/numeric.ts` (the directory exists and is empty) exports `optionalNumber(message?)` and `requiredNumber(message?)`, lifted verbatim from `product-form-page.tsx`, so the twelve migrated pages reuse the rule instead of each re-deriving it. `product-form-page.tsx`'s local copy is replaced by the import.

Retrofitting the product form is in scope deliberately: leaving four hand-rolled copies and a private helper next to the primitives that exist to replace them re-creates, inside one stack, the duplication this whole change is about.

*Alternative considered:* have `NumberInput` own `onChange` and emit `number | undefined`, so the schemas need no `preprocess`. Rejected — it contradicts the precedent the previous change set deliberately (and documented in a comment on `optionalNumber`), and `z.coerce.number()` still needs the guard for every field that can be cleared.

### Decision 5 — `color-input.tsx` is `<input type="color">` plus a hex text field, with no new dependency

antd's `ColorPicker showText format="hex"` is a popover with a saturation canvas, an alpha slider and format switching. The attribute editor uses none of that — it needs pick a colour, read the hex, type a hex. A native `<input type="color">` is keyboard-accessible and needs no library; pairing it with a text input covers the third.

The one thing the native control cannot express is *unset*: it has no empty state and reports `#000000` when never touched. `specs/admin-shell` requires an unset colour to save as unset, so the component holds `string | undefined` and only reports a value once the operator commits one — the native input is fed a display fallback while the model value stays `undefined`.

*Alternative considered:* `react-colorful` (~2.8 kB, the usual shadcn pairing). Rejected — adding a dependency inside the change whose purpose is removing one, to serve exactly one field on one page.

### Decision 6 — `shouldUpdate` + `getFieldValue` and `Form.useWatch` both become `useWatch`

antd expresses "re-render this subtree when field X changes" two ways: `Form.Item shouldUpdate` with a comparator, and `Form.useWatch`. Both map onto `useWatch({ control, name })`, which is what `store-settings-page` already does. The five `shouldUpdate` sites and the four `Form.useWatch` sites convert the same way; the comparator function is dropped, since `useWatch` already re-renders only on that field.

One nuance: `landing-page-lists`' media rows use `shouldUpdate` on a *nested* path (`media[i].type`). `useWatch({ control, name: \`media.${index}.type\` })` is the equivalent, read inside the row component rather than at the list level, so a row re-renders without its siblings.

### Decision 7 — The load guard stays exactly as it is

`ResourceFormLayout` blocking on `isEdit && isLoading` is what stops a Radix `Select` from mounting before `reset()` runs and silently clearing it — the panel's documented hazard, now applying to twelve more edit pages. No page in this change may render fields during load, and `ResourceFormPageRhf`'s `form.reset(toValues(record), { keepDefaultValues: true })` effect must keep both its `keepDefaultValues` flag and its `record`-keyed dependency.

### Decision 8 — `category-parent-picker.test.tsx` moves to a plain controlled harness

The picker itself is already shadcn (converted by the previous change); only its test still imports antd, wrapping it in a `Form` purely to supply `value`/`onChange`. A `useState` harness does the same thing with no library at all, and the test's assertions do not change.

### Decision 9 — Deleting the dependency is the final gate

`antd` comes out of `package.json` as the last step of the last phase. `tsc -b` then fails on any surviving import, which is a stronger check than grepping and cannot be satisfied by a stale build. `product-form-page-copy.tsx` is deleted before this, since it would otherwise fail the build for a file nothing routes to.

### Decision 10 — `lib/antd-theme.ts` is deleted, not ported

`buildAntdTheme` carries five values into antd: `colorPrimary: '#155eef'`, `colorError: '#d92d20'`, `colorSuccess: '#067647'`, `colorWarning: '#b54708'`, `borderRadius: 6`, plus the resolved font stack. Every one already exists in `index.css`'s `@theme` block — `--color-primary`, `--color-destructive`, `--color-success`, `--color-warning`, `--radius-md: 0.375rem` — because the file's whole purpose was mirroring them into a system that could not read CSS variables. Nothing is lost by deleting it.

`AdminFontProvider` keeps step 1 of its doc comment (setting `--font-sans` on `<html>`) and loses step 2 (the antd token) along with the `ConfigProvider` wrapper. Its header comment, which explains at length why the panel needs both, is rewritten to describe the one mechanism that remains.

### Decision 11 — Phase order is by risk, not by directory

Five phases, each independently shippable:

1. **Primitives** — `number-input`, `color-input`, `FormArrayMessage`, with tests. Nothing consumes them yet, so nothing can regress.
2. **Plain pages** — the five pages with no conditional or repeating fields. Establishes the migration's shape on the cheapest cases.
3. **Conditional and slug pages** — `tax-rule`, `bundle-deal`, `blog`, `page`, `testimonial`. Exercises Decision 6 five times.
4. **List pages** — `attribute`, then `landing-page-lists` + `landing-page`. Exercises Decision 3, where the risk is.
5. **Teardown** — layout `Alert`, `ConfigProvider`, dead file, scaffold delete and rename, dependency removal, doc corrections.

Phases 2–4 touch no shared file, so within a phase the pages are independent of one another.

## Risks / Trade-offs

**A group-level validation rule stops rendering and the save fails silently** → the highest-consequence failure in the change, because it looks like nothing happened. `FormArrayMessage` is built and tested in phase 1, before any list page is touched, and each of the three group rules gets an explicit test asserting the message appears.

**`landing-page-form-page` is 634 lines with a 447-line list module beside it** → migrated last, when the pattern has been applied eleven times. Its six lists are independent of one another and can be converted and verified one at a time.

**A Radix `Select` on a newly-migrated edit page clears its own `reset`** → Decision 7. The guard already exists; the risk is weakening it. Every migrated edit page gets a reopen-and-verify pass in its phase.

**A validation message's wording drifts during translation from antd `rules` to zod** → the proposal makes "no validation message changes wording" a constraint. The messages are copied as string literals, not rewritten.

**`<input type="color">` reads as less capable than antd's picker** → accepted. The field is used on one page for brand-matched swatches, where typing an exact hex matters more than a saturation canvas. Revisitable independently.

**Retrofitting `product-form-page.tsx` touches a page migrated days ago** → limited to swapping four inline numeric bindings for the primitive with identical semantics, in phase 1, verified against that page's own existing tests.

**The panel briefly runs both stacks** → it already does, and has since `replace-admin-modals-with-pages`. Each phase strictly reduces the count.

## Migration Plan

Phases run in the order above. After each: `pnpm -C admin lint`, `pnpm -C admin test`, `pnpm -C admin build`.

Rollback is per-phase — no phase depends on a later one, and phases 2–4 are page-local. The only irreversible step is phase 5's dependency removal, which is one line in `package.json` and one `pnpm install`.

The change is complete when `antd` appears nowhere in `admin/` outside `openspec/`.

## Open Questions

- Whether `landing-page-lists.tsx` should keep its six separate exported field components or collapse now that `useFieldArray` makes the shared parts cheaper. Deferred: its header comment argues for keeping them separate, that argument is unaffected by the library change, and collapsing them is a refactor that can follow independently without touching any spec.

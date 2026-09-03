/**
 * The rules behind the variant editor, kept apart from its rendering so they
 * can be reasoned about — and tested — without a DOM.
 *
 * This is where the defect that started this change lives or dies: authoring
 * options on an existing product regenerated its variants and silently reset
 * four of them to zero stock, because rows were matched by
 * `optionValueIndexes` and legacy variants had none, so all four keyed to `""`,
 * matched nothing, and were rebuilt from scratch.
 *
 * See `admin/product-attributes` — "An existing combination keeps its details
 * when the selection changes", and design.md Decision 3.
 */

/** One attribute a product sells values of, with the values it sells. */
export interface SelectedAttribute {
  attributeId: string
  name: string
  /** In presentation order. This array is what `optionValueIndexes` indexes into. */
  valueIds: string[]
  /** Label per value id, for naming a combination. */
  labelById: Record<string, string>
}

/** A row in the combination table. */
export interface CombinationRow {
  /** Backend id, when this combination already exists as a variant. */
  id?: string
  /** Stable local key linking pending image uploads to an unsaved row. */
  variantKey: string
  /** The value ids defining it, one per selected attribute, in attribute order. */
  valueIds: string[]
  name: string
  sku: string
  price: number
  compareAtPrice?: number
  stockQuantity: number
}

/** An existing variant, as the form holds it before a selection change. */
export interface ExistingVariant {
  id?: string
  variantKey: string
  name: string
  sku: string
  price: number
  compareAtPrice?: number
  stockQuantity: number
  /** Empty for a legacy variant authored before options existed. */
  valueIds: string[]
}

/**
 * The key an existing row is remembered by: its value ids, **sorted**.
 *
 * Sorted because the set of values is what identifies a combination, not the
 * order they happen to be listed in. The reference panel keys on the joined ids
 * in iteration order and only works by accident of how JS orders integer-like
 * object keys — reorder the attributes and every row stops matching itself. A
 * latent bug worth not copying (design Decision 3).
 */
export const combinationKey = (valueIds: string[]) => [...valueIds].sort().join('|');

/** What a combination reads as — "Red / XL". */
export const combinationName = (
  attributes: SelectedAttribute[],
  valueIds: string[],
): string =>
  valueIds
    .map((valueId, index) => attributes[index]?.labelById[valueId] ?? '')
    .filter(Boolean)
    .join(' / ');

/**
 * Every combination of one selected value per selected attribute.
 *
 * A cartesian product: 2 colours x 3 sizes is 6 rows. Attributes contributing
 * no values are skipped rather than collapsing the product to nothing — an
 * attribute the merchant has ticked but not yet chosen a value on should not
 * wipe the table.
 */
export function combinationsOf(attributes: SelectedAttribute[]): string[][] {
  const usable = attributes.filter((attribute) => attribute.valueIds.length > 0);
  if (usable.length === 0) return [];

  return usable.reduce<string[][]>(
    (acc, attribute) =>
      acc.flatMap((prefix) => attribute.valueIds.map((valueId) => [...prefix, valueId])),
    [[]],
  );
}

export interface RebuildResult {
  rows: CombinationRow[];
  /** Rows that existed and no longer do. Their images are released by the caller. */
  removed: ExistingVariant[];
  /**
   * Existing rows that could not be carried over — neither their value set nor
   * their name matched anything in the new table. Non-empty means the merchant
   * has to be warned before this is applied.
   */
  unmatched: ExistingVariant[];
}

/**
 * Rebuilds the combination table for a new selection, carrying every surviving
 * row over whole.
 *
 * Matching happens in two passes, most reliable first:
 *
 *  1. **By value set.** A row selling exactly these values *is* this
 *     combination, whatever else changed around it.
 *  2. **By name.** A legacy variant has no selection at all, so there is
 *     nothing to match on — but a variant named "Black" is plainly the
 *     combination whose values read as "Black". This is what would have saved
 *     the Q86 product, and it is a migration-era nicety rather than a permanent
 *     rule: after the first authoring every variant has a real selection.
 *
 * A matched row keeps its **database id**, SKU, price, compare-at price and
 * stock — the id being the important part, since it is what makes the backend
 * update the row rather than delete and recreate it, and so what preserves its
 * images and its links from past orders. The reference panel preserves only
 * price and quantity, which is why its variants lose their identity.
 *
 * A genuinely new combination starts at the product's price with **no stock**:
 * stock is never invented for something never counted.
 */
export function rebuildCombinations(
  attributes: SelectedAttribute[],
  existing: ExistingVariant[],
  defaults: { price: number; skuPrefix: string; nextKey: () => string },
): RebuildResult {
  const usable = attributes.filter((attribute) => attribute.valueIds.length > 0);
  const combinations = combinationsOf(usable);

  const byValues = new Map<string, ExistingVariant>();
  const byName = new Map<string, ExistingVariant>();
  for (const variant of existing) {
    if (variant.valueIds.length > 0) {
      byValues.set(combinationKey(variant.valueIds), variant);
    } else if (variant.name.trim()) {
      // Legacy only. Lower-cased so "Black" matches a combination rendering as
      // "black"; a merchant should not lose stock to a capital letter.
      byName.set(variant.name.trim().toLowerCase(), variant);
    }
  }

  const claimed = new Set<ExistingVariant>();

  const rows: CombinationRow[] = combinations.map((valueIds) => {
    const name = combinationName(usable, valueIds);

    const matched =
      byValues.get(combinationKey(valueIds)) ?? byName.get(name.trim().toLowerCase());

    if (matched && !claimed.has(matched)) {
      claimed.add(matched);
      return {
        id: matched.id,
        variantKey: matched.variantKey,
        valueIds,
        // The name follows the combination: letting it drift would put one
        // thing on the storefront and another in the cart.
        name,
        sku: matched.sku,
        price: matched.price,
        compareAtPrice: matched.compareAtPrice,
        stockQuantity: matched.stockQuantity,
      };
    }

    return {
      variantKey: defaults.nextKey(),
      valueIds,
      name,
      sku: [defaults.skuPrefix, slugPart(name)].filter(Boolean).join('-'),
      price: defaults.price,
      stockQuantity: 0,
    };
  });

  const removed = existing.filter((variant) => !claimed.has(variant));

  return {
    rows,
    removed,
    // A removed row that had no selection is one the name pass could not place
    // either — that is the case the merchant has to be warned about, because
    // whatever stock it held has nowhere to go. A removed row that *did* have a
    // selection was deliberately deselected, which needs no warning beyond the
    // ordinary delete guard.
    unmatched: removed.filter((variant) => variant.valueIds.length === 0),
  };
}

/** Lowercase, hyphen-separated — enough to build a readable default SKU. */
function slugPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Whether applying this selection would leave existing rows behind that the
 * merchant should agree to lose first.
 *
 * The case the spec names is adding a whole new attribute to a product that
 * already sells combinations: every existing row describes a product with one
 * fewer axis, so none of them can be carried over unchanged.
 */
export function describeCarryOverLoss(result: RebuildResult): string | null {
  if (result.unmatched.length === 0) return null;

  const withStock = result.unmatched.filter((variant) => variant.stockQuantity > 0);
  const names = result.unmatched.map((variant) => variant.name || variant.sku).join(', ');

  return (
    `${result.unmatched.length} existing combination${result.unmatched.length === 1 ? '' : 's'} ` +
    `cannot be carried over: ${names}.` +
    (withStock.length > 0
      ? ` ${withStock.length === 1 ? 'One of them holds' : `${withStock.length} of them hold`} stock, which will no longer be recorded anywhere.`
      : '')
  );
}

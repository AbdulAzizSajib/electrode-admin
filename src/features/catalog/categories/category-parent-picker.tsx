import * as React from 'react'
import { Combobox } from '@/components/ui/combobox'
import type { Category } from '@/lib/api/categories'

export interface CategoryParentPickerProps {
  /** Full hierarchy from useCategoryTree() — all statuses, unlimited depth, nested via `children`. */
  tree: Category[]
  /**
   * Categories created since `tree` was last fetched, flat rather than nested.
   *
   * A category created from this picker resolves before the tree refetches, and
   * one absent from the tree breaks the component twice over: its level renders
   * without it, and the chain walk cannot place it. Merged into the lookup maps
   * below rather than spliced into the nested tree, which would mean cloning it
   * at every ancestor. Drops out on its own once the refetch lands.
   */
  extraCategories?: Category[]
  /**
   * Offers "create a category" on each level. Called with that level's parent —
   * which is what makes a category created from the third dropdown a child of
   * the second's selection rather than a new top-level one.
   */
  onCreate?: (parentId: string | null) => void
  /**
   * The effective parentId (leaf of the chain), or null for top-level.
   *
   * Injected by whichever form owns the field: react-hook-form's
   * `<FormField render={({ field })}>` hands over exactly this pair, which is
   * all the picker asks of its consumer.
   */
  value?: string | null
  onChange?: (parentId: string | null) => void
  /** Exclude this category and its whole subtree — editing a category can't nest it under itself. */
  excludeId?: string
  /** Names each level's control for a screen reader; the visible label sits on the form item. */
  'aria-label'?: string
}

/**
 * Renders one dropdown per hierarchy level, each populated by the previous level's children —
 * "Computing & IT Hardware" → "Laptops" → "Gaming Laptops" → … — instead of one flat list mixing
 * every depth together. Selecting "None — stop here" at any level truncates everything deeper and
 * makes the previous level's selection the effective parent.
 *
 * A plain controlled control (reads `value`, calls `onChange`) — the enclosing form owns and resets
 * `parentId`, so this component only needs to derive its per-level chain from `value`, not track its
 * own copy of it. That contract is what lets one implementation serve both form libraries.
 */
export function CategoryParentPicker({
  tree,
  extraCategories,
  onCreate,
  value = null,
  onChange,
  excludeId,
  'aria-label': ariaLabel = 'Parent category',
}: CategoryParentPickerProps) {
  // Flatten once for id-based lookups (parent walks, children-of-id, excluded subtree).
  const flat = React.useMemo(() => {
    const out: Category[] = []
    const walk = (nodes: Category[]) => {
      for (const node of nodes) {
        out.push(node)
        if (node.children?.length) walk(node.children)
      }
    }
    walk(tree)
    // Only the ones the refetch has not caught up with yet — a duplicate would
    // otherwise show the same category twice on its level.
    const known = new Set(out.map((category) => category.id))
    for (const extra of extraCategories ?? []) {
      if (!known.has(extra.id)) out.push(extra)
    }
    return out
  }, [tree, extraCategories])

  const byId = React.useMemo(() => new Map(flat.map((c) => [c.id, c])), [flat])

  // Ids to hide from every level: the category being edited, plus its entire subtree (it can't
  // become its own descendant).
  const excludedIds = React.useMemo(() => {
    if (!excludeId) return new Set<string>()
    const excluded = new Set<string>([excludeId])
    let frontier = [excludeId]
    while (frontier.length) {
      const next: string[] = []
      for (const id of frontier) {
        for (const child of flat) {
          if (child.parentId === id && !excluded.has(child.id)) {
            excluded.add(child.id)
            next.push(child.id)
          }
        }
      }
      frontier = next
    }
    return excluded
  }, [excludeId, flat])

  const childrenOf = React.useCallback(
    (parentId: string | null): Category[] => {
      const source = parentId === null ? tree : (byId.get(parentId)?.children ?? [])
      // A just-created category is not yet in the tree's `children` arrays, so
      // its level is assembled from both sources.
      const seen = new Set(source.map((c) => c.id))
      const extras = (extraCategories ?? []).filter(
        (c) => !seen.has(c.id) && (c.parentId ?? null) === parentId,
      )
      return [...source, ...extras]
        .filter((c) => !excludedIds.has(c.id))
        .sort((a, b) => a.sortOrder - b.sortOrder)
    },
    [tree, byId, excludedIds, extraCategories],
  )

  // Derive the ancestor chain straight from `value` by walking up via parentId to the root — no
  // local state to keep in sync, so re-renders (including the form resetting `value` when a
  // record loads) are reflected automatically.
  const chain = React.useMemo(() => {
    if (!value || !byId.has(value)) return []
    const path: string[] = []
    let current: string | null = value
    const visited = new Set<string>()
    while (current && !visited.has(current)) {
      visited.add(current)
      path.unshift(current)
      current = byId.get(current)?.parentId ?? null
    }
    return path
  }, [value, byId])

  const handleSelect = (levelIndex: number, categoryId: string | null) => {
    const nextChain = categoryId === null ? chain.slice(0, levelIndex) : [...chain.slice(0, levelIndex), categoryId]
    onChange?.(nextChain.length > 0 ? nextChain[nextChain.length - 1] : null)
  }

  // One dropdown per level already selected, plus one trailing dropdown to go one level deeper.
  const levels = [...chain, null].map((_, i) => i)

  return (
    <div className="flex flex-col gap-2">
      {levels.map((levelIndex) => {
        const parentId = levelIndex === 0 ? null : chain[levelIndex - 1]
        const options = childrenOf(parentId)
        // No children under the last pick — nothing more to choose. Unless the
        // caller offers to create one: then this level is the only place a
        // subcategory of a leaf can be added, and hiding it would leave that
        // unreachable.
        if (levelIndex > 0 && options.length === 0 && !onCreate) return null

        const stopLabel = levelIndex === 0 ? 'No parent (top-level)' : 'None — stop here'
        const parentName = parentId ? byId.get(parentId)?.name : undefined

        return (
          <div key={levelIndex} className="flex flex-col gap-1">
            {levelIndex > 0 && <span className="text-xs text-muted-foreground">Subcategory of {parentName}</span>}
            <Combobox
              // "none" is a real option rather than an empty value: choosing it is how a merchant
              // truncates the chain, which is different from having chosen nothing yet.
              value={chain[levelIndex] ?? 'none'}
              onValueChange={(v) => handleSelect(levelIndex, v === null || v === 'none' ? null : v)}
              options={[
                { value: 'none', label: stopLabel },
                ...options.map((c) => ({ value: c.id, label: c.name })),
              ]}
              aria-label={levelIndex === 0 ? ariaLabel : `Subcategory of ${parentName}`}
              searchPlaceholder="Search categories"
              createAction={
                onCreate
                  ? {
                      label:
                        levelIndex === 0 ? 'Add category' : `Add subcategory of ${parentName}`,
                      onSelect: () => onCreate(parentId ?? null),
                    }
                  : undefined
              }
            />
          </div>
        )
      })}
    </div>
  )
}

import * as React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Category } from '@/lib/api/categories'

export interface CategoryFilterProps {
  /** Full hierarchy from useCategoryTree() — all statuses, unlimited depth, nested via `children`. */
  tree: Category[]
  /** Currently filtered category id, or null for "All categories". */
  value: string | null
  onChange: (categoryId: string | null) => void
}

/**
 * Toolbar filter that drills into the category hierarchy one level at a time — picking
 * "Power & Emergency Gadgets" reveals a second dropdown of its children, and so on — instead of
 * one flat list mixing every depth together. The deepest selected level is the effective filter.
 *
 * Same cascade model as the parent picker in the category form, but shaped for a filter bar:
 * inline rather than stacked, "All categories" as the reset at level 0, and no self-exclusion
 * (nothing is being edited here).
 */
export function CategoryFilter({ tree, value, onChange }: CategoryFilterProps) {
  const flat = React.useMemo(() => {
    const out: Category[] = []
    const walk = (nodes: Category[]) => {
      for (const node of nodes) {
        out.push(node)
        if (node.children?.length) walk(node.children)
      }
    }
    walk(tree)
    return out
  }, [tree])

  const byId = React.useMemo(() => new Map(flat.map((c) => [c.id, c])), [flat])

  const childrenOf = React.useCallback(
    (parentId: string | null): Category[] => {
      const source = parentId === null ? tree : (byId.get(parentId)?.children ?? [])
      return [...source].sort((a, b) => a.sortOrder - b.sortOrder)
    },
    [tree, byId],
  )

  // Derive the ancestor chain straight from `value` by walking up via parentId to the root, so the
  // dropdowns rebuild themselves from a single source of truth — including when the filter is
  // cleared or set from outside.
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
    onChange(nextChain.length > 0 ? nextChain[nextChain.length - 1] : null)
  }

  // One dropdown per level already selected, plus one trailing dropdown to go a level deeper.
  const levels = [...chain, null].map((_, i) => i)

  return (
    <>
      {levels.map((levelIndex) => {
        const parentId = levelIndex === 0 ? null : chain[levelIndex - 1]
        const options = childrenOf(parentId)
        if (levelIndex > 0 && options.length === 0) return null // leaf reached — nothing deeper to pick

        const resetLabel = levelIndex === 0 ? 'All categories' : `All of ${byId.get(parentId!)?.name ?? '—'}`

        return (
          <Select
            key={levelIndex}
            value={chain[levelIndex] ?? 'all'}
            onValueChange={(v) => handleSelect(levelIndex, v === 'all' ? null : v)}
          >
            <SelectTrigger className="h-8 w-auto min-w-36 max-w-56">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{resetLabel}</SelectItem>
              {options.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      })}
    </>
  )
}

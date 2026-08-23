import * as React from 'react'
import { Select } from 'antd'
import type { Category } from '@/lib/api/categories'

export interface CategoryParentPickerProps {
  /** Full hierarchy from useCategoryTree() — all statuses, unlimited depth, nested via `children`. */
  tree: Category[]
  /** Injected by antd's <Form.Item name="parentId">: the effective parentId (leaf of the chain), or null for top-level. */
  value?: string | null
  onChange?: (parentId: string | null) => void
  /** Exclude this category and its whole subtree — editing a category can't nest it under itself. */
  excludeId?: string
}

/**
 * Renders one dropdown per hierarchy level, each populated by the previous level's children —
 * "Computing & IT Hardware" → "Laptops" → "Gaming Laptops" → … — instead of one flat list mixing
 * every depth together. Selecting "None — stop here" at any level truncates everything deeper and
 * makes the previous level's selection the effective parent.
 *
 * A standard antd `Form.Item`-compatible control (reads `value`, calls `onChange`) — the enclosing
 * `<Form>` owns and resets `parentId`, so this component only needs to derive its per-level chain
 * from `value`, not track its own copy of it.
 */
export function CategoryParentPicker({ tree, value = null, onChange, excludeId }: CategoryParentPickerProps) {
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
    return out
  }, [tree])

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
      return source.filter((c) => !excludedIds.has(c.id)).sort((a, b) => a.sortOrder - b.sortOrder)
    },
    [tree, byId, excludedIds],
  )

  // Derive the ancestor chain straight from `value` by walking up via parentId to the root — no
  // local state to keep in sync, so re-renders (including antd resetting `value` on form reset)
  // are reflected automatically.
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
        if (levelIndex > 0 && options.length === 0) return null // no children under the last pick — nothing more to choose

        const stopLabel = levelIndex === 0 ? 'No parent (top-level)' : 'None — stop here'
        const parentName = parentId ? byId.get(parentId)?.name : undefined

        return (
          <div key={levelIndex} className="flex flex-col gap-1">
            {levelIndex > 0 && <span className="text-xs text-muted-foreground">Subcategory of {parentName}</span>}
            <Select
              value={chain[levelIndex] ?? 'none'}
              onChange={(v: string) => handleSelect(levelIndex, v === 'none' ? null : v)}
              options={[{ value: 'none', label: stopLabel }, ...options.map((c) => ({ value: c.id, label: c.name }))]}
            />
          </div>
        )
      })}
    </div>
  )
}

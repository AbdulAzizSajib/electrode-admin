import * as React from 'react'
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'
import type { Category } from '@/lib/api/categories'

export interface CategoryTreeNodeProps {
  category: Category
  /** 0 for top-level roots; each level indents further. */
  depth: number
  onEdit: (category: Category) => void
  onAddChild: (parent: Category) => void
  onDelete: (category: Category) => void
}

/** Recursive row for the category tree view — renders itself, then its `children` one level deeper. */
export function CategoryTreeNode({ category, depth, onEdit, onAddChild, onDelete }: CategoryTreeNodeProps) {
  const children = category.children ?? []
  const hasChildren = children.length > 0
  // Auto-expand the first two levels so the hierarchy is visible on load; deeper levels start collapsed.
  const [expanded, setExpanded] = React.useState(depth < 2)

  return (
    <div>
      <div
        className="group flex items-center gap-1.5 rounded-md py-1.5 pr-2 hover:bg-muted/50 focus-within:bg-muted/50"
        // Proportional to depth, so it cannot be a fixed class; `--spacing`
        // keeps it on the panel's compact scale.
        style={{ paddingInlineStart: `calc(var(--spacing) * 5 * ${depth})` }}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted',
            !hasChildren && 'invisible',
          )}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${category.name}`}
          aria-expanded={hasChildren ? expanded : undefined}
          tabIndex={hasChildren ? undefined : -1}
        >
          {hasChildren && (expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />)}
        </button>

        {/*
         * Name and slug share one min-width-0 box so the name takes the space it
         * needs and the slug gives way. As bare flex siblings both carried
         * `truncate` with no basis, and a long name shrank the slug to an
         * ellipsis while leaving its own room untouched.
         */}
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-sm font-medium text-foreground">{category.name}</span>
          <span className="truncate text-xs text-muted-foreground">{category.slug}</span>
        </span>
        <Badge variant={category.status ? 'success' : 'secondary'} className="ml-1 shrink-0">
          {category.status ? 'Active' : 'Inactive'}
        </Badge>
        {hasChildren && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {children.length} {children.length === 1 ? 'subcategory' : 'subcategories'}
          </span>
        )}

        {/*
         * Revealed on hover *and* on keyboard focus. `opacity-0` alone hid these
         * from anyone tabbing through the tree: the button took focus, the focus
         * ring was painted at zero opacity, and the only way to reach edit or
         * delete was with a mouse. `focus-within` on the row plus `focus:` on
         * each button means tabbing in shows the group and marks the one you are
         * on.
         *
         * Names are `aria-label`, not `title`: a tooltip that only appears after
         * a hover delay is not an accessible name, and these buttons have no
         * text of their own.
         */}
        <div className="ml-auto flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={`Add a subcategory under ${category.name}`}
            onClick={() => onAddChild(category)}
          >
            <Plus className="size-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={`Edit ${category.name}`}
            onClick={() => onEdit(category)}
          >
            <Pencil className="size-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-destructive hover:text-destructive"
            aria-label={`Delete ${category.name}`}
            onClick={() => onDelete(category)}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {hasChildren && expanded && (
        <div>
          {children.map((child) => (
            <CategoryTreeNode
              key={child.id}
              category={child}
              depth={depth + 1}
              onEdit={onEdit}
              onAddChild={onAddChild}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

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
        className="group flex items-center gap-1.5 rounded-md py-1.5 pr-2 hover:bg-muted/50"
        style={{ paddingLeft: `${depth * 20}px` }}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted',
            !hasChildren && 'invisible',
          )}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {hasChildren && (expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />)}
        </button>

        <span className="truncate text-sm font-medium text-foreground">{category.name}</span>
        <span className="truncate text-xs text-muted-foreground">{category.slug}</span>
        <Badge variant={category.status ? 'success' : 'secondary'} className="ml-1 shrink-0">
          {category.status ? 'Active' : 'Inactive'}
        </Badge>
        {hasChildren && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {children.length} {children.length === 1 ? 'subcategory' : 'subcategories'}
          </span>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100">
          <Button variant="ghost" size="icon" className="size-7" title="Add subcategory" onClick={() => onAddChild(category)}>
            <Plus className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7" title="Edit" onClick={() => onEdit(category)}>
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-destructive hover:text-destructive"
            title="Delete"
            onClick={() => onDelete(category)}
          >
            <Trash2 className="size-3.5" />
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

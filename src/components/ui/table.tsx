import * as React from 'react'
import { cn } from '@/lib/utils/cn'

export const Table = React.forwardRef<HTMLTableElement, React.ComponentProps<'table'>>(
  ({ className, ...props }, ref) => (
    <div className="w-full overflow-auto">
      <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  ),
)
Table.displayName = 'Table'

export const TableHeader = React.forwardRef<HTMLTableSectionElement, React.ComponentProps<'thead'>>(
  ({ className, ...props }, ref) => (
    <thead ref={ref} className={cn('bg-muted/60 [&_tr]:border-b [&_tr]:border-border', className)} {...props} />
  ),
)
TableHeader.displayName = 'TableHeader'

export const TableBody = React.forwardRef<HTMLTableSectionElement, React.ComponentProps<'tbody'>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
  ),
)
TableBody.displayName = 'TableBody'

export const TableFooter = React.forwardRef<HTMLTableSectionElement, React.ComponentProps<'tfoot'>>(
  ({ className, ...props }, ref) => (
    <tfoot ref={ref} className={cn('border-t border-border bg-muted/60 font-medium', className)} {...props} />
  ),
)
TableFooter.displayName = 'TableFooter'

export const TableRow = React.forwardRef<HTMLTableRowElement, React.ComponentProps<'tr'>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn('border-b border-border transition-colors hover:bg-muted/50', className)}
      {...props}
    />
  ),
)
TableRow.displayName = 'TableRow'

export const TableHead = React.forwardRef<HTMLTableCellElement, React.ComponentProps<'th'>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        'h-8 whitespace-nowrap px-3 text-left align-middle text-xs font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0',
        className,
      )}
      {...props}
    />
  ),
)
TableHead.displayName = 'TableHead'

export const TableCell = React.forwardRef<HTMLTableCellElement, React.ComponentProps<'td'>>(
  ({ className, ...props }, ref) => (
    <td
      ref={ref}
      className={cn('px-3 py-2 align-middle [&:has([role=checkbox])]:pr-0', className)}
      {...props}
    />
  ),
)
TableCell.displayName = 'TableCell'

export const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.ComponentProps<'caption'>>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn('mt-3 text-xs text-muted-foreground', className)} {...props} />
  ),
)
TableCaption.displayName = 'TableCaption'

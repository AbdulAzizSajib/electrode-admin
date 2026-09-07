import * as React from 'react'
import { NavLink, useLocation } from 'react-router'
import { ChevronDown } from 'lucide-react'
import { NAV_SECTIONS, isNavNodeVisible } from '@/routes/nav-config'
import { useSessionStore } from '@/lib/store/session-store'
import { cn } from '@/lib/utils/cn'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { usePulseValue } from '@/lib/realtime/use-realtime'

/** The one nav item that carries a live count — orders still waiting on staff action. */
const PENDING_BADGE_PATH = '/sales/orders'

export interface SidebarNavProps {
  collapsed?: boolean
  onNavigate?: () => void
}

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar'

function navTriggerClass(active: boolean, collapsed: boolean) {
  return cn(
    'flex items-center gap-2.5 rounded-md py-1.5 text-base font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-active hover:text-white',
    focusRing,
    collapsed ? 'justify-center px-0' : 'px-2.5',
    active && 'bg-sidebar-active text-white',
  )
}

export function SidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
  const role = useSessionStore((s) => s.user?.role ?? 'STAFF')
  const { pathname } = useLocation()
  const baseId = React.useId()

  // Reads the shell's poll rather than starting one; renders nothing until the first pulse.
  const pendingOrders = usePulseValue()?.pendingOrderCount ?? 0

  const [expanded, setExpanded] = React.useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const section of NAV_SECTIONS) {
      if (section.items?.some((i) => pathname.startsWith(i.path))) initial[section.label] = true
    }
    return initial
  })

  return (
    <nav className="flex flex-col gap-2 px-2 py-2">
      {NAV_SECTIONS.filter((section) => isNavNodeVisible(section.roles, role)).map((section) => {
        const Icon = section.icon

        // Direct link (no children), e.g. Dashboard, Notifications.
        if (section.path) {
          const active = pathname === section.path || pathname.startsWith(section.path + '/')
          const link = (
            <NavLink
              to={section.path}
              onClick={onNavigate}
              aria-label={collapsed ? section.label : undefined}
              className={navTriggerClass(active, collapsed)}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && <span>{section.label}</span>}
            </NavLink>
          )
          if (!collapsed) return <React.Fragment key={section.label}>{link}</React.Fragment>
          return (
            <Tooltip key={section.label}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{section.label}</TooltipContent>
            </Tooltip>
          )
        }

        const items = (section.items ?? []).filter((i) => isNavNodeVisible(i.roles, role))
        if (items.length === 0) return null
        const sectionActive = items.some((i) => pathname.startsWith(i.path))
        const listId = `${baseId}-${section.label}`

        // Collapsed rail: inline disclosure has nowhere to render, so children
        // surface in a flyout instead of being stranded behind a dead click.
        if (collapsed) {
          return (
            <DropdownMenu key={section.label}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button type="button" aria-label={section.label} className={navTriggerClass(sectionActive, true)}>
                      <Icon className="size-4 shrink-0" />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="right">{section.label}</TooltipContent>
              </Tooltip>
              <DropdownMenuContent side="right" align="start" sideOffset={10}>
                <DropdownMenuLabel>{section.label}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {items.map((item) => {
                  const active = pathname.startsWith(item.path)
                  const ItemIcon = item.icon
                  return (
                    <DropdownMenuItem
                      key={item.path}
                      asChild
                      className={cn(active && 'bg-muted font-medium text-primary')}
                    >
                      <NavLink to={item.path} onClick={onNavigate} className="gap-2">
                        <ItemIcon className="size-4 shrink-0" />
                        {item.label}
                      </NavLink>
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }

        const isOpen = expanded[section.label] ?? sectionActive

        return (
          <div key={section.label}>
            <button
              type="button"
              onClick={() => setExpanded((prev) => ({ ...prev, [section.label]: !isOpen }))}
              aria-expanded={isOpen}
              aria-controls={listId}
              className={cn(navTriggerClass(false, false), 'w-full', sectionActive && 'text-white')}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1 text-left">{section.label}</span>
              <ChevronDown className={cn('size-3.5 transition-transform', isOpen && 'rotate-180')} />
            </button>
            {isOpen && (
              <div id={listId} className="ml-4 flex flex-col gap-0.5 border-l border-sidebar-border pl-3 pt-0.5">
                {items.map((item) => {
                  const active = pathname.startsWith(item.path)
                  const ItemIcon = item.icon
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={onNavigate}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-base text-sidebar-foreground transition-colors hover:bg-sidebar-active hover:text-white',
                        focusRing,
                        active && 'bg-sidebar-active font-medium text-white',
                      )}
                    >
                      <ItemIcon className="size-4 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {item.path === PENDING_BADGE_PATH && pendingOrders > 0 && (
                        <Badge
                          variant="destructive"
                          className="h-4 min-w-4 justify-center rounded-full p-0 px-1 text-[11px]"
                        >
                          {pendingOrders > 99 ? '99+' : pendingOrders}
                        </Badge>
                      )}
                    </NavLink>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}

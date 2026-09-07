import { Link, useNavigate } from 'react-router'
import { Bell, LogOut, Menu, Search, Settings, User as UserIcon, PanelLeft, Volume2, VolumeX } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { RequireRole } from '@/routes/guards'
import { useSessionStore } from '@/lib/store/session-store'
import { useUiStore } from '@/lib/store/ui-store'
import { useUnreadNotificationCount } from '@/lib/api/notifications'
import { usePulseValue } from '@/lib/realtime/use-realtime'
import { initials } from '@/lib/utils/format'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface TopbarProps {
  /** Owned by `ShellLayout` so the toggle and the alert hook can't disagree about the setting. */
  soundMuted: boolean
  onToggleSound: () => void
}

export function Topbar({ soundMuted, onToggleSound }: TopbarProps) {
  const navigate = useNavigate()
  const user = useSessionStore((s) => s.user)
  const logout = useSessionStore((s) => s.logout)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen)
  const { data: fetchedUnreadCount = 0 } = useUnreadNotificationCount()

  /*
   * The live pulse is authoritative once it has arrived: it refreshes on the shared interval,
   * while `useUnreadNotificationCount` only refetches when something invalidates it. Falling
   * back to the fetched count keeps the badge correct on first paint, before the first pulse.
   */
  const pulse = usePulseValue()
  const unreadCount = pulse?.unreadNotificationCount ?? fetchedUnreadCount

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setMobileNavOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="hidden lg:inline-flex"
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
      >
        <PanelLeft className="size-5!"  />
      </Button>

      <Breadcrumbs />

      <div className="ml-auto flex items-center gap-2">
        <div className="relative hidden sm:block">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search…" className="h-8 w-56 pl-7" />
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleSound}
              aria-pressed={soundMuted}
              aria-label={soundMuted ? 'Unmute new-order sound' : 'Mute new-order sound'}
            >
              {soundMuted ? (
                <VolumeX className="size-4 text-muted-foreground" />
              ) : (
                <Volume2 className="size-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{soundMuted ? 'New-order sound off' : 'New-order sound on'}</TooltipContent>
        </Tooltip>

        <Button variant="ghost" size="icon" className="relative" asChild>
          <Link to="/notifications" aria-label="Notifications">
            <Bell className="size-4" />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -right-0.5 -top-0.5 h-4 min-w-4 justify-center rounded-full p-0 text-[11px]"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted">
              <Avatar className="size-7">
                <AvatarFallback>{user ? initials(user.name) : 'AD'}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
              <span className="text-sm font-medium text-foreground">{user?.name}</span>
              <span className="text-xs text-muted-foreground">{user?.email}</span>
              <Badge variant="outline" className="mt-1 w-fit">
                {user?.role}
              </Badge>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings/store">
                <UserIcon /> Account
              </Link>
            </DropdownMenuItem>
            {/* Only OWNER/ADMIN can manage store settings — UI-level hide, the backend re-checks role on the route itself. */}
            <RequireRole roles={['OWNER', 'ADMIN']}>
              <DropdownMenuItem asChild>
                <Link to="/settings/store">
                  <Settings /> Store Settings
                </Link>
              </DropdownMenuItem>
            </RequireRole>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleLogout}>
              <LogOut /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

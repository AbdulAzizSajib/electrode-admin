import { Outlet } from 'react-router'

export function AuthLayout() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted px-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center justify-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            E
          </div>
          <span className="text-base font-semibold text-foreground">Ecom Admin</span>
        </div>
        <Outlet />
      </div>
    </div>
  )
}

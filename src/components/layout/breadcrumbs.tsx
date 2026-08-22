import { Fragment } from 'react'
import { Link, useLocation } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { NAV_SECTIONS } from '@/routes/nav-config'
import { useBreadcrumbContext } from '@/components/layout/breadcrumb-context'
import { cn } from '@/lib/utils/cn'

function humanize(segment: string) {
  if (/^[a-f0-9-]{8,}$/i.test(segment)) return null // looks like an id, skip humanized fallback
  return segment
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function Breadcrumbs() {
  const { pathname } = useLocation()
  const { label: overrideLabel } = useBreadcrumbContext()

  const section = NAV_SECTIONS.find(
    (s) => s.path === pathname || s.items?.some((i) => pathname.startsWith(i.path)),
  )
  const item = section?.items?.find((i) => pathname.startsWith(i.path))

  const crumbs: { label: string; to?: string }[] = []
  if (section) {
    crumbs.push({ label: section.label, to: item ? undefined : section.path })
  }
  if (item) {
    crumbs.push({ label: item.label, to: item.path })
  }

  const basePath = item?.path ?? section?.path ?? ''
  const rest = pathname.slice(basePath.length).split('/').filter(Boolean)
  rest.forEach((segment, index) => {
    const isLast = index === rest.length - 1
    const label = (isLast && overrideLabel) || humanize(segment)
    if (label) crumbs.push({ label })
  })

  if (crumbs.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1
        return (
          <Fragment key={`${crumb.label}-${index}`}>
            {index > 0 && <ChevronRight className="size-3 shrink-0" />}
            {crumb.to && !isLast ? (
              <Link to={crumb.to} className="hover:text-foreground hover:underline">
                {crumb.label}
              </Link>
            ) : (
              <span className={cn(isLast && ' text-foreground text-sm font-light')}>
                {crumb.label}
                </span>
            )}
          </Fragment>
        )
      })}
    </nav>
  )
}

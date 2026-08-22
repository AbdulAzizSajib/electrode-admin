import * as React from 'react'

interface BreadcrumbContextValue {
  label: string | null
  setLabel: (label: string | null) => void
}

const BreadcrumbContext = React.createContext<BreadcrumbContextValue | null>(null)

export function BreadcrumbLabelProvider({ children }: { children: React.ReactNode }) {
  const [label, setLabel] = React.useState<string | null>(null)
  const value = React.useMemo(() => ({ label, setLabel }), [label])
  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>
}

/** Lets a page override the humanized last breadcrumb segment (e.g. a loaded record's name). */
export function useBreadcrumbLabel(label?: string | null) {
  const ctx = React.useContext(BreadcrumbContext)
  React.useEffect(() => {
    if (!ctx || !label) return
    ctx.setLabel(label)
    return () => ctx.setLabel(null)
  }, [ctx, label])
}

export function useBreadcrumbContext() {
  const ctx = React.useContext(BreadcrumbContext)
  if (!ctx) throw new Error('useBreadcrumbContext must be used within BreadcrumbLabelProvider')
  return ctx
}

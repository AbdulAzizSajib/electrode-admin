/**
 * Shared frame for the fulfilment documents.
 *
 * Renders a document on a preview page with a size toggle and a print button,
 * and nothing else. Mounted OUTSIDE ShellLayout (see app-router.tsx), which is
 * what keeps the sidebar and topbar off the paper — hiding them with
 * `@media print` from inside the shell leaves every ancestor's layout
 * participating in the printed output. See design.md Decision 3.
 *
 * The toolbar carries `no-print` so it disappears at print time.
 */
import * as React from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, Printer } from 'lucide-react'
import './print.css'

/** Which paper a document is laid out for. */
export type PaperSize = 'thermal' | 'a4'

/** The documents this frame serves. Also the localStorage key suffix. */
export type DocumentKind = 'packing-slip' | 'invoice' | 'shipping-label'

const STORAGE_PREFIX = 'order-doc-paper-size'

/**
 * Per-document defaults.
 *
 * The packing slip and label are working documents produced at the packing
 * bench, where the thermal printer is. The invoice goes in the box for the
 * customer, and A4 is what that should look like.
 */
const DEFAULT_SIZE: Record<DocumentKind, PaperSize> = {
  'packing-slip': 'thermal',
  invoice: 'a4',
  'shipping-label': 'thermal',
}

/**
 * Remembers the size choice per document type, on this machine.
 *
 * localStorage rather than store settings, deliberately: paper size is a
 * property of the printer in front of this operator, not of the business. A
 * merchant with a thermal unit at the bench and an A4 printer in the office
 * needs both to remember their own answer. See design.md Decision 4.
 */
function usePaperSize(kind: DocumentKind) {
  const key = `${STORAGE_PREFIX}:${kind}`

  const [size, setSize] = React.useState<PaperSize>(() => {
    try {
      const stored = localStorage.getItem(key)
      if (stored === 'thermal' || stored === 'a4') return stored
    } catch {
      // Private mode or a disabled store — fall through to the default. A
      // document that prints at the default size is fine; one that throws on
      // mount is not.
    }
    return DEFAULT_SIZE[kind]
  })

  const choose = React.useCallback(
    (next: PaperSize) => {
      setSize(next)
      try {
        localStorage.setItem(key, next)
      } catch {
        // Non-fatal: the choice applies to this render either way.
      }
    },
    [key],
  )

  return [size, choose] as const
}

interface PrintFrameProps {
  kind: DocumentKind
  /** Shown in the toolbar and used as the document title while printing. */
  title: string
  /** Where the back button returns to. */
  backTo: string
  children: (size: PaperSize) => React.ReactNode
}

export function PrintFrame({ kind, title, backTo, children }: PrintFrameProps) {
  const navigate = useNavigate()
  const [size, setSize] = usePaperSize(kind)

  /*
   * The document title becomes the default filename when printing to PDF and
   * the header some browsers stamp on the page. Restored on unmount so the
   * admin's own title is not left rewritten.
   */
  React.useEffect(() => {
    const previous = document.title
    document.title = title
    return () => {
      document.title = previous
    }
  }, [title])

  /*
   * The page-size rule is set on <body> rather than the document element: an
   * `@page` name has to be selected by the printed page's own box, and the
   * body is the outermost one this route controls.
   */
  React.useEffect(() => {
    const className = size === 'thermal' ? 'print-page-thermal' : 'print-page-a4'
    document.body.classList.add(className)
    return () => {
      document.body.classList.remove(className)
    }
  }, [size])

  return (
    <div className="print-preview">
      <div className="no-print flex w-full max-w-[210mm] items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate(backTo)}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
          Back to order
        </button>

        <div className="flex items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-md border border-border">
            {(['thermal', 'a4'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSize(option)}
                aria-pressed={size === option}
                className={
                  size === option
                    ? 'bg-primary px-3 py-2 text-sm text-primary-foreground'
                    : 'px-3 py-2 text-sm hover:bg-muted'
                }
              >
                {option === 'thermal' ? '80mm thermal' : 'A4'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90"
          >
            <Printer className="size-4" />
            Print
          </button>
        </div>
      </div>

      <div className="print-doc" data-size={size}>
        {children(size)}
      </div>
    </div>
  )
}

import * as React from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'

/**
 * The Export CSV button every report carries.
 *
 * Exports the whole filtered result, not the visible page — the server streams
 * every matching row, so this deliberately sends no page/limit.
 *
 * A failure must leave the on-screen report untouched and say so
 * (`admin-reporting/report-shell`): no file is written, the table is not
 * reloaded, and the backend's own message is surfaced rather than a generic one.
 */
export function ExportButton({ onExport }: { onExport: () => Promise<void> }) {
  const [isExporting, setIsExporting] = React.useState(false)

  const handleClick = async () => {
    setIsExporting(true)
    try {
      await onExport()
    } catch (error) {
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'The export could not be produced.',
        variant: 'destructive',
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={handleClick} disabled={isExporting}>
      {isExporting ? <Loader2 className="animate-spin" /> : <Download />}
      {isExporting ? 'Exporting…' : 'Export CSV'}
    </Button>
  )
}

import * as React from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface ReassignOption {
  value: string
  label: string
}

export interface ReassignDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /**
   * The server's own refusal message. Shown verbatim because it is the only
   * thing that knows how many records are affected, and a merchant deciding
   * whether to go ahead needs that number rather than "some".
   */
  reason: string
  /**
   * `reassign` — the records must keep one of these, so a replacement is
   * required before the delete can proceed. `confirm` — they may go without,
   * so only an acknowledgement is needed.
   */
  mode: 'reassign' | 'confirm'
  reassignLabel: string
  options: ReassignOption[]
  loading?: boolean
  /** Receives the chosen replacement id in `reassign` mode, nothing in `confirm`. */
  onConfirm: (reassignToId?: string) => void
}

/**
 * The second step of a delete the server refused.
 *
 * Both flows exist because both refusals are real: a product must always have a
 * tax rule, so deleting one means choosing where its products go; a product
 * need not have a bundle deal, so deleting one only means agreeing that its
 * products lose the offer. Presenting either as a plain "are you sure" would
 * hide a decision the merchant is the only one able to make.
 */
export function ReassignDeleteDialog({
  open,
  onOpenChange,
  title,
  reason,
  mode,
  reassignLabel,
  options,
  loading = false,
  onConfirm,
}: ReassignDeleteDialogProps) {
  const [replacementId, setReplacementId] = React.useState<string>('')

  // A fresh dialog for a different record must not inherit the last choice.
  // Adjusted during render rather than in an effect: this is derived state, and
  // an effect would render the stale choice once before clearing it.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setReplacementId('')
  }

  const needsReplacement = mode === 'reassign'
  const canConfirm = !needsReplacement || Boolean(replacementId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500" />
            {title}
          </DialogTitle>
          <DialogDescription>{reason}</DialogDescription>
        </DialogHeader>

        {needsReplacement &&
          (options.length === 0 ? (
            // Nothing to move them to. Say so rather than showing an empty
            // picker the merchant can never satisfy.
            <p className="text-sm text-muted-foreground">
              There is nothing else to move them to. Create a replacement first, then delete this
              one.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="reassign-target">{reassignLabel}</Label>
              <Select value={replacementId} onValueChange={setReplacementId}>
                <SelectTrigger id="reassign-target">
                  <SelectValue placeholder="Choose a replacement…" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            loading={loading}
            disabled={!canConfirm}
            onClick={() => onConfirm(needsReplacement ? replacementId : undefined)}
          >
            {needsReplacement ? 'Move and delete' : 'Delete anyway'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

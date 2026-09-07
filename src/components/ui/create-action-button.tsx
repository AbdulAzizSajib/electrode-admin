import { Plus } from 'lucide-react'

/**
 * One action offered below an option list, for what a merchant does when no
 * option suits — in this panel, creating the record they came looking for.
 *
 * Deliberately not an option. An entry in the option collection shifts the
 * highlight indices `aria-activedescendant` names, is committed by Enter as if
 * it were a value, draws a selection tick, and — worst — is filtered away by
 * the search at exactly the moment it is wanted, when what was typed matched
 * nothing. As a sibling of the list it survives all three settled states, is
 * reached by Tab, and is invisible to the arrows.
 *
 * Its own file rather than a second component inside `combobox.tsx`: a file
 * holding two components makes the React Compiler lint re-analyse the first
 * one, which then reports the highlight-clamping effect `Combobox` has always
 * had. Shared by `Combobox` and `MultiSelect` either way.
 */

export interface ComboboxCreateAction {
  label: string
  onSelect: () => void
}

export function CreateActionButton({
  action,
  onClose,
}: {
  action: ComboboxCreateAction
  onClose: () => void
}) {
  return (
    <>
      <div className="my-1 h-px bg-border" />
      <button
        type="button"
        onClick={() => {
          // Closes the list first: a dialog opened inside a live popover gets
          // its first click read as "outside the popover", and the two focus
          // traps fight over the first field.
          onClose()
          action.onSelect()
        }}
        className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm font-medium text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{action.label}</span>
      </button>
    </>
  )
}

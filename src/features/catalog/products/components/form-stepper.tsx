import { Check } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export interface StepDefinition {
  key: string
  title: string
  description: string
}

export interface FormStepperProps {
  steps: StepDefinition[]
  current: number
  /** Steps the user has already completed/visited — these are clickable shortcuts. */
  visited: Set<number>
  onStepClick: (index: number) => void
}

/**
 * Horizontal progress rail for the product form.
 *
 * Only visited steps are clickable: jumping ahead would skip the per-step
 * validation that gates "Next", so a forward jump could land the user on
 * Review with required fields still empty.
 */
export function FormStepper({ steps, current, visited, onStepClick }: FormStepperProps) {
  return (
    <ol className="flex w-full items-start gap-1 overflow-x-auto">
      {steps.map((step, index) => {
        const isCurrent = index === current
        const isDone = index < current || (visited.has(index) && index !== current)
        const isReachable = visited.has(index)

        return (
          <li key={step.key} className="flex min-w-0 flex-1 items-start gap-2">
            <button
              type="button"
              disabled={!isReachable}
              onClick={() => isReachable && onStepClick(index)}
              className={cn(
                'flex min-w-0 flex-1 flex-col items-start gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors',
                isReachable && !isCurrent && 'hover:bg-muted',
                !isReachable && 'cursor-not-allowed',
              )}
            >
              <div className="flex w-full items-center gap-2">
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
                    isCurrent && 'border-primary bg-primary text-primary-foreground',
                    !isCurrent && isDone && 'border-primary/40 bg-primary/10 text-primary',
                    !isCurrent && !isDone && 'border-border bg-muted text-muted-foreground',
                  )}
                >
                  {isDone && !isCurrent ? <Check className="size-3.5" /> : index + 1}
                </span>
                {/* Connector fills the space between this step and the next. */}
                {index < steps.length - 1 && (
                  <span
                    className={cn(
                      'h-px min-w-4 flex-1 transition-colors',
                      index < current ? 'bg-primary/40' : 'bg-border',
                    )}
                  />
                )}
              </div>
              <div className="flex min-w-0 flex-col">
                <span
                  className={cn(
                    'truncate text-xs font-medium',
                    isCurrent ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {step.title}
                </span>
                <span className="truncate text-[11px] text-muted-foreground">{step.description}</span>
              </div>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

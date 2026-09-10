import * as React from 'react'
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form'
import { Slot } from '@radix-ui/react-slot'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils/cn'

export const Form = FormProvider

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = { name: TName }

const FormFieldContext = React.createContext<FormFieldContextValue | null>(null)

export function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(props: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

function useFormField() {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)
  const { getFieldState, formState } = useFormContext()

  if (!fieldContext) throw new Error('useFormField must be used within <FormField>')

  const fieldState = getFieldState(fieldContext.name, formState)
  const id = itemContext?.id ?? fieldContext.name

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  }
}

type FormItemContextValue = { id: string }
const FormItemContext = React.createContext<FormItemContextValue | null>(null)

export const FormItem = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => {
    const id = React.useId()
    return (
      <FormItemContext.Provider value={{ id }}>
        <div ref={ref} className={cn('flex flex-col gap-1.5', className)} {...props} />
      </FormItemContext.Provider>
    )
  },
)
FormItem.displayName = 'FormItem'

export const FormLabel = React.forwardRef<
  React.ElementRef<typeof Label>,
  React.ComponentPropsWithoutRef<typeof Label>
>(({ className, ...props }, ref) => {
  const { error, formItemId } = useFormField()
  return (
    <Label
      ref={ref}
      className={cn(error && 'text-destructive', className)}
      htmlFor={formItemId}
      {...props}
    />
  )
})
FormLabel.displayName = 'FormLabel'

/**
 * Merges its accessibility props onto the control it wraps rather than rendering a wrapper element.
 * Must stay a `Slot`: Radix compound controls (notably `Select`) require their trigger to be a
 * direct child of the root, and an intervening `<div>` silently breaks that link — the trigger then
 * renders without its selected value.
 */
export const FormControl = React.forwardRef<HTMLElement, React.ComponentProps<typeof Slot>>(
  ({ ...props }, ref) => {
    const { error, formItemId, formDescriptionId, formMessageId } = useFormField()
    return (
      <Slot
        ref={ref}
        id={formItemId}
        aria-describedby={!error ? formDescriptionId : `${formDescriptionId} ${formMessageId}`}
        aria-invalid={!!error}
        {...props}
      />
    )
  },
)
FormControl.displayName = 'FormControl'

export const FormDescription = React.forwardRef<HTMLParagraphElement, React.ComponentProps<'p'>>(
  ({ className, ...props }, ref) => {
    const { formDescriptionId } = useFormField()
    return (
      <p
        ref={ref}
        id={formDescriptionId}
        className={cn('text-xs text-muted-foreground', className)}
        {...props}
      />
    )
  },
)
FormDescription.displayName = 'FormDescription'

export const FormMessage = React.forwardRef<HTMLParagraphElement, React.ComponentProps<'p'>>(
  ({ className, children, ...props }, ref) => {
    const { error, formMessageId } = useFormField()
    const body = error ? String(error?.message ?? '') : children
    if (!body) return null
    return (
      <p ref={ref} id={formMessageId} className={cn('text-xs font-medium text-destructive', className)} {...props}>
        {body}
      </p>
    )
  },
)
FormMessage.displayName = 'FormMessage'

/** Walks a dotted path — `deliveryZones`, `sections.2.rows` — through the error tree. */
function errorAtPath(errors: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (node, key) =>
        node == null || typeof node !== 'object'
          ? undefined
          : (node as Record<string, unknown>)[key],
      errors,
    )
}

/**
 * The failure message for a repeatable group, as opposed to for one field in it.
 *
 * Some rules hold over a whole list — that it is not empty, that a value is
 * distinct across its rows — and belong to no single input. `FormMessage` cannot
 * show them: it reads the error for the field it sits inside, and there is no
 * such field. Without this component those rules refuse the save and put nothing
 * on screen, which is the worst outcome available and exactly what antd's
 * `Form.List rules` + `Form.ErrorList` gave for free.
 *
 * A zod issue raised on the array's own path lands at `errors.<name>.root` once
 * the name is registered as a field array, and at `errors.<name>.message` when
 * it is not. Both are read, because which one applies depends on whether the
 * page reached `useFieldArray` — a distinction no caller should have to know.
 *
 * See openspec/changes/remove-antd-from-admin, design.md Decision 3, and
 * `specs/admin-shell` — "A validation failure belonging to a whole group is
 * reported against the group".
 */
export function FormArrayMessage({
  name,
  className,
  ...props
}: { name: string } & React.ComponentProps<'p'>) {
  // `useFormState` rather than reading `formState` off the context: it
  // subscribes this component to the named branch, so the message appears on
  // the render that the failed submit causes rather than on the next unrelated
  // one.
  const { errors } = useFormState({ name })
  const node = errorAtPath(errors, name)

  if (node == null || typeof node !== 'object') return null
  const branch = node as { root?: { message?: unknown }; message?: unknown }

  const message = branch.root?.message ?? branch.message
  if (typeof message !== 'string' || !message) return null

  return (
    <p className={cn('text-xs font-medium text-destructive', className)} {...props}>
      {message}
    </p>
  )
}

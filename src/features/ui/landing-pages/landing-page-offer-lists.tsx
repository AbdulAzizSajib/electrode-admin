import { useFieldArray, useWatch } from 'react-hook-form'
import { Plus, Trash2, ArrowDown, ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/ui/number-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FormArrayMessage,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import type { LandingPageForm } from './landing-page-schema'
import { MAX_PACKAGES, MAX_USAGE_IDEAS, MAX_WHY_US } from '@/lib/api/landing-pages'
import { useProducts } from '@/lib/api/products'
import { formatCurrency } from '@/lib/utils/format'

/**
 * The repeatable rows the OFFER MECHANICS are made of — packages, reasons,
 * usage ideas.
 *
 * A second module beside `landing-page-lists.tsx` rather than an addition to
 * it: that file was already six lists long, and these three arrived together
 * for one feature. Splitting on the feature boundary keeps each file readable
 * and means a change to the packages editor cannot re-render the gallery's.
 *
 * Same conventions as the file beside it — `useFieldArray` per list, the form
 * passed in rather than read from context, each list owning its own controls.
 */

const ROW = 'rounded-lg border border-border bg-muted/30 p-3'

function RowActions({
  index,
  total,
  onMove,
  onRemove,
}: {
  index: number
  total: number
  onMove: (from: number, to: number) => void
  onRemove: () => void
}) {
  return (
    <div className="flex shrink-0 flex-col gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
        aria-label="Move up"
      >
        <ArrowUp className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={index === total - 1}
        onClick={() => onMove(index, index + 1)}
        aria-label="Move down"
      >
        <ArrowDown className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        aria-label="Remove"
        className="text-destructive"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  )
}

function AddRowButton({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} className="self-start">
      <Plus className="size-4" />
      {children}
    </Button>
  )
}

/**
 * A package's key: generated once, never shown, never editable.
 *
 * An order records this, so rewriting it would reattach past orders to a
 * different tier — which is why, unlike a delivery zone's key, the merchant
 * never sees this field at all. Derived from the count at creation and then
 * left alone; a later reorder does NOT renumber, which is the entire point.
 */
const newPackageKey = (taken: string[]) => {
  for (let n = taken.length + 1; ; n += 1) {
    const candidate = `package-${n}`
    if (!taken.includes(candidate)) return candidate
  }
}

/**
 * The tiers a campaign offers — ৫০০ গ্রাম beside ১ কেজি, each with its price.
 *
 * AN EMPTY LIST IS A VALID, MEANINGFUL STATE: the page then sells its bound
 * product at that product's own price, exactly as landing pages did before
 * packages existed. So there is no minimum and no seeded first row.
 *
 * Each package names its OWN product, because two tiers are usually two
 * catalogue entries. The price is authored here rather than read from that
 * product — the one exception to "a landing page authors no price" — so the
 * product's current price is shown beside it whenever the two have drifted.
 */
export function PackagesListField({ form }: { form: LandingPageForm }) {
  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: 'packages',
  })

  const packages = useWatch({ control: form.control, name: 'packages' })
  const { data: products } = useProducts({ limit: 100 })
  const productOptions = products?.data ?? []

  return (
    <div className="flex flex-col gap-3">
      {fields.map((row, index) => {
        const chosenId = packages?.[index]?.productId
        const chosen = productOptions.find((product) => product.id === chosenId)
        const authored = packages?.[index]?.price

        /*
         * THE DRIFT WARNING.
         *
         * A package's price is authored, so editing the product afterwards
         * leaves the page advertising one number while the catalogue holds
         * another. The page keeps charging the AUTHORED price — silently
         * charging more than was advertised would be the worse failure — so
         * the only honest thing to do is show the merchant both and let them
         * decide.
         */
        const live = chosen ? Number(chosen.offerPrice) : null
        const drifted =
          live !== null && typeof authored === 'number' && Math.abs(live - authored) > 0.009

        return (
          <div key={row.id} className={`${ROW} flex gap-3`}>
            <div className="grid flex-1 gap-x-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name={`packages.${index}.label`}
                render={({ field }) => (
                  <FormItem className="mb-2">
                    <FormLabel>Package name</FormLabel>
                    <FormControl>
                      <Input placeholder="১ কেজি" {...field} />
                    </FormControl>
                    <FormDescription>What the shopper picks between.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`packages.${index}.productId`}
                render={({ field }) => (
                  <FormItem className="mb-2">
                    <FormLabel>Product</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a product" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {productOptions.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      What this tier ships and deducts stock from.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`packages.${index}.price`}
                render={({ field }) => (
                  <FormItem className="mb-2">
                    <FormLabel>Price</FormLabel>
                    <FormControl>
                      <NumberInput min={0} className="w-full" {...field} />
                    </FormControl>
                    <FormDescription>
                      {drifted ? (
                        <span className="text-amber-600">
                          This product now costs {formatCurrency(live)} in your catalogue.
                          The page will charge the price above.
                        </span>
                      ) : (
                        'What this tier costs. The page quotes and charges exactly this.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`packages.${index}.compareAtPrice`}
                render={({ field }) => (
                  <FormItem className="mb-2">
                    <FormLabel>Struck-through price</FormLabel>
                    <FormControl>
                      <NumberInput min={0} className="w-full" {...field} />
                    </FormControl>
                    <FormDescription>
                      Optional. Must be above the price charged.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`packages.${index}.freeGiftText`}
                render={({ field }) => (
                  <FormItem className="mb-2">
                    <FormLabel>Free gift line</FormLabel>
                    <FormControl>
                      <Input placeholder="+ ফ্রি ১ কেজি চিনিগুঁড়া চাল" {...field} />
                    </FormControl>
                    <FormDescription>Optional — shown under this tier.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`packages.${index}.badge`}
                render={({ field }) => (
                  <FormItem className="mb-2">
                    <FormLabel>Ribbon</FormLabel>
                    <FormControl>
                      <Input placeholder="হট অফার" {...field} />
                    </FormControl>
                    <FormDescription>Optional — a short highlight.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`packages.${index}.preselected`}
                render={({ field }) => (
                  <FormItem className="mb-2 flex flex-row items-center gap-2 sm:col-span-2">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={Boolean(field.value)}
                        onChange={(event) => field.onChange(event.target.checked)}
                        className="size-4"
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">Selected when the page opens</FormLabel>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <RowActions
              index={index}
              total={fields.length}
              onMove={move}
              onRemove={() => remove(index)}
            />
          </div>
        )
      })}

      <FormArrayMessage name="packages" />

      {fields.length < MAX_PACKAGES && (
        <AddRowButton
          onClick={() =>
            append({
              key: newPackageKey((packages ?? []).map((pkg) => pkg?.key ?? '')),
              label: '',
              /* Seeded with the page's own product — the common case is tiers
                 of the same thing, and a merchant selling something else here
                 can change it. */
              productId: form.getValues('productId'),
              price: 0,
            })
          }
        >
          Add a package
        </AddRowButton>
      )}
    </div>
  )
}

/** The numbered "why we are different" reasons. */
export function WhyUsListField({ form }: { form: LandingPageForm }) {
  const { fields, append, remove, move } = useFieldArray({ control: form.control, name: 'whyUs' })

  return (
    <div className="flex flex-col gap-3">
      {fields.map((row, index) => (
        <div key={row.id} className={`${ROW} flex gap-3`}>
          <div className="grid flex-1 gap-x-3 sm:grid-cols-2">
            <FormField
              control={form.control}
              name={`whyUs.${index}.title`}
              render={({ field }) => (
                <FormItem className="mb-2">
                  <FormLabel>Reason</FormLabel>
                  <FormControl>
                    <Input placeholder="খাঁটি দেশি দুধ" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`whyUs.${index}.text`}
              render={({ field }) => (
                <FormItem className="mb-2">
                  <FormLabel>Supporting line</FormLabel>
                  <FormControl>
                    <Input placeholder="বিশুদ্ধ গরুর দুধ থেকে তৈরি" {...field} />
                  </FormControl>
                  <FormDescription>Optional.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <RowActions
            index={index}
            total={fields.length}
            onMove={move}
            onRemove={() => remove(index)}
          />
        </div>
      ))}

      {fields.length < MAX_WHY_US && (
        <AddRowButton onClick={() => append({ title: '' })}>Add a reason</AddRowButton>
      )}
    </div>
  )
}

/** "What would I do with this" — short labels with optional icons. */
export function UsageIdeasListField({ form }: { form: LandingPageForm }) {
  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: 'usageIdeas',
  })

  return (
    <div className="flex flex-col gap-3">
      {fields.map((row, index) => (
        <div key={row.id} className={`${ROW} flex gap-3`}>
          <div className="grid flex-1 gap-x-3 sm:grid-cols-2">
            <FormField
              control={form.control}
              name={`usageIdeas.${index}.label`}
              render={({ field }) => (
                <FormItem className="mb-2">
                  <FormLabel>Idea</FormLabel>
                  <FormControl>
                    <Input placeholder="গরম ভাতের সাথে" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`usageIdeas.${index}.icon`}
              render={({ field }) => (
                <FormItem className="mb-2">
                  <FormLabel>Icon</FormLabel>
                  <FormControl>
                    <Input placeholder="lucide:utensils" {...field} />
                  </FormControl>
                  <FormDescription>Optional — an Iconify name.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <RowActions
            index={index}
            total={fields.length}
            onMove={move}
            onRemove={() => remove(index)}
          />
        </div>
      ))}

      {fields.length < MAX_USAGE_IDEAS && (
        <AddRowButton onClick={() => append({ label: '' })}>Add a usage idea</AddRowButton>
      )}
    </div>
  )
}

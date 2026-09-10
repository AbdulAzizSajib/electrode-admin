import { useParams } from 'react-router'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ResourceFormPage } from '@/components/crud/resource-form-page'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/ui/number-input'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { BUNDLE_DEALS_PATH, offerLabel } from '@/features/catalog/bundle-deals/bundle-deal-labels'
import { requiredNumber } from '@/lib/validation/numeric'
import {
  useBundleDeal,
  useCreateBundleDeal,
  useUpdateBundleDeal,
  type BundleDeal,
} from '@/lib/api/bundle-deals'

/*
 * Both floors are enforced by the backend too. Stating them here as well is what
 * turns a rejected save into a message beside the field that caused it.
 */
const schema = z.object({
  name: z.string().min(1, 'Give this offer a name'),
  buyQuantity: requiredNumber('How many must be bought?', {
    min: 1,
    message: 'An offer requiring nothing bought is not an offer',
  }),
  freeQuantity: requiredNumber('How many are then free?', {
    min: 1,
    message: 'An offer giving nothing away is not an offer',
  }),
})

/** Both quantities run through a `z.preprocess`, so input and output diverge. */
type FormValues = z.input<typeof schema>
type OutputValues = z.output<typeof schema>

const EMPTY: FormValues = { name: '', buyQuantity: 2, freeQuantity: 1 }

export default function BundleDealFormPage() {
  const { bundleDealId } = useParams()
  const isEdit = Boolean(bundleDealId)

  const { data, isLoading, error } = useBundleDeal(bundleDealId)
  const createMutation = useCreateBundleDeal()
  const updateMutation = useUpdateBundleDeal()

  const form = useForm<FormValues, unknown, OutputValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  })

  // One watch over both names: the preview is a sentence built from the pair, so
  // either changing has to rewrite it.
  const [buyQuantity, freeQuantity] = useWatch({
    control: form.control,
    name: ['buyQuantity', 'freeQuantity'],
  })

  return (
    <ResourceFormPage<FormValues, BundleDeal, OutputValues>
      noun="Bundle deal"
      listPath={BUNDLE_DEALS_PATH}
      recordId={bundleDealId}
      form={form}
      record={data}
      isLoading={isLoading}
      loadError={error}
      toValues={(deal) => ({
        name: deal.name,
        buyQuantity: deal.buyQuantity,
        freeQuantity: deal.freeQuantity,
      })}
      onSave={async (values) => {
        if (isEdit) {
          await updateMutation.mutateAsync({ id: bundleDealId as string, input: values })
          return
        }
        const created = await createMutation.mutateAsync(values)
        return { id: created.id }
      }}
    >
      <div className="grid gap-x-6 gap-y-4 md:grid-cols-3">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="md:col-span-3">
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Buy 2 get 1 free" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="buyQuantity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Units bought</FormLabel>
              <FormControl>
                <NumberInput className="w-full" min={1} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="freeQuantity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Units free</FormLabel>
              <FormControl>
                <NumberInput className="w-full" min={1} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-col gap-1.5">
          {/* An empty label, as antd's `label=" " colon={false}` was: it keeps
              the sentence on the same line as the two boxes it describes
              instead of riding up to the top of the row. */}
          <span aria-hidden className="text-xs font-medium">
            &nbsp;
          </span>
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            {offerLabel({
              buyQuantity: Number(buyQuantity) || 0,
              freeQuantity: Number(freeQuantity) || 0,
            })}
          </p>
        </div>
      </div>
    </ResourceFormPage>
  )
}

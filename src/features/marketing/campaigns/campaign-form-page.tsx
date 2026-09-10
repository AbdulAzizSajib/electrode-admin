/**
 * Campaign creation only.
 *
 * Editing a campaign already happens in place on `campaign-detail-page.tsx` —
 * that is where its products are attached, and the form there is part of the
 * page rather than an overlay — so this change gave campaigns a create route and
 * no edit route. Saving and continuing lands on that detail page, which is what
 * `listPath/:id` resolves to.
 */
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ResourceFormPage } from '@/components/crud/resource-form-page'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { CAMPAIGNS_PATH, NO_PLACEMENT } from '@/features/marketing/campaigns/campaigns-list-page'
import {
  useCreateCampaign,
  CAMPAIGN_PLACEMENTS,
  CAMPAIGN_STATUSES,
  type Campaign,
  type CampaignInput,
} from '@/lib/api/campaigns'

const schema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(200),
    description: z.string().trim().max(2000),
    status: z.enum(CAMPAIGN_STATUSES),
    placement: z.string(),
    startsAt: z.string(),
    endsAt: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.startsAt && v.endsAt && v.endsAt < v.startsAt) {
      ctx.addIssue({ code: 'custom', message: 'End must be after the start', path: ['endsAt'] })
    }
  })
type Values = z.infer<typeof schema>

const EMPTY: Values = {
  name: '',
  description: '',
  status: 'DRAFT',
  placement: NO_PLACEMENT,
  startsAt: '',
  endsAt: '',
}

function toCampaignPayload(v: Values): CampaignInput {
  const input: CampaignInput = { name: v.name, status: v.status }
  if (v.description) input.description = v.description
  if (v.placement && v.placement !== NO_PLACEMENT) {
    input.placement = v.placement as CampaignInput['placement']
  }
  if (v.startsAt) input.startsAt = new Date(`${v.startsAt}T00:00:00.000Z`).toISOString()
  if (v.endsAt) input.endsAt = new Date(`${v.endsAt}T23:59:59.999Z`).toISOString()
  return input
}

export default function CampaignFormPage() {
  const createMutation = useCreateCampaign()

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: EMPTY })

  const save = async (values: Values) => {
    const created = await createMutation.mutateAsync(toCampaignPayload(values))
    return { id: created.id }
  }

  return (
    <ResourceFormPage<Values, Campaign>
      noun="Campaign"
      listPath={CAMPAIGNS_PATH}
      form={form}
      toValues={() => EMPTY}
      onSave={save}
      description="Products are attached after the campaign exists."
    >
      <FormField control={form.control} name="name" render={({ field }) => (
        <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
      )} />
      <FormField control={form.control} name="description" render={({ field }) => (
        <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
      )} />
      <div className="grid gap-3.5 md:grid-cols-2">
        <FormField control={form.control} name="status" render={({ field }) => (
          <FormItem>
            <FormLabel>Status</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                {CAMPAIGN_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="placement" render={({ field }) => (
          <FormItem>
            <FormLabel>Placement</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value={NO_PLACEMENT}>None</SelectItem>
                {CAMPAIGN_PLACEMENTS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
      </div>
      <div className="grid gap-3.5 md:grid-cols-2">
        <FormField control={form.control} name="startsAt" render={({ field }) => (
          <FormItem><FormLabel>Starts</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="endsAt" render={({ field }) => (
          <FormItem><FormLabel>Ends</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
      </div>
    </ResourceFormPage>
  )
}

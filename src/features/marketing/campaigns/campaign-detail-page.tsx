import { useNavigate, useParams } from 'react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ArrowLeft, Eye, Trash2, TicketPercent } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/use-toast'
import { useBreadcrumbLabel } from '@/components/layout/breadcrumb-context'
import { useCampaign, useDeleteCampaign, useUpdateCampaign } from '@/lib/api/campaigns'
import { formatNumber } from '@/lib/utils/format'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().min(1, 'Description is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  isActive: z.boolean(),
})
type Values = z.infer<typeof schema>

export default function CampaignDetailPage() {
  const { campaignId } = useParams()
  const navigate = useNavigate()
  const { data: campaign, isLoading } = useCampaign(campaignId)
  const updateMutation = useUpdateCampaign()
  const deleteMutation = useDeleteCampaign()
  const confirmDialog = useConfirmDialog()

  useBreadcrumbLabel(campaign?.name)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: campaign
      ? { name: campaign.name, description: campaign.description, startDate: campaign.startDate, endDate: campaign.endDate, isActive: campaign.isActive }
      : undefined,
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }
  if (!campaign || !campaignId) return <EmptyState title="Campaign not found" />

  const onSubmit = async (values: Values) => {
    try {
      await updateMutation.mutateAsync({ id: campaignId, input: { ...values, couponIds: campaign.couponIds, productIds: campaign.productIds } })
      toast({ title: 'Campaign updated' })
    } catch (err) {
      toast({ title: 'Something went wrong', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }

  const redemptionRate = campaign.metrics.views > 0 ? ((campaign.metrics.redemptions / campaign.metrics.views) * 100).toFixed(1) : '0.0'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="size-7" onClick={() => navigate('/marketing/campaigns')}>
          <ArrowLeft className="size-4" />
        </Button>
        <PageHeader
          className="flex-1"
          title={campaign.name}
          actions={
            <Button
              variant="destructive"
              size="sm"
              onClick={() =>
                confirmDialog.confirm(async () => {
                  try {
                    await deleteMutation.mutateAsync(campaignId)
                    toast({ title: 'Campaign deleted' })
                    navigate('/marketing/campaigns')
                  } catch (err) {
                    toast({ title: 'Could not delete campaign', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
                  }
                })
              }
            >
              <Trash2 /> Delete
            </Button>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 py-3.5">
            <Eye className="size-5 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Views</span>
              <span className="text-lg font-semibold text-foreground">{formatNumber(campaign.metrics.views)}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-3.5">
            <TicketPercent className="size-5 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Redemptions</span>
              <span className="text-lg font-semibold text-foreground">{formatNumber(campaign.metrics.redemptions)}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-3.5">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Redemption rate</span>
              <span className="text-lg font-semibold text-foreground">{redemptionRate}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Configuration</CardTitle></CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3.5">
                <FormField control={form.control} name="startDate" render={({ field }) => (
                  <FormItem><FormLabel>Start date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="endDate" render={({ field }) => (
                  <FormItem><FormLabel>End date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="isActive" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between gap-2">
                  <FormLabel className="text-sm font-normal text-foreground">Active</FormLabel>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />
              <div className="flex justify-end">
                <Button type="submit" loading={form.formState.isSubmitting}>Save changes</Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={confirmDialog.setOpen}
        title="Delete this campaign?"
        description="This cannot be undone."
        confirmLabel="Delete"
        loading={confirmDialog.pending}
        onConfirm={confirmDialog.handleConfirm}
      />
    </div>
  )
}

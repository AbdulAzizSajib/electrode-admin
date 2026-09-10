import * as React from 'react'
import { useNavigate, useParams } from 'react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ArrowLeft, PackageSearch, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/use-toast'
import { useBreadcrumbLabel } from '@/components/layout/breadcrumb-context'
import {
  useCampaign,
  useDeleteCampaign,
  useUpdateCampaign,
  CAMPAIGN_DISCOUNT_TYPES,
  CAMPAIGN_PLACEMENTS,
  CAMPAIGN_STATUSES,
  CAMPAIGN_STATUS_VARIANT,
  type Campaign,
  type CampaignDiscountType,
  type CampaignInput,
  type CampaignPlacement,
  type CampaignProductInput,
} from '@/lib/api/campaigns'
import { useProducts } from '@/lib/api/products'

const NO_PLACEMENT = 'none'

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

function toFormValues(c: Campaign): Values {
  return {
    name: c.name,
    description: c.description ?? '',
    status: c.status,
    placement: c.placement ?? NO_PLACEMENT,
    startsAt: c.startsAt ? c.startsAt.slice(0, 10) : '',
    endsAt: c.endsAt ? c.endsAt.slice(0, 10) : '',
  }
}

/** The campaign's products, mapped back into the write shape the backend expects. */
function existingProductInputs(c: Campaign): CampaignProductInput[] {
  return c.products.map((p) => ({
    productId: p.productId,
    discountType: p.discountType,
    discountValue: Number(p.discountValue),
  }))
}

export default function CampaignDetailPage() {
  const { campaignId } = useParams()
  const navigate = useNavigate()
  const { data: campaign, isLoading } = useCampaign(campaignId)
  const { data: productsData } = useProducts({ limit: 100 })
  const updateMutation = useUpdateCampaign()
  const deleteMutation = useDeleteCampaign()
  const confirmDialog = useConfirmDialog()

  const [newProductId, setNewProductId] = React.useState('')
  const [newDiscountType, setNewDiscountType] = React.useState<CampaignDiscountType>('PERCENTAGE')
  const [newDiscountValue, setNewDiscountValue] = React.useState('10')

  useBreadcrumbLabel(campaign?.name)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: campaign ? toFormValues(campaign) : undefined,
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
    const input: CampaignInput = { name: values.name, status: values.status }
    if (values.description) input.description = values.description
    if (values.placement !== NO_PLACEMENT) input.placement = values.placement as CampaignPlacement
    if (values.startsAt) input.startsAt = new Date(`${values.startsAt}T00:00:00.000Z`).toISOString()
    if (values.endsAt) input.endsAt = new Date(`${values.endsAt}T23:59:59.999Z`).toISOString()

    try {
      await updateMutation.mutateAsync({ id: campaignId, input })
      toast({ title: 'Campaign updated' })
    } catch (err) {
      toast({ title: 'Something went wrong', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }

  /**
   * Products are written as a whole set, not individually — `PATCH /campaigns/:id` replaces the
   * association list — so both add and remove send the full resulting array.
   */
  const saveProducts = async (products: CampaignProductInput[], successTitle: string) => {
    try {
      await updateMutation.mutateAsync({ id: campaignId, input: { name: campaign.name, products } })
      toast({ title: successTitle })
    } catch (err) {
      toast({ title: 'Something went wrong', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }

  const addProduct = async () => {
    if (!newProductId) return
    const value = Number(newDiscountValue)
    if (Number.isNaN(value) || value < 0) {
      toast({ title: 'Enter a valid discount', variant: 'destructive' })
      return
    }
    if (campaign.products.some((p) => p.productId === newProductId)) {
      toast({ title: 'That product is already in this campaign', variant: 'destructive' })
      return
    }
    await saveProducts(
      [...existingProductInputs(campaign), { productId: newProductId, discountType: newDiscountType, discountValue: value }],
      'Product added',
    )
    setNewProductId('')
  }

  const removeProduct = (productId: string) =>
    saveProducts(existingProductInputs(campaign).filter((p) => p.productId !== productId), 'Product removed')

  const products = productsData?.data ?? []
  const available = products.filter((p) => !campaign.products.some((cp) => cp.productId === p.id))

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
            <div className="flex items-center gap-2">
              <Badge variant={CAMPAIGN_STATUS_VARIANT[campaign.status]}>{campaign.status}</Badge>
              <Button
                variant="destructive"
                size="lg"
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
            </div>
          }
        />
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
              <div className="grid grid-cols-2 gap-3.5">
                <FormField control={form.control} name="startsAt" render={({ field }) => (
                  <FormItem><FormLabel>Starts</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="endsAt" render={({ field }) => (
                  <FormItem><FormLabel>Ends</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="flex justify-end">
                <Button type="submit" loading={form.formState.isSubmitting}>Save changes</Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Products</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {campaign.products.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title="No products in this campaign"
              description="Add a product below to discount it while the campaign runs."
            />
          ) : (
            <div className="flex flex-col gap-1.5">
              {campaign.products.map((cp) => (
                <div key={cp.id} className="flex items-center gap-3 rounded-md border border-border p-2.5">
                  <span className="flex-1 text-sm text-foreground">{cp.product?.name ?? cp.productId}</span>
                  <Badge variant="outline">
                    {cp.discountType === 'PERCENTAGE' ? `${cp.discountValue}% off` : `${cp.discountValue} off`}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => removeProduct(cp.productId)}
                    aria-label="Remove product"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
            <div className="flex min-w-48 flex-1 flex-col gap-1.5">
              <span className="text-sm font-medium">Product</span>
              <Select value={newProductId} onValueChange={setNewProductId}>
                <SelectTrigger><SelectValue placeholder="Choose a product" /></SelectTrigger>
                <SelectContent>
                  {available.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-36 flex-col gap-1.5">
              <span className="text-sm font-medium">Discount</span>
              <Select value={newDiscountType} onValueChange={(v) => setNewDiscountType(v as CampaignDiscountType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_DISCOUNT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-28 flex-col gap-1.5">
              <span className="text-sm font-medium">Value</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={newDiscountValue}
                onChange={(e) => setNewDiscountValue(e.target.value)}
              />
            </div>
            <Button type="button" onClick={addProduct} disabled={!newProductId || updateMutation.isPending}>
              <Plus /> Add
            </Button>
          </div>
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

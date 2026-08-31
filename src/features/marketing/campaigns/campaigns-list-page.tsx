import * as React from 'react'
import { useNavigate } from 'react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { Megaphone, Plus } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { DataTable } from '@/components/ui/data-table'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { toast } from '@/components/ui/use-toast'
import {
  useCampaigns,
  useCreateCampaign,
  CAMPAIGN_PLACEMENTS,
  CAMPAIGN_STATUSES,
  CAMPAIGN_STATUS_VARIANT,
  type Campaign,
  type CampaignInput,
  type CampaignStatus,
} from '@/lib/api/campaigns'
import { formatDate } from '@/lib/utils/format'

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

export default function CampaignsListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = React.useState('')
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [statusFilter, setStatusFilter] = React.useState<'all' | CampaignStatus>('all')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  const { data, isLoading, isError, refetch } = useCampaigns({
    search,
    page,
    limit: pageSize,
    status: statusFilter === 'all' ? undefined : statusFilter,
  })
  const createMutation = useCreateCampaign()

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      description: '',
      status: 'DRAFT',
      placement: NO_PLACEMENT,
      startsAt: '',
      endsAt: '',
    },
  })

  const onSubmit = async (values: Values) => {
    try {
      const created = await createMutation.mutateAsync(toCampaignPayload(values))
      toast({ title: 'Campaign created' })
      setSheetOpen(false)
      form.reset()
      navigate(`/marketing/campaigns/${created.id}`)
    } catch (err) {
      toast({ title: 'Something went wrong', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }

  const columns: ColumnDef<Campaign>[] = [
    { accessorKey: 'name', header: 'Name', cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span> },
    {
      id: 'window',
      header: 'Window',
      cell: ({ row }) => {
        const { startsAt, endsAt } = row.original
        if (!startsAt && !endsAt) return <span className="text-muted-foreground">Always</span>
        return `${startsAt ? formatDate(startsAt) : '—'} – ${endsAt ? formatDate(endsAt) : '—'}`
      },
    },
    {
      id: 'placement',
      header: 'Placement',
      cell: ({ row }) => row.original.placement ?? <span className="text-muted-foreground">—</span>,
    },
    { id: 'products', header: 'Products', cell: ({ row }) => row.original.products.length },
    { id: 'status', header: 'Status', cell: ({ row }) => <Badge variant={CAMPAIGN_STATUS_VARIANT[row.original.status]}>{row.original.status}</Badge> },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Campaigns"
        description="Time-boxed promotions that discount a set of products."
        actions={
          <Button size="sm" onClick={() => setSheetOpen(true)}>
            <Plus /> New campaign
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Search campaigns…"
        onRowClick={(row) => navigate(`/marketing/campaigns/${row.id}`)}
        emptyState={{ icon: Megaphone, title: 'No campaigns yet' }}
        toolbar={
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as 'all' | CampaignStatus); setPage(1) }}>
            <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {CAMPAIGN_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        }
        page={page}
        pageSize={pageSize}
        total={data?.meta.total ?? 0}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
      />

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>New campaign</SheetTitle></SheetHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-1 flex-col gap-3.5 overflow-y-auto">
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
              <SheetFooter>
                <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
                <Button type="submit" loading={form.formState.isSubmitting}>Create campaign</Button>
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>
    </div>
  )
}

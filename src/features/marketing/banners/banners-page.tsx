import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ArrowDown, ArrowUp, GalleryHorizontal, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Card } from '@/components/ui/card'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import {
  useBanners,
  useCreateBanner,
  useDeleteBanner,
  useReorderBanner,
  useToggleBannerActive,
  useUpdateBanner,
  type Banner,
  type BannerPosition,
} from '@/lib/api/banners'

const POSITION_LABEL: Record<BannerPosition, string> = {
  homepage_hero: 'Homepage hero',
  homepage_secondary: 'Homepage secondary',
  category_top: 'Category top',
  checkout_sidebar: 'Checkout sidebar',
}

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  imageUrl: z.string().min(1, 'Image URL is required'),
  linkUrl: z.string().min(1, 'Link URL is required'),
  position: z.enum(['homepage_hero', 'homepage_secondary', 'category_top', 'checkout_sidebar']),
  isActive: z.boolean(),
})
type Values = z.infer<typeof schema>

export default function BannersPage() {
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Banner | null>(null)

  const { data, isLoading } = useBanners()
  const createMutation = useCreateBanner()
  const updateMutation = useUpdateBanner()
  const deleteMutation = useDeleteBanner()
  const reorderMutation = useReorderBanner()
  const toggleMutation = useToggleBannerActive()
  const confirmDialog = useConfirmDialog()

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: {
      title: editing?.title ?? '',
      imageUrl: editing?.imageUrl ?? '',
      linkUrl: editing?.linkUrl ?? '',
      position: editing?.position ?? 'homepage_hero',
      isActive: editing?.isActive ?? true,
    },
  })

  const onSubmit = async (values: Values) => {
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, input: { ...values, sortOrder: editing.sortOrder } })
        toast({ title: 'Banner updated' })
      } else {
        await createMutation.mutateAsync({ ...values, sortOrder: (data?.data.length ?? 0) + 1 })
        toast({ title: 'Banner created' })
      }
      setSheetOpen(false)
    } catch (err) {
      toast({ title: 'Something went wrong', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }

  const banners = data?.data ?? []

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Banners"
        description="Promotional banners shown across the storefront."
        actions={
          <Button size="sm" onClick={() => { setEditing(null); setSheetOpen(true) }}>
            <Plus /> New banner
          </Button>
        }
      />

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : banners.length === 0 ? (
        <EmptyState icon={GalleryHorizontal} title="No banners yet" description="Add a banner to promote something on the storefront." />
      ) : (
        <div className="flex flex-col gap-2">
          {banners.map((banner, index) => (
            <Card key={banner.id} className="flex items-center gap-3 p-2.5">
              <img src={banner.imageUrl} alt="" className="h-14 w-24 shrink-0 rounded-md border border-border object-cover" />
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="font-medium text-foreground">{banner.title}</span>
                <span className="text-xs text-muted-foreground">{POSITION_LABEL[banner.position]} · order {banner.sortOrder}</span>
              </div>
              <Badge variant={banner.isActive ? 'success' : 'secondary'}>{banner.isActive ? 'Active' : 'Inactive'}</Badge>
              <Switch checked={banner.isActive} onCheckedChange={() => toggleMutation.mutate(banner.id)} />
              <div className="flex items-center gap-0.5">
                <Button variant="ghost" size="icon" className="size-7" disabled={index === 0} onClick={() => reorderMutation.mutate({ id: banner.id, direction: 'up' })}>
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="size-7" disabled={index === banners.length - 1} onClick={() => reorderMutation.mutate({ id: banner.id, direction: 'down' })}>
                  <ArrowDown className="size-3.5" />
                </Button>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-7"><MoreHorizontal className="size-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => { setEditing(banner); setSheetOpen(true) }}>
                    <Pencil /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() =>
                      confirmDialog.confirm(async () => {
                        try {
                          await deleteMutation.mutateAsync(banner.id)
                          toast({ title: 'Banner deleted' })
                        } catch (err) {
                          toast({ title: 'Could not delete banner', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
                        }
                      })
                    }
                  >
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>{editing ? 'Edit banner' : 'New banner'}</SheetTitle></SheetHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-1 flex-col gap-3.5 overflow-y-auto">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="imageUrl" render={({ field }) => (
                <FormItem><FormLabel>Image URL</FormLabel><FormControl><Input placeholder="https://…" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="linkUrl" render={({ field }) => (
                <FormItem><FormLabel>Link URL</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="position" render={({ field }) => (
                <FormItem>
                  <FormLabel>Position</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {Object.entries(POSITION_LABEL).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="isActive" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between gap-2">
                  <FormLabel className="text-sm font-normal text-foreground">Active</FormLabel>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />
              <SheetFooter>
                <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
                <Button type="submit" loading={form.formState.isSubmitting}>{editing ? 'Save changes' : 'Create banner'}</Button>
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={confirmDialog.setOpen}
        title="Delete this banner?"
        description="This cannot be undone."
        confirmLabel="Delete"
        loading={confirmDialog.pending}
        onConfirm={confirmDialog.handleConfirm}
      />
    </div>
  )
}

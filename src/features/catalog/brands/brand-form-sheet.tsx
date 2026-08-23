import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { toast } from '@/components/ui/use-toast'
import { useCreateBrand, useUpdateBrand, type Brand } from '@/lib/api/brands'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  logo: z.string().optional(),
  description: z.string().optional(),
  status: z.boolean(),
})

type Values = z.infer<typeof schema>

export interface BrandFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  brand: Brand | null
}

export function BrandFormSheet({ open, onOpenChange, brand }: BrandFormSheetProps) {
  const isEdit = !!brand
  const createMutation = useCreateBrand()
  const updateMutation = useUpdateBrand()

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: {
      name: brand?.name ?? '',
      logo: brand?.logo ?? '',
      description: brand?.description ?? '',
      status: brand?.status ?? true,
    },
  })

  const onSubmit = async (values: Values) => {
    try {
      const input = { name: values.name, logo: values.logo || undefined, description: values.description || undefined, status: values.status }
      if (isEdit) {
        await updateMutation.mutateAsync({ id: brand.id, input })
        toast({ title: 'Brand updated' })
      } else {
        await createMutation.mutateAsync(input)
        toast({ title: 'Brand created' })
      }
      onOpenChange(false)
    } catch (err) {
      toast({ title: 'Something went wrong', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Edit brand' : 'New brand'}</SheetTitle>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-1 flex-col gap-3.5 overflow-y-auto">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="logo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Logo URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem className="flex-row items-center justify-between">
                  <FormLabel>Active</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <SheetFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={form.formState.isSubmitting}>
                {isEdit ? 'Save changes' : 'Create brand'}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}

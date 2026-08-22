import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { useStoreSettings, useUpdateStoreSettings } from '@/lib/api/store-settings'

const schema = z.object({
  storeName: z.string().min(1, 'Store name is required'),
  contactEmail: z.string().min(1, 'Contact email is required').email('Enter a valid email'),
  currency: z.string().min(1, 'Currency is required'),
  taxRate: z.coerce.number().min(0, 'Cannot be negative').max(100, 'Cannot exceed 100'),
  freeShippingThreshold: z.coerce.number().min(0, 'Cannot be negative'),
})
type Values = z.input<typeof schema>
type OutputValues = z.output<typeof schema>

export default function StoreSettingsPage() {
  const { data: settings, isLoading } = useStoreSettings()
  const updateMutation = useUpdateStoreSettings()

  const form = useForm<Values, unknown, OutputValues>({ resolver: zodResolver(schema), values: settings })

  const onSubmit = async (values: OutputValues) => {
    try {
      await updateMutation.mutateAsync(values)
      toast({ title: 'Store settings saved' })
    } catch (err) {
      toast({ title: 'Something went wrong', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }

  if (isLoading || !settings) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-72 w-full max-w-xl" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Store Settings" description="Store-wide configuration." />

      <Card className="max-w-xl">
        <CardHeader><CardTitle>General</CardTitle></CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
              <FormField control={form.control} name="storeName" render={({ field }) => (
                <FormItem><FormLabel>Store name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="contactEmail" render={({ field }) => (
                <FormItem><FormLabel>Contact email</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-3 gap-3.5">
                <FormField control={form.control} name="currency" render={({ field }) => (
                  <FormItem><FormLabel>Currency</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="taxRate" render={({ field }) => (
                  <FormItem><FormLabel>Tax rate (%)</FormLabel><FormControl><Input type="number" step="0.1" min="0" {...field} value={field.value === undefined ? '' : String(field.value)} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="freeShippingThreshold" render={({ field }) => (
                  <FormItem><FormLabel>Free shipping over</FormLabel><FormControl><Input type="number" step="0.01" min="0" {...field} value={field.value === undefined ? '' : String(field.value)} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="flex justify-end">
                <Button type="submit" loading={form.formState.isSubmitting}>Save changes</Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}

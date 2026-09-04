import { useParams } from 'react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ResourceFormPageRhf } from '@/components/crud/resource-form-page-rhf'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { SUPPLIERS_PATH } from '@/features/inventory/suppliers/suppliers-page'
import {
  useSupplier,
  useCreateSupplier,
  useUpdateSupplier,
  type Supplier,
} from '@/lib/api/suppliers'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  companyName: z.string().optional(),
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  phone: z.string().min(1, 'Phone is required'),
  address: z.string().min(1, 'Address is required'),
  isActive: z.boolean(),
})
type Values = z.infer<typeof schema>

const EMPTY: Values = {
  name: '',
  companyName: '',
  email: '',
  phone: '',
  address: '',
  isActive: true,
}

const toValues = (supplier: Supplier): Values => ({
  name: supplier.name,
  companyName: supplier.companyName ?? '',
  email: supplier.email ?? '',
  phone: supplier.phone ?? '',
  address: supplier.address ?? '',
  isActive: supplier.isActive,
})

export default function SupplierFormPage() {
  const { supplierId } = useParams()

  const { data, isLoading, error } = useSupplier(supplierId)
  const createMutation = useCreateSupplier()
  const updateMutation = useUpdateSupplier()

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: EMPTY })

  const save = async (values: Values) => {
    if (supplierId) {
      await updateMutation.mutateAsync({ id: supplierId, input: values })
      return
    }
    const created = await createMutation.mutateAsync(values)
    return { id: created.id }
  }

  return (
    <ResourceFormPageRhf<Values, Supplier>
      noun="Supplier"
      listPath={SUPPLIERS_PATH}
      recordId={supplierId}
      form={form}
      record={data}
      isLoading={isLoading}
      loadError={error}
      toValues={toValues}
      onSave={save}
    >
      <FormField control={form.control} name="name" render={({ field }) => (
        <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
      )} />
      <FormField control={form.control} name="companyName" render={({ field }) => (
        <FormItem><FormLabel>Company name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
      )} />
      <FormField control={form.control} name="email" render={({ field }) => (
        <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
      )} />
      <FormField control={form.control} name="phone" render={({ field }) => (
        <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
      )} />
      <FormField control={form.control} name="address" render={({ field }) => (
        <FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
      )} />
      <FormField control={form.control} name="isActive" render={({ field }) => (
        <FormItem className="flex flex-row items-center justify-between gap-2">
          <FormLabel className="text-sm font-normal text-foreground">Active</FormLabel>
          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
        </FormItem>
      )} />
    </ResourceFormPageRhf>
  )
}

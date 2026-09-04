import { useParams } from 'react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ResourceFormPageRhf } from '@/components/crud/resource-form-page-rhf'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { WAREHOUSES_PATH } from '@/features/inventory/warehouses/warehouses-page'
import {
  useWarehouse,
  useCreateWarehouse,
  useUpdateWarehouse,
  type Warehouse,
} from '@/lib/api/warehouses'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  isActive: z.boolean(),
})
type Values = z.infer<typeof schema>

const EMPTY: Values = { name: '', code: '', address: '', city: '', country: '', isActive: true }

const toValues = (warehouse: Warehouse): Values => ({
  name: warehouse.name,
  code: warehouse.code,
  address: warehouse.address ?? '',
  city: warehouse.city ?? '',
  country: warehouse.country ?? '',
  isActive: warehouse.isActive,
})

export default function WarehouseFormPage() {
  const { warehouseId } = useParams()

  const { data, isLoading, error } = useWarehouse(warehouseId)
  const createMutation = useCreateWarehouse()
  const updateMutation = useUpdateWarehouse()

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: EMPTY })

  const save = async (values: Values) => {
    if (warehouseId) {
      await updateMutation.mutateAsync({ id: warehouseId, input: values })
      return
    }
    const created = await createMutation.mutateAsync(values)
    return { id: created.id }
  }

  return (
    <ResourceFormPageRhf<Values, Warehouse>
      noun="Warehouse"
      listPath={WAREHOUSES_PATH}
      recordId={warehouseId}
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
      <FormField control={form.control} name="code" render={({ field }) => (
        <FormItem><FormLabel>Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
      )} />
      <FormField control={form.control} name="address" render={({ field }) => (
        <FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
      )} />
      <div className="grid grid-cols-2 gap-3.5">
        <FormField control={form.control} name="city" render={({ field }) => (
          <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="country" render={({ field }) => (
          <FormItem><FormLabel>Country</FormLabel><FormControl><Input placeholder="Bangladesh" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
      </div>
      <FormField control={form.control} name="isActive" render={({ field }) => (
        <FormItem className="flex flex-row items-center justify-between gap-2">
          <FormLabel className="text-sm font-normal text-foreground">Active</FormLabel>
          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
        </FormItem>
      )} />
    </ResourceFormPageRhf>
  )
}

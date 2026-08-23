import { useNavigate, useParams } from 'react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm } from 'react-hook-form'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { useBreadcrumbLabel } from '@/components/layout/breadcrumb-context'
import { useSuppliers } from '@/lib/api/suppliers'
import { useProducts } from '@/lib/api/products'
import {
  useCreatePurchaseOrder,
  usePurchaseOrder,
  useUpdatePurchaseOrder,
  type PurchaseOrderCreateInput,
  type PurchaseOrderUpdateInput,
} from '@/lib/api/purchase-orders'
import { formatCurrency } from '@/lib/utils/format'

// Only supplier + line items are create-only (the backend's PATCH doesn't accept them at all —
// see design.md). Kept in one schema so the form only needs one `useForm` instance; onSubmit picks
// which subset to actually send based on isEdit.
const schema = z.object({
  supplierId: z.string().min(1, 'Select a supplier'),
  notes: z.string().optional(),
  shippingCost: z.coerce.number().min(0, 'Cannot be negative').optional(),
  taxAmount: z.coerce.number().min(0, 'Cannot be negative').optional(),
  status: z.enum(['DRAFT', 'ORDERED', 'CANCELLED']),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, 'Select a product'),
        quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
        unitCost: z.coerce.number().min(0, 'Cost cannot be negative'),
      }),
    )
    .min(1, 'Add at least one line item'),
})
type Values = z.input<typeof schema>
type OutputValues = z.output<typeof schema>

export default function PurchaseOrderFormPage() {
  const { poId } = useParams()
  const isEdit = !!poId
  const navigate = useNavigate()

  const { data: po, isLoading: loadingPo } = usePurchaseOrder(poId)
  const { data: suppliersData } = useSuppliers()
  const { data: productsData } = useProducts({ limit: 200 })
  const createMutation = useCreatePurchaseOrder()
  const updateMutation = useUpdatePurchaseOrder()

  useBreadcrumbLabel(isEdit ? (po ? `Edit ${po.purchaseNumber}` : 'Edit purchase order') : 'New purchase order')

  const form = useForm<Values, unknown, OutputValues>({
    resolver: zodResolver(schema),
    values: po
      ? {
          supplierId: po.supplierId,
          notes: po.notes ?? '',
          shippingCost: Number(po.shippingCost),
          taxAmount: Number(po.taxAmount),
          status: po.status === 'DRAFT' || po.status === 'ORDERED' || po.status === 'CANCELLED' ? po.status : 'DRAFT',
          items: po.items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitCost: Number(i.unitCost) })),
        }
      : undefined,
    defaultValues: {
      supplierId: '',
      notes: '',
      shippingCost: undefined,
      taxAmount: undefined,
      status: 'DRAFT',
      items: [{ productId: '', quantity: 1, unitCost: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' })
  const watchedItems = form.watch('items')
  const watchedShipping = form.watch('shippingCost')
  const watchedTax = form.watch('taxAmount')
  const products = productsData?.data ?? []

  const subtotal = watchedItems.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0
    const cost = Number(item.unitCost) || 0
    return sum + qty * cost
  }, 0)
  const total = subtotal + (Number(watchedShipping) || 0) + (Number(watchedTax) || 0)

  const onSubmit = async (values: OutputValues) => {
    try {
      if (isEdit && poId) {
        // Line items and supplier aren't editable once a PO exists — the backend's PATCH doesn't
        // accept them (see design.md), so only the scalar fields below are sent.
        const input: PurchaseOrderUpdateInput = {
          shippingCost: values.shippingCost,
          taxAmount: values.taxAmount,
          notes: values.notes,
          status: values.status,
        }
        await updateMutation.mutateAsync({ id: poId, input })
        toast({ title: 'Purchase order updated' })
        navigate(`/inventory/purchase-orders/${poId}`)
      } else {
        const input: PurchaseOrderCreateInput = {
          supplierId: values.supplierId,
          items: values.items,
          shippingCost: values.shippingCost,
          taxAmount: values.taxAmount,
          notes: values.notes,
        }
        const created = await createMutation.mutateAsync(input)
        toast({ title: 'Purchase order created' })
        navigate(`/inventory/purchase-orders/${created.id}`)
      }
    } catch (err) {
      toast({ title: 'Something went wrong', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }

  if (isEdit && loadingPo) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={isEdit ? 'Edit purchase order' : 'New purchase order'} />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              {isEdit ? (
                <>
                  <div className="flex flex-col gap-1.5 text-sm sm:col-span-2">
                    <span className="text-muted-foreground">Supplier</span>
                    <span className="font-medium text-foreground">{po?.supplier.name}</span>
                    <span className="text-xs text-muted-foreground">Supplier can't be changed after a purchase order is created.</span>
                  </div>
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="DRAFT">Draft</SelectItem>
                            <SelectItem value="ORDERED">Ordered</SelectItem>
                            <SelectItem value="CANCELLED">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              ) : (
                <FormField
                  control={form.control}
                  name="supplierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select a supplier" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {suppliersData?.data.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="shippingCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shipping cost</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} value={field.value === undefined ? '' : String(field.value)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="taxAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax amount</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} value={field.value === undefined ? '' : String(field.value)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Notes</FormLabel>
                    <FormControl><Textarea rows={2} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Line items</CardTitle>
              {!isEdit && (
                <Button type="button" size="sm" variant="outline" onClick={() => append({ productId: '', quantity: 1, unitCost: 0 })}>
                  <Plus /> Add item
                </Button>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {isEdit ? (
                <div className="flex flex-col gap-1.5">
                  {po?.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{item.product.name} <span className="text-muted-foreground">× {item.quantity}</span></span>
                      <span className="text-muted-foreground">{formatCurrency(Number(item.unitCost))} each</span>
                    </div>
                  ))}
                  <span className="text-xs text-muted-foreground">Line items can't be changed after a purchase order is created.</span>
                </div>
              ) : (
                <>
                  {fields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-1 gap-2 rounded-md border border-border p-2.5 sm:grid-cols-[1fr_100px_120px_32px] sm:items-end">
                      <FormField
                        control={form.control}
                        name={`items.${index}.productId`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Product</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select a product" /></SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Qty</FormLabel>
                            <FormControl>
                              <Input type="number" min="1" {...field} value={field.value === undefined ? '' : String(field.value)} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.unitCost`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Unit cost</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" min="0" {...field} value={field.value === undefined ? '' : String(field.value)} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="button" variant="ghost" size="icon" disabled={fields.length === 1} onClick={() => remove(index)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </>
              )}
              <div className="flex flex-col items-end gap-0.5 text-sm">
                <span className="text-muted-foreground">Subtotal: {formatCurrency(subtotal)}</span>
                <span className="font-medium text-foreground">Total: {formatCurrency(total)}</span>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
            <Button type="submit" loading={form.formState.isSubmitting}>{isEdit ? 'Save changes' : 'Create purchase order'}</Button>
          </div>
        </form>
      </Form>
    </div>
  )
}

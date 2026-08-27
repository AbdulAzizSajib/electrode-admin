import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Pencil, Trash2, ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/use-toast'
import { useBreadcrumbLabel } from '@/components/layout/breadcrumb-context'
import { useDeleteProduct, useProduct } from '@/lib/api/products'
import { formatCurrency, formatDateTime } from '@/lib/utils/format'

const STOCK_VARIANT = { in_stock: 'success', low_stock: 'warning', out_of_stock: 'destructive' } as const
const STOCK_LABEL = { in_stock: 'In stock', low_stock: 'Low stock', out_of_stock: 'Out of stock' } as const

const STATUS_VARIANT = { DRAFT: 'secondary', ACTIVE: 'success', ARCHIVED: 'outline' } as const
const STATUS_LABEL = { DRAFT: 'Draft', ACTIVE: 'Active', ARCHIVED: 'Archived' } as const
const TYPE_LABEL = { SIMPLE: 'Simple', VARIABLE: 'Variable' } as const

export default function ProductDetailPage() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const { data: product, isLoading } = useProduct(productId)
  const deleteMutation = useDeleteProduct()
  const confirmDialog = useConfirmDialog()

  useBreadcrumbLabel(product?.name)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  if (!product) {
    return <EmptyState title="Product not found" description="It may have been deleted." />
  }

  const images = [...product.images].sort((a, b) => a.sortOrder - b.sortOrder)
  const variants = product.variants ?? []
  const attributes = product.attributes ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="size-7" onClick={() => navigate('/catalog/products')}>
          <ArrowLeft className="size-4" />
        </Button>
        <PageHeader
          className="flex-1"
          title={product.name}
          description={product.sku ?? undefined}
          actions={
            <>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/catalog/products/${product.id}/edit`}>
                  <Pencil /> Edit
                </Link>
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() =>
                  confirmDialog.confirm(async () => {
                    try {
                      // The server archives rather than deletes when the product
                      // is referenced by orders; its message says which happened.
                      const { message } = await deleteMutation.mutateAsync(product.id)
                      toast({ title: 'Product deleted', description: message })
                      navigate('/catalog/products')
                    } catch (err) {
                      toast({ title: 'Could not delete product', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
                    }
                  })
                }
              >
                <Trash2 /> Delete
              </Button>
            </>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Images</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {images.length === 0 && <span className="text-sm text-muted-foreground">No images added.</span>}
              {images.map((img) => (
                <div key={img.id ?? img.url} className="relative">
                  <img src={img.url} alt={img.altText ?? ''} className="size-24 rounded-md border border-border object-cover" />
                  {img.isPrimary && (
                    <Badge variant="default" className="absolute -top-1.5 -right-1.5">
                      Primary
                    </Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {product.shortDescription && <p className="text-sm font-medium text-foreground">{product.shortDescription}</p>}
              <p className="text-sm text-foreground">{product.description}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Attributes</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5">
              {attributes.length === 0 ? (
                <span className="text-sm text-muted-foreground">No attributes added.</span>
              ) : (
                attributes.map((a) => (
                  <Badge key={a.id ?? a.name} variant="outline">
                    {a.name}: {a.value}
                  </Badge>
                ))
              )}
            </CardContent>
          </Card>

          {product.type === 'VARIABLE' && (
            <Card>
              <CardHeader>
                <CardTitle>Variants</CardTitle>
              </CardHeader>
              <CardContent>
                {variants.length === 0 ? (
                  <span className="text-sm text-muted-foreground">No variants added.</span>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Attributes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {variants.map((v) => (
                        <TableRow key={v.id ?? v.sku}>
                          <TableCell>{v.name}</TableCell>
                          <TableCell>{v.sku}</TableCell>
                          <TableCell>{v.price === undefined ? '—' : formatCurrency(Number(v.price))}</TableCell>
                          <TableCell>{v.stockQuantity ?? 0}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(v.attributes ?? {}).map(([name, value]) => (
                                <Badge key={name} variant="outline">
                                  {name}: {value}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5 text-sm">
              <Row label="Status" value={<Badge variant={STATUS_VARIANT[product.status]}>{STATUS_LABEL[product.status]}</Badge>} />
              <Row label="Type" value={TYPE_LABEL[product.type]} />
              {product.isFeatured && <Row label="Featured" value={<Badge variant="info">Featured</Badge>} />}
              <Row label="Category" value={product.category?.name ?? '—'} />
              <Row label="Brand" value={product.brand?.name ?? '—'} />
              <Row label="Price" value={formatCurrency(Number(product.price))} />
              {product.compareAtPrice && <Row label="Compare-at price" value={formatCurrency(Number(product.compareAtPrice))} />}
              <Row label="Stock" value={<Badge variant={STOCK_VARIANT[product.stockStatus]}>{STOCK_LABEL[product.stockStatus]}</Badge>} />
              <Row label="Quantity" value={String(product.stockQuantity)} />
              <Row label="Low stock threshold" value={String(product.lowStockThreshold)} />
              <Row label="Updated" value={formatDateTime(product.updatedAt)} />
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={confirmDialog.setOpen}
        title="Delete this product?"
        description="This cannot be undone."
        confirmLabel="Delete"
        loading={confirmDialog.pending}
        onConfirm={confirmDialog.handleConfirm}
      />
    </div>
  )
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}

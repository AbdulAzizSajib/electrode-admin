import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Pencil, Trash2, ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/use-toast'
import { useBreadcrumbLabel } from '@/components/layout/breadcrumb-context'
import { useDeleteProduct, useProduct } from '@/lib/api/products'
import { formatCurrency, formatDateTime } from '@/lib/utils/format'

const STOCK_VARIANT = { in_stock: 'success', low_stock: 'warning', out_of_stock: 'destructive' } as const
const STOCK_LABEL = { in_stock: 'In stock', low_stock: 'Low stock', out_of_stock: 'Out of stock' } as const

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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="size-7" onClick={() => navigate('/catalog/products')}>
          <ArrowLeft className="size-4" />
        </Button>
        <PageHeader
          className="flex-1"
          title={product.name}
          description={product.sku}
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
                      await deleteMutation.mutateAsync(product.id)
                      toast({ title: 'Product deleted' })
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
              {product.images.map((src) => (
                <img key={src} src={src} alt="" className="size-24 rounded-md border border-border object-cover" />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground">{product.description}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Categories</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5">
              {product.categoryNames.length === 0 ? (
                <span className="text-sm text-muted-foreground">No categories assigned.</span>
              ) : (
                product.categoryNames.map((name) => <Badge key={name} variant="outline">{name}</Badge>)
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5 text-sm">
              <Row label="Status" value={<Badge variant={product.isPublished ? 'success' : 'secondary'}>{product.isPublished ? 'Published' : 'Draft'}</Badge>} />
              <Row label="Brand" value={product.brandName} />
              <Row label="Price" value={formatCurrency(product.price)} />
              {product.compareAtPrice && <Row label="Compare-at price" value={formatCurrency(product.compareAtPrice)} />}
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

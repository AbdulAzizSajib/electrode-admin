import { Link } from 'react-router'
import { FileQuestion } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'

export default function NotFoundPage() {
  return (
    <div className="flex h-full items-center justify-center py-16">
      <EmptyState
        icon={FileQuestion}
        title="Page not found"
        description="The page you're looking for doesn't exist or has moved."
        action={
          <Button asChild size="sm" className="mt-1">
            <Link to="/dashboard">Back to Dashboard</Link>
          </Button>
        }
      />
    </div>
  )
}

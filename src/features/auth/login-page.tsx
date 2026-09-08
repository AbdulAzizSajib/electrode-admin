import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import { Link, useLocation, useNavigate } from 'react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useSessionStore } from '@/lib/store/session-store'
import { ApiError } from '@/lib/api/client'
import { toast } from '@/components/ui/use-toast'
import { usePublicBranding } from '@/lib/api/public-settings'

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  const login = useSessionStore((s) => s.login)
  const navigate = useNavigate()
  const location = useLocation()

  /*
   * Shares the cached read the surrounding `AuthLayout` already made — same
   * query key, so this is not a second request. Used only for copy: the form
   * never waits on it, and every value below falls back. See
   * `lib/api/public-settings.ts`.
   */
  const { data: branding } = usePublicBranding()
  const storeName = branding?.storeName?.trim()

  /*
   * The store's own contact address as the placeholder when there is one — it
   * is very often the address the owner actually signs in with, and it beats a
   * fictional "you@store.com" as a hint about the expected format.
   */
  const emailPlaceholder = branding?.contact?.email?.trim() || 'you@store.com'

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const loginMutation = useMutation({
    mutationFn: (values: LoginValues) => login(values.email, values.password),
    onSuccess: () => {
      toast({ title: 'Welcome back', description: 'Signed in successfully.' })
      const from = (location.state as { from?: string } | null)?.from
      navigate(from ?? '/dashboard', { replace: true })
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : 'Check your credentials and try again.'
      toast({ variant: 'destructive', title: 'Sign in failed', description: message })
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          {storeName
            ? `Sign in to manage ${storeName}.`
            : 'Sign in with your administrator account.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => loginMutation.mutate(values))} className="flex flex-col gap-3.5">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder={emailPlaceholder} autoComplete="username" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="mt-1" loading={loginMutation.isPending}>
              Sign in
            </Button>
          </form>
        </Form>
        <div className="mt-4 text-center text-xs text-muted-foreground">
          <Link to="/forgot-password" className="hover:text-foreground hover:underline">
            Forgot your password?
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

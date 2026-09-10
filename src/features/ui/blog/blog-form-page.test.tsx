import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/**
 * The blog half of the slug rule the content pages share: the address follows
 * the title only until the merchant takes it over, and never re-derives on a
 * post that has already been shared.
 *
 * The server's slug clash is asserted too. It used to be a `validateStatus` /
 * `help` pair on the antd item and is now `form.setError`, which is the same
 * decision — a conflict is about one field and has one fix, so reporting it only
 * in the banner above the form leaves the merchant to work out which input it
 * meant.
 *
 * See openspec/changes/remove-antd-from-admin, task 3.6.
 */

interface Stub {
  postId?: string
  post?: Record<string, unknown>
}

const stub = vi.hoisted(() => ({ postId: undefined, post: undefined }) as Stub)
const navigate = vi.hoisted(() => vi.fn())
const createMutate = vi.hoisted(() => vi.fn())
const updateMutate = vi.hoisted(() => vi.fn())

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router')
  return { ...actual, useNavigate: () => navigate, useParams: () => ({ postId: stub.postId }) }
})

vi.mock('@/lib/api/blog-posts', () => ({
  BLOG_MEDIA_TYPES: ['NONE', 'IMAGE', 'VIDEO'],
  BLOG_POST_STATUSES: ['DRAFT', 'PUBLISHED'],
  useBlogPost: () => ({ data: stub.post, isLoading: false, error: undefined }),
  useCreateBlogPost: () => ({ mutateAsync: createMutate, isPending: false }),
  useUpdateBlogPost: () => ({ mutateAsync: updateMutate, isPending: false }),
}))
vi.mock('@/features/ui/blog/blog-list-page', () => ({ BLOG_PATH: '/ui/blog' }))
// Reached through the media field, which no test here uploads with.
vi.mock('@/lib/api/uploads', () => ({
  useUploadImage: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUploadVideo: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }))

/**
 * Tiptap in jsdom is slow and contributes nothing here: the page only ever sees
 * this control's `value`/`onChange`, so a textarea exercises the same contract.
 */
vi.mock('@/components/forms/rich-text-editor', () => ({
  RichTextEditor: ({
    value,
    onChange,
    ...rest
  }: {
    value?: string
    onChange?: (html: string) => void
  } & Record<string, unknown>) => {
    const { minHeight, allowImages, ...domProps } = rest
    void minHeight
    void allowImages
    return (
      <textarea value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} {...domProps} />
    )
  },
}))

import BlogFormPage from '@/features/ui/blog/blog-form-page'

const POST = {
  id: 'post-1',
  title: 'Smart Home on a Budget',
  slug: 'smart-home-on-a-budget',
  excerpt: 'Cheap ways to automate a first room.',
  body: '<p>Start with a plug.</p>',
  mediaType: 'NONE',
  imageUrl: null,
  videoUrl: null,
  videoThumbnailUrl: null,
  publishedAt: '2026-01-01T00:00:00.000Z',
  metaTitle: null,
  metaDescription: null,
  status: 'PUBLISHED',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const title = () => screen.getByLabelText('Title') as HTMLInputElement
const slug = () => screen.getByLabelText('Address') as HTMLInputElement

/**
 * What the address field itself is saying, read through the association the
 * merchant's screen reader would use. The banner above the form carries the same
 * words on a refused save, so matching on the text alone would pass even if the
 * field said nothing — which is the regression this asserts against.
 */
const slugMessage = () =>
  (slug().getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent)
    .filter(Boolean)
    .join(' ')

/** Everything a save needs beyond the address. */
const fillRequired = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText('Excerpt'), 'A summary.')
  await user.type(screen.getByLabelText('Content'), '<p>Words.</p>')
}

beforeEach(() => {
  stub.postId = undefined
  stub.post = undefined
  navigate.mockReset()
  createMutate.mockReset()
  updateMutate.mockReset()
  createMutate.mockResolvedValue({ id: 'post-1' })
})

describe('BlogFormPage — the slug follows the title until it does not', () => {
  it('derives the address from the title on a new post', async () => {
    const user = userEvent.setup()
    render(<BlogFormPage />)

    await user.type(title(), 'Smart Home on a Budget')

    expect(slug().value).toBe('smart-home-on-a-budget')
  })

  it('stops deriving the moment the merchant edits the address themselves', async () => {
    const user = userEvent.setup()
    render(<BlogFormPage />)

    await user.type(title(), 'Smart Home')
    expect(slug().value).toBe('smart-home')

    await user.clear(slug())
    await user.type(slug(), 'budget-smart-home')

    await user.type(title(), ' on a Budget')

    expect(title().value).toBe('Smart Home on a Budget')
    expect(slug().value).toBe('budget-smart-home')
  })

  it('never re-derives the address of a post that already has one', async () => {
    const user = userEvent.setup()
    stub.postId = 'post-1'
    stub.post = POST
    render(<BlogFormPage />)

    expect(slug().value).toBe('smart-home-on-a-budget')

    await user.clear(title())
    await user.type(title(), 'A Budget Smart Home')

    expect(slug().value).toBe('smart-home-on-a-budget')
  })

  it('refuses an address that is not a slug', async () => {
    const user = userEvent.setup()
    render(<BlogFormPage />)

    await user.type(title(), 'Smart Home')
    await fillRequired(user)
    await user.clear(slug())
    await user.type(slug(), 'Smart Home')

    await user.click(screen.getByRole('button', { name: 'Save and return' }))

    expect(await screen.findByText('Use lowercase words separated by single hyphens')).toBeTruthy()
    expect(createMutate).not.toHaveBeenCalled()
  })

  it("puts the server's slug clash on the address field, not only above the form", async () => {
    const user = userEvent.setup()
    createMutate.mockRejectedValue(new Error('This slug is already taken'))
    render(<BlogFormPage />)

    await user.type(title(), 'Smart Home')
    await fillRequired(user)

    await user.click(screen.getByRole('button', { name: 'Save and return' }))

    await waitFor(() => expect(slugMessage()).toContain('This slug is already taken'))
    // And the post that was refused is still on the page, entire.
    expect(title().value).toBe('Smart Home')
    expect(slug().value).toBe('smart-home')
  })
})

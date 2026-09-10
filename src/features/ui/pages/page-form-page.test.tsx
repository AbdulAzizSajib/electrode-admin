import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/**
 * The address a content page is reached at, and the one rule about it that is
 * easy to lose in a form-library rewrite: it follows the title only until the
 * merchant takes it over.
 *
 * Getting this wrong is silent and destructive in one direction — an edit that
 * quietly re-derives the slug changes a live URL other sites already link to —
 * so the "stops following" half matters more than the "follows" half.
 *
 * The reserved-slug refusal is here too because it moved from an antd
 * `validator` to a zod `superRefine` closing over server data, which is the
 * kind of wiring that compiles perfectly while never running.
 *
 * See openspec/changes/remove-antd-from-admin, task 3.6.
 */

interface Stub {
  pageId?: string
  page?: Record<string, unknown>
  reservedSlugs: string[]
}

const stub = vi.hoisted(() => ({ pageId: undefined, page: undefined, reservedSlugs: [] }) as Stub)
const navigate = vi.hoisted(() => vi.fn())
const createMutate = vi.hoisted(() => vi.fn())
const updateMutate = vi.hoisted(() => vi.fn())

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router')
  return { ...actual, useNavigate: () => navigate, useParams: () => ({ pageId: stub.pageId }) }
})

vi.mock('@/lib/api/pages', () => ({
  PAGE_STATUSES: ['DRAFT', 'PUBLISHED'],
  usePage: () => ({ data: stub.page, isLoading: false, error: undefined }),
  useCreatePage: () => ({ mutateAsync: createMutate, isPending: false }),
  useUpdatePage: () => ({ mutateAsync: updateMutate, isPending: false }),
  useReservedSlugs: () => ({ data: stub.reservedSlugs }),
}))
vi.mock('@/features/ui/pages/pages-list-page', () => ({ PAGES_PATH: '/ui/pages' }))
vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }))

/**
 * Tiptap in jsdom is slow and contributes nothing here: the page only ever sees
 * this control's `value`/`onChange`, so a textarea exercises the same contract.
 */
vi.mock('@/components/forms/rich-text-editor', () => ({
  // `rest` matters: `FormControl` clones its child with the id the `FormLabel`
  // points at, so a mock that drops it leaves the field with no accessible name.
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

import PageFormPage from '@/features/ui/pages/page-form-page'

const PAGE = {
  id: 'page-1',
  title: 'Refund Policy',
  slug: 'refund-policy',
  body: '<p>How refunds work.</p>',
  metaTitle: null,
  metaDescription: null,
  status: 'PUBLISHED',
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const title = () => screen.getByLabelText('Title') as HTMLInputElement
const slug = () => screen.getByLabelText('Address') as HTMLInputElement

beforeEach(() => {
  stub.pageId = undefined
  stub.page = undefined
  stub.reservedSlugs = []
  navigate.mockReset()
  createMutate.mockReset()
  updateMutate.mockReset()
  createMutate.mockResolvedValue({ id: 'page-1' })
})

describe('PageFormPage — the slug follows the title until it does not', () => {
  it('derives the address from the title on a new page', async () => {
    const user = userEvent.setup()
    render(<PageFormPage />)

    await user.type(title(), 'Refund Policy')

    expect(slug().value).toBe('refund-policy')
  })

  it('stops deriving the moment the merchant edits the address themselves', async () => {
    const user = userEvent.setup()
    render(<PageFormPage />)

    await user.type(title(), 'Refund Policy')
    expect(slug().value).toBe('refund-policy')

    await user.clear(slug())
    await user.type(slug(), 'refunds')

    // More title. The address the merchant chose survives it.
    await user.type(title(), ' And Returns')

    expect(title().value).toBe('Refund Policy And Returns')
    expect(slug().value).toBe('refunds')
  })

  it('never re-derives the address of a page that already has one', async () => {
    const user = userEvent.setup()
    stub.pageId = 'page-1'
    stub.page = PAGE
    render(<PageFormPage />)

    expect(slug().value).toBe('refund-policy')

    // Retitling an existing page must not move its URL — other sites link to it.
    await user.clear(title())
    await user.type(title(), 'Returns And Refunds')

    expect(slug().value).toBe('refund-policy')
  })

  it('refuses an address the storefront has already claimed', async () => {
    const user = userEvent.setup()
    stub.reservedSlugs = ['cart']
    render(<PageFormPage />)

    await user.type(title(), 'Cart')
    await user.type(screen.getByLabelText('Content'), '<p>Anything.</p>')
    expect(slug().value).toBe('cart')

    await user.click(screen.getByRole('button', { name: 'Save and return' }))

    expect(
      await screen.findByText('"/cart" is reserved by the storefront — pick another address'),
    ).toBeTruthy()
    expect(createMutate).not.toHaveBeenCalled()
    // Nothing the merchant typed is taken away by the refusal.
    expect(title().value).toBe('Cart')
  })

  it('refuses an address that is not a slug', async () => {
    const user = userEvent.setup()
    render(<PageFormPage />)

    await user.type(title(), 'Refund Policy')
    await user.type(screen.getByLabelText('Content'), '<p>Anything.</p>')
    await user.clear(slug())
    await user.type(slug(), 'Refund Policy')

    await user.click(screen.getByRole('button', { name: 'Save and return' }))

    expect(
      await screen.findByText('Use lowercase words separated by single hyphens'),
    ).toBeTruthy()
    expect(createMutate).not.toHaveBeenCalled()
  })
})

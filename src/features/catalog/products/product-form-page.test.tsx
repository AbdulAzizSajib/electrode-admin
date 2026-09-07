import { describe, expect, it, vi, beforeEach } from 'vitest'

/*
 * This page is seven cards and a media sidebar; filling it takes dozens of
 * user-event interactions, several of which open a popover. That comfortably
 * exceeds vitest's 5s default once the suite runs in parallel — these tests pass
 * in isolation and time out alongside everything else, which is a scheduling
 * artifact rather than a failure.
 */
vi.setConfig({ testTimeout: 20_000 })
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/**
 * The guarantees `specs/catalog-management` makes about the product authoring
 * page, asserted against the real page.
 *
 * The page had no test at all before `migrate-product-form-to-shadcn`, and its
 * contract for that change is "behaviour is unchanged" — so these are what make
 * that claim checkable rather than merely stated. The four destructive-save
 * guards come first, because each one fails silently and permanently: the
 * merchant sees a save that worked, and the data is gone.
 *
 * Everything below the page is stubbed — the API hooks, the router, the rich
 * text editor. What is being tested is the page's own decisions (what it
 * submits, what it refuses, where it navigates), not Tiptap's rendering or
 * react-query's caching.
 */

// ---------------------------------------------------------------------------
// Controllable stubs
// ---------------------------------------------------------------------------

interface Stub {
  productId?: string
  product?: Record<string, unknown>
  loadingProduct: boolean
  loadError?: unknown
  brandsError: boolean
  taxRulesError: boolean
  createResult: { id: string }
  createRejects?: Error
  updateRejects?: Error
}

const stub = vi.hoisted(
  () =>
    ({
      productId: undefined,
      product: undefined,
      loadingProduct: false,
      loadError: undefined,
      brandsError: false,
      taxRulesError: false,
      createResult: { id: 'created-1' },
      createRejects: undefined,
      updateRejects: undefined,
    }) as Stub,
)

const navigate = vi.hoisted(() => vi.fn())
const createMutate = vi.hoisted(() => vi.fn())
const updateMutate = vi.hoisted(() => vi.fn())
const createBrandMutate = vi.hoisted(() => vi.fn())

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router')
  return { ...actual, useNavigate: () => navigate, useParams: () => ({ productId: stub.productId }) }
})

vi.mock('@/lib/api/products', () => ({
  useProduct: () => ({
    data: stub.product,
    isLoading: stub.loadingProduct,
    error: stub.loadError,
  }),
  useCreateProduct: () => ({ mutateAsync: createMutate, isPending: false }),
  useUpdateProduct: () => ({ mutateAsync: updateMutate, isPending: false }),
}))

vi.mock('@/lib/api/categories', () => ({
  useCategoryTree: () => ({
    data: [{ id: 'cat-1', name: 'Chargers', parentId: null, sortOrder: 0, children: [] }],
    isLoading: false,
    isError: false,
  }),
  useCreateCategory: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/lib/api/brands', () => ({
  useBrands: () => ({
    data: { data: [{ id: 'brand-1', name: 'Anker' }] },
    isLoading: false,
    isError: stub.brandsError,
  }),
  // The quick-create bodies each pull their resource's create hook, so every
  // mocked API module below owes one — a module mock replaces the whole module.
  useCreateBrand: () => ({ mutateAsync: createBrandMutate, isPending: false }),
}))
vi.mock('@/lib/api/attributes', () => ({
  useAllAttributes: () => ({ data: [], isLoading: false, isError: false }),
  useCreateAttribute: () => ({ mutateAsync: vi.fn(), isPending: false }),
  // Reached through the edit-values dialog. Stubbed even though no test here
  // opens it: the module factory replaces the whole module, so a hook it omits
  // is `undefined` at import time and the page fails to render at all.
  useUpdateAttribute: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateAttributeValue: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateAttributeValue: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteAttributeValue: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/lib/api/tax-rules', () => ({
  useAllTaxRules: () => ({
    data: [{ id: 'tax-1', name: 'Standard', type: 'PERCENT', value: 15 }],
    isLoading: false,
    isError: stub.taxRulesError,
  }),
  useCreateTaxRule: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/lib/api/collections', () => ({
  useAllCollections: () => ({ data: [], isLoading: false, isError: false }),
  useCreateCollection: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/lib/api/bundle-deals', () => ({
  useAllBundleDeals: () => ({ data: [], isLoading: false, isError: false }),
  useCreateBundleDeal: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/lib/api/uploads', () => ({ useUploadVideo: () => ({ mutateAsync: vi.fn(), isPending: false }) }))
vi.mock('@/lib/api/tags', () => ({ useTagSuggestions: () => ({ data: [], isFetching: false }) }))
vi.mock('@/components/layout/breadcrumb-context', () => ({ useBreadcrumbLabel: () => {} }))
vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }))

/**
 * Tiptap in jsdom is slow and contributes nothing here: the page only ever sees
 * this control's `value`/`onChange`, so a textarea exercises the same contract.
 */
vi.mock('@/components/forms/rich-text-editor', () => ({
  // `rest` matters: `FormControl` clones its child with the id the `FormLabel`
  // points at, so a mock that drops it leaves the field with no accessible name
  // and `getByLabelText('Description')` finds nothing.
  RichTextEditor: ({
    value,
    onChange,
    ...rest
  }: {
    value?: string
    onChange?: (html: string) => void
  } & Record<string, unknown>) => {
    // `minHeight` and `allowImages` are the editor's own props and are not valid
    // DOM attributes; everything else is what `FormControl` injected.
    const { minHeight, allowImages, ...domProps } = rest
    void minHeight
    void allowImages
    return (
      <textarea value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} {...domProps} />
    )
  },
}))

import ProductFormPage from '@/features/catalog/products/product-form-page'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PRODUCT = {
  id: 'p-1',
  updatedAt: '2026-01-01T00:00:00Z',
  name: 'Fast Charger',
  sku: 'fast-charger',
  shortDescription: '',
  description: 'A charger',
  type: 'SIMPLE',
  status: 'ACTIVE',
  categoryId: 'cat-1',
  brandId: 'brand-1',
  offerPrice: '120',
  sellingPrice: '150',
  purchasePrice: '90',
  lowStockThreshold: 5,
  isFeatured: false,
  taxRuleId: 'tax-1',
  bundleDealId: null,
  collections: [],
  tags: [],
  unit: '',
  badge: '',
  isRefundable: null,
  hasWarranty: null,
  attributes: [],
  images: [] as Record<string, unknown>[],
  variants: [] as Record<string, unknown>[],
  video: null,
  videoThumbnail: null,
  stockQuantity: 12,
}

const withImages = () => ({
  ...PRODUCT,
  images: [
    { id: 'img-1', url: 'https://a.png', altText: 'A', isPrimary: false, variantId: null },
    { id: 'img-2', url: 'https://b.png', altText: 'B', isPrimary: false, variantId: null },
  ],
})

/** The `ProductInput` handed to the mutation on the most recent save. */
const lastCreateInput = () => createMutate.mock.calls.at(-1)?.[0]
const lastUpdateInput = () => updateMutate.mock.calls.at(-1)?.[0]

const saveAndContinue = () => screen.getByRole('button', { name: /and continue editing$/ })
const saveAndReturn = () => screen.getByRole('button', { name: /and return$/ })

beforeEach(() => {
  vi.clearAllMocks()
  // jsdom has no layout, so it does not implement this at all. The page calls it
  // to bring a rejected field into view.
  Element.prototype.scrollIntoView = vi.fn()
  stub.productId = undefined
  stub.product = undefined
  stub.loadingProduct = false
  stub.loadError = undefined
  stub.brandsError = false
  stub.taxRulesError = false
  stub.createRejects = undefined
  stub.updateRejects = undefined
  createMutate.mockImplementation(async () => {
    if (stub.createRejects) throw stub.createRejects
    return stub.createResult
  })
  updateMutate.mockImplementation(async () => {
    if (stub.updateRejects) throw stub.updateRejects
    return { id: 'p-1' }
  })
  createBrandMutate.mockImplementation(async () => ({ id: 'brand-2', name: 'Nike' }))
})

/** Fills everything a create needs, so a save gets past validation. */
async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Name'), 'Fast Charger')
  await user.type(screen.getByLabelText('Description'), 'A charger')
  await user.click(screen.getByRole('combobox', { name: 'Category' }))
  await user.click(await screen.findByRole('option', { name: 'Chargers' }))
  await user.click(screen.getByRole('combobox', { name: 'Brand' }))
  await user.click(await screen.findByRole('option', { name: 'Anker' }))
  await user.click(screen.getByRole('combobox', { name: 'Tax rule' }))
  await user.click(await screen.findByRole('option', { name: /Standard/ }))
}

// ---------------------------------------------------------------------------

describe('ProductFormPage', () => {
  describe('the destructive-save guards', () => {
    it('loads the gallery from a warm cache, and resubmits its images', async () => {
      /*
       * The regression this exists for: `product` is already non-undefined on
       * the FIRST render when the detail query is warm — arriving from the
       * products list, or back here after a save invalidated it. Seeding
       * `syncedProductKey` from it marks the product as synced before anything
       * has been read out of it, so the gallery loads empty and the next save
       * sends `images: []` over a product that has two.
       */
      stub.productId = 'p-1'
      stub.product = withImages()
      const user = userEvent.setup()
      render(<ProductFormPage />)

      // The gallery is populated, not empty.
      expect((screen.getByLabelText('Image 1 address') as HTMLInputElement).value).toBe('https://a.png')
      expect((screen.getByLabelText('Image 2 address') as HTMLInputElement).value).toBe('https://b.png')

      await user.click(saveAndContinue())

      await waitFor(() => expect(updateMutate).toHaveBeenCalled())
      const images = lastUpdateInput().input.images
      expect(images).toHaveLength(2)
      expect(images.map((i: { url: string }) => i.url)).toEqual(['https://a.png', 'https://b.png'])
    })

    it('refuses a save that would delete images the form never loaded', async () => {
      /*
       * A genuine load failure: the product on record has two images, but the
       * gallery arrived empty and nobody touched it. Simulated by handing the
       * form a product whose `images` the response omitted — the shape a
       * partial/failed detail load produces — while the record still has them.
       */
      stub.productId = 'p-1'
      stub.product = { ...withImages(), images: [] }
      const user = userEvent.setup()
      const { rerender } = render(<ProductFormPage />)

      // Nothing loaded, so there is no remove control to click.
      expect(screen.queryByLabelText('Image 1 address')).toBeNull()

      /*
       * The record turns out to have images after all — same `updatedAt`, so the
       * sync block does not re-run and the gallery stays empty. That divergence
       * is precisely the load failure the guard exists to catch.
       */
      stub.product = withImages()
      rerender(<ProductFormPage />)

      await user.click(saveAndContinue())

      await waitFor(() =>
        expect(screen.getByRole('alert').textContent).toContain('saving would delete them'),
      )
      expect(updateMutate).not.toHaveBeenCalled()
    })

    it('saves an emptied gallery when the merchant removed every image', async () => {
      /*
       * The counterpart to the guard above, and the reason it needs to tell
       * intent from failure: removing the last image must be possible. This
       * used to be refused, which left no way to delete a product's final
       * image at all — the save that would have emptied `product.images` was
       * the very thing being blocked.
       */
      stub.productId = 'p-1'
      stub.product = withImages()
      const user = userEvent.setup()
      render(<ProductFormPage />)

      await user.click(screen.getAllByRole('button', { name: 'Remove image' })[0])
      await user.click(screen.getAllByRole('button', { name: 'Remove image' })[0])

      await user.click(saveAndContinue())

      await waitFor(() => expect(updateMutate).toHaveBeenCalled())
      expect(lastUpdateInput().input.images).toEqual([])
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('never falls through to an empty form when the product will not load', () => {
      stub.productId = 'p-1'
      stub.loadError = new Error('Network unreachable')
      render(<ProductFormPage />)

      expect(screen.getByRole('alert').textContent).toContain('Network unreachable')
      expect(screen.queryByLabelText('Name')).toBeNull()
      expect(screen.queryByRole('button', { name: /and return$/ })).toBeNull()
      expect(screen.getByRole('button', { name: /Back to products/ })).not.toBeNull()
    })

    it('sends a cleared optional price as unset, not as zero', async () => {
      /*
       * antd's `InputNumber` returned `null` for an emptied field; a native
       * number input returns `''`, and `Number('')` is 0. Unguarded, clearing
       * "Regular price" saves the product as "on offer, regular price zero".
       */
      stub.productId = 'p-1'
      stub.product = { ...PRODUCT }
      const user = userEvent.setup()
      render(<ProductFormPage />)

      await user.clear(screen.getByLabelText('Regular price'))
      await user.clear(screen.getByLabelText('Purchase price'))
      await user.click(saveAndContinue())

      await waitFor(() => expect(updateMutate).toHaveBeenCalled())
      const input = lastUpdateInput().input
      expect(input.sellingPrice).toBeUndefined()
      expect(input.purchasePrice).toBeUndefined()
      // The required one is untouched.
      expect(input.offerPrice).toBe(120)
    })
  })

  describe('reporting a refused save', () => {
    it('surfaces a validation failure on a control that cannot take focus', async () => {
      /*
       * Description is a `RichTextEditor` — a custom control with no focusable
       * ref, so react-hook-form's own `shouldFocusError` cannot reach it. Left
       * to that alone the header button looks frozen, which is the exact bug the
       * page's validation reporting was written to fix.
       */
      const scrollIntoView = vi.fn()
      Element.prototype.scrollIntoView = scrollIntoView

      const user = userEvent.setup()
      render(<ProductFormPage />)

      await user.type(screen.getByLabelText('Name'), 'Fast Charger')
      await user.click(screen.getByRole('combobox', { name: 'Category' }))
      await user.click(await screen.findByRole('option', { name: 'Chargers' }))
      await user.click(screen.getByRole('combobox', { name: 'Brand' }))
      await user.click(await screen.findByRole('option', { name: 'Anker' }))
      await user.click(screen.getByRole('combobox', { name: 'Tax rule' }))
      await user.click(await screen.findByRole('option', { name: /Standard/ }))

      await user.click(saveAndContinue())

      await waitFor(() =>
        expect(screen.getByRole('alert').textContent).toContain('Description is required'),
      )
      expect(screen.getByRole('alert').textContent).toContain('highlighted below')
      // Scrolled to, rather than left off-screen.
      expect(scrollIntoView).toHaveBeenCalled()
      expect(createMutate).not.toHaveBeenCalled()
    })

    it('counts the fields when more than one needs attention', async () => {
      Element.prototype.scrollIntoView = vi.fn()
      const user = userEvent.setup()
      render(<ProductFormPage />)

      await user.click(saveAndContinue())

      await waitFor(() => {
        const text = screen.getByRole('alert').textContent ?? ''
        expect(text).toMatch(/\d+ fields need attention/)
      })
    })

    it('keeps every entered value when the server refuses the save', async () => {
      stub.createRejects = new Error('A product with this code already exists')
      const user = userEvent.setup()
      render(<ProductFormPage />)

      await fillRequired(user)
      await user.type(screen.getByLabelText('Badge'), 'New')
      await user.click(saveAndReturn())

      await waitFor(() =>
        expect(screen.getByRole('alert').textContent).toContain(
          'A product with this code already exists',
        ),
      )
      // Nothing was reset, and the merchant did not leave the page.
      expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Fast Charger')
      expect((screen.getByLabelText('Badge') as HTMLInputElement).value).toBe('New')
      expect(navigate).not.toHaveBeenCalled()
    })

    it('dismisses the failure message on request', async () => {
      stub.createRejects = new Error('Nope')
      const user = userEvent.setup()
      render(<ProductFormPage />)

      await fillRequired(user)
      await user.click(saveAndContinue())

      await waitFor(() => expect(screen.getByRole('alert')).not.toBeNull())
      await user.click(screen.getByRole('button', { name: 'Dismiss' }))

      await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    })
  })

  describe('reference lists', () => {
    it('names the lists that failed to load', () => {
      stub.brandsError = true
      stub.taxRulesError = true
      render(<ProductFormPage />)

      expect(screen.getByRole('alert').textContent).toContain('Could not load brands and tax rules')
    })

    it('says nothing when every list loaded', () => {
      render(<ProductFormPage />)
      expect(screen.queryByRole('alert')).toBeNull()
    })
  })

  describe('the product code', () => {
    it('fills from the name until the merchant types their own', async () => {
      const user = userEvent.setup()
      render(<ProductFormPage />)

      await user.type(screen.getByLabelText('Name'), 'Fast Charger')
      expect((screen.getByLabelText('Product code') as HTMLInputElement).value).toBe('fast-charger')

      await user.clear(screen.getByLabelText('Product code'))
      await user.type(screen.getByLabelText('Product code'), 'my-own-code')
      await user.type(screen.getByLabelText('Name'), ' Pro')

      // The merchant's code wins from here on.
      expect((screen.getByLabelText('Product code') as HTMLInputElement).value).toBe('my-own-code')
    })

    it('leaves a saved code alone when editing', async () => {
      stub.productId = 'p-1'
      stub.product = { ...PRODUCT }
      const user = userEvent.setup()
      render(<ProductFormPage />)

      await user.type(screen.getByLabelText('Name'), ' Extra')

      expect((screen.getByLabelText('Product code') as HTMLInputElement).value).toBe('fast-charger')
    })

    it('refuses to rebuild the code from an empty name', async () => {
      const user = userEvent.setup()
      render(<ProductFormPage />)

      await user.click(screen.getByRole('button', { name: 'Build the product code from the name' }))

      expect((screen.getByLabelText('Product code') as HTMLInputElement).value).toBe('')
    })
  })

  describe('where a successful save lands', () => {
    it('continues as the edit form for a product just created', async () => {
      const user = userEvent.setup()
      render(<ProductFormPage />)

      await fillRequired(user)
      await user.click(saveAndContinue())

      await waitFor(() =>
        expect(navigate).toHaveBeenCalledWith('/catalog/products/created-1/edit', { replace: true }),
      )
    })

    it('returns to the list from the save-and-return control', async () => {
      const user = userEvent.setup()
      render(<ProductFormPage />)

      await fillRequired(user)
      await user.click(saveAndReturn())

      await waitFor(() => expect(navigate).toHaveBeenCalledWith('/catalog/products'))
    })

    it('sends no variants or options on a create', async () => {
      const user = userEvent.setup()
      render(<ProductFormPage />)

      await fillRequired(user)
      await user.click(saveAndContinue())

      await waitFor(() => expect(createMutate).toHaveBeenCalled())
      const input = lastCreateInput().input
      // Nothing exists to attach a variant to yet.
      expect(input.variants).toBeUndefined()
      expect(input.options).toBeUndefined()
    })
  })

  describe('the gated inventory half', () => {
    it('explains that variants and the gallery arrive after saving', () => {
      render(<ProductFormPage />)

      expect(screen.getAllByText('Available after saving')).toHaveLength(2)
    })

    it('offers them once the product exists', () => {
      stub.productId = 'p-1'
      stub.product = { ...PRODUCT }
      render(<ProductFormPage />)

      expect(screen.queryByText('Available after saving')).toBeNull()
    })

    it('shows stock read-only, with no control to change it', () => {
      stub.productId = 'p-1'
      stub.product = { ...PRODUCT }
      render(<ProductFormPage />)

      expect(screen.getByText('12')).not.toBeNull()
      expect(screen.getByText('across all warehouses')).not.toBeNull()
      expect(screen.queryByLabelText('In stock')).toBeNull()
    })
  })

  describe('exactly one primary image', () => {
    it('promotes the first image row when none is starred', async () => {
      stub.productId = 'p-1'
      stub.product = withImages()
      const user = userEvent.setup()
      render(<ProductFormPage />)

      await user.click(saveAndContinue())

      await waitFor(() => expect(updateMutate).toHaveBeenCalled())
      const images = lastUpdateInput().input.images
      expect(images.filter((i: { isPrimary: boolean }) => i.isPrimary)).toHaveLength(1)
      expect(images[0].isPrimary).toBe(true)
    })

    it('promotes a picked file when there are no image rows at all', async () => {
      stub.productId = 'p-1'
      stub.product = { ...PRODUCT, images: [] }
      const user = userEvent.setup()
      const { container } = render(<ProductFormPage />)

      // The picker is deliberately `aria-hidden` and pointer-events-none, so
      // the change is fired directly rather than clicked. `[multiple]` picks the
      // gallery's own input — the sidebar's video and poster pickers are also
      // `type="file"` and come first in the DOM.
      const picker = container.querySelector(
        'input[type="file"][multiple]',
      ) as HTMLInputElement
      fireEvent.change(picker, {
        target: { files: [new File(['x'], 'photo.png', { type: 'image/png' })] },
      })

      await user.click(saveAndContinue())

      await waitFor(() => expect(updateMutate).toHaveBeenCalled())
      const upload = lastUpdateInput().upload
      expect(upload.files).toHaveLength(1)
      expect(upload.imageSlots[0].isPrimary).toBe(true)
      expect(lastUpdateInput().input.images).toHaveLength(0)
    })
  })

  describe('the tri-state facts', () => {
    it('defaults to not stated, and sends null rather than false', async () => {
      const user = userEvent.setup()
      render(<ProductFormPage />)

      expect(
        screen.getByRole('radiogroup', { name: 'Refundable' }).querySelector('[aria-checked="true"]')
          ?.textContent,
      ).toBe('Not stated')

      await fillRequired(user)
      await user.click(saveAndContinue())

      await waitFor(() => expect(createMutate).toHaveBeenCalled())
      expect(lastCreateInput().input.isRefundable).toBeNull()
      expect(lastCreateInput().input.hasWarranty).toBeNull()
    })

    it('records an explicit No distinctly from not stated', async () => {
      const user = userEvent.setup()
      render(<ProductFormPage />)

      await fillRequired(user)
      await user.click(
        screen.getByRole('radiogroup', { name: 'Warranty' }).querySelector('[value="no"]')!,
      )
      await user.click(saveAndContinue())

      await waitFor(() => expect(createMutate).toHaveBeenCalled())
      expect(lastCreateInput().input.hasWarranty).toBe(false)
      expect(lastCreateInput().input.isRefundable).toBeNull()
    })
  })

  describe('specifications', () => {
    it('adds and removes rows, and refuses an incomplete one', async () => {
      Element.prototype.scrollIntoView = vi.fn()
      const user = userEvent.setup()
      render(<ProductFormPage />)

      await fillRequired(user)
      await user.click(screen.getByRole('button', { name: 'Add specification' }))

      await user.type(screen.getByLabelText('Specification detail'), 'Battery life')
      // Value left empty.
      await user.click(saveAndContinue())

      await waitFor(() => expect(screen.getByRole('alert')).not.toBeNull())
      expect(createMutate).not.toHaveBeenCalled()

      await user.type(screen.getByLabelText('Specification value'), '40 hours')
      await user.click(saveAndContinue())

      await waitFor(() => expect(createMutate).toHaveBeenCalled())
      expect(lastCreateInput().input.attributes).toEqual([
        { name: 'Battery life', value: '40 hours' },
      ])
    })
  })

  /**
   * `specs/catalog-management` — creating a reference record from the picker
   * that needed it. The point of the whole feature is the third assertion: a
   * merchant who searched for a brand that does not exist keeps the product
   * they were part way through writing.
   */
  describe('creating a reference record from a picker', () => {
    it('selects the brand it just created, leaving the product untouched', async () => {
      const user = userEvent.setup()
      render(<ProductFormPage />)

      await user.type(screen.getByLabelText('Name'), 'Fast Charger')

      // Search for a brand that is not there, and create it from where the
      // search failed.
      await user.click(screen.getByRole('combobox', { name: 'Brand' }))
      await user.keyboard('Nike')
      await waitFor(() => expect(screen.getByText('Nothing matches what you typed')).not.toBeNull())
      await user.click(screen.getByRole('button', { name: 'Add brand' }))

      const dialog = await screen.findByRole('dialog')
      await user.type(within(dialog).getByLabelText('Name'), 'Nike')
      await user.click(within(dialog).getByRole('button', { name: 'Create brand' }))

      await waitFor(() => expect(createBrandMutate).toHaveBeenCalledTimes(1))
      expect(createBrandMutate.mock.calls[0][0].input.name).toBe('Nike')

      // Selected by name straight away — before the brand list has refetched.
      await waitFor(() =>
        expect(screen.getByRole('combobox', { name: 'Brand' }).textContent).toContain('Nike'),
      )

      // The product is exactly as it was, and was never submitted.
      expect(screen.getByLabelText<HTMLInputElement>('Name').value).toBe('Fast Charger')
      expect(createMutate).not.toHaveBeenCalled()
      expect(updateMutate).not.toHaveBeenCalled()
    })
  })
})

import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.setConfig({ testTimeout: 20_000 })
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'

/**
 * The products-per-row choice saves with the switches beside it, as one complete block.
 *
 * The backend's `catalogConfigSchema` requires EVERY key on write, so the failure this guards is a
 * refused save: a row stored before `productGridColumns` existed seeds the draft without it, and the
 * page must fill it from the default rather than send `undefined`. The other half is that choosing a
 * column count changes that one key and leaves the merchant's switches as they were.
 *
 * See server/openspec/changes/add-product-grid-columns-setting, task 2.3.
 */

const updateMutate = vi.hoisted(() => vi.fn())
const settings = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))

vi.mock('@/lib/api/store-settings', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api/store-settings')>('@/lib/api/store-settings')
  return {
    ...actual,
    useStoreSettings: () => ({ data: settings.current, isLoading: false, error: undefined }),
    useUpdateStoreSettings: () => ({ mutateAsync: updateMutate, isPending: false }),
  }
})

import CatalogSettingsPage from './catalog-settings-page'

/** A row saved before the column count existed: five flags, one of them off. */
const LEGACY_CATALOG = {
  showWishlist: false,
  showCompare: true,
  showQuickView: true,
  openCartOnAdd: true,
  cardQuantityControl: false,
}

function renderPage() {
  render(
    <RouterProvider
      router={createMemoryRouter([{ path: '/', element: <CatalogSettingsPage /> }], {
        initialEntries: ['/'],
      })}
    />,
  )
}

const lastPayload = () => updateMutate.mock.calls.at(-1)?.[0] as { catalogConfig?: unknown }

beforeEach(() => {
  updateMutate.mockReset()
  updateMutate.mockResolvedValue({})
  settings.current = { catalogConfig: { ...LEGACY_CATALOG } }
})

describe('Catalog settings — products per row', () => {
  it('shows six as the choice for a row that predates the setting', () => {
    renderPage()
    expect(screen.getByRole('radio', { name: '6 (default)' }).getAttribute('aria-checked')).toBe('true')
  })

  it('saves the chosen count together with every flag, unchanged', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('radio', { name: '4' }))
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1))
    expect(lastPayload()).toEqual({
      catalogConfig: { ...LEGACY_CATALOG, productGridColumns: 4 },
    })
  })

  it('reads back a stored count', () => {
    settings.current = { catalogConfig: { ...LEGACY_CATALOG, productGridColumns: 5 } }
    renderPage()
    expect(screen.getByRole('radio', { name: '5' }).getAttribute('aria-checked')).toBe('true')
  })
})

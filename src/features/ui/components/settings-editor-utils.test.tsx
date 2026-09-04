import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter, RouterProvider, createBrowserRouter } from 'react-router'
import { useUnsavedChangesGuard } from './settings-editor-utils'

/**
 * `useUnsavedChangesGuard` wraps `useBlocker`, which throws outside a data
 * router. That is invisible to `tsc` and to every test that renders a page in
 * isolation, so it shipped: Header Links and Footer Links both crashed to a
 * blank screen because `main.tsx` mounted a plain `<BrowserRouter>`.
 *
 * These two cases pin down both halves — the hook needs a data router, and the
 * app must keep giving it one.
 */

function Guarded() {
  useUnsavedChangesGuard(false)
  return <p>editor mounted</p>
}

describe('useUnsavedChangesGuard', () => {
  it('renders under a data router', async () => {
    const router = createBrowserRouter([{ path: '*', element: <Guarded /> }])
    render(<RouterProvider router={router} />)

    expect(await screen.findByText('editor mounted')).toBeTruthy()
  })

  it('throws under a non-data router, which is why main.tsx must not use one', () => {
    // React logs the render error itself; silenced so a passing run stays clean.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(() =>
        render(
          <BrowserRouter>
            <Guarded />
          </BrowserRouter>,
        ),
      ).toThrow(/data router/i)
    } finally {
      spy.mockRestore()
    }
  })
})

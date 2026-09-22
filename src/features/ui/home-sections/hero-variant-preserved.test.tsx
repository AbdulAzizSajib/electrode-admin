import { describe, expect, it, vi, beforeEach } from 'vitest'

// A drag-and-drop list plus a settings draft; the default 5s is a scheduling
// artifact once the suite runs its files in parallel.
vi.setConfig({ testTimeout: 20_000 })
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'

/**
 * The hero's LAYOUT must survive a save from Home Sections.
 *
 * This page owns `homeConfig` and replaces it WHOLESALE on save, but it does
 * not edit every field in it — the hero's `variant` is chosen on Home Slider.
 * So the failure this guards is not a crash: a merchant reorders their home
 * sections here, saves, and their hero silently reverts to the default layout.
 * Nothing errors, nothing logs, and the two screens are far enough apart that
 * nobody connects them.
 *
 * It is the same hazard `reconcileHomeConfig` carries on the server, one
 * repository over, and it is invisible to a type checker because dropping an
 * optional field is legal.
 *
 * See openspec/changes/add-hero-section-variants-admin, task 5.2.
 */

const updateMutate = vi.hoisted(() => vi.fn())
const settings = vi.hoisted(
  () =>
    ({
      current: {
        homeConfig: [
          { key: 'HERO', enabled: true, variant: 'SLIDER_STACK' },
          { key: 'BRAND_BAR', enabled: true },
          { key: 'FEATURED_CATEGORIES', enabled: true },
          { key: 'BEST_SELLING', enabled: true },
          { key: 'MID_BANNERS', enabled: true },
          { key: 'FEATURED_PRODUCTS', enabled: true },
          { key: 'PERKS_BAR', enabled: true },
          { key: 'DEAL_OF_WEEK', enabled: true },
          { key: 'NEW_ARRIVALS', enabled: true },
          { key: 'TESTIMONIALS', enabled: true },
          { key: 'BLOG', enabled: true },
          { key: 'NEWSLETTER', enabled: true },
        ],
        newsletter: {
          heading: 'Join us',
          subtext: 'News and offers',
          placeholder: 'Email',
          buttonLabel: 'Subscribe',
        },
        mainNav: [],
      },
    }) as { current: Record<string, unknown> },
)

vi.mock('@/lib/api/store-settings', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api/store-settings')>('@/lib/api/store-settings')
  return {
    ...actual,
    useStoreSettings: () => ({ data: settings.current, isLoading: false, error: undefined }),
    useUpdateStoreSettings: () => ({ mutateAsync: updateMutate, isPending: false }),
  }
})
vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }))

const { default: HomeSectionsPage } = await import(
  '@/features/ui/home-sections/home-sections-page'
)

/** The HERO entry of whatever the page last sent. */
const savedHero = () => {
  const payload = updateMutate.mock.calls.at(-1)?.[0] as
    | { homeConfig?: { key: string; variant?: string }[] }
    | undefined
  return payload?.homeConfig?.find((section) => section.key === 'HERO')
}

/*
 * A DATA router, not <MemoryRouter>: the page calls `useUnsavedChangesGuard`,
 * which uses `useBlocker`, and that throws outside one.
 */
const renderPage = () =>
  render(
    <RouterProvider
      router={createMemoryRouter([{ path: '/', element: <HomeSectionsPage /> }], {
        initialEntries: ['/'],
      })}
    />,
  )

describe('the hero layout survives a save from Home Sections', () => {
  beforeEach(() => {
    updateMutate.mockReset()
    updateMutate.mockResolvedValue(undefined)
  })

  it('is sent back unchanged when an unrelated section is toggled', async () => {
    const user = userEvent.setup()
    renderPage()

    // Anything that dirties the draft and triggers a save will do; the point is
    // that the save carries a field this page never touched.
    await user.click(screen.getByLabelText('Recent blog posts'))
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(updateMutate).toHaveBeenCalled())
    expect(savedHero()).toEqual({ key: 'HERO', enabled: true, variant: 'SLIDER_STACK' })
  })

  it('is sent back unchanged when the hero itself is switched off', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByLabelText('Hero banners'))
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(updateMutate).toHaveBeenCalled())
    // Switching a section off must not discard its layout: switching it back on
    // has to restore the hero the merchant arranged, not the default.
    expect(savedHero()).toEqual({ key: 'HERO', enabled: false, variant: 'SLIDER_STACK' })
  })

  it('does not invent a layout for a store that has never chosen one', async () => {
    const user = userEvent.setup()
    const withoutVariant = (settings.current.homeConfig as { key: string }[]).map((section) =>
      section.key === 'HERO' ? { key: 'HERO', enabled: true } : section,
    )
    settings.current = { ...settings.current, homeConfig: withoutVariant }

    renderPage()
    await user.click(screen.getByLabelText('Recent blog posts'))
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(updateMutate).toHaveBeenCalled())
    // Absent stays absent — the server resolves it to the default, and writing
    // one in here would be a second representation of the same state.
    expect(savedHero()).toEqual({ key: 'HERO', enabled: true })
  })
})

describe('the hero row points at where its layout is chosen', () => {
  it('names the current layout and links to Home slider', () => {
    settings.current = {
      ...settings.current,
      homeConfig: [
        { key: 'HERO', enabled: true, variant: 'FULL_SLIDER' },
        { key: 'BRAND_BAR', enabled: true },
      ],
    }

    renderPage()

    expect(screen.getByText('Full-width slider')).toBeTruthy()

    const link = screen.getByRole('link', { name: /change on home slider/i })
    expect(link.getAttribute('href')).toBe('/ui/home-slider')
  })

  it('offers no control to change it from this page', () => {
    settings.current = {
      ...settings.current,
      homeConfig: [
        { key: 'HERO', enabled: true, variant: 'FULL_SLIDER' },
        { key: 'BRAND_BAR', enabled: true },
      ],
    }

    renderPage()

    // One place makes the choice. A second control here would mean two screens
    // writing the same field with only one able to show what it means.
    expect(screen.queryByRole('radiogroup', { name: /hero layout/i })).toBeNull()
    expect(screen.queryByRole('combobox', { name: /layout/i })).toBeNull()
  })
})

import { describe, expect, it, vi, beforeEach } from 'vitest'

// A drag-and-drop list plus a settings draft; the default 5s is a scheduling
// artifact once the suite runs its files in parallel.
vi.setConfig({ testTimeout: 20_000 })
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'

/**
 * A section's LAYOUT must survive a save from Home Sections.
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
 * The featured-categories layout IS edited on this page, and it is held to the
 * same rule from the other side: a stored choice survives every save that does
 * not touch it, and choosing one changes that one field and nothing else. One
 * guarantee, two sections, side by side.
 *
 * See openspec/changes/add-hero-section-variants-admin, task 5.2, and
 * server/openspec/changes/add-featured-categories-layout, design.md Decision 6.
 */

const updateMutate = vi.hoisted(() => vi.fn())
const settings = vi.hoisted(
  () =>
    ({
      current: {
        homeConfig: [
          { key: 'HERO', enabled: true, variant: 'SLIDER_STACK' },
          { key: 'BRAND_BAR', enabled: true },
          { key: 'FEATURED_CATEGORIES', enabled: true, variant: 'SLIDER' },
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

type SavedSection = { key: string; enabled: boolean; variant?: string }

/** The last `homeConfig` the page sent. */
const savedConfig = () => {
  const payload = updateMutate.mock.calls.at(-1)?.[0] as { homeConfig?: SavedSection[] } | undefined
  return payload?.homeConfig
}

/** One section's entry of whatever the page last sent. */
const saved = (key: string) => savedConfig()?.find((section) => section.key === key)

const BASELINE = () => settings.current.homeConfig as SavedSection[]

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
    expect(saved('HERO')).toEqual({ key: 'HERO', enabled: true, variant: 'SLIDER_STACK' })
  })

  it('is sent back unchanged when the hero itself is switched off', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByLabelText('Hero banners'))
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(updateMutate).toHaveBeenCalled())
    // Switching a section off must not discard its layout: switching it back on
    // has to restore the hero the merchant arranged, not the default.
    expect(saved('HERO')).toEqual({ key: 'HERO', enabled: false, variant: 'SLIDER_STACK' })
  })

  it('does not invent a layout for a store that has never chosen one', async () => {
    const user = userEvent.setup()
    const withoutVariant = BASELINE().map((section) =>
      section.key === 'HERO' ? { key: 'HERO', enabled: true } : section,
    )
    settings.current = { ...settings.current, homeConfig: withoutVariant }

    renderPage()
    await user.click(screen.getByLabelText('Recent blog posts'))
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(updateMutate).toHaveBeenCalled())
    // Absent stays absent — the server resolves it to the default, and writing
    // one in here would be a second representation of the same state.
    expect(saved('HERO')).toEqual({ key: 'HERO', enabled: true })
  })
})

describe('the featured categories layout survives a save from Home Sections', () => {
  beforeEach(() => {
    updateMutate.mockReset()
    updateMutate.mockResolvedValue(undefined)
    settings.current = { ...settings.current, homeConfig: BASELINE() }
  })

  it('is sent back unchanged when an unrelated section is toggled', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByLabelText('Recent blog posts'))
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(updateMutate).toHaveBeenCalled())
    expect(saved('FEATURED_CATEGORIES')).toEqual({
      key: 'FEATURED_CATEGORIES',
      enabled: true,
      variant: 'SLIDER',
    })
  })

  it('is sent back unchanged when the section itself is switched off', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByLabelText('Featured categories'))
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(updateMutate).toHaveBeenCalled())
    expect(saved('FEATURED_CATEGORIES')).toEqual({
      key: 'FEATURED_CATEGORIES',
      enabled: false,
      variant: 'SLIDER',
    })
  })

  it('does not invent a layout for a store that has never chosen one', async () => {
    const user = userEvent.setup()
    settings.current = {
      ...settings.current,
      homeConfig: BASELINE().map((section) =>
        section.key === 'FEATURED_CATEGORIES'
          ? { key: 'FEATURED_CATEGORIES', enabled: true }
          : section,
      ),
    }

    renderPage()
    await user.click(screen.getByLabelText('Recent blog posts'))
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(updateMutate).toHaveBeenCalled())
    expect(saved('FEATURED_CATEGORIES')).toEqual({ key: 'FEATURED_CATEGORIES', enabled: true })
  })
})

describe('the featured categories layout is chosen on its row', () => {
  beforeEach(() => {
    updateMutate.mockReset()
    updateMutate.mockResolvedValue(undefined)
    settings.current = {
      ...settings.current,
      homeConfig: BASELINE().map((section) =>
        section.key === 'FEATURED_CATEGORIES'
          ? { key: 'FEATURED_CATEGORIES', enabled: true }
          : section,
      ),
    }
  })

  const openPanel = async (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('button', { name: /show featured categories settings/i }))

  it('shows the default selected for a store that has never chosen one', async () => {
    const user = userEvent.setup()
    renderPage()
    await openPanel(user)

    expect(screen.getByRole('radio', { name: 'Grid' }).getAttribute('data-state')).toBe('checked')
  })

  it('writes the chosen layout on that entry and changes nothing else', async () => {
    const user = userEvent.setup()
    renderPage()
    await openPanel(user)

    await user.click(screen.getByRole('radio', { name: 'Slider' }))
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(updateMutate).toHaveBeenCalled())

    const expected = (settings.current.homeConfig as SavedSection[]).map((section) =>
      section.key === 'FEATURED_CATEGORIES' ? { ...section, variant: 'SLIDER' } : section,
    )
    // The whole list, not one entry: order, every enabled flag and the hero's
    // own layout are all exactly as they were.
    expect(savedConfig()).toEqual(expected)

    const payload = updateMutate.mock.calls.at(-1)?.[0] as Record<string, unknown>
    expect(Object.keys(payload).sort()).toEqual(['homeConfig', 'newsletter'])
  })

  it('is offered while the section is switched off, and the choice is kept', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByLabelText('Featured categories'))
    await openPanel(user)
    await user.click(screen.getByRole('radio', { name: 'Slider' }))
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(updateMutate).toHaveBeenCalled())
    expect(saved('FEATURED_CATEGORIES')).toEqual({
      key: 'FEATURED_CATEGORIES',
      enabled: false,
      variant: 'SLIDER',
    })
  })

  it('keeps the selection on screen when the save is refused', async () => {
    const user = userEvent.setup()
    updateMutate.mockRejectedValue(new Error('SLIDER is not a layout FEATURED_CATEGORIES offers.'))
    renderPage()
    await openPanel(user)

    await user.click(screen.getByRole('radio', { name: 'Slider' }))
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(updateMutate).toHaveBeenCalled())
    // A refused save leaves the draft as the merchant had it.
    expect(screen.getByRole('radio', { name: 'Slider' }).getAttribute('data-state')).toBe('checked')
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

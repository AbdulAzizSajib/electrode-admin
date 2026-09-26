import { describe, expect, it, vi, beforeEach } from 'vitest'

// A settings draft over a reorderable list; the default 5s is a scheduling
// artifact once the suite runs its files in parallel. Matches the sibling
// section-layout suite.
vi.setConfig({ testTimeout: 20_000 })
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { DEFAULT_PERKS, type Perk } from '@/lib/api/store-settings'

/**
 * The perks band's wording, edited from the Perks strip row on Home Sections.
 *
 * Three failures worth guarding, none of which a type checker can see:
 *
 *  1. A STORE THAT HAS NEVER OPENED THIS PANEL must keep its band. The admin
 *     read returns the settings row AS STORED, so `perks` is null for every
 *     shop upgraded into this feature while their home page is visibly
 *     rendering four columns. The page sends `perks` on EVERY save — including
 *     one that only reorders sections — so a draft seeded from `null` rather
 *     than from `DEFAULT_PERKS` would delete a live band the merchant never
 *     touched, silently, from a screen about something else.
 *
 *  2. A BLANK FIELD must be refused HERE. The backend requires all three on
 *     every perk and would refuse the whole save, losing an unrelated reorder
 *     made in the same visit.
 *
 *  3. THE REFUSAL MUST BE VISIBLE. These fields live in a panel that is shut by
 *     default, so a toast alone points at inputs that are not on the page.
 *
 * See server/openspec/changes/add-perks-strip-content, design.md.
 */

const updateMutate = vi.hoisted(() => vi.fn())
const settings = vi.hoisted(
  () =>
    ({
      current: {
        homeConfig: [
          { key: 'HERO', enabled: true },
          { key: 'PERKS_BAR', enabled: true },
          { key: 'BLOG', enabled: true },
          { key: 'NEWSLETTER', enabled: true },
        ],
        newsletter: { heading: 'Join us', subtext: 'News and offers' },
        // Null, which is what every store upgraded into this feature has.
        perks: null,
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
vi.mock('@/lib/api/promo-banner-groups', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api/promo-banner-groups')>(
      '@/lib/api/promo-banner-groups',
    )
  return {
    ...actual,
    usePromoBannerGroups: () => ({ data: [], isLoading: false, error: undefined }),
  }
})
vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }))

const { default: HomeSectionsPage } = await import(
  '@/features/ui/home-sections/home-sections-page'
)

/** The last `perks` list the page sent. */
const savedPerks = () =>
  (updateMutate.mock.calls.at(-1)?.[0] as { perks?: Perk[] } | undefined)?.perks

/* A DATA router: the page calls `useUnsavedChangesGuard`, which uses
   `useBlocker`, and that throws outside one. */
const renderPage = () =>
  render(
    <RouterProvider
      router={createMemoryRouter([{ path: '/', element: <HomeSectionsPage /> }], {
        initialEntries: ['/'],
      })}
    />,
  )

/*
 * Matches the disclosure in EITHER state — its label reads "Show …" when shut
 * and "Hide …" when open, so a "show"-only query cannot close it again.
 */
const togglePanel = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: /perks strip settings/i }))

const save = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: /save/i }))

describe('the perks strip editor', () => {
  beforeEach(() => {
    updateMutate.mockReset()
    updateMutate.mockResolvedValue(undefined)
    settings.current.perks = null
  })

  it('seeds an unconfigured store from the shipped defaults rather than from nothing', async () => {
    const user = userEvent.setup()
    renderPage()
    await togglePanel(user)

    expect(screen.getByDisplayValue(DEFAULT_PERKS[0].title)).toBeTruthy()
    expect(screen.getByDisplayValue(DEFAULT_PERKS[0].icon)).toBeTruthy()
  })

  it('sends the shipped defaults back untouched when the save was about something else', async () => {
    const user = userEvent.setup()
    renderPage()

    // A reorder, with the panel never opened — the exact visit that used to be
    // able to wipe the band.
    await user.click(screen.getByLabelText('Show Recent blog posts'))
    await save(user)

    await waitFor(() => expect(updateMutate).toHaveBeenCalled())
    expect(savedPerks()).toEqual(DEFAULT_PERKS)
  })

  it('sends an edited column and leaves the others alone', async () => {
    const user = userEvent.setup()
    renderPage()
    await togglePanel(user)

    const title = screen.getByLabelText('Perk 1 title')
    await user.clear(title)
    await user.type(title, 'Free delivery')
    await save(user)

    await waitFor(() => expect(updateMutate).toHaveBeenCalled())
    expect(savedPerks()).toEqual([
      { ...DEFAULT_PERKS[0], title: 'Free delivery' },
      ...DEFAULT_PERKS.slice(1),
    ])
  })

  it('adds and removes a column, and stops at the band capacity', async () => {
    settings.current.perks = [{ icon: 'lucide:truck', title: 'Delivery', description: 'Fast' }]
    const user = userEvent.setup()
    renderPage()
    await togglePanel(user)

    const add = screen.getByRole('button', { name: /add perk/i })
    await user.click(add)
    await user.click(add)
    await user.click(add)
    // Four is the whole band — a fifth would wrap the row.
    expect(add.hasAttribute('disabled')).toBe(true)

    await user.click(screen.getAllByRole('button', { name: /remove perk/i })[3])
    expect(add.hasAttribute('disabled')).toBe(false)
  })

  it('refuses a save with a blank field instead of letting the backend refuse it', async () => {
    const user = userEvent.setup()
    renderPage()
    await togglePanel(user)

    await user.clear(screen.getByLabelText('Perk 2 title'))
    await save(user)

    expect(updateMutate).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Perk 2 title').getAttribute('aria-invalid')).toBe('true')
  })

  it('says why, outside the panel, so the reason survives the panel being shut', async () => {
    const user = userEvent.setup()
    renderPage()
    await togglePanel(user)

    await user.clear(screen.getByLabelText('Perk 2 title'))
    // Shut it, exactly as a merchant tidying up before pressing Save would.
    await togglePanel(user)
    await save(user)

    expect(updateMutate).not.toHaveBeenCalled()
    expect(screen.getByText(/this save was refused/i)).toBeTruthy()
    // ...and the panel is reopened, so the offending field can be fixed.
    await waitFor(() => expect(screen.getByLabelText('Perk 2 title')).toBeTruthy())
  })

  it('stops complaining as soon as the field is filled in', async () => {
    const user = userEvent.setup()
    renderPage()
    await togglePanel(user)

    await user.clear(screen.getByLabelText('Perk 2 title'))
    await save(user)
    expect(screen.getByLabelText('Perk 2 title').getAttribute('aria-invalid')).toBe('true')

    await user.type(screen.getByLabelText('Perk 2 title'), 'Returns')
    expect(screen.getByLabelText('Perk 2 title').getAttribute('aria-invalid')).toBe('false')

    await save(user)
    await waitFor(() => expect(updateMutate).toHaveBeenCalled())
    expect(savedPerks()?.[1]).toEqual({ ...DEFAULT_PERKS[1], title: 'Returns' })
  })
})

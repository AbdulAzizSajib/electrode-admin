import { describe, expect, it, vi, beforeEach } from 'vitest'

// Six repeatable editors on one page; the default 5s is a scheduling artifact
// once the suite runs its files in parallel.
vi.setConfig({ testTimeout: 30_000 })
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/**
 * What `specs/admin-shell` promises about repeatable groups, asserted against
 * the page that has six of them.
 *
 * The delivery zones carry every part of the requirement at once: a rule that
 * belongs to the list rather than to a row, a floor on how few rows may remain,
 * and a ceiling on how many may be added. `Form.List` gave all three; zod plus
 * `useFieldArray` gives none of them by default, and the failure mode of the
 * first is silence — the save is refused and no message appears anywhere.
 *
 * See openspec/changes/remove-antd-from-admin, task 4.10.
 */

const stub = vi.hoisted(() => ({ landingPageId: undefined, page: undefined }) as {
  landingPageId?: string
  page?: Record<string, unknown>
})
const navigate = vi.hoisted(() => vi.fn())
const createMutate = vi.hoisted(() => vi.fn())
const updateMutate = vi.hoisted(() => vi.fn())

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router')
  return {
    ...actual,
    useNavigate: () => navigate,
    useParams: () => ({ landingPageId: stub.landingPageId }),
  }
})

vi.mock('@/lib/api/landing-pages', () => ({
  LANDING_PAGE_STATUSES: ['DRAFT', 'PUBLISHED'],
  MAX_DELIVERY_ZONES: 5,
  useLandingPage: () => ({ data: stub.page, isLoading: false, error: undefined }),
  useCreateLandingPage: () => ({ mutateAsync: createMutate, isPending: false }),
  useUpdateLandingPage: () => ({ mutateAsync: updateMutate, isPending: false }),
}))
vi.mock('@/lib/api/products', () => ({
  useProducts: () => ({
    data: { data: [{ id: 'p-1', name: 'Winter Hoodie', offerPrice: '1200', sellingPrice: '1800' }] },
    isLoading: false,
  }),
}))
vi.mock('@/features/ui/landing-pages/landing-pages-page', () => ({
  LANDING_PAGES_PATH: '/ui/landing-pages',
}))
// Reached through `ImageUrlField`, which no test here uploads with.
vi.mock('@/lib/api/uploads', () => ({
  useUploadImage: () => ({ mutateAsync: vi.fn(), isPending: false }),
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

import LandingPageFormPage from '@/features/ui/landing-pages/landing-page-form-page'

const zoneKeys = () =>
  (screen.getAllByLabelText('Key') as HTMLInputElement[]).map((input) => input.value)
const zoneAreas = () =>
  (screen.getAllByLabelText('Area') as HTMLInputElement[]).map((input) => input.value)
const removeButtons = () => screen.getAllByRole('button', { name: 'Remove' }) as HTMLButtonElement[]
const addZone = () => screen.getByRole('button', { name: 'Add a delivery area' }) as HTMLButtonElement

const retype = async (
  user: ReturnType<typeof userEvent.setup>,
  field: HTMLElement,
  text: string,
) => {
  await user.clear(field)
  await user.type(field, text)
}

/** Everything a create needs beyond the lists, so a save gets past validation. */
const fillRequired = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText('Campaign name'), 'Winter Offer')
  await user.type(screen.getByLabelText('Headline'), 'Premium winter hoodie')
  await user.type(screen.getByLabelText('Description'), '<p>Warm.</p>')
  await user.click(screen.getByRole('combobox', { name: 'Product' }))
  await user.click(await screen.findByRole('option', { name: 'Winter Hoodie' }))
}

const saveAndStay = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Save and continue editing' }))

beforeEach(() => {
  // Radix's Select measures and captures the pointer; jsdom implements neither.
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()

  stub.landingPageId = undefined
  stub.page = undefined
  navigate.mockReset()
  createMutate.mockReset()
  updateMutate.mockReset()
  createMutate.mockResolvedValue({ id: 'lp-1' })
})

describe('LandingPageFormPage — a rule belonging to the whole zone list', () => {
  it('refuses two areas sharing a key, against the list, and keeps both rows', async () => {
    const user = userEvent.setup()
    render(<LandingPageFormPage />)

    await fillRequired(user)
    // The two seeded zones, with the second's key changed to collide.
    await retype(user, screen.getAllByLabelText('Key')[1], 'inside-dhaka')

    await saveAndStay(user)

    // Belongs to neither row on its own, so neither row can carry it.
    expect(await screen.findByText('Each area needs its own distinct key')).toBeTruthy()
    expect(createMutate).not.toHaveBeenCalled()
    // Refused, not cleared.
    expect(zoneKeys()).toEqual(['inside-dhaka', 'inside-dhaka'])
    expect(zoneAreas()).toEqual(['ঢাকার ভিতরে', 'ঢাকার বাইরে'])
  })

  it('clears the message and saves once the keys differ again', async () => {
    const user = userEvent.setup()
    render(<LandingPageFormPage />)

    await fillRequired(user)
    await retype(user, screen.getAllByLabelText('Key')[1], 'inside-dhaka')
    await saveAndStay(user)
    await screen.findByText('Each area needs its own distinct key')

    await retype(user, screen.getAllByLabelText('Key')[1], 'outside-dhaka')
    await saveAndStay(user)

    await waitFor(() => expect(createMutate).toHaveBeenCalled())
    expect(screen.queryByText('Each area needs its own distinct key')).toBeNull()
  })

  it('still reports a key that is not a key, against the row that holds it', async () => {
    const user = userEvent.setup()
    render(<LandingPageFormPage />)

    await fillRequired(user)
    await retype(user, screen.getAllByLabelText('Key')[1], 'Outside Dhaka')

    await saveAndStay(user)

    expect(await screen.findByText('Lowercase words separated by single hyphens')).toBeTruthy()
    expect(createMutate).not.toHaveBeenCalled()
  })
})

describe('LandingPageFormPage — the zone list has a floor and a ceiling', () => {
  it('offers no removal on the last remaining area', async () => {
    const user = userEvent.setup()
    render(<LandingPageFormPage />)

    // Two to begin with, so both may be removed.
    expect(removeButtons().every((button) => !button.disabled)).toBe(true)

    await user.click(removeButtons()[1])

    // A page with no zone can charge no delivery, so the last one stays.
    expect(zoneKeys()).toEqual(['inside-dhaka'])
    expect(removeButtons()[0].disabled).toBe(true)
  })

  it('stops offering to add an area at the ceiling', async () => {
    const user = userEvent.setup()
    render(<LandingPageFormPage />)

    expect(addZone().disabled).toBe(false)
    // Five is `MAX_DELIVERY_ZONES`; two are seeded.
    for (let i = 0; i < 3; i += 1) await user.click(addZone())

    expect(zoneKeys()).toHaveLength(5)
    expect(addZone().disabled).toBe(true)
  })

  it('appends an empty area and leaves the ones above it alone', async () => {
    const user = userEvent.setup()
    render(<LandingPageFormPage />)

    await user.click(addZone())

    expect(zoneKeys()).toEqual(['inside-dhaka', 'outside-dhaka', ''])
    expect(zoneAreas()).toEqual(['ঢাকার ভিতরে', 'ঢাকার বাইরে', ''])
  })

  it('removes the middle area and leaves the ones either side of it alone', async () => {
    const user = userEvent.setup()
    render(<LandingPageFormPage />)

    await user.click(addZone())
    await retype(user, screen.getAllByLabelText('Key')[2], 'chittagong')

    await user.click(removeButtons()[1])

    expect(zoneKeys()).toEqual(['inside-dhaka', 'chittagong'])
  })
})

describe('LandingPageFormPage — the gallery is submitted in the order shown', () => {
  it('moves a row up, keeps both rows’ values, and sends the new order', async () => {
    const user = userEvent.setup()
    render(<LandingPageFormPage />)

    await fillRequired(user)

    // Two video rows, so each row's URL is a plainly labelled field.
    for (let i = 0; i < 2; i += 1) {
      await user.click(screen.getByRole('button', { name: 'Add image or video' }))
      await user.click(screen.getAllByRole('combobox', { name: 'Type' })[i])
      await user.click(await screen.findByRole('option', { name: 'Video' }))
    }
    await user.type(screen.getAllByLabelText('Video URL')[0], 'https://a.mp4')
    await user.type(screen.getAllByLabelText('Video URL')[1], 'https://b.mp4')

    await user.click(screen.getAllByRole('button', { name: 'Move up' })[1])

    // Both rows keep what was entered; only their positions swapped.
    expect(
      (screen.getAllByLabelText('Video URL') as HTMLInputElement[]).map((i) => i.value),
    ).toEqual(['https://b.mp4', 'https://a.mp4'])

    await saveAndStay(user)

    await waitFor(() => expect(createMutate).toHaveBeenCalled())
    expect(createMutate.mock.calls[0][0].media.map((m: { url: string }) => m.url)).toEqual([
      'https://b.mp4',
      'https://a.mp4',
    ])
  })

  it('gives the first row no way up and the last no way down', async () => {
    const user = userEvent.setup()
    render(<LandingPageFormPage />)

    for (let i = 0; i < 2; i += 1) {
      await user.click(screen.getByRole('button', { name: 'Add image or video' }))
    }

    const up = screen.getAllByRole('button', { name: 'Move up' }) as HTMLButtonElement[]
    const down = screen.getAllByRole('button', { name: 'Move down' }) as HTMLButtonElement[]
    // The gallery rows come before the delivery zones in the document.
    expect(up[0].disabled).toBe(true)
    expect(down[1].disabled).toBe(true)
  })

  it('switches one row between image and video without disturbing the other', async () => {
    const user = userEvent.setup()
    render(<LandingPageFormPage />)

    for (let i = 0; i < 2; i += 1) {
      await user.click(screen.getByRole('button', { name: 'Add image or video' }))
    }
    // Both start as images, so both offer alt text and neither offers a URL box.
    await user.type(screen.getAllByLabelText('Alt text')[1], 'A hoodie')

    await user.click(screen.getAllByRole('combobox', { name: 'Type' })[0])
    await user.click(await screen.findByRole('option', { name: 'Video' }))

    // Only the first row changed shape; the second still holds its alt text.
    expect(screen.getAllByLabelText('Video URL')).toHaveLength(1)
    expect((screen.getAllByLabelText('Alt text')[0] as HTMLInputElement).value).toBe('A hoodie')
  })

  it('refuses a video row with no URL, in the video’s own words', async () => {
    const user = userEvent.setup()
    render(<LandingPageFormPage />)

    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: 'Add image or video' }))
    await user.click(screen.getByRole('combobox', { name: 'Type' }))
    await user.click(await screen.findByRole('option', { name: 'Video' }))

    await saveAndStay(user)

    expect(await screen.findByText('Add the video URL')).toBeTruthy()
    expect(createMutate).not.toHaveBeenCalled()
  })
})

describe('LandingPageFormPage — a page built here reopens as it was left', () => {
  /*
   * The other direction of the migration: `toValues` is where a rewrite quietly
   * drops a field, and the loss is invisible until a merchant reopens a page and
   * finds a section empty. Everything a full page carries goes out through the
   * payload and comes back in through the record.
   *
   * Not a substitute for the pass against a real server (task 4.11) — the
   * backend's own defaulting is not exercised here — but it is what makes the
   * form's half of the round trip checkable.
   */
  it('shows every list, in order, when reopened from what it sent', async () => {
    const user = userEvent.setup()
    render(<LandingPageFormPage />)

    await fillRequired(user)

    await user.click(screen.getByRole('button', { name: 'Add image or video' }))
    await user.click(screen.getByRole('combobox', { name: 'Type' }))
    await user.click(await screen.findByRole('option', { name: 'Video' }))
    await user.type(screen.getByLabelText('Video URL'), 'https://clip.mp4')

    for (const [i, heading] of ['Free delivery', 'Cash on delivery'].entries()) {
      await user.click(screen.getByRole('button', { name: 'Add a selling point' }))
      await user.type(screen.getAllByLabelText('Heading')[i], heading)
    }

    await user.click(screen.getByRole('button', { name: 'Add a question' }))
    await user.type(screen.getByLabelText('Question'), 'Can I exchange?')
    await user.type(screen.getByLabelText('Answer'), 'Within 7 days.')

    await retype(user, screen.getAllByLabelText('Delivery charge')[1], '150')

    await saveAndStay(user)
    await waitFor(() => expect(createMutate).toHaveBeenCalled())
    const sent = createMutate.mock.calls[0][0]

    // Reopen it: the record the server would hand back is what was sent, plus
    // the columns it fills in itself.
    cleanup()
    stub.landingPageId = 'lp-1'
    stub.page = {
      ...sent,
      id: 'lp-1',
      slug: 'winter-offer',
      subheadline: null,
      badgeText: null,
      successHeading: null,
      successMessage: null,
      metaTitle: null,
      metaDescription: null,
      ogImageUrl: null,
      facebookPixelId: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }
    render(<LandingPageFormPage />)

    await waitFor(() =>
      expect((screen.getByLabelText('Campaign name') as HTMLInputElement).value).toBe(
        'Winter Offer',
      ),
    )
    expect((screen.getByLabelText('Headline') as HTMLInputElement).value).toBe(
      'Premium winter hoodie',
    )
    expect((screen.getByLabelText('Video URL') as HTMLInputElement).value).toBe(
      'https://clip.mp4',
    )
    expect(
      (screen.getAllByLabelText('Heading') as HTMLInputElement[]).map((i) => i.value),
    ).toEqual(['Free delivery', 'Cash on delivery'])
    expect((screen.getByLabelText('Question') as HTMLInputElement).value).toBe('Can I exchange?')
    expect((screen.getByLabelText('Answer') as HTMLTextAreaElement).value).toBe('Within 7 days.')
    expect(zoneKeys()).toEqual(['inside-dhaka', 'outside-dhaka'])
    expect(
      (screen.getAllByLabelText('Delivery charge') as HTMLInputElement[]).map((i) => i.value),
    ).toEqual(['60', '150'])
  })
})

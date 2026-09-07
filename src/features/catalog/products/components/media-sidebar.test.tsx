import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MediaSidebar, type ImageRow } from '@/features/catalog/products/components/media-sidebar'
import { SHARED_VARIANT_KEY, type PendingImage } from '@/features/catalog/products/components/image-upload-field'

/**
 * Asserts the gallery half of `specs/catalog-management` — "Exactly one image
 * ends up primary" and the gating in "The inventory half is gated on the
 * product existing".
 *
 * The primary invariant spans two lists — image rows entered by URL and files
 * picked in this session — and the bug it guards against is starring a URL row
 * while a picked file stays starred too, which sends two primaries to a backend
 * that accepts one.
 */

vi.mock('@/lib/api/uploads', () => ({
  useUploadVideo: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

const file = (name: string) => new File(['x'], name, { type: 'image/png' })

function Harness({
  initialImages = [],
  initialPending = [],
  productExists = true,
}: {
  initialImages?: ImageRow[]
  initialPending?: PendingImage[]
  productExists?: boolean
}) {
  const [images, setImages] = React.useState<ImageRow[]>(initialImages)
  const [pending, setPending] = React.useState<PendingImage[]>(initialPending)

  return (
    <>
      <MediaSidebar
        images={images}
        onImagesChange={setImages}
        pendingImages={pending}
        onPendingImagesChange={setPending}
        video={null}
        videoThumbnail={null}
        onVideoChange={() => {}}
        productExists={productExists}
      />
      {/* Read the invariant back out without reaching into component internals. */}
      <output data-testid="state">
        {JSON.stringify({
          urlPrimaries: images.filter((i) => i.isPrimary).length,
          pendingPrimaries: pending.filter((p) => p.isPrimary).length,
          urls: images.map((i) => i.url),
        })}
      </output>
    </>
  )
}

const state = () => JSON.parse(screen.getByTestId('state').textContent ?? '{}')

describe('MediaSidebar', () => {
  it('explains that the gallery arrives after saving, rather than showing dead controls', () => {
    render(<Harness productExists={false} />)

    expect(screen.getByText('Available after saving')).not.toBeNull()
    expect(screen.queryByRole('button', { name: /Add image URL/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Make main image' })).toBeNull()
  })

  it('offers the gallery once the product exists', () => {
    render(<Harness />)

    expect(screen.queryByText('Available after saving')).toBeNull()
    expect(screen.getByRole('button', { name: /Add image URL/ })).not.toBeNull()
  })

  it('starring an image row clears the star from a picked file', async () => {
    const user = userEvent.setup()
    render(
      <Harness
        initialImages={[{ url: 'https://a.png', isPrimary: false, variantKey: SHARED_VARIANT_KEY }]}
        initialPending={[
          { file: file('b.png'), key: 'k1', altText: '', isPrimary: true, variantKey: SHARED_VARIANT_KEY },
        ]}
      />,
    )

    expect(state().pendingPrimaries).toBe(1)

    await user.click(screen.getByRole('button', { name: 'Make main image' }))

    await waitFor(() => expect(state().urlPrimaries).toBe(1))
    // Exactly one primary across BOTH lists — this is the whole invariant.
    expect(state().pendingPrimaries).toBe(0)
  })

  it('starring one image row clears the others', async () => {
    const user = userEvent.setup()
    render(
      <Harness
        initialImages={[
          { url: 'https://a.png', isPrimary: true, variantKey: SHARED_VARIANT_KEY },
          { url: 'https://b.png', isPrimary: false, variantKey: SHARED_VARIANT_KEY },
        ]}
      />,
    )

    await user.click(screen.getAllByRole('button', { name: 'Make main image' })[1])

    await waitFor(() => expect(state().urlPrimaries).toBe(1))
  })

  it('marks a first added URL row primary only when nothing else is', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: /Add image URL/ }))

    await waitFor(() => expect(state().urlPrimaries).toBe(1))
  })

  it('does not mark an added URL row primary when a picked file already is', async () => {
    const user = userEvent.setup()
    render(
      <Harness
        initialPending={[
          { file: file('b.png'), key: 'k1', altText: '', isPrimary: true, variantKey: SHARED_VARIANT_KEY },
        ]}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Add image URL/ }))

    // Would otherwise be two primaries.
    await waitFor(() => expect(state().urls).toHaveLength(1))
    expect(state().urlPrimaries).toBe(0)
    expect(state().pendingPrimaries).toBe(1)
  })

  it('removes one image row without disturbing the others', async () => {
    const user = userEvent.setup()
    render(
      <Harness
        initialImages={[
          { url: 'https://a.png', isPrimary: true, variantKey: SHARED_VARIANT_KEY },
          { url: 'https://b.png', isPrimary: false, variantKey: SHARED_VARIANT_KEY },
        ]}
      />,
    )

    await user.click(screen.getAllByRole('button', { name: 'Remove image' })[0])

    await waitFor(() => expect(state().urls).toEqual(['https://b.png']))
  })

  it('names each gallery field, so identical-looking rows are distinguishable', () => {
    render(
      <Harness
        initialImages={[{ url: 'https://a.png', isPrimary: true, variantKey: SHARED_VARIANT_KEY }]}
      />,
    )

    expect(screen.getByRole('textbox', { name: 'Image 1 address' })).not.toBeNull()
    expect(screen.getByRole('textbox', { name: 'Image 1 alt text' })).not.toBeNull()
  })
})

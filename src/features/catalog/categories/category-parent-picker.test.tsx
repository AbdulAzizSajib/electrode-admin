import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Form } from 'antd'
import { CategoryParentPicker } from '@/features/catalog/categories/category-parent-picker'
import type { Category } from '@/lib/api/categories'

/**
 * This component is the one file in `migrate-product-form-to-shadcn` that a page
 * NOT being migrated still depends on: `category-form-page` is antd, and wraps
 * this in a `<Form.Item name="parentId">`.
 *
 * antd's `Form.Item` clones its child with `value` and `onChange`; react-hook-form's
 * `FormField` hands over the same two. So the picker is exercised here inside a real
 * antd form — the consumer most likely to break — as well as standalone. A test that
 * only rendered it bare would pass while the category page was broken.
 *
 * See design.md Decision 7.
 */

const node = (id: string, name: string, parentId: string | null, children: Category[] = []): Category =>
  ({ id, name, parentId, sortOrder: 0, children }) as unknown as Category

/*
 * Computing & IT
 *   Laptops
 *     Gaming laptops
 *   Monitors
 * Audio
 */
const TREE: Category[] = [
  node('computing', 'Computing & IT', null, [
    node('laptops', 'Laptops', 'computing', [node('gaming', 'Gaming laptops', 'laptops')]),
    node('monitors', 'Monitors', 'computing'),
  ]),
  node('audio', 'Audio', null),
]

/** Every level's combobox, top-level first. */
const levels = () => screen.getAllByRole('combobox')

function AntdHarness({ initial = null, onValuesChange }: { initial?: string | null; onValuesChange?: (v: unknown) => void }) {
  return (
    <Form initialValues={{ parentId: initial }} onValuesChange={(_, all) => onValuesChange?.(all)}>
      <Form.Item name="parentId" label="Parent category">
        <CategoryParentPicker tree={TREE} />
      </Form.Item>
    </Form>
  )
}

describe('CategoryParentPicker', () => {
  it('rehydrates the whole ancestor chain from a leaf value', () => {
    render(<CategoryParentPicker tree={TREE} value="gaming" />)

    // Three levels already chosen, plus a trailing one to go deeper — but
    // "Gaming laptops" has no children, so that trailing level renders nothing.
    expect(levels()).toHaveLength(3)
    expect(levels()[0].textContent).toContain('Computing & IT')
    expect(levels()[1].textContent).toContain('Laptops')
    expect(levels()[2].textContent).toContain('Gaming laptops')
  })

  it('offers a trailing level when the last pick still has children', () => {
    render(<CategoryParentPicker tree={TREE} value="computing" />)

    expect(levels()).toHaveLength(2)
    expect(levels()[0].textContent).toContain('Computing & IT')
    // The trailing level offers to go one deeper, and stops at "None".
    expect(levels()[1].textContent).toContain('None — stop here')
  })

  it('starts at one level offering the top-level stop label', () => {
    render(<CategoryParentPicker tree={TREE} value={null} />)

    expect(levels()).toHaveLength(1)
    expect(levels()[0].textContent).toContain('No parent (top-level)')
  })

  it('reports the leaf of the chain when a deeper level is chosen', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<CategoryParentPicker tree={TREE} value="computing" onChange={onChange} />)

    await user.click(levels()[1])
    await user.click(screen.getByRole('option', { name: 'Laptops' }))

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('laptops'))
  })

  it('truncates everything deeper when a level is set back to None', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<CategoryParentPicker tree={TREE} value="gaming" onChange={onChange} />)

    // Level 1 is "Laptops"; setting it to "None — stop here" makes its parent
    // the effective one.
    await user.click(levels()[1])
    await user.click(screen.getByRole('option', { name: 'None — stop here' }))

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('computing'))
  })

  it('reports null when the top level is set back to no parent', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<CategoryParentPicker tree={TREE} value="computing" onChange={onChange} />)

    await user.click(levels()[0])
    await user.click(screen.getByRole('option', { name: 'No parent (top-level)' }))

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(null))
  })

  it('hides the excluded category and its whole subtree', async () => {
    const user = userEvent.setup()
    render(<CategoryParentPicker tree={TREE} value={null} excludeId="computing" />)

    await user.click(levels()[0])

    const offered = screen.getAllByRole('option').map((o) => o.textContent)
    expect(offered).toContain('Audio')
    expect(offered).not.toContain('Computing & IT')
    // And nothing beneath it is reachable either.
    expect(offered).not.toContain('Laptops')
  })

  describe('inside the still-antd category form', () => {
    it('rehydrates from the form value', () => {
      render(<AntdHarness initial="laptops" />)

      expect(levels()[0].textContent).toContain('Computing & IT')
      expect(levels()[1].textContent).toContain('Laptops')
    })

    it('writes the chosen parent back into the antd form', async () => {
      const onValuesChange = vi.fn()
      const user = userEvent.setup()
      render(<AntdHarness initial={null} onValuesChange={onValuesChange} />)

      await user.click(levels()[0])
      await user.click(screen.getByRole('option', { name: 'Audio' }))

      await waitFor(() => expect(onValuesChange).toHaveBeenCalledWith({ parentId: 'audio' }))
    })
  })
})

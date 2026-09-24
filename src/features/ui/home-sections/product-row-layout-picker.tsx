import { LayoutPicker } from '@/features/ui/components/layout-picker'
import {
  PRODUCT_ROW_LAYOUT_OPTIONS,
  type ProductRowLayout,
} from '@/lib/api/store-settings'

/**
 * How a homepage row of products is arranged — a grid or a scrolling row —
 * picked by looking at it.
 *
 * Mounted in each product row's settings panel on Home Sections, for the same
 * reason the featured-categories picker is: the choice moves no artwork
 * guidance and has no consequence a separate screen could show, and that page
 * already owns and writes `homeConfig`. The card shell is `LayoutPicker`,
 * shared with the hero and the categories; only the two drawings are here.
 *
 * ONE COMPONENT FOR ALL THREE ROWS. They offer the same two layouts, so a
 * picker each would be three copies of one drawing. Each row still stores its
 * own choice — the caller passes that row's value and writes back to that row.
 *
 * The drawing is a PRODUCT card, not a category tile: taller, with a price line
 * and an action bar, so the two pickers are not mistaken for each other when a
 * merchant opens two rows at once.
 *
 * See server/openspec/changes/add-product-slider-and-card-quantity, design.md
 * Decision 2.
 */

/** Shared drawing box, so the two diagrams line up. */
const BOX = { w: 190, h: 70 }
const GAP = 4
/** Cards per row in the drawing. Not the storefront's six — a drawing, not a mirror. */
const PER_ROW = 4

interface DiagramProps {
  className?: string
}

/**
 * One product card: an "image" block, a "name" line, and an action bar — the
 * three things that make a product card read as one at this size.
 */
function Card({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  const pad = width * 0.12
  const imageH = height * 0.45

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={2} className="fill-current opacity-15" />
      {/* Image band. */}
      <rect
        x={x + pad}
        y={y + pad * 0.6}
        width={width - pad * 2}
        height={imageH}
        rx={1}
        className="fill-current opacity-30"
      />
      {/* Name. */}
      <rect
        x={x + pad}
        y={y + imageH + pad}
        width={(width - pad * 2) * 0.8}
        height={2}
        rx={1}
        className="fill-current opacity-55"
      />
      {/* The action bar — "Add to cart", the card's own row. */}
      <rect
        x={x + pad}
        y={y + height - pad * 0.6 - 4}
        width={width - pad * 2}
        height={4}
        rx={1}
        className="fill-current opacity-70"
      />
    </g>
  )
}

/** Two rows of cards that wrap — every product visible at once. */
function GridDiagram({ className }: DiagramProps) {
  const cardW = (BOX.w - GAP * (PER_ROW - 1)) / PER_ROW
  const cardH = (BOX.h - GAP) / 2

  return (
    <svg viewBox={`0 0 ${BOX.w} ${BOX.h}`} className={className} role="presentation">
      {[0, 1].map((row) =>
        Array.from({ length: PER_ROW }, (_, col) => (
          <Card
            key={`${row}-${col}`}
            x={col * (cardW + GAP)}
            y={row * (cardH + GAP)}
            width={cardW}
            height={cardH}
          />
        )),
      )}
    </svg>
  )
}

/**
 * One row of the same cards running off the right edge — the last one clipped
 * by the viewBox, so "it continues" is the first thing read.
 */
function SliderDiagram({ className }: DiagramProps) {
  // Same card size as the grid's, centred vertically: the layouts share card
  // dimensions on the storefront, and the drawing says so.
  const cardW = (BOX.w - GAP * (PER_ROW - 1)) / PER_ROW
  const cardH = (BOX.h - GAP) / 2
  const y = (BOX.h - cardH) / 2

  return (
    <svg viewBox={`0 0 ${BOX.w} ${BOX.h}`} className={className} role="presentation">
      {/* One more than fits, offset by half a card, so the first and last are cut. */}
      {Array.from({ length: PER_ROW + 1 }, (_, col) => (
        <Card key={col} x={col * (cardW + GAP) - cardW / 2} y={y} width={cardW} height={cardH} />
      ))}
    </svg>
  )
}

const DIAGRAMS: Record<ProductRowLayout, (props: DiagramProps) => React.JSX.Element> = {
  GRID: GridDiagram,
  SLIDER: SliderDiagram,
}

export function ProductRowLayoutPicker({
  value,
  onChange,
  label,
}: {
  value: ProductRowLayout
  onChange: (layout: ProductRowLayout) => void
  /** Names the group for the row it sits on, e.g. "New arrivals layout". */
  label: string
}) {
  return (
    <LayoutPicker
      options={PRODUCT_ROW_LAYOUT_OPTIONS}
      value={value}
      onChange={onChange}
      label={label}
      // Two options, two columns. Keep equal to the option list's length.
      columns={2}
      diagram={(layout, { className }) => {
        const Diagram = DIAGRAMS[layout]
        return <Diagram className={className} />
      }}
    />
  )
}

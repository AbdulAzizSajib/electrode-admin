import { LayoutPicker } from '@/features/ui/components/layout-picker'
import {
  FEATURED_CATEGORIES_LAYOUT_OPTIONS,
  type FeaturedCategoriesLayout,
} from '@/lib/api/store-settings'

/**
 * How the featured categories are arranged — a grid or a scrolling row —
 * picked by looking at it.
 *
 * Mounted in the Featured categories row's settings panel on Home Sections,
 * not on a page of its own: unlike the hero's layout, this choice moves no
 * artwork guidance and has no consequence a separate screen could show, and
 * that page already owns and writes `homeConfig`. The card shell is
 * `LayoutPicker`, shared with the hero; only the two drawings are here.
 *
 * See server/openspec/changes/add-featured-categories-layout, design.md Decisions 2
 * and 3.
 */

/** Shared drawing box, so the two diagrams line up. */
const BOX = { w: 190, h: 70 }
const GAP = 4
/** Tiles per row in the drawing. Not the storefront's seven — a drawing, not a mirror. */
const PER_ROW = 5

interface DiagramProps {
  className?: string
}

/** One category tile: a rounded box with a "name" line beneath its "image". */
function Tile({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={2} className="fill-current opacity-25" />
      <rect
        x={x + width * 0.25}
        y={y + height - 6}
        width={width * 0.5}
        height={2}
        rx={1}
        className="fill-current opacity-60"
      />
    </g>
  )
}

/** Two rows of tiles that wrap — every tile visible at once. */
function GridDiagram({ className }: DiagramProps) {
  const tileW = (BOX.w - GAP * (PER_ROW - 1)) / PER_ROW
  const tileH = (BOX.h - GAP) / 2

  return (
    <svg viewBox={`0 0 ${BOX.w} ${BOX.h}`} className={className} role="presentation">
      {[0, 1].map((row) =>
        Array.from({ length: PER_ROW }, (_, col) => (
          <Tile
            key={`${row}-${col}`}
            x={col * (tileW + GAP)}
            y={row * (tileH + GAP)}
            width={tileW}
            height={tileH}
          />
        )),
      )}
    </svg>
  )
}

/**
 * One row of the same tiles running off the right edge — the last one clipped
 * by the viewBox, so "it continues" is the first thing read.
 */
function SliderDiagram({ className }: DiagramProps) {
  // Same tile size as the grid's, centred vertically: the layouts share tile
  // dimensions on the storefront, and the drawing says so.
  const tileW = (BOX.w - GAP * (PER_ROW - 1)) / PER_ROW
  const tileH = (BOX.h - GAP) / 2
  const y = (BOX.h - tileH) / 2

  return (
    <svg viewBox={`0 0 ${BOX.w} ${BOX.h}`} className={className} role="presentation">
      {/* One more than fits, offset by half a tile, so the first and last are cut. */}
      {Array.from({ length: PER_ROW + 1 }, (_, col) => (
        <Tile key={col} x={col * (tileW + GAP) - tileW / 2} y={y} width={tileW} height={tileH} />
      ))}
    </svg>
  )
}

const DIAGRAMS: Record<FeaturedCategoriesLayout, (props: DiagramProps) => React.JSX.Element> = {
  GRID: GridDiagram,
  SLIDER: SliderDiagram,
}

export function CategoryLayoutPicker({
  value,
  onChange,
}: {
  value: FeaturedCategoriesLayout
  onChange: (layout: FeaturedCategoriesLayout) => void
}) {
  return (
    <LayoutPicker
      options={FEATURED_CATEGORIES_LAYOUT_OPTIONS}
      value={value}
      onChange={onChange}
      label="Featured categories layout"
      // Two options, two columns. Keep equal to the option list's length.
      columns={2}
      diagram={(layout, { className }) => {
        const Diagram = DIAGRAMS[layout]
        return <Diagram className={className} />
      }}
    />
  )
}

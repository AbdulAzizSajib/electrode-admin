import { Card } from '@/components/ui/card'
import { LayoutPicker } from '@/features/ui/components/layout-picker'
import { HERO_RATIO, heroSlots } from '@/features/ui/home-slider/hero-slots'
import { HERO_VARIANT_OPTIONS, type HeroVariant } from '@/lib/api/store-settings'

/**
 * How the hero is arranged — picked by looking at it, not by reading a name.
 *
 * ── Why diagrams ─────────────────────────────────────────────────────────
 *
 * Two of the arrangements use the same three slots and differ only in
 * where those slots sit. No label fits that difference, and no sentence short
 * enough to sit under a radio button carries it either. So each option draws
 * itself: plain boxes at the real ratios, in the same proportions the slot grid
 * below renders at full size.
 *
 * Inline SVG rather than screenshots — one image per layout would need re-cutting every
 * time a ratio moved, with nothing to enforce it, and they would be one more
 * thing that can silently disagree with the storefront.
 *
 * ── What lives here and what does not ────────────────────────────────────
 *
 * The CARD SHELL — the radio group, the selected and pending states, and the
 * two layout rules that kept going wrong — is `LayoutPicker`, shared with the
 * featured-categories picker. What is here is everything hero-specific: the
 * diagrams, drawn against the hero's own 19:8 box, and the per-layout artwork
 * sizes in each card's footer.
 *
 * See openspec/changes/add-hero-section-variants-admin, design.md Decision 3,
 * and server/openspec/changes/add-featured-categories-layout, design.md Decision 3.
 */

/**
 * Shared drawing constants, so the diagrams line up with each other.
 *
 * The box is `HERO_RATIO` — the one every layout paints on the storefront —
 * so the diagrams show the real fact that the layouts differ only inside it.
 * 190 x 80 is exactly 19:8.
 */
const BOX = { w: 190, h: 190 / HERO_RATIO }
const GAP = 4

interface DiagramProps {
  className?: string
}

/** A rounded box in the diagram's "artwork" fill. */
function Slot({
  x,
  y,
  width,
  height,
  label,
}: {
  x: number
  y: number
  width: number
  height: number
  label: string
}) {
  return (
    <>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={2}
        className="fill-current opacity-25"
      />
      {/* The slider is the one slot worth distinguishing at this size — three
          dots read as "this one rotates" without needing a caption. */}
      {label === 'slider' && (
        <g className="fill-current opacity-70">
          {[-6, 0, 6].map((offset) => (
            <circle key={offset} cx={x + width / 2 + offset} cy={y + height - 6} r={1.6} />
          ))}
        </g>
      )}
    </>
  )
}

/** Slider left at 57%, two square tiles over a wide tile in the 43% column. */
function SplitThreeDiagram({ className }: DiagramProps) {
  const side = BOX.w * 0.43
  const slider = BOX.w - side - GAP
  const tile = (side - GAP) / 2
  const promoH = BOX.h - tile - GAP

  return (
    <svg viewBox={`0 0 ${BOX.w} ${BOX.h}`} className={className} role="presentation">
      <Slot x={0} y={0} width={slider} height={BOX.h} label="slider" />
      <Slot x={slider + GAP} y={0} width={tile} height={tile} label="tile" />
      <Slot x={slider + GAP + tile + GAP} y={0} width={tile} height={tile} label="tile" />
      <Slot x={slider + GAP} y={tile + GAP} width={side} height={promoH} label="tile" />
    </svg>
  )
}

/** Slider left at two thirds, one tall tile filling the right third. */
function SplitTallDiagram({ className }: DiagramProps) {
  const side = BOX.w / 3
  const slider = BOX.w - side - GAP

  return (
    <svg viewBox={`0 0 ${BOX.w} ${BOX.h}`} className={className} role="presentation">
      <Slot x={0} y={0} width={slider} height={BOX.h} label="slider" />
      <Slot x={slider + GAP} y={0} width={side} height={BOX.h} label="tile" />
    </svg>
  )
}

/** One panel across the whole width. */
function FullSliderDiagram({ className }: DiagramProps) {
  return (
    <svg viewBox={`0 0 ${BOX.w} ${BOX.h}`} className={className} role="presentation">
      <Slot x={0} y={0} width={BOX.w} height={BOX.h} label="slider" />
    </svg>
  )
}

/** A row of three 43:20 tiles along the bottom, the panel filling what is above. */
function SliderStackDiagram({ className }: DiagramProps) {
  const tileW = (BOX.w - GAP * 2) / 3
  const tileH = tileW / (43 / 20)
  const sliderH = BOX.h - tileH - GAP

  return (
    <svg viewBox={`0 0 ${BOX.w} ${BOX.h}`} className={className} role="presentation">
      <Slot x={0} y={0} width={BOX.w} height={sliderH} label="slider" />
      {[0, 1, 2].map((i) => (
        <Slot
          key={i}
          x={i * (tileW + GAP)}
          y={sliderH + GAP}
          width={tileW}
          height={tileH}
          label="tile"
        />
      ))}
    </svg>
  )
}

const DIAGRAMS: Record<HeroVariant, (props: DiagramProps) => React.JSX.Element> = {
  SPLIT_THREE: SplitThreeDiagram,
  FULL_SLIDER: FullSliderDiagram,
  SLIDER_STACK: SliderStackDiagram,
  SPLIT_TALL: SplitTallDiagram,
}

export function VariantPicker({
  value,
  onChange,
  saving,
}: {
  value: HeroVariant
  onChange: (variant: HeroVariant) => void
  /**
   * The layout currently being written, or null.
   *
   * NOT a plain `disabled` boolean, and not the shared settings mutation's
   * `isPending` — see the comment on `savingVariant` in home-slider-page.tsx
   * and the header of `LayoutPicker`.
   */
  saving?: HeroVariant | null
}) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium text-foreground">Hero layout</h2>
        <p className="text-sm text-muted-foreground">
          How the hero is arranged on your home page. The same images are used by every layout —
          changing this never deletes artwork.
        </p>
      </div>

      <LayoutPicker
        options={HERO_VARIANT_OPTIONS}
        value={value}
        onChange={onChange}
        saving={saving}
        label="Hero layout"
        // One column per layout at xl, so the set reads as one row. Keep this
        // equal to `HERO_VARIANT_OPTIONS.length`.
        columns={4}
        diagram={(variant, { className }) => {
          const Diagram = DIAGRAMS[variant]
          return <Diagram className={className} />
        }}
        /*
          The artwork sizes THIS layout asks for, so a merchant can see what
          changing to it would cost them before they change. The same figures
          the slot headings below carry, from the same `heroSlots()` call — a
          merchant comparing layouts is usually deciding whether they already
          have artwork that fits. One row for FULL_SLIDER and up to three for
          the others; three is the maximum any layout has, since
          `HERO_PLACEMENTS` has three entries and no layout renders a slot twice.
        */
        footer={(variant) =>
          heroSlots(variant).map((slot) => (
            <span key={slot.placement} className="flex justify-between gap-2">
              <span className="truncate">{slot.label}</span>
              <span className="shrink-0">
                {slot.recommended.width} × {slot.recommended.height}
              </span>
            </span>
          ))
        }
      />
    </Card>
  )
}

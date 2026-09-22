import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import { Card } from '@/components/ui/card'
import { HERO_VARIANT_OPTIONS, type HeroVariant } from '@/lib/api/store-settings'
import { cn } from '@/lib/utils/cn'

/**
 * How the hero is arranged — picked by looking at it, not by reading a name.
 *
 * ── Why diagrams ─────────────────────────────────────────────────────────
 *
 * Two of the four arrangements use the same three slots and differ only in
 * where those slots sit. No label fits that difference, and no sentence short
 * enough to sit under a radio button carries it either. So each option draws
 * itself: plain boxes at the real ratios, in the same proportions the slot grid
 * below renders at full size.
 *
 * Inline SVG rather than screenshots — four images would need re-cutting every
 * time a ratio moved, with nothing to enforce it, and they would be one more
 * thing that can silently disagree with the storefront.
 *
 * ── Why a radio group and not a Select ───────────────────────────────────
 *
 * Partly because four options are faster to read than to open. Mostly because
 * a Radix `Select` mounted before its record has loaded clears react-hook-form's
 * `values` reset and silently blocks the save — a failure this panel has hit
 * before. A radio group carries the same roving focus and arrow-key movement
 * without that.
 *
 * See openspec/changes/add-hero-section-variants-admin, design.md Decision 3.
 */

/** Shared drawing constants, so the four diagrams line up with each other. */
const BOX = { w: 200, h: 78 }
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

/** Slider left, one square tile filling the 43% column. */
function SplitOneDiagram({ className }: DiagramProps) {
  const side = BOX.w * 0.43
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

/** Full-width panel above a row of three tiles. */
function SliderStackDiagram({ className }: DiagramProps) {
  const sliderH = BOX.h * 0.58
  const tileH = BOX.h - sliderH - GAP
  const tileW = (BOX.w - GAP * 2) / 3

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
  SPLIT_ONE: SplitOneDiagram,
  FULL_SLIDER: FullSliderDiagram,
  SLIDER_STACK: SliderStackDiagram,
}

export function VariantPicker({
  value,
  onChange,
  disabled,
}: {
  value: HeroVariant
  onChange: (variant: HeroVariant) => void
  disabled?: boolean
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

      <RadioGroupPrimitive.Root
        value={value}
        onValueChange={(next) => onChange(next as HeroVariant)}
        disabled={disabled}
        aria-label="Hero layout"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {HERO_VARIANT_OPTIONS.map((option) => {
          const Diagram = DIAGRAMS[option.value]
          const selected = option.value === value

          return (
            <RadioGroupPrimitive.Item
              key={option.value}
              value={option.value}
              className={cn(
                'flex flex-col gap-2 rounded-md border p-3 text-left transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'disabled:cursor-not-allowed disabled:opacity-50',
                selected
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/40',
              )}
            >
              <Diagram
                className={cn(
                  'h-auto w-full',
                  selected ? 'text-primary' : 'text-muted-foreground',
                )}
              />
              <span className="text-sm font-medium text-foreground">{option.label}</span>
              <span className="text-xs text-muted-foreground">{option.description}</span>
            </RadioGroupPrimitive.Item>
          )
        })}
      </RadioGroupPrimitive.Root>
    </Card>
  )
}

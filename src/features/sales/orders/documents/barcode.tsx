/**
 * Renders an order number as a Code 128 barcode, with the number in text below.
 *
 * SVG rather than canvas, deliberately. A canvas rasterises at one pixel
 * density; a thermal printer's 203 dpi is not that density, so the bars get
 * resampled on the way to paper and the narrow-to-wide ratio — which is the
 * entire information content of the symbol — drifts. That is how a barcode
 * becomes intermittently unscannable while still looking perfectly fine.
 * SVG is resolution-independent, so the same markup prints correctly at 203 dpi
 * thermal and 600 dpi laser. See design.md Decision 2.
 *
 * The human-readable text is not decoration either: it is what lets a person
 * read the order number when a scanner will not cooperate, and the spec
 * requires it beneath every barcode.
 */
import { encodeCode128B, QUIET_ZONE_MODULES } from './code128'

interface BarcodeProps {
  /** The order number to encode. Rendered as text whether or not it encodes. */
  value: string
  /**
   * Height of the bars alone, in millimetres. The text sits below this.
   * ~15mm is comfortable for a handheld scanner at typical working distance.
   */
  heightMm?: number
  /**
   * Width of one module in millimetres — the narrowest bar.
   *
   * 0.33mm is a deliberate floor rather than a preference: at 203 dpi a printer
   * dot is ~0.125mm, so 0.33mm is between two and three dots wide and survives
   * the rounding. Thinner bars start merging on thermal paper, and merged bars
   * do not scan.
   */
  moduleMm?: number
  className?: string
}

export function Barcode({ value, heightMm = 15, moduleMm = 0.33, className }: BarcodeProps) {
  const encoded = encodeCode128B(value)

  /*
   * Unencodable: show the number, omit the bars. A wrong or truncated barcode
   * would misroute a parcel silently, which is strictly worse than a label
   * that visibly has no barcode on it. Required by the spec's
   * "unencodable order number degrades safely" scenario.
   */
  if (!encoded) {
    return (
      <div className={className}>
        <span className="barcode-text">{value}</span>
      </div>
    )
  }

  const totalModules = encoded.modules + QUIET_ZONE_MODULES * 2
  const widthMm = totalModules * moduleMm

  // Walk the runs, emitting a rect for each bar and skipping each space. Runs
  // alternate bar-first, so even indices are bars.
  const bars: Array<{ x: number; width: number }> = []
  let cursor = QUIET_ZONE_MODULES
  encoded.runs.forEach((run, index) => {
    if (index % 2 === 0) bars.push({ x: cursor, width: run })
    cursor += run
  })

  return (
    <div className={className}>
      <svg
        // viewBox in module units with the width in millimetres: the browser
        // scales one to the other, so the bar ratios are exact at any dpi.
        viewBox={`0 0 ${totalModules} ${heightMm}`}
        width={`${widthMm}mm`}
        height={`${heightMm}mm`}
        preserveAspectRatio="none"
        shapeRendering="crispEdges"
        role="img"
        aria-label={`Barcode for ${value}`}
      >
        {/*
         * The quiet zone is white space a scanner needs to find the symbol's
         * edges. Painted explicitly rather than left transparent so it survives
         * being placed on any background.
         */}
        <rect x="0" y="0" width={totalModules} height={heightMm} fill="#fff" />
        {bars.map((bar, index) => (
          <rect
            key={index}
            x={bar.x}
            y="0"
            width={bar.width}
            height={heightMm}
            fill="#000"
          />
        ))}
      </svg>
      <span className="barcode-text">{value}</span>
    </div>
  )
}

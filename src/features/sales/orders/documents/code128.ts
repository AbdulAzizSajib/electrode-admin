/**
 * Code 128 code set B encoder.
 *
 * Turns a string into the bar/space widths a barcode is drawn from. Pure: a
 * string in, numbers out, no DOM and no network — which is what lets a label
 * print on a packing bench with no internet (see the barcode requirement in
 * openspec/changes/add-order-fulfillment-documents).
 *
 * Hand-written rather than pulled from a library because the problem is one
 * symbology, one character set, one output format, and the encoding has not
 * changed since 1981. See design.md Decision 1 for the alternatives weighed.
 *
 * ## Why code set B only
 *
 * Order numbers are `ORD-YYYYMMDD-XXXXXX` — uppercase letters, digits and
 * hyphens, all of which sit inside set B. Set C would pack digit PAIRS into
 * single symbols and shorten the barcode, but it only helps for long runs of
 * digits and costs a shift/switch state machine that is one more thing to get
 * subtly wrong. Set A buys control characters nothing here needs.
 *
 * ## What "subtly wrong" means here, and why the tests matter
 *
 * A barcode with a miscomputed checksum, a dropped quiet zone or an off-by-one
 * pattern still LOOKS like a barcode. Nothing about it reads as broken until a
 * scanner somewhere refuses the parcel. So correctness here comes from the unit
 * tests asserting exact widths against known vectors, not from inspection.
 */

/**
 * The 107 Code 128 symbols, as bar/space run lengths.
 *
 * Each entry is six digits: bar, space, bar, space, bar, space — the widths in
 * modules of the six runs making up one symbol. Every symbol is 11 modules
 * wide, which the tests assert rather than trust.
 *
 * Index is the symbol VALUE, which is also what the checksum arithmetic works
 * in. For set B, value = charCode - 32, so index 0 is a space and index 94 is
 * `~`. Values 95-106 are the control symbols (shifts, set switches, start
 * codes, stop) — only START_B and STOP are used here.
 */
const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312',
  '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222',
  '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131',
  '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321',
  '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121',
  '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321',
  '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224',
  '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114',
  '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112',
  '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113',
  '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412',
  '211214', '211232', '2331112',
] as const

/** Set-B start symbol. Its value, 104, is also the checksum's starting weight. */
const START_B = 104

/** Stop symbol. 13 modules and seven runs, not eleven and six — the one asymmetry. */
const STOP = 106

/** Lowest and highest character encodable in set B: space (32) through `~` (126). */
const MIN_CHAR = 32
const MAX_CHAR = 126

/**
 * Quiet zone in modules, on each side.
 *
 * Not decoration: a scanner needs blank space to recognise where the symbol
 * begins and ends, and a barcode butted against neighbouring ink is a barcode
 * that intermittently fails to read. The spec calls for at least 10 modules.
 */
export const QUIET_ZONE_MODULES = 10

export interface Code128Encoding {
  /**
   * Alternating run widths in modules, starting with a BAR. Consumers draw
   * these left to right, filling odd-indexed runs and skipping even ones.
   */
  readonly runs: readonly number[]
  /** Total width in modules, excluding quiet zones — the sum of `runs`. */
  readonly modules: number
  /** The text these runs encode, echoed back for rendering beneath the bars. */
  readonly value: string
}

/** Whether every character of `value` can be represented in code set B. */
export const isEncodable = (value: string): boolean =>
  value.length > 0 &&
  [...value].every((ch) => {
    const code = ch.charCodeAt(0)
    return code >= MIN_CHAR && code <= MAX_CHAR
  })

/**
 * Encodes `value` as Code 128 B, or returns `null` if it cannot be represented.
 *
 * `null` rather than a throw or a mangled barcode: the caller's contract is to
 * print the human-readable number without bars, because a wrong barcode is
 * worse than no barcode — one misroutes a parcel silently, the other is
 * visibly missing. An empty string is likewise unencodable; there is no
 * meaningful barcode of nothing.
 */
export const encodeCode128B = (value: string): Code128Encoding | null => {
  if (!isEncodable(value)) return null

  const symbols: number[] = [START_B]

  for (const ch of value) {
    symbols.push(ch.charCodeAt(0) - MIN_CHAR)
  }

  /*
   * Modulo-103 weighted checksum. The start code counts once, then each data
   * symbol is weighted by its 1-based position. Computed over `symbols` as it
   * stands — start code included, which is why the seed is symbols[0] and the
   * loop begins at 1.
   */
  let checksum = symbols[0]
  for (let i = 1; i < symbols.length; i += 1) {
    checksum += symbols[i] * i
  }
  symbols.push(checksum % 103)

  symbols.push(STOP)

  const runs: number[] = []
  for (const symbol of symbols) {
    for (const width of PATTERNS[symbol]) {
      runs.push(Number(width))
    }
  }

  return {
    runs,
    modules: runs.reduce((sum, width) => sum + width, 0),
    value,
  }
}

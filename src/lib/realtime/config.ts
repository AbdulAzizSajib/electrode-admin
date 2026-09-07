/**
 * How often the panel asks the server whether anything changed.
 *
 * One constant on purpose: every live element in the panel is driven by a single shared poll,
 * so this is the only value that needs editing to retune the whole panel's liveness. 10s puts a
 * new order in front of staff within one interval at roughly 8.6k requests/day for 2-3
 * concurrent staff — comfortably inside the API host's free-tier budget, with room to halve it.
 */
export const PULSE_INTERVAL_MS = 10_000

/** `localStorage` key holding the new-order sound's mute state. */
export const SOUND_MUTED_KEY = 'electrode.admin.orderAlertMuted'

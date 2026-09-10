/**
 * jsdom is missing a handful of browser APIs the panel's components reach for on
 * mount — Radix measures, Recharts observes. Stubbed here rather than mocked
 * per-test, since a component asking whether the viewport is wide is not what
 * any of these tests are about.
 */

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

import * as React from 'react'

/**
 * Marks a scroll container while it is actually being scrolled.
 *
 * Sets `data-scrolling` on the element for the duration of a scroll plus a
 * short idle window, which is what the `.scrollbar-overlay` utility in
 * `index.css` keys its visible thumb off. CSS can express "while hovered" on
 * its own but has no notion of "while scrolling", and hover alone is the wrong
 * rule: a wheel or trackpad scroll frequently happens with the pointer
 * elsewhere, and the merchant needs to see where they are in the list.
 *
 * Returns a CALLBACK ref, not an object ref, so the listener follows the node.
 * `ShellLayout` keys its `<main>` on the currency format, which swaps the DOM
 * node without re-running an effect — an effect-based version would keep
 * listening to the detached element and the page's scrollbar would quietly stop
 * appearing partway through the session.
 *
 * The attribute is written directly rather than held in state: a scroll fires
 * on every frame, and re-rendering the whole shell sixty times a second to
 * toggle one class is the cost this avoids.
 *
 * @param idleMs How long the thumb stays after the last scroll event. Long
 *   enough to read the position, short enough not to read as "always on".
 */
export function useAutoHideScrollbar<T extends HTMLElement>(idleMs = 800) {
  /* Detaches the previous node's listener when the ref moves or unmounts. */
  const detach = React.useRef<(() => void) | null>(null)

  return React.useCallback(
    (el: T | null) => {
      detach.current?.()
      detach.current = null

      if (!el) return

      let timer: number | undefined

      const onScroll = () => {
        el.dataset.scrolling = ''
        window.clearTimeout(timer)
        timer = window.setTimeout(() => {
          delete el.dataset.scrolling
        }, idleMs)
      }

      el.addEventListener('scroll', onScroll, { passive: true })

      detach.current = () => {
        el.removeEventListener('scroll', onScroll)
        window.clearTimeout(timer)
      }
    },
    [idleMs],
  )
}

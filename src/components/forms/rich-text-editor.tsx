import * as React from 'react'
import Quill from 'quill'
import 'quill/dist/quill.snow.css'
import { cn } from '@/lib/utils/cn'

/**
 * The formatting editor product descriptions, blog posts and pages are
 * authored in.
 *
 * Quill stores plain semantic HTML — `<p>`, `<ul>`, `<strong>` — not a
 * proprietary document model the storefront would have to convert. Anything the
 * storefront cannot render, it can at least sanitise away, which is not true of
 * a JSON blob only the editor understands.
 *
 * The stored markup is deliberately NOT trusted on the way out. It is sanitised
 * where it meets a browser, on the storefront — see design.md, "Rich text is
 * sanitised on the way out, not only on the way in". Sanitising only here would
 * leave anything already stored, or written by any other path, trusted forever.
 *
 * Shaped as a controlled input (`value`/`onChange`) so a form can drive it like
 * any other field.
 *
 * ## Why Quill and not Tiptap
 *
 * This replaced a Tiptap implementation that silently lost content on every
 * edit form. Tiptap's React binding re-applies the whole options object
 * whenever any of it changes, and `content` is one of those options: when an
 * async-loaded record arrived and `value` went from `''` to its real markup,
 * the binding wrote the new `content` onto `editor.options` WITHOUT touching
 * the document, which defeated the "only push when it differs" guard the sync
 * effect relied on. The editor kept rendering the empty document it was created
 * with while the form believed it held the record. Every product, blog post and
 * page opened for editing showed blank Overview and Description fields, and
 * saving wrote that blank back.
 *
 * Quill has no such coupling — the document is only ever changed by an explicit
 * API call, so the guard below is the single place content moves in.
 */

export interface RichTextEditorProps {
  /** HTML. Undefined and `''` both mean empty. */
  value?: string
  onChange?: (html: string) => void
  placeholder?: string
  disabled?: boolean
  /** Minimum height of the writing area, in Tailwind units. */
  minHeight?: string
  /**
   * Adds an image button. Opt-in rather than always-on because the storefront's
   * sanitiser is the other half of this switch: `<img>` had to be added to its
   * allow-list before an inserted image would survive rendering. Product
   * descriptions never needed images and are deliberately left as they were —
   * see add-admin-ui-cms-section design.md, "Rich text keeps the existing
   * sanitise-on-render policy".
   */
  allowImages?: boolean
}

/**
 * An empty document round-trips as one of these; storing it would be storing
 * nothing. Quill 2 normally empties to `<p><br></p>`, but a document whose only
 * content is whitespace serialises to the others.
 */
const EMPTY_HTML = new Set(['<p><br></p>', '<p></p>', '<p><br/></p>', ''])

const isEmptyHtml = (html: string) => EMPTY_HTML.has(html.trim())

/** Normalises what Quill reports so `''` is the single representation of empty. */
const readHtml = (quill: Quill) => {
  const html = quill.root.innerHTML
  return isEmptyHtml(html) ? '' : html
}

/**
 * `minHeight` arrives as a Tailwind class because that is what the previous
 * editor took and what all four call sites already pass. The writing area sizes
 * itself from a CSS variable instead (see the wrapper below), so the class has
 * to be resolved to a length here.
 *
 * Tailwind's scale is `0.25rem` per step. Anything unrecognised falls back to
 * the `min-h-40` default rather than collapsing the field to nothing.
 */
const MIN_HEIGHT_PX: Record<string, string> = {
  'min-h-20': '5rem',
  'min-h-24': '6rem',
  'min-h-32': '8rem',
  'min-h-40': '10rem',
  'min-h-60': '15rem',
  'min-h-80': '20rem',
  'min-h-96': '24rem',
}

/**
 * The toolbar.
 *
 * Deliberately NOT Quill's full default set. Every control here has to survive
 * the storefront's sanitiser (`nextjs/src/lib/sanitize-html.ts`) or the
 * formatting silently vanishes the moment a shopper loads the page — the
 * editor and that allow-list are two halves of one switch.
 *
 * So the omissions are the considered part:
 *   - `font` / `size` / `color` / `background` / `align` emit inline `style`
 *     and `class` attributes, both of which that allow-list strips. Quill's own
 *     demo shows them because it renders its own output; this does not.
 *   - `video` embeds an `<iframe>`, which is not an allowed tag.
 *   - `formula` needs KaTeX loaded at render time, which the storefront does
 *     not do.
 *
 * `image` is conditional rather than declared inline so the two variants stay
 * one list — see `allowImages`.
 */
const buildToolbar = (allowImages?: boolean) => [
  // The heading dropdown, in place of the previous editor's two H2/H3 buttons:
  // same two levels, plus the "Normal" entry that takes a line back to a
  // paragraph without needing the eraser.
  [{ header: [2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['blockquote', 'code-block'],
  allowImages ? ['link', 'image'] : ['link'],
  ['clean'],
]

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  disabled,
  minHeight = 'min-h-40',
  allowImages,
}: RichTextEditorProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const quillRef = React.useRef<Quill | null>(null)

  /*
   * `onChange` through a ref so the setup effect below can stay `[]`.
   *
   * Quill is imperative: constructing it mounts a contenteditable and wires
   * listeners. Re-running that because a parent passed a fresh callback would
   * tear down the DOM the caret lives in, so the effect must not depend on
   * anything that changes per render — but the listener still has to call the
   * CURRENT callback, not the one captured on mount.
   */
  const onChangeRef = React.useRef(onChange)
  React.useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  /*
   * What the editor last reported upward. Compared against an incoming `value`
   * so a parent echoing our own HTML back is recognised as already-applied and
   * does not reset the document — the classic controlled-editor bug, where
   * every keystroke round-trips through the parent and puts the caret back at
   * the start.
   */
  const lastEmittedRef = React.useRef<string>('')

  /*
   * The initial value, read once. Quill is created in an effect that must not
   * re-run on `value`, so the first document is seeded from here and every
   * subsequent change goes through the sync effect below.
   */
  const initialValueRef = React.useRef(value ?? '')

  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    /*
     * Quill appends its own child nodes to whatever element it is given and
     * leaves them behind on teardown. Under StrictMode the setup effect runs
     * twice, so it is handed a fresh inner element each time and the cleanup
     * removes it — without this, a remount stacks a second toolbar and a second
     * writing area on top of the first.
     */
    const editorElement = document.createElement('div')
    container.appendChild(editorElement)

    const quill = new Quill(editorElement, {
      theme: 'snow',
      placeholder,
      readOnly: disabled,
      modules: { toolbar: buildToolbar(allowImages) },
    })

    if (initialValueRef.current) {
      quill.clipboard.dangerouslyPasteHTML(initialValueRef.current, 'silent')
    }
    lastEmittedRef.current = readHtml(quill)

    /*
     * `user` only. A programmatic `setContents` from the sync effect also fires
     * `text-change`, and reporting that upward would echo the parent's own
     * value back at it — harmless for a plain form, but it marks a pristine
     * form dirty the moment a record finishes loading.
     */
    quill.on('text-change', (_delta, _old, source) => {
      if (source !== 'user') return
      const html = readHtml(quill)
      lastEmittedRef.current = html
      onChangeRef.current?.(html)
    })

    quillRef.current = quill
    setReady(true)

    return () => {
      quillRef.current = null
      setReady(false)
      editorElement.remove()
      // Quill 2 mounts the toolbar as a sibling of the element it was given.
      container.querySelectorAll('.ql-toolbar').forEach((node) => node.remove())
    }
    // Mount-only: see `onChangeRef`. `placeholder`/`disabled`/`allowImages` are
    // applied by the effects below rather than by rebuilding the editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /*
   * Push a new `value` in only when it genuinely differs from what the editor
   * already holds — both against the live document and against what we last
   * emitted, since a parent that re-serialises our HTML can hand back a string
   * that differs only in ways Quill itself normalised away.
   */
  React.useEffect(() => {
    const quill = quillRef.current
    if (!quill) return

    const incoming = value ?? ''
    if (incoming === lastEmittedRef.current) return
    if (incoming === readHtml(quill)) return

    /*
     * The caret is restored because this effect also runs for changes a form
     * makes while the field has focus — a "reset" button, or a background
     * refetch landing mid-edit. Without it the caret jumps to the start.
     */
    const selection = quill.getSelection()

    if (incoming === '') {
      quill.setContents([], 'silent')
    } else {
      quill.setContents(quill.clipboard.convert({ html: incoming }), 'silent')
    }

    lastEmittedRef.current = readHtml(quill)

    if (selection) {
      const length = quill.getLength()
      quill.setSelection(Math.min(selection.index, Math.max(length - 1, 0)), 0, 'silent')
    }
  }, [value, ready])

  React.useEffect(() => {
    quillRef.current?.enable(!disabled)
  }, [disabled, ready])

  return (
    <div
      className={cn(
        'rich-text-editor rounded-md border border-border bg-background focus-within:border-primary',
        // Quill ships its own borders; the wrapper owns the outline instead so
        // the control matches every other field on the form.
        '[&_.ql-toolbar]:rounded-t-md [&_.ql-toolbar]:border-0 [&_.ql-toolbar]:border-b [&_.ql-toolbar]:border-border',
        // Quill's stock chrome is its own grey. Repoint the icon strokes and
        // the active/hover states at the admin's tokens so the control reads as
        // part of the form rather than an embedded widget.
        '[&_.ql-toolbar_.ql-stroke]:stroke-foreground [&_.ql-toolbar_.ql-fill]:fill-foreground',
        '[&_.ql-toolbar_.ql-picker-label]:text-foreground',
        '[&_.ql-toolbar_button]:rounded [&_.ql-toolbar_button:hover]:bg-muted',
        '[&_.ql-toolbar_button.ql-active]:bg-muted',
        '[&_.ql-toolbar_.ql-active_.ql-stroke]:stroke-primary [&_.ql-toolbar_.ql-active_.ql-fill]:fill-primary',
        '[&_.ql-toolbar_.ql-picker-label:hover]:text-primary [&_.ql-toolbar_.ql-picker-label.ql-active]:text-primary',
        // The heading dropdown renders as an absolutely-positioned panel that
        // inherits none of the surrounding surface.
        '[&_.ql-picker-options]:rounded-md [&_.ql-picker-options]:border [&_.ql-picker-options]:border-border [&_.ql-picker-options]:bg-popover [&_.ql-picker-options]:shadow-md',
        '[&_.ql-picker-item]:text-popover-foreground [&_.ql-picker-item:hover]:text-primary',
        '[&_.ql-container]:rounded-b-md [&_.ql-container]:border-0 [&_.ql-container]:font-sans [&_.ql-container]:text-sm',
        // The writing area, matching the prose styles the storefront renders with.
        '[&_.ql-editor]:px-3 [&_.ql-editor]:py-2',
        // Quill's placeholder is its own grey and italic; every other field on
        // the form uses upright muted text.
        '[&_.ql-editor.ql-blank::before]:not-italic [&_.ql-editor.ql-blank::before]:text-muted-foreground',
        '[&_.ql-editor_h2]:mb-1 [&_.ql-editor_h2]:mt-3 [&_.ql-editor_h2]:text-base [&_.ql-editor_h2]:font-semibold',
        '[&_.ql-editor_h3]:mb-1 [&_.ql-editor_h3]:mt-3 [&_.ql-editor_h3]:text-sm [&_.ql-editor_h3]:font-semibold',
        '[&_.ql-editor_p]:my-1.5',
        '[&_.ql-editor_ul]:my-1.5 [&_.ql-editor_ol]:my-1.5',
        '[&_.ql-editor_blockquote]:border-l-2 [&_.ql-editor_blockquote]:border-border [&_.ql-editor_blockquote]:pl-3 [&_.ql-editor_blockquote]:text-muted-foreground',
        '[&_.ql-editor_a]:text-primary [&_.ql-editor_a]:underline',
        '[&_.ql-editor_img]:my-2 [&_.ql-editor_img]:max-w-full [&_.ql-editor_img]:rounded',
        /*
         * The caller's `min-h-*` has to land on the writing area, not the
         * wrapper — on the wrapper the toolbar eats into it, so a `min-h-20`
         * Overview field would be shorter than asked for. Applied via a CSS
         * variable because Tailwind only emits classes it can see at build
         * time, and an interpolated `[&_.ql-editor]:${minHeight}` is invisible
         * to it — the class would never exist in the stylesheet.
         */
        '[&_.ql-editor]:min-h-(--rte-min-height)',
        minHeight,
      )}
      style={{ '--rte-min-height': MIN_HEIGHT_PX[minHeight] ?? '10rem' } as React.CSSProperties}
    >
      <div ref={containerRef} />
    </div>
  )
}

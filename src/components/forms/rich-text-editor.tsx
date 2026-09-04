import * as React from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import {
  Bold,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
  Unlink,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * The formatting editor product descriptions are authored in.
 *
 * Tiptap was chosen over the alternatives for one reason that matters
 * downstream: it stores plain semantic HTML — `<p>`, `<ul>`, `<strong>` — not a
 * proprietary document model the storefront would have to convert. Anything the
 * storefront cannot render, it can at least sanitise away, which is not true of
 * a JSON blob only the editor understands.
 *
 * The stored markup is deliberately NOT trusted on the way out. It is sanitised
 * where it meets a browser, on the storefront — see design.md, "Rich text is
 * sanitised on the way out, not only on the way in". Sanitising only here would
 * leave anything already stored, or written by any other path, trusted forever.
 *
 * Shaped as a controlled input (`value`/`onChange`) so antd's `Form.Item` can
 * drive it like any other field.
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

/** An empty document round-trips as this; storing it would be storing nothing. */
const EMPTY_HTML = '<p></p>'

function ToolbarButton({
  active,
  disabled,
  onClick,
  label,
  children,
}: {
  active?: boolean
  disabled?: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      // Without this the button steals focus from the editor and every command
      // runs against a lost selection.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'inline-flex size-7 items-center justify-center rounded transition-colors',
        'text-muted-foreground hover:bg-muted hover:text-foreground',
        'disabled:pointer-events-none disabled:opacity-40',
        active && 'bg-muted text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function Toolbar({ editor, allowImages }: { editor: Editor; allowImages?: boolean }) {
  const insertImage = () => {
    const src = window.prompt('Image address', 'https://')
    if (src === null || src.trim() === '') return
    // `alt` is asked for separately rather than left empty: an image with no
    // alternative text is invisible to a screen reader, and a policy page is
    // exactly the kind of content that has to be readable.
    const alt = window.prompt('Describe this image (for screen readers)', '') ?? ''
    editor.chain().focus().setImage({ src: src.trim(), alt }).run()
  }

  const setLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined
    const href = window.prompt('Link address', previous ?? 'https://')
    // Cancel leaves the text alone; clearing the box removes the link, which is
    // the only way to unlink from the keyboard-less path.
    if (href === null) return
    if (href.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: href.trim() }).run()
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-1.5 py-1">
      <ToolbarButton
        label="Bold"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough"
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="size-3.5" />
      </ToolbarButton>

      <span className="mx-1 h-4 w-px bg-border" />

      <ToolbarButton
        label="Heading"
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Sub-heading"
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="size-3.5" />
      </ToolbarButton>

      <span className="mx-1 h-4 w-px bg-border" />

      <ToolbarButton
        label="Bulleted list"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Quote"
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="size-3.5" />
      </ToolbarButton>

      <span className="mx-1 h-4 w-px bg-border" />

      <ToolbarButton label="Add link" active={editor.isActive('link')} onClick={setLink}>
        <LinkIcon className="size-3.5" />
      </ToolbarButton>
      {allowImages && (
        <ToolbarButton label="Insert image" onClick={insertImage}>
          <ImageIcon className="size-3.5" />
        </ToolbarButton>
      )}
      <ToolbarButton
        label="Remove link"
        disabled={!editor.isActive('link')}
        onClick={() => editor.chain().focus().unsetLink().run()}
      >
        <Unlink className="size-3.5" />
      </ToolbarButton>

      <span className="mx-1 h-4 w-px bg-border" />

      <ToolbarButton
        label="Undo"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Redo"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 className="size-3.5" />
      </ToolbarButton>
    </div>
  )
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  disabled,
  minHeight = 'min-h-40',
  allowImages,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }),
      Link.configure({
        openOnClick: false,
        // Whatever a merchant writes still passes the storefront's sanitiser;
        // this only stops the editor itself from minting a dangerous href.
        protocols: ['http', 'https', 'mailto'],
        HTMLAttributes: { rel: 'noopener noreferrer' },
      }),
      // Only when asked for — see `allowImages`. `inline: false` keeps an image
      // a block node, which is what the storefront's prose styles expect.
      ...(allowImages ? [Image.configure({ inline: false, allowBase64: false })] : []),
    ],
    content: value ?? '',
    editable: !disabled,
    onUpdate: ({ editor: current }) => {
      const html = current.getHTML()
      onChange?.(html === EMPTY_HTML ? '' : html)
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm max-w-none px-3 py-2 outline-none',
          '[&_h2]:mb-1 [&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-semibold',
          '[&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:text-sm [&_h3]:font-semibold',
          '[&_p]:my-1.5',
          '[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5',
          '[&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5',
          '[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
          '[&_a]:text-primary [&_a]:underline',
          '[&_img]:my-2 [&_img]:max-w-full [&_img]:rounded',
          minHeight,
        ),
      },
    },
  })

  /*
   * Push a new `value` in only when it genuinely differs from what the editor
   * already holds. Without the comparison every keystroke would round-trip
   * through the parent, reset the document, and put the caret back at the
   * start — the classic controlled-editor bug.
   */
  React.useEffect(() => {
    if (!editor) return
    const incoming = value ?? ''
    const current = editor.getHTML()
    if (incoming === current || (incoming === '' && current === EMPTY_HTML)) return
    editor.commands.setContent(incoming, { emitUpdate: false })
  }, [editor, value])

  React.useEffect(() => {
    editor?.setEditable(!disabled)
  }, [editor, disabled])

  if (!editor) {
    // One render before the editor exists. A sized placeholder keeps the form
    // from jumping when it appears.
    return <div className={cn('rounded-md border border-border bg-muted/30', minHeight)} />
  }

  const isEmpty = editor.isEmpty

  return (
    <div className="rounded-md border border-border bg-background focus-within:border-primary">
      <Toolbar editor={editor} allowImages={allowImages} />
      <div className="relative">
        {isEmpty && placeholder && (
          <p className="pointer-events-none absolute px-3 py-2 text-sm text-muted-foreground">
            {placeholder}
          </p>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

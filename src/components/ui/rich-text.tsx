import { cn } from '@/lib/utils/cn'
import { sanitizeHtml } from '@/lib/utils/sanitize-html'

/**
 * Renders merchant-authored HTML, sanitised at the point it meets a browser.
 *
 * The read-side counterpart of `components/forms/rich-text-editor.tsx`. Detail
 * pages used to print these columns as plain JSX text, which showed the
 * merchant their own markup — a literal `<p>test</p>` on the product page —
 * rather than the formatting they wrote.
 *
 * `dangerouslySetInnerHTML` below is only as dangerous as `sanitizeHtml`'s
 * allowlist makes it. Nothing else in the admin should set merchant markup
 * directly.
 */
export function RichText({ html, className }: { html: string; className?: string }) {
  const clean = sanitizeHtml(html)

  return (
    <div
      className={cn(
        'text-sm leading-relaxed text-foreground',
        '[&_p]:my-2',
        '[&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-lg [&_h1]:font-bold',
        '[&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-bold',
        '[&_h3]:mb-1.5 [&_h3]:mt-3 [&_h3]:text-sm [&_h3]:font-semibold',
        '[&_strong]:font-semibold',
        '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5',
        '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5',
        '[&_li]:my-1',
        '[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
        '[&_a]:text-primary [&_a]:underline',
        '[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:text-xs',
        '[&_img]:my-2 [&_img]:max-w-full [&_img]:rounded',
        '[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse',
        '[&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left',
        '[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1',
        className,
      )}
      // Safe only because of `sanitizeHtml` above — never bypass it.
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  )
}

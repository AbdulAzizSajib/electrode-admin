import type { BlogMediaType } from '@/lib/api/blog-posts'

/**
 * The non-component half of the blog media field.
 *
 * Split from `blog-media-field.tsx` because a file that exports both components and plain values
 * breaks fast refresh — the same reason `banner-labels.ts` is separate from the pages that use it,
 * and `settings-editor-utils.tsx` from `settings-editor.tsx`.
 */

/** A post's single media slot, as the form holds it. Empty strings rather than nulls, so the inputs stay controlled. */
export interface BlogMedia {
  mediaType: BlogMediaType
  imageUrl: string
  videoUrl: string
  videoThumbnailUrl: string
}

/** No media. Also what "Remove" returns the field to. */
export const EMPTY_MEDIA: BlogMedia = {
  mediaType: 'NONE',
  imageUrl: '',
  videoUrl: '',
  videoThumbnailUrl: '',
}

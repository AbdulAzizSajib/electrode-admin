/**
 * Direct media uploads, for the places where a file is not part of a record's
 * own multipart write.
 *
 * Product images ride along with the product (see `products.ts`); a product
 * video does not, because it is a single field the merchant sets once and the
 * form only needs the URL back.
 */
import { useMutation } from '@tanstack/react-query'
import { request } from '@/lib/api/request'

export interface UploadedImage {
  url: string
}

/**
 * A single image, for a field whose record is not written as multipart.
 *
 * The store settings singleton is patched as JSON, so a logo cannot ride along
 * with it the way a category's image rides along with the category — the file
 * goes up first and the returned URL is what the PATCH carries.
 */
async function uploadImage(file: File): Promise<UploadedImage> {
  const form = new FormData()
  form.append('file', file)

  const res = await request<UploadedImage>('/uploads/image', { method: 'POST', body: form })
  return res.data
}

export function useUploadImage() {
  return useMutation({ mutationFn: uploadImage })
}

export interface UploadedVideo {
  url: string
  /** Always present — the backend derives a frame when no poster is supplied. */
  thumbnailUrl: string
}

/**
 * The video and its poster frame go up together: a video without a thumbnail
 * shows a black rectangle until it plays, so they are only useful as a pair and
 * should fail or succeed as one. The poster is optional.
 */
async function uploadVideo({
  video,
  thumbnail,
}: {
  video: File
  thumbnail?: File | null
}): Promise<UploadedVideo> {
  const form = new FormData()
  form.append('video', video)
  if (thumbnail) form.append('thumbnail', thumbnail)

  const res = await request<UploadedVideo>('/uploads/video', { method: 'POST', body: form })
  return res.data
}

export function useUploadVideo() {
  return useMutation({ mutationFn: uploadVideo })
}

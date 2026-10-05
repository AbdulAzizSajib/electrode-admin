import { describe, expect, it } from 'vitest'
import { cloudinaryThumb } from '@/lib/cloudinary'

const UPLOAD = 'https://res.cloudinary.com/demo/image/upload/v1/Bariyan/images/earbuds.jpg'

describe('cloudinaryThumb', () => {
  it('requests a square thumbnail at 2x, cropped on the server', () => {
    expect(cloudinaryThumb(UPLOAD, 32, { crop: 'fill' })).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_fill,w_64,h_64/v1/Bariyan/images/earbuds.jpg',
    )
  })

  it('requests a whole-artwork preview bounded by width by default', () => {
    expect(cloudinaryThumb(UPLOAD, 300)).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_600/v1/Bariyan/images/earbuds.jpg',
    )
  })

  it('treats a generated video poster as an image', () => {
    const poster = 'https://res.cloudinary.com/demo/video/upload/v1/Bariyan/images/clip.jpg'
    expect(cloudinaryThumb(poster, 80)).toContain('/video/upload/f_auto,q_auto,c_limit,w_160/v1/')
  })

  it('is idempotent: a transformed URL is not transformed again', () => {
    const once = cloudinaryThumb(UPLOAD, 32, { crop: 'fill' })
    expect(cloudinaryThumb(once, 32, { crop: 'fill' })).toBe(once)
    const named = 'https://res.cloudinary.com/demo/image/upload/c_scale,w_500/v1/a.jpg'
    expect(cloudinaryThumb(named, 32)).toBe(named)
  })

  it('passes anything that is not a Cloudinary image through unchanged', () => {
    for (const url of [
      'https://cdn.example.com/banner.jpg',
      'https://res.cloudinary.com.evil.test/x/image/upload/v1/a.png',
      'https://res.cloudinary.com/demo/video/upload/v1/clip.mp4',
      'blob:http://localhost:5173/1234',
    ]) {
      expect(cloudinaryThumb(url, 32)).toBe(url)
    }
  })

  it('returns an empty string for a missing URL', () => {
    expect(cloudinaryThumb(null, 32)).toBe('')
    expect(cloudinaryThumb(undefined, 32)).toBe('')
    expect(cloudinaryThumb('', 32)).toBe('')
  })
})

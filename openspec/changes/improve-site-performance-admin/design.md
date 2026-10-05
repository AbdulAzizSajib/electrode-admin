## Context

The admin renders Cloudinary URLs straight from API records into `<img>`. `components/ui/thumbnail.tsx` is the shared list thumbnail. It handles the empty and broken cases and loads lazily, but it sizes only through `className` and requests the original. The other 15 preview sites are raw `<img>` tags. Uploads return `secure_url` of the form `https://res.cloudinary.com/<cloud>/image/upload/v<n>/<public_id>.<ext>`, and video posters live under `/video/upload/…jpg`.

## Goals / Non-Goals

**Goals:** previews cost bytes proportional to their on-screen size, with one helper and no change to saved values.

**Non-Goals:**
- The rich-text editor's embedded images. See the proposal.
- Responsive `srcset` in the admin. It is a desktop tool where 2× of the CSS size covers retina, and one URL per preview keeps it simple.

## Decisions

### D1. Transform at render time, never at save time
`cloudinaryThumb` is applied only where a URL is put into `src`. Form state, query cache and payloads keep the original. This is what satisfies the "saved URLs unchanged" requirement without special-casing any form. It is also why the helper must be idempotent: a URL that already carries a transformation segment (`/upload/<transform>/v123/…`) is returned unchanged rather than double-transformed.

### D2. `c_fill` for square thumbnails, `c_limit` for previews
List thumbnails are `object-cover` squares, so `c_fill,w_N,h_N` also crops on the server and saves bytes. Banner, slider, logo and settings previews show the whole artwork with `object-contain`, so they use `c_limit,w_N` to keep the aspect ratio. The caller chooses via `{ crop }`, which defaults to `limit`.

### D3. `Thumbnail` takes `size`
`Thumbnail` gains `size: number` (CSS px, default 40). It requests at `2 × size` and sets `width`/`height` attributes, so layout is reserved before the image loads. `className` keeps controlling the visual box. The 11 callers pass the size their class already implies (`size-8` → 32).

### D4. Same regex as the storefront
The helper matches `/(image|video)/upload/`, and for `video/upload` it only transforms URLs with an image extension (posters). It is written in the admin rather than shared, because the admin and storefront are separate repositories with no shared package. The duplication is about 20 lines and both copies are unit-tested.

## Risks / Trade-offs

- **[A merchant's existing URL already has a named transformation]** → It is detected and left alone (D1).
- **[Cloudinary derivative quota]** → Thumbnails are a handful of fixed widths (64, 80, 96, …), so derivatives are generated once and reused. That is cheaper than serving originals in bandwidth, which is the larger quota.

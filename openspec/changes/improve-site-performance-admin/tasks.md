## 1. Helper

- [x] 1.1 Add `src/lib/cloudinary.ts` exporting `cloudinaryThumb(url, width, { crop?: 'fill' | 'limit' })`:
  - `fill` produces `f_auto,q_auto,c_fill,w_{2w},h_{2w}`
  - `limit` produces `f_auto,q_auto,c_limit,w_{2w}`
  - it matches `/(image|video)/upload/` (video only with an image extension)
  - it is idempotent on URLs that already carry a transformation
  - it passes non-Cloudinary, empty and `null` input through
- [x] 1.2 Add `src/lib/cloudinary.test.ts` covering each case in 1.1.

## 2. Thumbnail and callers

- [x] 2.1 `components/ui/thumbnail.tsx`: add `size` (default 40), request `cloudinaryThumb(url, size, { crop: 'fill' })`, and set `width`/`height`. Keep the existing empty and broken behaviour.
- [x] 2.2 Pass `size` at each of the 11 `Thumbnail` callers, matching their current class.
  - There were 5 call sites, not 11 (11 was the count of files mentioning the word): media sidebar (320 and 48), order create (32), order detail (40), orders list (32).

## 3. Direct previews

- [x] 3.1 Product screens: `products-list-page.tsx:~81` (32, fill, add `loading="lazy"`), `product-detail-page.tsx:~104` and `image-upload-field.tsx:~122`.
  - `image-upload-field.tsx` was left alone: its previews are `blob:` URLs of files not yet uploaded, which the helper would pass through anyway.
- [x] 3.2 Form fields: `components/forms/single-image-field.tsx:~48`, `blog-media-field.tsx:~90,~110`, `landing-pages/image-url-field.tsx:~103` and `checkout-settings/account-icon-field.tsx:~83` (limit, at preview width).
- [x] 3.3 Merchandising: `banners-page.tsx:~110`, `home-slider-page.tsx:~666,~778` and `site-settings-page.tsx:~1364` (limit).
- [x] 3.4 `sales/orders/documents/document-parts.tsx:~32`: limit at a print width of about 300 px. `components/layout/auth-layout.tsx:~76`: limit at its rendered width.
- [x] 3.5 Grep `<img` under `src/`, and confirm that every remaining hit is either routed through the helper or is the rich-text editor.

## 4. Verification

- [x] 4.1 `cd admin && npx vitest run` (from an uppercase `E:\` path), `npm run lint`, `npm run build`.
  - 2026-10-05: vitest 421/424. The 3 failures (`product-form-page` ×2, `variant-editor`) fail identically on the pre-change code.
  - Lint on the changed files: 1 pre-existing warning (`order-create-page.tsx`, react-hook-form `watch`).
  - Build passes.
- [ ] 4.2 In the browser network tab:
  - Not run here: it needs a signed-in admin session in a browser. The saved-URL half holds by construction, because `cloudinaryThumb` is only ever called inside `src={…}` and never on form state or payloads.
  - the product list's image requests carry `w_64` and total well under the previous size
  - edit a banner and save it unchanged, and confirm the request payload's image URL equals the loaded one

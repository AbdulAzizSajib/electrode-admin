## Why

Every image preview in the admin panel loads the Cloudinary original. A 20-row product table with 32 px thumbnails can pull 20 multi-megabyte photos, and the same is true of order lists, banners, the home slider and settings previews. The admin has no Cloudinary URL helper at all. This is the admin part of the site-performance work, alongside `improve-site-performance` (server) and `improve-site-performance-ui` (storefront).

## What Changes

- Add `src/lib/cloudinary.ts` with `cloudinaryThumb(url, width, { crop? })`. It inserts `f_auto,q_auto,c_<fill|limit>,w_<2×width>` into Cloudinary upload URLs and returns any other URL unchanged.
- `Thumbnail` takes the rendered size and requests through the helper. Its 11 callers pass their size.
- The direct `<img>` previews (product list and detail, image upload fields, banners, home slider, blog media, landing image field, site settings, account icon field) request through the helper at their rendered size and load lazily.
- Order documents (invoice/packing slip) request a print-appropriate width instead of the original.
- No behaviour change to what is uploaded or saved: the stored URL is still the original. Only the preview request changes.

## Capabilities

### New Capabilities
- `admin-image-previews`: image previews in the admin panel are requested at their display size, not as originals.

### Modified Capabilities
None.

## Impact

- **Code**: the new `src/lib/cloudinary.ts` with tests, `src/components/ui/thumbnail.tsx` and its callers, and the 15 direct `<img>` sites listed in tasks.md.
- **Not touched**: the rich-text editor's in-document images. Those are the merchant's content being edited, so the editor shows exactly what the storefront renders from; the storefront change bounds them at display time.
- **Dependencies**: none.

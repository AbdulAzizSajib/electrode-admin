## Purpose

Keeps the admin panel fast on list and settings screens by requesting every Cloudinary image preview at the size it is shown, never as the original upload.

## ADDED Requirements

### Requirement: Image previews are requested at display size
Every Cloudinary image the admin panel displays as a preview (list thumbnails, form previews, banner and slider previews, settings previews, order documents) SHALL be requested with automatic format, automatic quality and a width no greater than twice its rendered width. Previews below the fold SHALL load lazily. A URL that is not a Cloudinary upload URL SHALL be requested unchanged.

#### Scenario: Product list thumbnails
- **WHEN** an admin opens the product list showing 32 px thumbnails
- **THEN** each thumbnail request is for an image no wider than 64 px with `f_auto` and `q_auto`

#### Scenario: Upload field preview after upload
- **WHEN** an admin uploads a product image and the form shows its preview
- **THEN** the preview is requested at the preview's display size, not as the original

#### Scenario: Non-Cloudinary URL
- **WHEN** a preview's URL is a pasted link to another host
- **THEN** the admin requests that URL exactly as entered

### Requirement: Saved image URLs are unchanged by previews
Requesting a resized preview SHALL NOT change the URL that is saved on the record or sent to the API.

#### Scenario: Editing a banner without changing its image
- **WHEN** an admin opens a banner, which shows a resized preview, and saves without touching the image
- **THEN** the saved image URL is identical to the URL loaded from the API

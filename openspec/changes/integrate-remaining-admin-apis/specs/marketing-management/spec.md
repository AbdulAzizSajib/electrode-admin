## Purpose

Covers how the admin panel manages promotional banners, discount coupons, and merchandising campaigns against the real backend marketing API, replacing the earlier mock in-memory data.

## ADDED Requirements

### Requirement: Banner Listing and Placement
The system SHALL list every banner regardless of status from the admin banner endpoint, showing each banner's placement, status, sort order, and scheduling window, and SHALL allow filtering the list by placement and by status.

#### Scenario: List banners including drafts
- **WHEN** the user opens the banners page
- **THEN** the system requests the admin banner list and displays banners in every status, including drafts and inactive ones, not only those a storefront visitor would see

#### Scenario: Filter banners by placement
- **WHEN** the user filters banners to a single placement
- **THEN** the system re-requests the banner list with that placement filter and displays only matching banners

### Requirement: Banner Creation and Artwork Upload
The system SHALL create a banner by sending its placement, type, status, sort order, and presentation fields together with any selected desktop and mobile artwork files in a single multipart request, and SHALL accept a banner with no artwork.

#### Scenario: Create a banner with desktop and mobile artwork
- **WHEN** the user submits the new-banner form with a placement, a desktop image file, and a mobile image file
- **THEN** the system sends the fields and both files in one multipart request, and on success the new banner appears in the banner list

#### Scenario: Create a banner without artwork
- **WHEN** the user submits the new-banner form with no image selected
- **THEN** the system sends the request without artwork and the banner is created, since banner artwork is optional

#### Scenario: Rejected artwork
- **WHEN** the user selects a file the backend rejects and submits the form
- **THEN** the system shows the backend's rejection message and no banner is created

### Requirement: Banner Scheduling
The system SHALL let the user set an optional start and end time on a banner and SHALL send both as part of the banner payload, so a banner can be scheduled to appear and expire without further manual action. The system SHALL treat an absent start or end time as an open-ended window rather than substituting a default.

#### Scenario: Schedule a banner for a future window
- **WHEN** the user sets a start time and an end time on a banner and saves
- **THEN** the system sends both timestamps to the backend, and the banner list reflects the scheduled window on success

#### Scenario: Save a banner with no end time
- **WHEN** the user sets a start time but leaves the end time empty and saves
- **THEN** the system sends the banner with no end time and the banner remains active indefinitely

### Requirement: Banner Ordering
The system SHALL let the user set a banner's sort order as a directly editable numeric value on the banner itself.

#### Scenario: Change a banner's sort order
- **WHEN** the user edits a banner's sort order value and saves
- **THEN** the system sends the new sort order to the backend, and the banner list re-orders on success

### Requirement: Banner Link Target
The system SHALL allow a banner to link either to a manually entered URL or to a selected product, and SHALL send whichever the user chose.

#### Scenario: Link a banner to a product
- **WHEN** the user selects a product as the banner's link target and saves
- **THEN** the system sends the product association to the backend rather than a manual URL

### Requirement: Coupon Management
The system SHALL create, list, update, and delete coupons against the backend, sending the coupon's code, discount type, discount value, status, and its optional minimum order amount, maximum discount amount, usage limit, per-customer limit, and validity window.

#### Scenario: Create a percentage coupon with a spend floor
- **WHEN** the user submits the new-coupon form with a percentage discount type, a value, and a minimum order amount
- **THEN** the system sends those fields to the backend, and on success the new coupon appears in the coupon list

#### Scenario: Create a coupon with no usage limit
- **WHEN** the user submits the new-coupon form leaving the usage limit empty
- **THEN** the system sends the coupon with no usage limit and the coupon is created with unlimited redemptions

#### Scenario: Duplicate coupon code
- **WHEN** the user submits a coupon whose code already exists and the backend rejects the request
- **THEN** the system shows the backend's rejection message and no coupon is created

### Requirement: Coupon Usage Visibility
The system SHALL display each coupon's redemption count as reported by the backend and SHALL NOT allow the user to edit it, since redemption counts are recorded server-side as orders are placed.

#### Scenario: View a coupon's redemption count
- **WHEN** the user views the coupon list
- **THEN** each coupon shows its backend-reported usage count, presented as read-only

### Requirement: Campaign Management
The system SHALL create, list, update, and delete campaigns against the backend, sending the campaign's name, status, optional description, optional placement, and optional start and end times.

#### Scenario: Create a scheduled campaign
- **WHEN** the user submits the new-campaign form with a name, a scheduled status, and a start and end time
- **THEN** the system sends those fields to the backend, and on success the new campaign appears in the campaign list

#### Scenario: Change a campaign's status
- **WHEN** the user changes a campaign's status and saves
- **THEN** the system sends the status change to the backend, and the campaign list and detail reflect the new status on success

### Requirement: Campaign Product Association
The system SHALL let the user associate products with a campaign and SHALL send those associations to the backend, and the campaign detail SHALL display the campaign's currently associated products as returned by the backend.

#### Scenario: Add products to a campaign
- **WHEN** the user selects two products for a campaign and saves
- **THEN** the system sends the product associations to the backend, and the campaign detail lists both products on success

#### Scenario: View a campaign with no products
- **WHEN** the user opens a campaign that has no associated products
- **THEN** the campaign detail shows an empty product list rather than an error

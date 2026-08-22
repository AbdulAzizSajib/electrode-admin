## Purpose

Lets store staff run promotions — discount coupons, marketing campaigns, and storefront banners.

## ADDED Requirements

### Requirement: Coupon Management
The system SHALL provide list, create, edit, and delete UI for coupons, covering code, discount type (percentage or fixed), discount value, usage limit, current usage count, minimum order amount, validity window (start/end date), and active status.

#### Scenario: Prevent duplicate code
- **WHEN** the user saves a coupon whose code matches an existing mock coupon's code
- **THEN** the system shows a validation error and does not save

#### Scenario: Validity window enforced in UI
- **WHEN** the user sets an end date earlier than the start date
- **THEN** the system shows a validation error and does not save

### Requirement: Campaign Management
The system SHALL provide list, create, edit, and delete UI for marketing campaigns, covering name, description, associated coupons/products, start/end date, and active status.

#### Scenario: View campaign performance placeholder
- **WHEN** the user opens a campaign's detail page
- **THEN** the page shows mock performance metrics (e.g. views, redemptions) alongside the campaign's configuration

### Requirement: Banner Management
The system SHALL provide list, create, edit, and delete UI for storefront banners, covering image, title, link target, display position, sort order, and active status, matching the fields exposed by the `/banners/admin` endpoints.

#### Scenario: Reorder banners
- **WHEN** the user changes a banner's sort order (e.g. via drag or a position field)
- **THEN** the banner list reflects the new order and subsequent saves persist that order in the mock store

#### Scenario: Toggle active status
- **WHEN** the user toggles a banner's active status from the list
- **THEN** the mock banner record updates without requiring the full edit form

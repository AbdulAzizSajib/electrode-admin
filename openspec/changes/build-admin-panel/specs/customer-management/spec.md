## Purpose

Lets store staff look up customer accounts and moderate product reviews submitted by customers.

## ADDED Requirements

### Requirement: Customer List and Detail
The system SHALL display a paginated, searchable list of customer accounts (name, email, join date, order count, total spent) and a detail view per customer showing profile info, saved addresses, and order history, scoped to users with the CUSTOMER role.

#### Scenario: Search by name or email
- **WHEN** the user types into the customer list search field
- **THEN** the list filters to mock customers whose name or email contains the search text

#### Scenario: Navigate to customer's orders
- **WHEN** the user views a customer's detail page
- **THEN** the order history section lists that customer's mock orders and each links to its order detail page

### Requirement: Staff/Admin User Directory
The system SHALL display a paginated, searchable list of staff/admin user accounts (name, email, role, active status) separate from the customer list, matching the `/users` admin endpoint's scope, and allow editing a user's role and active status.

#### Scenario: Change a staff user's role
- **WHEN** an OWNER or ADMIN user changes another user's role
- **THEN** the mock user record updates and, on next navigation, that user's nav visibility reflects the new role

#### Scenario: Deactivate a user
- **WHEN** the user toggles a staff account to inactive
- **THEN** the mock record updates and the account is flagged inactive in the list

### Requirement: Review Moderation
The system SHALL display a paginated, filterable (by status and rating) list of product reviews showing product, customer, rating, comment excerpt, and status (pending, approved, rejected), and SHALL allow changing a review's status and editing/removing its content.

#### Scenario: Approve a pending review
- **WHEN** the user sets a pending review's status to approved
- **THEN** the mock review record updates and would become visible on the storefront product page

#### Scenario: Reject a review
- **WHEN** the user sets a review's status to rejected
- **THEN** the mock review record updates and is excluded from any "approved" filtered view

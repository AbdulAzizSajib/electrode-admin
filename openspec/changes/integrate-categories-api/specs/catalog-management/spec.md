## Purpose

Covers how the admin panel manages the product category tree (including nested/child categories) against the real backend category API, replacing the earlier mock in-memory data.

## ADDED Requirements

### Requirement: Category List and Filtering
The system SHALL fetch categories from the backend's admin list endpoint, passing page, page size, name search, active-status, and parent-category filters as query parameters, and SHALL render the returned page of categories with each row's parent name (when present).

#### Scenario: Search by name
- **WHEN** the user types into the category search field
- **THEN** the system re-requests the category list with that text as the search filter and displays only matching categories

#### Scenario: Backend unreachable or returns an error
- **WHEN** the category list request fails (network error or a non-success response)
- **THEN** the system shows an error state with a retry action instead of a stale or empty table

### Requirement: Category Create
The system SHALL create a category by sending name, description, image URL, active status, sort order, and optional parent category to the backend, and SHALL treat the slug as server-generated (not collected from the user).

#### Scenario: Create a top-level category
- **WHEN** the user submits the create-category form without selecting a parent
- **THEN** the system sends the category fields with no parent reference, and on success the newly created category (including the server-assigned slug) appears in the category list

#### Scenario: Create a child category
- **WHEN** the user submits the create-category form with a parent category selected
- **THEN** the system sends that parent's identifier as the parent reference, and on success the new category is associated with the chosen parent

#### Scenario: Create request fails
- **WHEN** the backend rejects the create request
- **THEN** the system keeps the form open and shows the backend's error message instead of closing or clearing the form

### Requirement: Category Edit
The system SHALL update a category by submitting the edit form's fields (name, description, image, active status, sort order, parent) to the backend, and SHALL refresh the category list from the backend after a successful update instead of assuming the response mirrors local state.

#### Scenario: Edit an existing category
- **WHEN** the user changes the description and sort order on an existing category and submits
- **THEN** the system sends the update request, and the category list reflects the updated values on success; fields the form doesn't expose (for example SEO title/description) remain as the backend returns them, since the form never sends them

### Requirement: Category Delete
The system SHALL request deletion of a category from the backend and SHALL surface the backend's rejection reason (for example, a category that still has child categories) instead of a generic failure message when the delete request fails.

#### Scenario: Successful delete
- **WHEN** the user confirms deleting a category and the backend accepts the request
- **THEN** the category no longer appears in the category list

#### Scenario: Backend rejects the delete
- **WHEN** the user confirms deleting a category and the backend returns an error (for example, because it still has children)
- **THEN** the system shows the backend's error message and the category remains in the list

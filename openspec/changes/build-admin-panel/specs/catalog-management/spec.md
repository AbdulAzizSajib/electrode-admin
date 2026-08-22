## Purpose

Lets store staff manage the product catalog — products, categories, and brands — that customers browse in the storefront.

## ADDED Requirements

### Requirement: Product List and Filtering
The system SHALL display a paginated, searchable, sortable list of products showing image thumbnail, name, SKU, category, brand, price, stock status, and publish status, matching the fields exposed by the `/products/admin` endpoint.

#### Scenario: Search by name or SKU
- **WHEN** the user types into the product list search field
- **THEN** the list filters to mock products whose name or SKU contains the search text

#### Scenario: Filter by category, brand, or status
- **WHEN** the user selects a category, brand, or publish-status filter
- **THEN** the list shows only mock products matching all active filters

### Requirement: Product Create and Edit
The system SHALL provide a create/edit form for products covering name, slug, description, SKU, price, compare-at price, brand, one or more categories, images, and publish status, with client-side validation on required fields and numeric ranges.

#### Scenario: Validation blocks submit
- **WHEN** the user submits the product form with a missing name or a negative price
- **THEN** the system shows inline field errors and does not save the record

#### Scenario: Successful create
- **WHEN** the user submits a valid new product form
- **THEN** the mock product store gains a new record and the user is navigated to the product's detail page with a success toast

#### Scenario: Manage category associations
- **WHEN** the user adds or removes a category on the product edit form
- **THEN** the product's category associations update accordingly, mirroring the collection's product-category link/unlink endpoints

### Requirement: Product Delete
The system SHALL allow deleting a product from the list or detail view after a confirmation step.

#### Scenario: Confirm before delete
- **WHEN** the user chooses Delete on a product
- **THEN** the system shows a confirmation dialog and only removes the mock record if the user confirms

### Requirement: Category Management
The system SHALL provide list, create, edit, and delete UI for categories, including a parent category selector to support nested categories.

#### Scenario: Assign parent category
- **WHEN** the user selects a parent category while creating or editing a category
- **THEN** the category is saved with that parent reference and appears nested under it in the category list

#### Scenario: Prevent deleting a category with children
- **WHEN** the user attempts to delete a category that has child categories
- **THEN** the system blocks the deletion with an explanatory message

### Requirement: Brand Management
The system SHALL provide list, create, edit, and delete UI for brands, covering name, slug, logo image, and description.

#### Scenario: Duplicate slug prevented
- **WHEN** the user saves a brand whose slug matches an existing mock brand's slug
- **THEN** the system shows a validation error and does not save

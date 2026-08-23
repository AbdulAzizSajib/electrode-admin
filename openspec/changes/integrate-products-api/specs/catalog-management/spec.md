## Purpose

Covers how the admin panel manages products — simple and variable, with images, custom attributes, and variants — against the real backend product API, replacing the earlier mock in-memory data.

## ADDED Requirements

### Requirement: Product List and Filtering
The system SHALL fetch products from the backend's list endpoint, passing page, page size, name/SKU search, category, brand, and status filters as query parameters, and SHALL render the returned page of products with each row's category name, brand name, and stock status.

#### Scenario: Search by name or SKU
- **WHEN** the user types into the product search field
- **THEN** the system re-requests the product list with that text as the search filter and displays only matching products

#### Scenario: Filter by status
- **WHEN** the user filters the product list to Active or Draft
- **THEN** the system re-requests the product list with that status filter and displays only matching products

#### Scenario: Backend unreachable or returns an error
- **WHEN** the product list request fails (network error or a non-success response)
- **THEN** the system shows an error state with a retry action instead of a stale or empty table

### Requirement: Product Create
The system SHALL create a product by sending name, SKU, description, short description, type, status, category, brand, price, compare-at price, stock quantity, low-stock threshold, featured flag, images, custom attributes, and (for variable products) variants to the backend, and SHALL treat the slug as server-generated (not collected from the user).

#### Scenario: Create a simple product
- **WHEN** the user submits the create-product form with type set to Simple
- **THEN** the system sends the product fields without a variants list, and on success the newly created product (including the server-assigned slug) appears in the product list

#### Scenario: Create a variable product with variants
- **WHEN** the user submits the create-product form with type set to Variable and at least one variant (name, SKU, price, stock quantity, and its own attribute name/value pairs)
- **THEN** the system sends the product fields together with the variants list, and on success the new product is created with those variants

#### Scenario: Variable product with no variants
- **WHEN** the user submits the create-product form with type set to Variable but no variant rows added
- **THEN** the system blocks submission and shows a validation error instead of sending the request

#### Scenario: Add product images
- **WHEN** the user adds one or more image rows (URL, optional alt text, primary marker) before submitting
- **THEN** the system sends the images list with each row's sort order preserved and exactly one row marked primary

#### Scenario: Add custom attributes
- **WHEN** the user adds one or more name/value attribute rows (for example Brand, Warranty) before submitting
- **THEN** the system sends the attributes list as entered

#### Scenario: Create request fails
- **WHEN** the backend rejects the create request
- **THEN** the system keeps the form open and shows the backend's error message instead of closing or clearing the form

### Requirement: Product Edit
The system SHALL update a product by submitting the edit form's fields (including images, attributes, and variants) to the backend, and SHALL refresh the product from the backend after a successful update instead of assuming the response mirrors local state.

#### Scenario: Edit an existing product's pricing and stock
- **WHEN** the user changes price, compare-at price, stock quantity, or low-stock threshold on an existing product and submits
- **THEN** the system sends the update request, and the product detail/list reflect the updated values on success

#### Scenario: Switch a product from Simple to Variable
- **WHEN** the user changes an existing product's type to Variable and adds at least one variant, then submits
- **THEN** the system sends the updated type together with the variants list, and the product's detail view reflects the new type and variants on success

#### Scenario: Add or remove images and attributes on edit
- **WHEN** the user adds, removes, or reorders image or attribute rows on an existing product and submits
- **THEN** the system sends the full updated images/attributes lists, and the product detail view reflects the change on success

### Requirement: Product Delete
The system SHALL request deletion of a product from the backend and SHALL surface the backend's rejection reason instead of a generic failure message when the delete request fails.

#### Scenario: Successful delete
- **WHEN** the user confirms deleting a product and the backend accepts the request
- **THEN** the product no longer appears in the product list

#### Scenario: Backend rejects the delete
- **WHEN** the user confirms deleting a product and the backend returns an error
- **THEN** the system shows the backend's error message and the product remains in the list

### Requirement: Product Detail Display
The system SHALL display a product's type, status, featured flag, category, brand, images (with the primary image distinguished), custom attributes, and — for variable products — its variants with each variant's own attributes.

#### Scenario: View a simple product
- **WHEN** the user opens a Simple product's detail page
- **THEN** the system shows its images, attributes, price, and stock without a variants section

#### Scenario: View a variable product
- **WHEN** the user opens a Variable product's detail page
- **THEN** the system shows a variants table listing each variant's name, SKU, price, stock quantity, and attribute values

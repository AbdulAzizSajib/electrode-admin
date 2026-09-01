## Purpose

Covers how the admin panel manages products — simple and variable, with images, custom attributes, and variants — against the real backend product API, replacing the earlier mock in-memory data.

## ADDED Requirements

### Requirement: Assigning a Product Image to a Variant
The product form SHALL let an admin assign each image of a variable product to one of that product's variants, or leave it shared across all variants. Shared SHALL be the default for every image, so an admin who assigns nothing produces the same result as before this capability existed. The control SHALL be offered for both URL-based images and files staged for upload, so an image's assignment is set wherever that image is entered.

#### Scenario: Assigning an image to a variant
- **WHEN** the admin selects a variant for an image row on a variable product
- **THEN** that image is recorded as belonging to the selected variant, with no other image's assignment affected

#### Scenario: Leaving an image shared
- **WHEN** the admin adds an image and does not choose a variant for it
- **THEN** the image is submitted with no variant assignment, meaning it applies to every variant

#### Scenario: Assigning a file staged for upload
- **WHEN** the admin stages a file for upload and selects a variant for it before submitting
- **THEN** the file is uploaded and stored assigned to that variant in the same submission, with no second edit required

#### Scenario: Simple products offer no assignment
- **WHEN** the admin edits a product whose type is simple
- **THEN** no variant assignment control is shown on any image row

#### Scenario: No named variants yet
- **WHEN** the product is variable but no variant has been given a name yet
- **THEN** the assignment control indicates there are no variants to choose from rather than presenting an empty or unlabeled list

### Requirement: Submitting Image-to-Variant Assignments
The system SHALL submit each image's variant assignment in the same request that creates or updates the product, identifying the variant by its backend id where one exists and by its position in the submitted variant list where it does not. The image list and the variant list SHALL be built from one source of truth in the same submission, so a position submitted for an image always refers to the variant the admin selected.

#### Scenario: Creating a product with assigned images
- **WHEN** the admin creates a variable product with variants and images assigned to them
- **THEN** the product, its variants, and the image assignments are sent in one request, with each assignment identifying its variant by position in the submitted variant list
- **AND** the created product returned by the backend reflects those assignments

#### Scenario: Editing a product with existing variants
- **WHEN** the admin assigns an image to a variant that already exists on the saved product
- **THEN** the assignment is submitted identifying that variant by its backend id

#### Scenario: Assigning to a variant added in the same edit
- **WHEN** the admin adds a new variant and assigns an image to it without saving in between
- **THEN** the assignment is submitted identifying that variant by its position in the submitted variant list
- **AND** both the new variant and the assignment are applied in one request

#### Scenario: Clearing an assignment
- **WHEN** the admin changes an image that was assigned to a variant back to shared
- **THEN** the update submits that image with no variant assignment, clearing the previous one

#### Scenario: Removing an assigned variant
- **WHEN** the admin deletes a variant row that images were assigned to
- **THEN** those images revert to shared in the form before submission
- **AND** the request contains no reference to the removed variant

#### Scenario: Backend rejects an assignment
- **WHEN** the product create or update fails because an image named a variant the backend does not accept
- **THEN** the form shows the error and stays open with the admin's input intact, rather than discarding the edit

### Requirement: Displaying Image-to-Variant Assignments
The product detail view SHALL show which variant each image is assigned to, or that it is shared, so an admin can verify assignments without entering edit mode. The product form SHALL show each image's saved assignment when an existing product is opened for editing.

#### Scenario: Viewing assignments on the detail page
- **WHEN** the admin views a variable product whose images are assigned to variants
- **THEN** each image is labeled with the variant it belongs to, and images with no assignment are labeled as shared

#### Scenario: Editing preserves saved assignments
- **WHEN** the admin opens a saved product for editing
- **THEN** each image row shows its saved variant assignment as the current selection
- **AND** saving without changing anything leaves every assignment as it was

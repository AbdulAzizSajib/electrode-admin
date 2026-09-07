## Purpose

Covers how the admin panel lets a merchant author a product, and specifically how the reference records a product depends on — its category, brand, collections, tax rule, bundle deal, and the shop attributes behind its variants — can be created from the product form itself, without abandoning the product being written.

## ADDED Requirements

### Requirement: Reference Pickers Offer To Create What Is Missing

Every reference picker on the product form SHALL offer an action that creates a new record of that picker's kind: Category, Brand, Collections, Tax rule, Bundle deal, and the shop attributes the variant section selects from.

For a picker presented as a searchable option list, the action SHALL be offered below the options and SHALL remain offered in every state the list can be in once its options have arrived — a full list, a list narrowed to nothing by what was typed, and a list that is empty because no such record exists. The action SHALL be named for what it creates, so a merchant reads which kind of record they are about to add rather than a bare "Add".

The action SHALL NOT be presented as one of the options. Choosing an option and creating a record are different outcomes, and confirming a highlighted option SHALL never open the create modal.

While a picker's options are still loading, the action MAY be withheld, since the merchant cannot yet know whether what they want is missing.

#### Scenario: Searching for a brand that does not exist

- **WHEN** the merchant types a brand name into the Brand picker and no option matches
- **THEN** the picker reports that nothing matched what was typed
- **AND** the action to create a brand is still offered

#### Scenario: The list is not empty

- **WHEN** the merchant opens the Collections picker and collections exist
- **THEN** the create action is offered below the collections, without having to search first

#### Scenario: The resource has no records at all

- **WHEN** the merchant opens a picker whose resource has no records
- **THEN** the picker reports that there are none yet
- **AND** the action to create the first one is offered

#### Scenario: Confirming an option does not create

- **WHEN** the merchant highlights an option with the keyboard and confirms it
- **THEN** that option becomes the field's value and no create modal opens

### Requirement: Creating A Reference Record Without Leaving The Product Form

Invoking a picker's create action SHALL open a modal over the product form. The panel SHALL NOT navigate away from the product form, change its address, or reload it, at any point in the interaction.

Everything already entered on the product form SHALL be preserved for the whole interaction — while the modal is open, after a successful create, after a cancelled modal, and after a create the backend rejected.

Submitting the modal SHALL create only the reference record. It SHALL NOT create, update, or submit the product being authored.

#### Scenario: The product form is preserved through a create

- **WHEN** the merchant has filled in a product's name, description, price, and images, then creates a brand from the Brand picker
- **THEN** the brand is created
- **AND** every value already entered on the product form is still present and unchanged, other than the brand field

#### Scenario: Cancelling changes nothing

- **WHEN** the merchant opens a create modal, types into it, and cancels
- **THEN** no record is created, the picker's value is unchanged, and the product form is untouched

#### Scenario: The modal does not submit the product

- **WHEN** the merchant submits a create modal opened from the product form
- **THEN** the product is neither created nor updated, whatever state the product form is in

### Requirement: The Created Record Becomes The Field's Value

When a record is created from a picker's modal, the panel SHALL make it that field's value without any further action from the merchant: selected for a single-value picker, and added to the existing selection for a multi-value picker, leaving values already selected in place.

The newly created record SHALL be shown by name as the field's value immediately, and SHALL be offered among that picker's options from then on — the merchant SHALL NOT have to reload the page or reopen the picker for it to appear.

A successful create SHALL confirm what was created, naming the record type and the record.

#### Scenario: A created brand is selected

- **WHEN** the merchant searches the Brand picker for a brand that does not exist, creates it from the picker, and the create succeeds
- **THEN** the modal closes, the Brand field reads the new brand's name, and a confirmation names the brand that was created

#### Scenario: A created collection joins the selection

- **WHEN** the merchant has two collections selected and creates a third from the Collections picker
- **THEN** all three are selected, with the two earlier ones unchanged

#### Scenario: The new record is available as an option

- **WHEN** the merchant creates a tax rule from the Tax rule picker and then reopens that picker
- **THEN** the new tax rule appears among the options

### Requirement: What A Quick-Create Modal Collects

A create modal SHALL collect the record's name, required, plus only the fields that make the record usable on a product:

- **Brand** — description, logo (uploaded file or URL), and whether it is active.
- **Category** — parent, description, image, and whether it is active.
- **Collection** — whether it is visible.
- **Tax rule** — whether the charge is flat or a percentage, and its value.
- **Bundle deal** — the buy quantity and the free quantity.
- **Attribute** — how its values are presented, and the values themselves, each with a label and an optional swatch.

A create modal SHALL NOT offer the remaining fields of that resource's own form, and SHALL NOT edit or delete an existing record. Those SHALL remain the resource's own authoring page.

A record created this way SHALL be indistinguishable from one created on that resource's page: the same record, reachable and editable there afterwards.

#### Scenario: Creating a brand with only a name

- **WHEN** the merchant submits the brand modal with a name and nothing else
- **THEN** the brand is created and selected, with the fields left blank taking the same defaults they would take on the brand page

#### Scenario: Name is required

- **WHEN** the merchant submits a create modal with an empty name
- **THEN** the modal reports that the name is required and nothing is created

#### Scenario: The created record is a full record

- **WHEN** the merchant creates a brand from the product form and later opens that brand on the brands list
- **THEN** the brand is present and editable there, carrying the values entered in the modal

### Requirement: Creating A Category At The Level It Was Invoked From

The Category picker presents one dropdown per level of the hierarchy. Invoking its create action from a level SHALL create the category at that level: the parent SHALL default to the category selected at the level above, or to no parent when invoked at the top level. The merchant SHALL be able to change that parent before submitting.

The created category SHALL become the field's value at the level it was created from, leaving the levels above it unchanged.

#### Scenario: Creating a subcategory

- **WHEN** the merchant has selected "Laptops" at one level and invokes the create action on the level below it
- **THEN** the modal opens with "Laptops" as the parent
- **AND** on success the new category is selected below "Laptops", which remains selected

#### Scenario: Creating a top-level category

- **WHEN** the merchant invokes the create action on the first level of the Category picker
- **THEN** the modal opens with no parent, and on success the new category is selected as the product's top-level category

### Requirement: Creating An Attribute From The Variant Section

The variant section selects attribute values as grouped checkboxes rather than from a dropdown, and SHALL offer its create action beside the section rather than inside an option list.

An attribute SHALL be created with at least one value, since an attribute with no values cannot produce a variant. On success, the new attribute SHALL appear in the section with every one of its values selected, and the product's variant combinations SHALL be rebuilt to include them, leaving the combinations already entered for other attributes intact.

#### Scenario: Creating an attribute with values

- **WHEN** the merchant creates an attribute named "Colour" with the values "Red" and "Blue"
- **THEN** "Colour" appears in the variant section with both values selected
- **AND** the combinations are rebuilt to cover them, with the rows already priced and stocked for other attributes carried over

#### Scenario: An attribute needs a value

- **WHEN** the merchant submits the attribute modal with a name but no values
- **THEN** the modal reports that at least one value is required and nothing is created

### Requirement: A Rejected Quick-Create Keeps The Modal Open

When the backend rejects a create, the modal SHALL stay open, SHALL show the reason, and SHALL keep everything the merchant typed. The picker's value SHALL be unchanged, and nothing SHALL be reported as created.

While a create is in flight, the modal SHALL show that it is working and SHALL NOT submit a second time.

#### Scenario: The backend rejects a duplicate name

- **WHEN** the merchant submits a brand whose name already exists and the backend rejects it
- **THEN** the modal stays open showing the reason, with the typed name still in the field, and the Brand field's value is unchanged

#### Scenario: Submitting twice

- **WHEN** the merchant submits a create modal and activates the submit control again before it has finished
- **THEN** only one record is created


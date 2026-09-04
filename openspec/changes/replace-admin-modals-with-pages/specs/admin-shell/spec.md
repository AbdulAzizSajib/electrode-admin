## Purpose

Governs how the admin panel presents and routes record authoring: creating and editing a record is a page the merchant navigates to, at an address they can link to and return to, rather than an overlay stacked on the list they came from. Also names the narrow set of overlays that are deliberately exempt, so the rule has an edge rather than being read as "no dialogs anywhere".

## ADDED Requirements

### Requirement: Record Authoring Happens On A Page

Creating or editing a record in the admin panel SHALL take place on its own routed page. The panel SHALL NOT present a create or edit form inside a modal, dialog, sheet, drawer, or any other overlay rendered on top of another surface.

A create or edit page SHALL occupy the same shell as every other page — the sidebar and topbar remain, and the list the merchant came from is replaced rather than dimmed behind the form.

#### Scenario: Creating a record from a list

- **WHEN** the merchant activates the create action on a resource's list page
- **THEN** the panel navigates to that resource's create page and the list is no longer displayed, with no overlay covering it

#### Scenario: Editing a record from a list row

- **WHEN** the merchant activates the edit action on a row of a resource's list page
- **THEN** the panel navigates to that record's edit page, pre-filled with the record's current values, and no overlay is shown

#### Scenario: No overlay authoring remains

- **WHEN** any create or edit form in the admin panel is rendered
- **THEN** it is rendered as a page at its own address, not inside a modal, dialog, sheet, or drawer

### Requirement: Authoring Pages Are Addressable

Every create and edit page SHALL have a distinct URL that identifies the resource and, when editing, the record. That URL SHALL be sufficient on its own to reach the form: opening it directly, restoring it from a bookmark, or reloading it SHALL render the same form, without first visiting the list.

The browser's back and forward controls SHALL move between the list and the form as ordinary navigation.

#### Scenario: Opening an edit URL directly

- **WHEN** the merchant opens a record's edit URL in a fresh tab, having never visited that resource's list in the session
- **THEN** the panel loads the record and renders its edit form with the record's current values

#### Scenario: Reloading a create page

- **WHEN** the merchant reloads the browser while on a create page
- **THEN** the panel renders an empty create form for that resource rather than returning to the list or showing not-found

#### Scenario: Back returns to the list

- **WHEN** the merchant navigates from a list to a create or edit page and then presses the browser's back control
- **THEN** the panel returns to the list

#### Scenario: Unknown record

- **WHEN** the merchant opens an edit URL whose record identifier does not resolve to a record
- **THEN** the panel shows a load failure for that resource with a way back to the list, rather than an empty form that would create a second record on save

### Requirement: Authoring Pages Behave Consistently

Every create and edit page SHALL offer the same controls and the same outcomes, regardless of which resource it authors:

- **Cancel** — abandons the form and returns to the resource's list.
- **Save and continue editing** — persists the record and stays on the form. When invoked on a create page, the page SHALL become the edit page for the record just created, so that pressing save again updates that record rather than creating a second one.
- **Save and return** — persists the record and returns to the resource's list.

A successful save SHALL confirm what happened, naming the record type and whether it was created or updated.

#### Scenario: Saving and returning

- **WHEN** the merchant submits a valid form with "Save and return"
- **THEN** the record is persisted, a confirmation names what was created or updated, and the panel returns to that resource's list showing the saved record

#### Scenario: Saving a new record and staying

- **WHEN** the merchant submits a valid create form with "Save and continue editing"
- **THEN** the record is persisted and the page becomes the edit page for that new record, so a subsequent save updates it instead of creating another

#### Scenario: Cancelling

- **WHEN** the merchant activates Cancel
- **THEN** the panel returns to that resource's list and nothing is persisted

### Requirement: A Rejected Save Preserves The Form

When a save is rejected — by field validation or by the backend — the page SHALL keep every value the merchant entered and SHALL state the reason at the top of the form, above the fields. The panel SHALL NOT navigate away, clear the form, or reset it to the record's stored values.

#### Scenario: Backend rejects a save

- **WHEN** the merchant submits a form and the backend refuses the request
- **THEN** the page stays on the form with every entered value intact, and the backend's reason appears above the fields

#### Scenario: Field validation fails

- **WHEN** the merchant submits a form with a field that fails validation
- **THEN** the page stays on the form, the failing fields are marked, and a message above the fields says some fields need attention

### Requirement: Authoring Pages Inherit The List's Access Control

A create or edit page SHALL require at least the access its resource's list page requires. A merchant who cannot reach a resource's list SHALL NOT be able to reach that resource's create or edit page by navigating to its URL directly.

#### Scenario: Restricted resource reached by URL

- **WHEN** a merchant whose role is not permitted to view a restricted resource's list opens that resource's create or edit URL directly
- **THEN** access is refused, exactly as it is refused for the list

### Requirement: Authoring Pages Carry Context From Where They Were Opened

When a resource's list offers a create action that implies context — such as adding a child under a specific parent in a category tree, or adding a sub-category under the currently selected category — the create page SHALL open with that context already applied, and the merchant SHALL NOT have to re-select it.

#### Scenario: Adding a child under a chosen parent

- **WHEN** the merchant activates the add-child action on a specific node of the category tree
- **THEN** the create page opens with that node already set as the new record's parent

#### Scenario: Creating without implied context

- **WHEN** the merchant activates the plain create action, with no parent or scope implied
- **THEN** the create page opens with no parent pre-selected

### Requirement: Confirmations And In-Context Actions Remain Overlays

The rule that authoring happens on a page SHALL NOT extend to surfaces that are not record authoring. The following SHALL remain overlays:

- Destructive confirmations, including deletes that first require choosing a replacement record, and the warning shown before a variant-option change discards combinations a product already carries.
- Short workflow actions taken against a record already on screen — adjusting stock, receiving purchase-order items, recording a payment, creating or updating a shipment, changing an order's status, completing or setting the status of a return, issuing a refund, and replying to a review.
- Read-only detail viewers, including the audit-log change detail and the refund detail.

These are decisions and short in-context actions rather than record authoring; routing them to a page would put a navigation in front of a confirmation.

#### Scenario: Confirming a delete

- **WHEN** the merchant activates delete on a row
- **THEN** a confirmation overlay names the record and asks for confirmation, without navigating away from the list

#### Scenario: Taking a workflow action on a record

- **WHEN** the merchant takes a short workflow action against the record currently on screen, such as adjusting stock or recording a payment
- **THEN** the action is presented as an overlay over that record, and the merchant returns to it directly on completion

### Requirement: Resource Authoring Routes

Each resource's create and edit pages SHALL be reachable at the addresses below. A resource that has no separate read-only detail page uses its identifier path as its edit page; a resource that already has a detail page keeps that path for the detail view and appends an edit segment.

| Resource | Create | Edit |
| --- | --- | --- |
| Brands | `/catalog/brands/new` | `/catalog/brands/:brandId` |
| Brands (bulk) | `/catalog/brands/bulk` | — |
| Categories | `/catalog/categories/new` | `/catalog/categories/:categoryId` |
| Sub-categories | `/catalog/sub-categories/new` | `/catalog/sub-categories/:categoryId` |
| Suppliers | `/inventory/suppliers/new` | `/inventory/suppliers/:supplierId` |
| Warehouses | `/inventory/warehouses/new` | `/inventory/warehouses/:warehouseId` |
| Banners | `/marketing/banners/new` | `/marketing/banners/:bannerId` |
| Vouchers | `/marketing/vouchers/new` | `/marketing/vouchers/:voucherId` |
| Campaigns | `/marketing/campaigns/new` | — (edited in place on `/marketing/campaigns/:campaignId`) |
| Shipping methods | `/sales/shipping-methods/new` | `/sales/shipping-methods/:shippingMethodId` |
| Roles | `/settings/roles/new` | `/settings/roles/:roleId` |
| Staff users | — (no create surface exists) | `/settings/staff/:userId` |

A dash means that resource has no such surface today, or already authors it in place on a page rather than in an overlay; neither case requires a new route.

A role's edit page authors its name and description. Which permissions a role grants is not authored there — that stays on `/settings/roles`, where the permission checkboxes are toggled against the role currently selected.

#### Scenario: Renaming a role

- **WHEN** the merchant opens a role's edit page, changes its name and saves
- **THEN** the role is renamed, and the permissions it grants are unaffected

Authoring pages SHALL NOT appear in the global navigation menu; they are reached from their resource's list.

#### Scenario: Sub-categories reuse the category form

- **WHEN** the merchant edits a sub-category from the sub-categories list
- **THEN** the same category authoring form is used, scoped to that record, so a field available when editing a category is available when editing a sub-category

#### Scenario: Bulk brand creation

- **WHEN** the merchant activates the bulk-create action on the brands list
- **THEN** the panel navigates to the bulk brand creation page, which is addressable and reloadable like any other authoring page

#### Scenario: Navigation menu unchanged

- **WHEN** the global navigation menu is rendered
- **THEN** it lists the same destinations as before, with no entry for any create or edit page

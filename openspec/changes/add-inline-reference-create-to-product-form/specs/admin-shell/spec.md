## Purpose

Governs the panel-wide form and messaging behaviour every authoring page inherits, including where the rule that record authoring happens on a routed page has its edge: an overlay may create a record the form in front of the merchant needs in order to be completed, and this states what such an overlay may and may not do.

## ADDED Requirements

### Requirement: An Overlay May Create A Record The Current Form References

Creating and editing a record is a routed page, not an overlay. As a narrow exception, a form MAY offer an overlay that creates a record that form references, so that a missing reference does not force the merchant to abandon a part-filled form to go and create it.

Such an overlay SHALL be limited in all of the following ways:

- It SHALL be reachable only from the field that references the record, and SHALL NOT be reachable from that resource's list, its detail page, or the navigation.
- It SHALL only create. It SHALL NOT edit or delete an existing record.
- It SHALL collect only the fields that make the created record usable by the form that opened it. The resource's remaining fields SHALL stay on its authoring page.
- It SHALL leave the underlying form exactly as it was, apart from the field the created record fills.
- It SHALL NOT replace that resource's create page, which SHALL remain reachable and SHALL remain the surface a merchant is sent to from that resource's list.

An overlay meeting all of these is an in-context action on the form being filled in, not record authoring, and SHALL NOT be read as permission to return create or edit forms to overlays anywhere else.

#### Scenario: Creating a referenced record from a field

- **WHEN** the merchant activates a create action on a reference field of a form they are filling in
- **THEN** an overlay opens that creates only that kind of record, and the form underneath keeps everything already entered

#### Scenario: The resource's own pages are unaffected

- **WHEN** the merchant activates the create action on that resource's own list page
- **THEN** the panel navigates to that resource's create page as before, with no overlay

#### Scenario: Editing still requires the page

- **WHEN** the merchant wants to change a record they created from a reference field
- **THEN** they do so on that resource's edit page; no overlay in the panel offers to edit it

### Requirement: A Nested Form Does Not Submit The Form It Sits In

An overlay that contains its own form SHALL submit only itself. Submitting it — by activating its submit control or by pressing Enter in one of its fields — SHALL NOT submit, validate, or otherwise act on the form it is rendered over.

Dismissing the overlay, whether by its cancel control, its close control, or Escape, SHALL leave the underlying form untouched and SHALL NOT trigger its validation.

#### Scenario: Enter inside the overlay

- **WHEN** the merchant presses Enter in a field of an overlay opened from a form
- **THEN** the overlay's own submit runs and the underlying form is not submitted

#### Scenario: Escape closes only the overlay

- **WHEN** the merchant presses Escape while the overlay is open
- **THEN** the overlay closes and the underlying form keeps its values, with no validation errors raised on it

### Requirement: An Option List May Offer An Action Below Its Options

A searchable option list MAY render a single action below its options, for something the merchant can do when no option suits — such as creating a new record.

That action SHALL NOT be part of the option collection: it SHALL NOT be counted as an option, SHALL NOT be reachable by the arrow keys that move through options, and SHALL NOT be what Enter confirms. It SHALL be reachable and activatable by keyboard through ordinary focus order.

The action SHALL be rendered alongside whichever of the list's three settled states is showing — options, nothing matched, or there are none yet — so it is available exactly when it is most needed. It MAY be withheld while the options are still loading.

#### Scenario: Arrow keys skip the action

- **WHEN** the merchant presses the down arrow repeatedly with the list open
- **THEN** the highlight cycles through the options only, and never lands on the action

#### Scenario: The action is keyboard reachable

- **WHEN** the merchant moves focus forward from the list's search field
- **THEN** focus reaches the action and it can be activated from the keyboard

#### Scenario: Offered when nothing matched

- **WHEN** what the merchant typed matches no option
- **THEN** the list says nothing matched and the action is shown with it


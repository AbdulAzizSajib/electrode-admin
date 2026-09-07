## Purpose

The behaviour every admin authoring page inherits from the panel shell: how page-level messages are surfaced and dismissed, and how form fields behave when a list is long, a field takes several values, or a choice is one of a short mutually exclusive set.

## ADDED Requirements

### Requirement: Page-level messages carry a severity and can be dismissed

An admin page SHALL be able to present a message above its content that is announced to assistive technology, that distinguishes informational, cautionary and failure severities from one another by more than colour alone, and that can carry a heading with supporting detail beneath it.

A message the operator can act on SHALL be dismissible; a message describing a condition still in force SHALL NOT be.

#### Scenario: A failure message is announced

- **WHEN** a page presents a failure message
- **THEN** assistive technology announces it without the operator having to move focus to it

#### Scenario: Severity is distinguishable without colour

- **WHEN** an informational and a failure message are presented
- **THEN** each carries an icon and wording that identify its severity, so the two are told apart with colour removed

#### Scenario: Dismissing a message

- **WHEN** a message is presented as dismissible and the operator dismisses it
- **THEN** it is removed and the rest of the page stays as it was

#### Scenario: A message describing an ongoing condition

- **WHEN** a message describes a condition the operator cannot resolve from this page
- **THEN** no dismiss control is offered

### Requirement: Long option lists are narrowable by typing

A form field choosing from a list that can grow beyond what fits on screen SHALL let the operator narrow the options by typing, and SHALL be fully operable from the keyboard: opening the list, moving through the narrowed options, choosing one, and closing without choosing.

Such a field SHALL distinguish "no options match what you typed", "the list has not arrived yet" and "there are none" from one another.

#### Scenario: Narrowing by typing

- **WHEN** the operator types into the field
- **THEN** only options matching what they typed are offered

#### Scenario: Keyboard operation

- **WHEN** the operator moves through the narrowed options with the arrow keys and confirms one
- **THEN** that option is selected and the list closes
- **AND** dismissing the list instead leaves the previous selection unchanged

#### Scenario: Nothing matches

- **WHEN** what the operator typed matches no option
- **THEN** the field says so, distinctly from saying the list is empty

#### Scenario: The list is still arriving

- **WHEN** the field's options are still being fetched
- **THEN** the field indicates that they are loading rather than presenting an empty list

### Requirement: Multi-value fields show and remove selections individually

A form field taking several values at once SHALL show each selected value separately, SHALL let any one of them be removed without disturbing the others, and SHALL indicate when nothing is selected.

#### Scenario: Selecting several values

- **WHEN** the operator selects three options
- **THEN** all three are shown as separate, individually removable selections

#### Scenario: Removing one selection

- **WHEN** the operator removes one selection
- **THEN** the other two are unchanged

#### Scenario: Nothing selected

- **WHEN** no value is selected
- **THEN** the field shows its placeholder rather than appearing broken or empty-labelled

### Requirement: Short mutually exclusive choices are one keyboard group

A field choosing exactly one option from a short, fixed set SHALL present all options at once, SHALL be reached by a single tab stop, and SHALL move between its options with the arrow keys. The group SHALL carry one accessible name covering all its options.

#### Scenario: Tabbing to the group

- **WHEN** the operator tabs to the field
- **THEN** focus lands on the group once, not once per option

#### Scenario: Choosing with the keyboard

- **WHEN** the operator presses an arrow key inside the group
- **THEN** the selection moves to the adjacent option

#### Scenario: The group is named

- **WHEN** assistive technology reads the field
- **THEN** the group is announced with the field's label, and each option with its own

### Requirement: Numeric fields accept an empty value distinctly from zero

A form field taking an optional number SHALL treat "left empty" and "zero" as different answers, and SHALL send neither in place of the other.

#### Scenario: An optional numeric field is left empty

- **WHEN** the operator leaves an optional numeric field empty and saves
- **THEN** the field is sent as unset, not as zero

#### Scenario: An optional numeric field is set to zero

- **WHEN** the operator enters 0 and saves
- **THEN** the field is sent as zero

#### Scenario: A negative value

- **WHEN** the operator enters a negative value in a field that does not accept one
- **THEN** the save is refused and the field is marked with the reason

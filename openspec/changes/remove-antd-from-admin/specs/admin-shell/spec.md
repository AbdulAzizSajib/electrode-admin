## Purpose

The behaviour every admin authoring page inherits from the panel shell: how page-level messages are surfaced and dismissed, and how form fields behave when a list is long, a field takes several values, or a choice is one of a short mutually exclusive set.

## ADDED Requirements

### Requirement: A repeatable group of fields is added to, removed from and reordered

A form section standing for a list of like things — gallery items, highlights, questions and answers, delivery areas — SHALL let the operator append a row, remove any single row, and move a row up or down within the list.

Row order SHALL be the authored order: the list is submitted in the order shown, and no position is derived from the content of a row.

Where a list must not fall below a number of rows, the removal control on the remaining rows SHALL be unavailable rather than removing a row the save would then be refused for. Where a list must not grow beyond a number of rows, the add control SHALL become unavailable at that number.

#### Scenario: Appending a row

- **WHEN** the operator adds a row to a repeatable group
- **THEN** an empty row appears at the end of the list and the rows above it keep the values already entered

#### Scenario: Removing a row from the middle

- **WHEN** the operator removes the second of three rows
- **THEN** that row is gone and the values in the first and third rows are unchanged

#### Scenario: Reordering

- **WHEN** the operator moves a row up
- **THEN** it swaps position with the row above, both rows keep their values, and the list submits in the order now shown

#### Scenario: The list is at its floor

- **WHEN** a list that requires at least one row has exactly one row left
- **THEN** that row offers no removal control

#### Scenario: The list is at its ceiling

- **WHEN** a list that accepts at most a fixed number of rows reaches that number
- **THEN** the control for adding a further row is unavailable

#### Scenario: Moving the end rows

- **WHEN** the first row is shown
- **THEN** it offers no "move up" action, and the last row offers no "move down" action

### Requirement: A validation failure belonging to a whole group is reported against the group

Some rules hold over a repeatable group rather than over any one row in it — that the group is not empty, or that a value is distinct across rows. Such a failure SHALL be reported against the group, in the group's own position on the page, and SHALL NOT be silently dropped because it belongs to no single field.

A refused save caused only by a group-level rule SHALL still leave every entered value on the page.

#### Scenario: The group is empty when it may not be

- **WHEN** the operator removes every row carrying a value from a group that requires at least one, and saves
- **THEN** the save is refused and the reason is shown against the group

#### Scenario: Two rows collide

- **WHEN** two rows in a group carry a value that must be distinct across the group and the operator saves
- **THEN** the save is refused, the reason names the collision, and both rows keep what was entered

#### Scenario: A group-level failure is visible

- **WHEN** a save is refused for a group-level rule
- **THEN** the message appears with the group rather than only in the page-level message above the form

### Requirement: Colour values are entered and shown as a hex code

A form field taking a colour SHALL let the operator pick one visually and SHALL also show the chosen value as a hex code, so a colour matched to a brand can be read off, copied and typed in exactly.

Entering a hex code directly SHALL set the same value as picking that colour.

#### Scenario: Picking a colour

- **WHEN** the operator picks a colour
- **THEN** the field shows the corresponding hex code alongside the colour

#### Scenario: Typing a hex code

- **WHEN** the operator types a valid hex code into the field
- **THEN** the shown colour updates to match and the stored value is that code

#### Scenario: The field has no colour yet

- **WHEN** a colour field has never been set
- **THEN** it presents as unset rather than as an arbitrary default colour, and saves as unset

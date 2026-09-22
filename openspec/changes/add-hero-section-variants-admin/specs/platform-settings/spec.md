## ADDED Requirements

### Requirement: An admin chooses the homepage hero's arrangement

An OWNER/ADMIN SHALL be able to choose the homepage hero's arrangement from the set the server offers, and SHALL make that choice on the screen where the hero's artwork is managed — the only screen that shows what an arrangement looks like.

Each option SHALL be presented with a **diagram of the arrangement**, not a name alone. Two arrangements can use the same artwork slots and differ only in where those slots sit, and no wording makes that difference legible.

The current arrangement SHALL be shown as selected whenever the screen is opened, and the panel MUST NOT substitute a default of its own: the server resolves every store's arrangement on read, and a second resolution here could disagree with the live storefront.

Choosing an arrangement SHALL write only that choice. It MUST NOT upload, delete, reorder or alter any artwork, and MUST NOT change which homepage sections are switched on or the order they render in.

#### Scenario: Admin opens the hero screen

- **WHEN** an OWNER/ADMIN opens the homepage hero screen
- **THEN** the arrangement the store is currently using is shown as selected
- **AND** every arrangement the server offers is presented with a diagram of it

#### Scenario: Admin changes the arrangement

- **WHEN** an OWNER/ADMIN selects a different arrangement and saves
- **THEN** the choice is persisted
- **AND** no banner is created, removed, reordered or edited

#### Scenario: Choosing an arrangement does not disturb the section list

- **WHEN** an OWNER/ADMIN changes the hero's arrangement
- **THEN** every homepage section's on/off state and the order of the list are unchanged

### Requirement: Artwork guidance matches the chosen arrangement

The artwork guidance this panel presents SHALL be derived from the **chosen** arrangement. That covers the recommended upload size beside each upload control, the aspect ratio of each empty slot placeholder, the "renders at" figure quoted for the store's own content width, the shape a dimension warning is checked against, and how many images a slot accepts.

Guidance MUST NOT be quoted from a different arrangement. A merchant told to export artwork for an arrangement their store does not use will produce files the storefront crops, and will have no way to tell the guidance was wrong.

Each arrangement's geometry SHALL be expressed as fractions of the content width and fixed aspect ratios, never as pixel dimensions measured at one width, so that a merchant who changes their content width is told a size that is still correct.

Dimension warnings SHALL remain **advisory**. Artwork that does not match the chosen arrangement's shape SHALL be described, with what will happen to it, and MUST NOT be blocked from upload.

#### Scenario: Guidance follows a change of arrangement

- **WHEN** an OWNER/ADMIN changes the hero's arrangement
- **THEN** the recommended upload sizes, the slot placeholder shapes and the per-slot capacities shown are those of the newly chosen arrangement

#### Scenario: Existing artwork no longer matches the new arrangement

- **WHEN** an arrangement is chosen whose slot shapes differ from artwork already uploaded
- **THEN** the panel warns that the artwork will be cropped and states the recommended size
- **AND** the artwork is neither removed nor rejected

#### Scenario: Content width changes

- **WHEN** a merchant changes the store's content width
- **THEN** the recommended upload size for each slot of the current arrangement is unchanged
- **AND** the "renders at" figure reflects the new width

### Requirement: The hero screen shows the chosen arrangement's shape

The hero screen SHALL lay its slots out as the **chosen** arrangement lays them out, so that a merchant can see which box they are editing. A store using a single wide panel MUST NOT be shown a grid of a panel and three tiles.

#### Scenario: A non-default arrangement is laid out

- **WHEN** an OWNER/ADMIN opens the hero screen for a store using the full-width-panel-above-three-tiles arrangement
- **THEN** the slots are drawn as one wide box above a row of three, at their true ratios

### Requirement: Artwork an arrangement does not render stays visible and is identified as unused

Artwork belonging to a slot the chosen arrangement does not render SHALL remain listed on the hero screen, editable and deletable, in a group identified as **not used by the current arrangement**.

It MUST NOT be hidden. The artwork is on file and the storefront will render it again unchanged if the store returns to an arrangement that uses it; a screen that simply stopped showing it would tell a merchant their uploads were destroyed, and the reasonable response to that is to upload them all again.

The panel SHALL state that the artwork is kept and will be used again if the arrangement changes back.

#### Scenario: Switching to an arrangement that uses fewer slots

- **WHEN** an OWNER/ADMIN switches to an arrangement that renders no tiles, and tile artwork is on file
- **THEN** that artwork is still listed, marked as not used by the current arrangement, and can still be edited or deleted

#### Scenario: Switching back

- **WHEN** an OWNER/ADMIN returns to an arrangement that uses a previously unused slot
- **THEN** that slot's artwork appears in its place, unchanged

#### Scenario: More artwork than the arrangement renders

- **WHEN** a slot holds more images than the chosen arrangement renders
- **THEN** the panel says how many will be shown and that the remainder will not, counted against the current arrangement's capacity

### Requirement: The homepage section list points at where the hero's arrangement is set

The screen that manages the homepage section list SHALL name the hero's current arrangement on the hero's row and link to the screen where it is chosen. A merchant looking for the setting where the rest of the homepage's layout is configured MUST find a pointer rather than nothing.

That screen MUST NOT offer the choice itself, so that there is one place the setting is made.

#### Scenario: Admin looks for the setting on the section list

- **WHEN** an OWNER/ADMIN opens the homepage section list
- **THEN** the hero's row names the current arrangement and links to the hero screen
- **AND** the arrangement cannot be changed from that row

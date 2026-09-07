## Purpose

How the admin panel lets a merchant author a product: one scrolling page holding the product's copy, organization, pricing, facts, specifications, variants and media, with the guarantees that stop a save from destroying data the form never managed to load.

## ADDED Requirements

### Requirement: A refused save keeps every entered value and says why

The product authoring page SHALL, when a save is refused for any reason, leave every value the merchant entered exactly as it was and present the reason at the top of the form. The page SHALL NOT navigate away from a save that did not succeed.

The page is seven cards tall and its save controls sit in the header, so a message rendered only beside the offending field is not sufficient: the page SHALL both summarise the failure at the top and bring the first offending field into view with focus.

#### Scenario: A required field below the fold is empty

- **WHEN** the merchant presses a save control while a required field further down the page is empty
- **THEN** a message at the top of the form states how many fields need attention
- **AND** the first offending field is scrolled into view and focused
- **AND** every other value on the page is unchanged

#### Scenario: Exactly one field is invalid

- **WHEN** a save is refused because a single field is invalid
- **THEN** the message at the top names that field's own validation message rather than a count

#### Scenario: The server refuses the save

- **WHEN** the request is rejected by the server
- **THEN** the server's reason appears at the top of the form
- **AND** nothing on the page is reset, and the merchant stays on the page

#### Scenario: The merchant dismisses the message

- **WHEN** the merchant dismisses the failure message
- **THEN** it is removed and the form remains fully editable

### Requirement: A save that succeeded decides where the merchant lands

The page SHALL offer a save that returns to the product list and a save that stays on the page, and SHALL act on either only after the request has succeeded. A create that stays SHALL continue as the edit form for the product just created, so pressing save again updates it rather than creating a second product.

#### Scenario: Create and continue editing

- **WHEN** a create succeeds from the save-and-continue control
- **THEN** the merchant stays on the page, now editing the created product
- **AND** the sections gated on the product existing become available without navigating away

#### Scenario: Save and return

- **WHEN** a save succeeds from the save-and-return control
- **THEN** the merchant is taken to the product list

#### Scenario: Save and return is refused

- **WHEN** a save from the save-and-return control is refused
- **THEN** the merchant stays on the page with their values and the reason intact

### Requirement: A product that cannot be loaded is never presented as an editable form

When the page is opened for an existing product and that product cannot be read, the page SHALL present the load failure and a way back to the product list, and SHALL NOT render empty fields under an edit heading.

The page submits images, variants, options, collections and keywords as the complete intended set, so an empty form saved over a real product deletes all of them.

#### Scenario: The product fails to load

- **WHEN** the product detail request fails on an edit route
- **THEN** the page shows that the product could not be loaded, with the reason
- **AND** no editable fields and no save controls are offered
- **AND** a control returns the merchant to the product list

### Requirement: A save that would delete images the form never loaded is refused

The page SHALL refuse to save an existing product when that product has images on record and the form is holding none, and SHALL say that saving would delete them.

Removing the last image deliberately SHALL remain possible through the gallery's own remove control.

#### Scenario: The gallery failed to populate

- **WHEN** the merchant saves an existing product that has images on record while the form holds no image rows
- **THEN** the save is refused with a message that saving would delete them and to reload the page
- **AND** no request is sent

#### Scenario: The merchant removed the last image on purpose

- **WHEN** the merchant removes every image using the gallery's remove control and saves
- **THEN** the save proceeds and the product is left with no images

### Requirement: Reference lists that fail to load are named

The page SHALL distinguish a reference list that is still arriving, one that failed, and one that is genuinely empty. When one or more lists fail, the page SHALL name which ones and say that a product cannot be saved without a category, brand and tax rule.

#### Scenario: Two reference lists fail

- **WHEN** the brands and tax rules requests both fail
- **THEN** a warning names both — "Could not load brands and tax rules"
- **AND** it states that those fields stay empty until the lists load

#### Scenario: A reference list is still loading

- **WHEN** a reference list request is in flight
- **THEN** its field indicates that options are still arriving rather than presenting an empty list

### Requirement: Reference pickers are narrowable and clearable

Brand, tax rule and bundle deal SHALL each let the merchant narrow the options by typing. Collections SHALL accept several values at once and let each be removed individually. Bundle deal SHALL be clearable back to no offer, and clearing it SHALL be sent as an explicit clear rather than as an omitted field.

#### Scenario: Narrowing a long list

- **WHEN** the merchant types into the brand picker
- **THEN** only options matching what they typed are offered

#### Scenario: Several collections

- **WHEN** the merchant selects three collections
- **THEN** all three are shown as individually removable selections
- **AND** the product keeps its category regardless of which collections it joins

#### Scenario: Clearing the bundle deal

- **WHEN** the merchant clears a bundle deal that was previously set and saves
- **THEN** the product is saved with no bundle deal

### Requirement: Keywords are reused rather than reinvented

The keyword field SHALL offer keywords the shop already uses as the merchant types, and SHALL accept a keyword that matches no suggestion. Keywords SHALL be collapsed by exact, case-insensitive comparison so a product carries each once, keeping the first spelling used. Removal SHALL affect only the keyword removed.

#### Scenario: An existing keyword is suggested

- **WHEN** the merchant types "wire"
- **THEN** keywords the shop already uses that match are offered
- **AND** keywords already on this product are not offered

#### Scenario: A new keyword is added

- **WHEN** the merchant types a keyword matching no suggestion and confirms it
- **THEN** it is added as typed

#### Scenario: A case-insensitive repeat

- **WHEN** "Wireless" is added to a product already carrying "wireless"
- **THEN** the product carries one keyword, spelled as it was first entered

#### Scenario: Removing one keyword does not remove another

- **WHEN** the merchant removes "less" from a product also carrying "wireless"
- **THEN** "wireless" remains

### Requirement: The product code mirrors the name until the merchant sets one

On a new product the code SHALL be filled from the name as a slug and SHALL stop doing so the moment the merchant types their own code. A control SHALL rebuild the code from the name on demand. When editing an existing product the saved code is authoritative and SHALL NOT be overwritten by the name.

#### Scenario: Typing the name fills the code

- **WHEN** the merchant types a product name on a new product and has not typed a code
- **THEN** the code field holds the slugified name
- **AND** any outstanding "code is required" message is cleared

#### Scenario: The merchant types their own code

- **WHEN** the merchant edits the code field
- **THEN** later changes to the name leave the code alone

#### Scenario: Rebuilding the code with no name

- **WHEN** the merchant asks to rebuild the code while the name is empty
- **THEN** they are told to enter a product name first and the code is unchanged

### Requirement: Product facts record three states, not two

Refundable and Warranty SHALL each record yes, no, or not stated, and SHALL default to not stated. A fact left unstated SHALL NOT be presented to shoppers as an empty label.

#### Scenario: A fact is left unstated

- **WHEN** the merchant saves a product without answering Refundable
- **THEN** the product records that it is not stated, distinctly from "No"

#### Scenario: Answering a fact

- **WHEN** the merchant selects "No" for Warranty
- **THEN** the product records that it has no warranty

### Requirement: The inventory half is gated on the product existing

Attribute selection, the combination table and the gallery each attach to a product, so they SHALL be offered only once the product exists. Before that the page SHALL explain that they become available after saving rather than presenting controls that cannot work.

#### Scenario: A product being created

- **WHEN** the page is open on a new product
- **THEN** the variants and gallery sections explain that they become available once the product is saved
- **AND** no disabled or non-functioning controls are shown in their place

#### Scenario: The product exists

- **WHEN** the page is open on an existing product
- **THEN** attribute selection, the combination table and the gallery are all available

### Requirement: Combinations that cannot be carried over are confirmed before they are lost

Changing which attribute values a product sells SHALL carry every surviving combination over whole, keeping its code, prices and stock. When a change cannot carry combinations over, the page SHALL describe what would be lost and SHALL apply nothing until the merchant agrees.

#### Scenario: A change that carries over cleanly

- **WHEN** the merchant ticks an additional size
- **THEN** the new combinations appear and every existing combination keeps its code, prices and stock

#### Scenario: A change that would drop a combination it cannot place

- **WHEN** a selection change leaves an existing combination that matches nothing in the new table by either its values or its name — such as the single default row of a product that previously sold no attributes
- **THEN** the page names what cannot be carried over, says so explicitly when any of it holds stock, and asks the merchant to confirm
- **AND** neither the selection nor the table changes until they do

#### Scenario: A value is deliberately unticked

- **WHEN** the merchant unticks a value whose own combination exists, so that combination is deliberately deselected
- **THEN** the change applies without a confirmation, because the merchant has just said what they want removed
- **AND** media attached to that combination is released

#### Scenario: The merchant declines

- **WHEN** the merchant declines the confirmation
- **THEN** the selection and the combination table are exactly as they were

#### Scenario: The merchant confirms

- **WHEN** the merchant confirms
- **THEN** the selection and table are updated, and media attached to a removed combination is released

### Requirement: Media attached to a removed combination is released

When a combination disappears, nothing in the form SHALL still point at it. Files picked inside a combination row depict that combination and SHALL be discarded with it, with the merchant told how many were dropped. An image row entered by URL SHALL be released to the product as a whole rather than discarded.

#### Scenario: A combination with picked files is removed

- **WHEN** a combination holding two picked files is removed
- **THEN** those two files are dropped and the merchant is told two variant images were removed
- **AND** the form submits no reference to the removed combination

#### Scenario: A combination with a URL image is removed

- **WHEN** a combination is removed while an image row entered by URL is assigned to it
- **THEN** that image row is reassigned to the product as a whole and its address is kept

### Requirement: Exactly one image ends up primary

Every saved product SHALL have exactly one primary image whenever it has any image at all, counting both images entered by URL and files picked in this session. Making one image primary SHALL clear the primary flag from every other, across both.

#### Scenario: The merchant marked no primary and URL rows exist

- **WHEN** the product is saved with images but none marked primary
- **THEN** the first image row is saved as primary

#### Scenario: The merchant marked no primary and only picked files exist

- **WHEN** the product is saved with no image rows and one or more picked files, none marked primary
- **THEN** a picked file belonging to the product as a whole is saved as primary, falling back to the first picked file

#### Scenario: Starring an image

- **WHEN** the merchant stars an image row
- **THEN** it becomes primary and no picked file remains marked primary

### Requirement: Stock is displayed on the authoring page but never set there

Product and variant stock SHALL be shown read-only. The page SHALL NOT offer a control that writes a stock quantity, and SHALL say that stock moves when a purchase order is received or stock is adjusted.

#### Scenario: Stock on an existing product

- **WHEN** the page is open on an existing product
- **THEN** its stock across all warehouses is shown as text with no control to edit it
- **AND** the page states that stock moves through receiving or adjustment

#### Scenario: Stock on a combination row

- **WHEN** the combination table is shown
- **THEN** each row's stock is displayed and cannot be typed into

#### Scenario: A product being created

- **WHEN** the page is open on a new product
- **THEN** stock reads zero, described as such until stock is received

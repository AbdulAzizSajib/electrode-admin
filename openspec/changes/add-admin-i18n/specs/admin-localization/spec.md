## Purpose

Governs the language the admin panel presents its interface in: how a staff member chooses it, how that choice survives leaving and returning, what is shown when a translation has not been written yet, and — as binding as the rest — which parts of the panel the choice deliberately does not affect.

## ADDED Requirements

### Requirement: The Panel Is Readable In Either English Or Bangla

The panel SHALL present its interface text in one of two languages, English or Bangla, and SHALL present the whole interface in a single language at a time. It SHALL NOT mix the two within one screen, except where a specific requirement below permits a fallback.

Interface text means the words the panel itself supplies: navigation, headings, field labels, buttons, placeholders, status descriptions, confirmations and messages.

#### Scenario: Reading the panel in Bangla

- **WHEN** a staff member has selected Bangla and opens any screen covered by this change
- **THEN** the panel's own text on that screen reads in Bangla

#### Scenario: Reading the panel in English

- **WHEN** a staff member has selected English and opens the same screen
- **THEN** the panel's own text on that screen reads in English

### Requirement: English Is What An Unconfigured Panel Shows

A staff member who has never chosen a language SHALL see the panel in English.

The panel SHALL NOT infer the language from the browser, the operating system, or the network. A staff member whose browser is configured for Bangla but who has made no choice in this panel SHALL still see English, because a browser's language setting states what its owner can read, not what this shared operations tool should display.

#### Scenario: First use

- **WHEN** a staff member opens the panel for the first time and has never chosen a language
- **THEN** the panel is in English

#### Scenario: A Bangla browser does not decide

- **WHEN** a staff member whose browser prefers Bangla opens the panel without ever having chosen a language
- **THEN** the panel is in English

### Requirement: The Language Is Chosen From Within The Panel

The panel SHALL offer a control, reachable from every authenticated screen, that shows which language is active and allows switching to the other.

Switching SHALL take effect immediately across the interface, without reloading the page and without navigating away from the current screen. Work in progress SHALL survive the switch: a part-filled form SHALL keep every value already entered, and SHALL NOT be validated or submitted as a consequence of the switch.

#### Scenario: Switching language

- **WHEN** a staff member activates the language control and selects the other language
- **THEN** the interface text changes to that language at once, on the screen they are already on

#### Scenario: Switching while filling a form

- **WHEN** a staff member switches language while a form holds unsaved entries
- **THEN** the labels change language, every entered value remains, and no validation error is raised by the switch

### Requirement: The Chosen Language Is Remembered

Once chosen, the language SHALL persist across page reloads and across sessions on that browser, until it is changed again.

The choice SHALL be restored before the interface is first painted, so a staff member who has chosen Bangla SHALL NOT see English text appear and then change.

#### Scenario: Returning later

- **WHEN** a staff member who selected Bangla closes the panel and opens it again
- **THEN** the panel is in Bangla without their having to choose again

#### Scenario: No flash of the previous language

- **WHEN** a staff member who selected Bangla reloads the page
- **THEN** the first painted interface is already in Bangla

### Requirement: Untranslated Text Falls Back To English

Where a piece of interface text has no translation in the active language, the panel SHALL display the English text for it.

It SHALL NOT display an empty space, an internal identifier, or a placeholder. A screen whose translation is incomplete SHALL remain fully usable, every control still labelled and operable.

This fallback is what makes a phased translation safe; it is not licence to leave text untranslated indefinitely.

#### Scenario: A missing translation

- **WHEN** a staff member using Bangla opens a screen whose text has not yet been translated
- **THEN** that text reads in English, and every control on the screen is labelled and usable

#### Scenario: An internal identifier is never shown

- **WHEN** interface text is requested that exists in neither language
- **THEN** the panel does not display an internal identifier or an empty label in its place

### Requirement: Components The Panel Does Not Author Follow The Same Language

Interface text supplied by component libraries rather than written in this panel — the words inside date pickers, selection lists, tables and their empty and loading states — SHALL follow the active language along with everything else.

A staff member SHALL NOT encounter a screen whose headings are Bangla and whose calendar or empty-state text is English.

#### Scenario: A date picker in Bangla

- **WHEN** a staff member using Bangla opens a date picker
- **THEN** its month names, weekday names and controls read in Bangla

#### Scenario: An empty table in Bangla

- **WHEN** a staff member using Bangla views a table with no rows
- **THEN** its empty-state text reads in Bangla

### Requirement: Numbers, Money And Dates Are Unaffected By The Language

The language setting SHALL govern words only. It SHALL NOT change how a quantity, a monetary amount, a percentage or a date is written.

Specifically, in both languages:

- Digits SHALL be Western (`1,200`), never Bangla-Indic (`১,২০০`).
- Digit grouping and decimal separators SHALL be unchanged by the language.
- A monetary amount SHALL keep the symbol, symbol position and decimal count the merchant configured in store settings, which are settings of the shop and not of the reader.
- A date SHALL keep its existing numeric and month-abbreviation form.

This is a deliberate constraint, not an unfinished translation. Staff read financial figures in Western digits, and figures copied out of the panel into a spreadsheet must remain parseable as numbers.

#### Scenario: A figure in the Bangla interface

- **WHEN** a staff member using Bangla views an amount of one thousand two hundred taka
- **THEN** it is written with Western digits and the merchant's configured currency symbol and position, exactly as it is written in the English interface

#### Scenario: Currency settings still win

- **WHEN** the merchant has configured the currency symbol to trail the amount
- **THEN** it trails in both languages, unchanged by the language setting

#### Scenario: A date in the Bangla interface

- **WHEN** a staff member using Bangla views a record's date
- **THEN** the date is written in the same form as in the English interface

### Requirement: Merchant Content And Server Text Are Not Translated

The panel SHALL NOT translate values that are data rather than interface: product names, category names, brand names, customer names, addresses, and text the merchant has authored.

Such values SHALL be displayed as stored, in whatever language the merchant entered them, in both interface languages.

Where the panel presents a coded value from the server — an order status, a payment state — under its own display label, that label SHALL follow the active language. The underlying coded value SHALL NOT be altered, and SHALL remain what is sent back to the server.

#### Scenario: A product name is left alone

- **WHEN** a staff member using Bangla views a product whose name the merchant entered in English
- **THEN** the name is displayed in English, unchanged

#### Scenario: A status label follows the language

- **WHEN** a staff member using Bangla views an order the server reports as pending
- **THEN** the panel describes it in Bangla, and the value it sends back when acting on that order is unchanged

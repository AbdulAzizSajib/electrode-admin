## ADDED Requirements

### Requirement: Catalog Display Feature Editor

The system SHALL let an administrator turn each of the storefront's catalog display features — the wishlist, product comparison, and quick view — on or off, independently of one another, and SHALL save those choices to the backend.

For each feature the system SHALL state what the storefront does when it is turned off, so the administrator can predict the effect before saving rather than after. Where turning a feature off changes where a shopper is taken rather than merely removing something, that destination SHALL be stated.

The editor SHALL show each feature's currently saved state on load, and SHALL NOT present a default as though it were a saved choice once the record has loaded.

#### Scenario: Turn off product comparison

- **WHEN** the administrator turns comparison off and saves
- **THEN** the change is sent to the backend and the page reflects the saved state on success
- **AND** the wishlist and quick view settings are unchanged

#### Scenario: Effect of each switch is stated

- **WHEN** the administrator views the editor
- **THEN** each feature carries a description of what the storefront does when that feature is off
- **AND** the quick view description states that a product with variants leads to its full product page instead

#### Scenario: Saved state is shown on load

- **WHEN** the administrator opens the editor for a store that has previously turned the wishlist off
- **THEN** the wishlist switch reads as off

#### Scenario: Rejected save

- **WHEN** the backend rejects the save
- **THEN** the system shows the backend's message and the administrator's unsaved edits are preserved rather than discarded

### Requirement: Catalog Display Settings Save Without Disturbing Other Settings

Saving the catalog display features SHALL leave every other store setting as it was, including the checkout configuration, theme, navigation, footer, social links, announcement bar, and newsletter — none of which this editor presents.

An administrator SHALL be warned before navigating away from unsaved changes to these settings.

#### Scenario: Save on a fully configured store

- **WHEN** the administrator saves the catalog display features on a store whose checkout configuration and theme are populated
- **THEN** the catalog display features are updated
- **AND** the checkout configuration and theme remain intact

#### Scenario: Navigating away with unsaved changes

- **WHEN** the administrator changes a switch and then navigates to another screen without saving
- **THEN** the system warns them before leaving
